import { createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Pool, PoolClient } from "pg";
import { pool } from "@/db";
import { EntryError, canonicalEntryCommand } from "@/domain/entries";
import {
  crawlerTranslatorVersion,
  sourceKey,
  translateCrawlerGame,
  type JsonRecord,
} from "@/domain/crawler-import";
import { isAdministrator } from "@/modules/identity/authority";
import { assessmentProducer } from "@/modules/rankings/assessment-queue";
export const importQueue = "historical-import-stage";
const sha = (v: string | Buffer) =>
  createHash("sha256").update(v).digest("hex");
async function authorize(c: Pick<PoolClient, "query">, actor: string) {
  if (!(await isAdministrator(c, actor)))
    throw new EntryError(
      "World Curling administrator access is required for historical staging.",
      403,
    );
}
async function fileDigest(path: string) {
  const h = createHash("sha256");
  let size = 0;
  for await (const b of createReadStream(path)) {
    size += b.length;
    if (size > 256 * 1024 * 1024)
      throw new EntryError("Export exceeds the bounded staging size.");
    h.update(b);
  }
  return h.digest("hex");
}
async function source() {
  const path = process.env.CRAWLER_IMPORT_EXPORT;
  if (!path) return { available: false, digest: null };
  try {
    return { available: true, digest: await fileDigest(path) };
  } catch {
    return { available: false, digest: null };
  }
}
async function audit(
  c: PoolClient,
  actor: string,
  id: string,
  action: string,
  evidence: unknown,
) {
  const receipt = randomUUID();
  await c.query(
    "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
    [receipt, actor, action, id],
  );
  await c.query(
    "INSERT INTO import_attempt(id,job_id,actor_id,action,evidence) VALUES($1,$2,$3,$4,$5)",
    [receipt, id, actor, action, JSON.stringify(evidence)],
  );
}
export async function stageImport(actor: string, raw: unknown) {
  const v = raw as JsonRecord;
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    !["stage", "retry"].includes(v.action) ||
    typeof v.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(v.id) ||
    typeof v.sourceDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.sourceDigest) ||
    (v.action === "retry" &&
      (typeof v.requestId !== "string" ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(v.requestId))) ||
    Object.keys(v).some(
      (k) => !["id", "action", "sourceDigest", "requestId"].includes(k),
    )
  )
    throw new EntryError(
      "Provide an import identifier, stage/retry action and the exact reviewed source digest. Each deliberate retry requires a new request identifier.",
    );
  await authorize(pool, actor);
  const producer = await assessmentProducer();
  await producer.createQueue(importQueue);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await authorize(c, actor);
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `import:${v.id}`,
    ]);
    const existing = (
      await c.query("SELECT * FROM import_job WHERE id=$1 FOR UPDATE", [v.id])
    ).rows[0];
    const requestId = v.requestId ?? v.id,
      commandDigest = sha(canonicalEntryCommand(v));
    const receipt = (
      await c.query("SELECT * FROM import_command WHERE request_id=$1", [
        requestId,
      ])
    ).rows[0];
    if (receipt) {
      if (
        receipt.actor_id !== actor ||
        receipt.command_digest !== commandDigest ||
        receipt.job_id !== v.id
      )
        throw new EntryError(
          "Import request identifier belongs to another command.",
          409,
        );
      await c.query("COMMIT");
      return { id: v.id };
    }
    if (existing) {
      if (existing.actor_id !== actor || existing.digest !== v.sourceDigest)
        throw new EntryError(
          "Import identifier belongs to a different frozen command.",
          409,
        );
      if (v.action === "retry" && existing.status !== "failed")
        throw new EntryError(
          "Only a failed staging job can start a new retry. Refresh its recorded state.",
          409,
        );
      if (v.action === "stage") {
        await c.query("COMMIT");
        return { id: v.id };
      }
    } else {
      if (v.action !== "stage")
        throw new EntryError("Import job not found.", 404);
      const path = process.env.CRAWLER_IMPORT_EXPORT;
      if (!path)
        throw new EntryError(
          "No consistent export is configured by the operator.",
          503,
        );
      let actual: string;
      try {
        actual = await fileDigest(path);
      } catch {
        throw new EntryError("The configured export is unavailable.", 503);
      }
      if (actual !== v.sourceDigest)
        throw new EntryError(
          "The configured export changed. Refresh and review its identity.",
          409,
        );
      await c.query(
        "INSERT INTO import_job(id,actor_id,source_path,digest,status) VALUES($1,$2,$3,$4,'queued')",
        [v.id, actor, resolve(path), v.sourceDigest],
      );
    }
    if (existing)
      await c.query(
        "UPDATE import_job SET status='queued',error=NULL,updated_at=now() WHERE id=$1",
        [v.id],
      );
    await c.query(
      "INSERT INTO import_command(request_id,job_id,actor_id,command_digest) VALUES($1,$2,$3,$4)",
      [requestId, v.id, actor, commandDigest],
    );
    await audit(
      c,
      actor,
      v.id,
      existing ? "import_retry_queued" : "import_stage_queued",
      { digest: v.sourceDigest, requestId },
    );
    await producer.send(
      importQueue,
      { importId: v.id },
      {
        retryLimit: 3,
        retryDelay: 5,
        expireInSeconds: 300,
        db: { executeSql: (text, values) => c.query(text, values) },
      },
    );
    await c.query("COMMIT");
    return { id: v.id };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function importWorkspace(
  actor: string,
  jobId?: string,
  recordKey?: string,
) {
  await authorize(pool, actor);
  if (!jobId)
    return {
      actorId: actor,
      source: await source(),
      jobs: (
        await pool.query(
          `SELECT id,digest,status,attempts,unique_games AS "uniqueGames",issue_count AS "issueCount",created_at AS "createdAt" FROM import_job ORDER BY created_at DESC LIMIT 100`,
        )
      ).rows,
    };
  const job = (
    await pool.query(
      `SELECT id,actor_id AS "actorId",digest,status,attempts,source_records AS "sourceRecords",evidence_records AS "evidenceRecords",unique_games AS "uniqueGames",issue_count AS "issueCount",manifest,error,created_at AS "createdAt",updated_at AS "updatedAt" FROM import_job WHERE id=$1`,
      [jobId],
    )
  ).rows[0];
  if (!job) throw new EntryError("Import job not found.", 404);
  if (recordKey) {
    const record = (
      await pool.query(
        'SELECT source_key AS key,kind,payload,preview,line_digest AS "lineDigest",source_line AS "sourceLine",ordinal FROM import_record WHERE job_id=$1 AND source_key=$2',
        [jobId, recordKey],
      )
    ).rows[0];
    if (!record) throw new EntryError("Frozen record not found.", 404);
    return record;
  }
  const games = (
    await pool.query(
      "SELECT preview FROM import_record WHERE job_id=$1 AND kind='game' ORDER BY source_key LIMIT 100",
      [jobId],
    )
  ).rows.map((r) => r.preview);
  const keys = games.flatMap((g) => g.entryIds);
  const labels = Object.fromEntries(
    (
      await pool.query(
        "SELECT source_key,payload->>'display_name' AS display_name FROM import_record WHERE job_id=$1 AND source_key=ANY($2::text[])",
        [jobId, keys],
      )
    ).rows.map((r) => [r.source_key, r.display_name]),
  );
  return {
    job,
    games: games.map((g) => ({
      ...g,
      entryNames: g.entryIds.map((id: string) => labels[id] ?? id),
    })),
    issues: (
      await pool.query(
        'SELECT source_key AS "sourceKey",code,detail FROM import_issue WHERE job_id=$1 ORDER BY source_key,code LIMIT 1000',
        [jobId],
      )
    ).rows,
    records: (
      await pool.query(
        'SELECT source_key AS key,kind,line_digest AS "lineDigest" FROM import_record WHERE job_id=$1 ORDER BY kind,source_key LIMIT 1000',
        [jobId],
      )
    ).rows,
    attempts: (
      await pool.query(
        'SELECT action,evidence,created_at AS "createdAt" FROM import_attempt WHERE job_id=$1 ORDER BY created_at,id',
        [jobId],
      )
    ).rows,
  };
}
async function* lines(path: string) {
  let pending = "",
    bytes = 0;
  const hash = createHash("sha256");
  const stream = createReadStream(path, { encoding: "utf8" });
  for await (const chunk of stream) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 256 * 1024 * 1024)
      throw new EntryError("Export exceeds the bounded staging size.");
    hash.update(chunk);
    pending += chunk;
    let at: number;
    while ((at = pending.indexOf("\n")) !== -1) {
      if (at > 2 * 1024 * 1024)
        throw new EntryError("Export record exceeds the staging limit.");
      const line = pending.slice(0, at);
      pending = pending.slice(at + 1);
      if (!line) throw new EntryError("Empty export record.");
      yield { line, digest: null };
    }
    if (pending.length > 2 * 1024 * 1024)
      throw new EntryError("Export record exceeds the staging limit.");
  }
  if (pending) throw new EntryError("Export must end with a newline.");
  yield { line: null, digest: hash.digest("hex") };
}
export async function processImport(database: Pool, id: string) {
  const c = await database.connect();
  let actor: string | undefined;
  try {
    await c.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [
      `import-worker:${id}`,
    ]);
    await c.query("BEGIN");
    const start = (
      await c.query("SELECT * FROM import_job WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (!start || start.status === "staged" || start.status === "failed") {
      await c.query("COMMIT");
      return;
    }
    actor = start.actor_id;
    await authorize(c, actor!);
    await c.query(
      "UPDATE import_job SET status='running',attempts=attempts+1,updated_at=now() WHERE id=$1",
      [id],
    );
    await audit(c, actor!, id, "import_stage_started", {
      digest: start.digest,
    });
    await c.query("COMMIT");
    await c.query("BEGIN");
    const job = (
      await c.query("SELECT * FROM import_job WHERE id=$1 FOR UPDATE", [id])
    ).rows[0];
    if (job.status === "staged") {
      await c.query("COMMIT");
      return;
    }
    await authorize(c, actor!);
    let count = 0,
      sourceRecords = 0,
      evidenceRecords = 0,
      games = 0,
      issues = 0,
      manifest: JsonRecord | undefined;
    const interpretations = new Map<string, JsonRecord>();
    const sourceKeys = new Set<string>();
    for await (const item of lines(job.source_path)) {
      if (item.digest) {
        if (item.digest !== job.digest)
          throw new EntryError(
            "Export changed after this job was queued; no batch was staged.",
          );
        continue;
      }
      if (++count > 100000) throw new EntryError("Too many export records.");
      let row: JsonRecord;
      try {
        row = JSON.parse(item.line!);
      } catch {
        throw new EntryError(`Malformed JSON at export record ${count}.`);
      }
      if (
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        typeof row.key !== "string" ||
        row.key.length > 200 ||
        !row.payload ||
        typeof row.payload !== "object" ||
        Array.isArray(row.payload)
      )
        throw new EntryError(`Malformed export envelope at record ${count}.`);
      const p = row.payload,
        codes: string[] = [];
      let preview: unknown = null;
      if (sourceKeys.has(row.key))
        throw new EntryError("Duplicate scoped source key in the export.");
      sourceKeys.add(row.key);
      if (count === 1) {
        if (
          row.kind !== "manifest" ||
          p.format !== "wcp-crawler-representative-export-v1" ||
          typeof p.sourceSchemaVersion !== "string" ||
          !p.sourceRevisionMetadata ||
          p.sourceRevisionMetadata.schema_version !== p.sourceSchemaVersion ||
          p.sourceRevisionMetadata.generation_id !== p.generation ||
          !Number.isInteger(p.revision) ||
          typeof p.generation !== "string" ||
          !p.sourceDigests ||
          ![
            "snapshot",
            "registry",
            "manifest",
            "hammer_proof",
            "hammer_html",
          ].every((k) => /^[a-f0-9]{64}$/.test(p.sourceDigests[k]))
        )
          throw new EntryError(
            "A versioned, digest-bound source manifest is required first.",
          );
        manifest = p;
      } else if (row.kind === "raw_body") {
        if (
          p.encoding !== "base64" ||
          typeof p.body !== "string" ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(p.body) ||
          !Array.isArray(p.sourceScope)
        )
          throw new EntryError("Malformed retained source body.");
        const body = Buffer.from(p.body, "base64");
        if (
          body.toString("base64") !== p.body ||
          body.length !== p.bodyBytes ||
          sha(body) !== p.bodySha256
        )
          throw new EntryError("Retained source body digest mismatch.");
        sourceKey(p.gameId, "game");
      } else if (row.kind === "interpretation") {
        if (row.key !== p.id || interpretations.has(p.gameId))
          throw new EntryError("Duplicate or mismatched interpretation.");
        interpretations.set(p.gameId, p);
      } else if (["game", "event", "entry", "person"].includes(row.kind)) {
        sourceKey(row.key, row.kind);
        if (p.id !== row.key)
          throw new EntryError("Source envelope key differs from its payload.");
        if (
          !Array.isArray(p.evidence_ids) ||
          p.evidence_ids.some((v: unknown) => typeof v !== "string") ||
          !p.field_evidence ||
          typeof p.field_evidence !== "object" ||
          Array.isArray(p.field_evidence) ||
          Object.values(p.field_evidence).some(
            (v) => !Array.isArray(v) || v.some((x) => typeof x !== "string"),
          ) ||
          !p.missing ||
          typeof p.missing !== "object" ||
          Array.isArray(p.missing) ||
          Object.values(p.missing).some((v) => typeof v !== "string")
        )
          throw new EntryError(
            "Source record is missing provenance containers.",
          );
        sourceRecords++;
        if (row.kind === "game") {
          preview = translateCrawlerGame(p, interpretations.get(row.key));
          codes.push(...(preview as JsonRecord).issues);
          games++;
        } else if (row.kind === "entry") {
          sourceKey(p.event_id, "event");
          if (p.event_id.split(":")[3] !== row.key.split(":")[3])
            throw new EntryError("Entry parent scope mismatch.");
          codes.push("core_identity_unresolved");
        } else if (row.kind === "person")
          codes.push("player_identity_unresolved");
        else if (p.discipline == null) codes.push("discipline_unknown");
      } else if (row.kind === "evidence") {
        if (
          p.source !== "cz" ||
          !Array.isArray(p.source_scope) ||
          (p.url !== null &&
            (typeof p.url !== "string" ||
              !/^https:\/\/(www|home)\.curlingzone\.com\//.test(p.url))) ||
          !Number.isFinite(Date.parse(p.last_successful_observed_at))
        )
          throw new EntryError("Malformed source evidence provenance.");
        evidenceRecords++;
        if (p.extraction_version == null)
          codes.push("historical_parser_unknown");
        if (p.url === null) codes.push("source_url_unknown");
      } else throw new EntryError("Unsupported export record kind.");
      await c.query(
        "INSERT INTO import_record(job_id,source_key,kind,source_line,line_digest,payload,preview,ordinal) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          row.key,
          row.kind,
          item.line,
          sha(item.line!),
          JSON.stringify(p),
          preview ? JSON.stringify(preview) : null,
          count,
        ],
      );
      for (const code of new Set(codes)) {
        await c.query(
          "INSERT INTO import_issue(job_id,source_key,code,detail) VALUES($1,$2,$3,$4)",
          [
            id,
            row.key,
            code,
            `Retained source uncertainty: ${code.replaceAll("_", " ")}. No canonical resolution or certification applied.`,
          ],
        );
        issues++;
      }
    }
    if (!manifest || !games)
      throw new EntryError("The representative export has no games.");
    for (const interpretation of interpretations.values()) {
      const body = (
        await c.query(
          "SELECT payload FROM import_record WHERE job_id=$1 AND kind='raw_body' AND payload->>'gameId'=$2 AND payload->>'bodySha256'=$3",
          [id, interpretation.gameId, interpretation.bodySha256],
        )
      ).rows[0];
      if (
        !body ||
        body.payload.observedAt !== interpretation.observedAt ||
        canonicalEntryCommand(body.payload.sourceScope) !==
          canonicalEntryCommand(
            interpretation.supportingInterpretation?.verifiedSourceScope,
          )
      )
        throw new EntryError(
          "Reported hammer interpretation lacks its exact retained scoped body.",
        );
    }
    const missing = await c.query(
      `SELECT r.source_key FROM import_record r CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(r.payload->'evidence_ids','[]'::jsonb)) e(key) WHERE r.job_id=$1 AND NOT EXISTS(SELECT 1 FROM import_record x WHERE x.job_id=r.job_id AND x.kind='evidence' AND x.source_key=e.key) LIMIT 1`,
      [id],
    );
    if (missing.rowCount)
      throw new EntryError(
        "Selected source evidence is missing from the export.",
      );
    const orphan = await c.query(
      `SELECT r.source_key FROM import_record r WHERE r.job_id=$1 AND r.kind='game' AND (NOT EXISTS(SELECT 1 FROM import_record e WHERE e.job_id=r.job_id AND e.kind='event' AND e.source_key=r.payload->>'event_id') OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(r.payload->'entry_ids') k WHERE NOT EXISTS(SELECT 1 FROM import_record e WHERE e.job_id=r.job_id AND e.kind='entry' AND e.source_key=k))) LIMIT 1`,
      [id],
    );
    if (orphan.rowCount)
      throw new EntryError(
        "Selected game parent or entries are missing from the export.",
      );
    await c.query(
      "UPDATE import_job SET status='staged',source_records=$2,evidence_records=$3,unique_games=$4,issue_count=$5,manifest=$6,error=NULL,updated_at=now() WHERE id=$1",
      [
        id,
        sourceRecords,
        evidenceRecords,
        games,
        issues,
        JSON.stringify({
          ...manifest,
          translatorVersion: crawlerTranslatorVersion,
          certification: null,
          publicationStatus: "private_staging_only",
        }),
      ],
    );
    await audit(c, actor!, id, "import_batch_frozen", {
      digest: job.digest,
      sourceRecords,
      evidenceRecords,
      uniqueGames: games,
      issueCount: issues,
      translatorVersion: crawlerTranslatorVersion,
    });
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    if (actor) {
      await c.query("BEGIN");
      const current = (
        await c.query("SELECT status FROM import_job WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (current && current.status !== "staged") {
        const error =
          e instanceof EntryError
            ? e.message
            : "Staging failed; no batch contents were committed. Retry this job after operator review.";
        await c.query(
          "UPDATE import_job SET status='failed',error=$2,updated_at=now() WHERE id=$1",
          [id, error],
        );
        await audit(c, actor, id, "import_stage_failed", { error });
      }
      await c.query("COMMIT");
    } else throw e;
  } finally {
    await c.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
      `import-worker:${id}`,
    ]);
    c.release();
  }
}
