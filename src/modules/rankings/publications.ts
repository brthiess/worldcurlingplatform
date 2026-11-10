import { pool } from "@/db";
import { EntryError, identifier } from "@/domain/entries";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { freezeContents } from "@/domain/finalization";
import {
  publicationReadiness,
  comparePublication,
  type PublicRankingList,
  type PublicRankingRow,
} from "@/domain/ranking-publication";
import { overallPublicationCandidate } from "./overall";

async function staff(c: PoolClient, userId: string) {
  if (
    !(
      await c.query(
        "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
        [userId],
      )
    ).rowCount
  )
    throw new EntryError(
      "Current World Curling administrator authority is required.",
      403,
    );
}
async function privateDetail(c: PoolClient, id: string) {
  const r = (
    await c.query(
      `SELECT id,list_key AS "listKey",list_definition AS list,effective_date::text AS "effectiveDate",version,previous_id AS "previousId",replaces_id AS "replacesId",producer,producer_record_id AS "runId",private_contents AS "privateContents",private_digest AS "privateDigest",public_contents AS "publicContents",public_digest AS "publicDigest",actor_id AS "actorId",published_at AS "publishedAt" FROM ranking_publication WHERE id=$1`,
      [id],
    )
  ).rows[0];
  if (!r) throw new EntryError("Approved publication not found.", 404);
  if (
    freezeContents(JSON.parse(r.privateContents)).digest !== r.privateDigest ||
    freezeContents(JSON.parse(r.publicContents)).digest !== r.publicDigest
  )
    throw new EntryError(
      "Frozen publication evidence does not match its digests.",
      422,
    );
  return {
    ...r,
    data: JSON.parse(r.publicContents) as PublicRankingList,
    evidence: JSON.parse(r.privateContents),
  };
}
async function candidate(c: PoolClient, producer: unknown, id: string) {
  if (producer !== "overall")
    throw new EntryError("This draft producer is not available.");
  const { run, blockers } = await overallPublicationCandidate(c, id),
    m = run.manifest,
    result = run.result;
  const data: PublicRankingList = {
    schema: "wcp.public-ranking-list.v1",
    list: {
      family: "overall",
      subjectType: "team",
      discipline: run.discipline,
      season: m.source.rules.data.season,
      seriesId: null,
    },
    title: `${run.discipline === "men_four" ? "Men’s" : "Women’s"} four-player overall`,
    effectiveDate: run.effectiveDate,
    origin: "calculated",
    rows: result.rows
      .filter((r: { rank: number | null }) => r.rank !== null)
      .map(
        (r: any): PublicRankingRow => ({
          subjectId: r.id,
          subjectType: "team",
          name: r.name,
          href: `/teams/${encodeURIComponent(r.teamId)}`,
          rank: r.rank,
          total: r.total,
          starting: r.starting,
          carryover: r.carryover,
          eventTotal: r.eventTotal,
          contributions: [
            ...r.counted.map((a: any) => ({ ...a, counted: true })),
            ...r.excluded.map((a: any) => ({ ...a, counted: false })),
          ].map((a: any) => ({
            id: a.id,
            label:
              m.source.events.find(
                (e: any) => e.assessment?.id === a.assessmentId,
              )?.name ?? "Completed event",
            date: a.date,
            points: a.points,
            counted: a.counted,
            // An adjustment's private rationale never becomes public copy.
            reason: a.counted
              ? null
              : "Not included in the approved counting total",
          })),
        }),
      ),
  };
  if (!data.rows.length)
    blockers.push("A complete list needs at least one ranked subject.");
  const listKey = freezeContents(data.list).digest;
  const previousRow = (
    await c.query(
      "SELECT id FROM ranking_publication WHERE list_key=$1 ORDER BY version DESC LIMIT 1",
      [listKey],
    )
  ).rows[0];
  const previous = previousRow ? await privateDetail(c, previousRow.id) : null;
  const comparedRow = (
    await c.query(
      "SELECT id FROM ranking_publication WHERE list_key=$1 AND effective_date<=$2 ORDER BY effective_date DESC,version DESC LIMIT 1",
      [listKey, data.effectiveDate],
    )
  ).rows[0];
  const compared = comparedRow ? await privateDetail(c, comparedRow.id) : null;
  const publishedRow = (
    await c.query(
      "SELECT id FROM ranking_publication WHERE producer='overall' AND producer_record_id=$1",
      [run.id],
    )
  ).rows[0];
  const published = publishedRow
    ? await privateDetail(c, publishedRow.id)
    : null;
  const comparison = comparePublication(data, compared?.data ?? null);
  data.rows = data.rows.map((row) => {
    const old = comparison.rows.find((x) => x.subjectId === row.subjectId)!;
    return {
      ...row,
      previousRank: old.previousRank,
      previousTotal: old.previousTotal,
      movement: old.movement,
    };
  });
  return {
    producer: "overall",
    runId: run.id,
    manifestDigest: run.manifestDigest,
    resultDigest: run.resultDigest,
    listKey,
    data,
    result,
    run,
    blockers,
    previous,
    compared,
    published,
    version: previous?.version ?? 0,
    comparison,
  };
}
export async function publicationWorkspace(
  userId: string,
  params: { producer?: string; run?: string; id?: string },
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await staff(c, userId);
    if (params.id) {
      const result = await privateDetail(c, identifier(params.id));
      await c.query("COMMIT");
      return result;
    }
    const runs = (
      await c.query(
        `SELECT id,discipline,effective_date::text AS "effectiveDate",version,result_contents::jsonb->>'state' AS state FROM overall_ranking_run ORDER BY effective_date DESC,created_at DESC,id`,
      )
    ).rows;
    const receipts = (
      await c.query(
        `SELECT actor_id AS "actorId",request_id AS "requestId",command_digest AS "commandDigest",publication_id AS "publicationId",action,'/api/v1/ranking-publications' AS path FROM ranking_publication_receipt`,
      )
    ).rows;
    const review = params.run
      ? await candidate(c, params.producer, identifier(params.run))
      : null;
    await c.query("COMMIT");
    return { actorId: userId, runs, receipts, ...(review ?? {}) };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function savePublication(userId: string, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new EntryError("Provide a publication command.");
  const cmd = raw as Record<string, unknown>,
    requestId = identifier(cmd.requestId),
    commandDigest = freezeContents(cmd).digest;
  if (cmd.action !== "approve" && cmd.action !== "replay")
    throw new EntryError("Choose approve or frozen publication replay.");
  const runId = identifier(cmd.runId),
    c = await pool.connect(),
    held: string[] = [];
  let destroy = false;
  try {
    // Fetch only immutable context before lock/snapshot acquisition.
    const run = (
      await c.query(
        "SELECT discipline,effective_date::text AS date FROM overall_ranking_run WHERE id=$1",
        [runId],
      )
    ).rows[0];
    if (!run || cmd.producer !== "overall")
      throw new EntryError("Draft producer/run not found.", 404);
    for (const key of [
      `publication-request:${userId}:${requestId}`,
      `overall:${run.discipline}:${run.date}`,
      `publication-list:overall:team:${run.discipline}:2026-27`,
    ]) {
      await c.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [key]);
      held.push(key);
    }
    await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await staff(c, userId);
    const receipt = (
      await c.query(
        "SELECT command_digest,publication_id FROM ranking_publication_receipt WHERE actor_id=$1 AND request_id=$2",
        [userId, requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.command_digest !== commandDigest)
        throw new EntryError(
          "Request identifier was already used with different content.",
          409,
        );
      const recorded = await privateDetail(c, receipt.publication_id);
      if (recorded.runId !== runId || recorded.producer !== cmd.producer)
        throw new EntryError(
          "Recorded publication association does not match.",
          409,
        );
      await c.query("COMMIT");
      return recorded;
    }
    const auditId = randomUUID();
    let result;
    if (cmd.action === "replay") {
      result = await privateDetail(c, identifier(cmd.publicationId));
      if (
        result.runId !== runId ||
        result.producer !== cmd.producer ||
        result.publicDigest !== cmd.publicDigest ||
        result.privateDigest !== cmd.privateDigest
      )
        throw new EntryError(
          "Replay must identify the exact approved publication and its frozen digests.",
          409,
        );
      await c.query(
        "INSERT INTO audit_record(id,actor_id,action,resource_id,after_state) VALUES($1,$2,'ranking_publication_replayed',$3,$4)",
        [
          auditId,
          userId,
          result.id,
          {
            publicDigest: result.publicDigest,
            privateDigest: result.privateDigest,
          },
        ],
      );
    } else {
      const review = await candidate(c, cmd.producer, runId);
      if (
        !Number.isSafeInteger(cmd.version) ||
        cmd.version !== review.version ||
        cmd.previousId !== (review.previous?.id ?? null) ||
        cmd.comparedId !== (review.compared?.id ?? null) ||
        cmd.manifestDigest !== review.manifestDigest ||
        cmd.resultDigest !== review.resultDigest
      )
        throw new EntryError(
          "Draft or publication comparison changed. Reload and review before approving.",
          409,
        );
      if (
        !Array.isArray(cmd.acknowledged) ||
        cmd.acknowledged.some((x) => typeof x !== "string")
      )
        throw new EntryError("Provide exact informational acknowledgements.");
      const blockers = [
        ...review.blockers,
        ...publicationReadiness(review.result, cmd.acknowledged as string[]),
      ];
      if (blockers.length)
        throw new EntryError(`Publication blocked: ${blockers.join(" ")}`, 422);
      if (
        typeof cmd.note !== "string" ||
        !cmd.note.trim() ||
        cmd.note.length > 4000
      )
        throw new EntryError(
          "Record a private approval rationale (up to 4000 characters).",
        );
      if (
        (
          await c.query(
            "SELECT id FROM ranking_publication WHERE producer=$1 AND producer_record_id=$2",
            [cmd.producer, runId],
          )
        ).rowCount
      )
        throw new EntryError(
          "This exact draft is already published. Select its existing publication.",
          409,
        );
      const id = randomUUID(),
        publicFrozen = freezeContents(review.data),
        privateFrozen = freezeContents({
          schema: "wcp.ranking-publication-evidence.v1",
          producer: cmd.producer,
          runId,
          manifestContents: review.run.manifestContents,
          manifestDigest: review.manifestDigest,
          resultContents: review.run.resultContents,
          resultDigest: review.resultDigest,
          comparison: review.comparison,
          previousId: review.previous?.id ?? null,
          comparedId: review.compared?.id ?? null,
          decision: {
            actorId: userId,
            requestId,
            commandDigest,
            auditId,
            note: cmd.note.trim(),
            acknowledged: cmd.acknowledged,
          },
        });
      await c.query(
        "INSERT INTO audit_record(id,actor_id,action,resource_id,after_state) VALUES($1,$2,'ranking_publication_approved',$3,$4)",
        [
          auditId,
          userId,
          id,
          {
            publicDigest: publicFrozen.digest,
            privateDigest: privateFrozen.digest,
            runId,
          },
        ],
      );
      const replaces =
        review.compared?.effectiveDate === review.data.effectiveDate
          ? review.compared.id
          : null;
      await c.query(
        `INSERT INTO ranking_publication(id,list_key,list_definition,effective_date,version,previous_id,replaces_id,producer,producer_record_id,private_contents,private_digest,public_contents,public_digest,actor_id,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          id,
          review.listKey,
          review.data.list,
          review.data.effectiveDate,
          review.version + 1,
          review.previous?.id ?? null,
          replaces,
          cmd.producer,
          runId,
          privateFrozen.contents,
          privateFrozen.digest,
          publicFrozen.contents,
          publicFrozen.digest,
          userId,
          auditId,
        ],
      );
      result = await privateDetail(c, id);
    }
    await c.query(
      "INSERT INTO ranking_publication_receipt(actor_id,request_id,command_digest,publication_id,action,audit_id) VALUES($1,$2,$3,$4,$5,$6)",
      [userId, requestId, commandDigest, result.id, cmd.action, auditId],
    );
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "40001")
      throw new EntryError(
        "Concurrent publication inputs changed. Retry the same command, then reload if stale.",
        409,
      );
    throw e;
  } finally {
    for (const key of held.reverse()) {
      try {
        if (
          (
            await c.query(
              "SELECT pg_advisory_unlock(hashtextextended($1,0)) AS unlocked",
              [key],
            )
          ).rows[0]?.unlocked !== true
        )
          destroy = true;
      } catch {
        destroy = true;
      }
    }
    c.release(destroy);
  }
}

/** Only the explicit frozen public DTO is read here. No join to mutable names,
 * calculation manifests, accounts or private administrator decisions. */
export async function publicRankings(params: {
  id?: string;
  discipline?: string;
  family?: string;
  season?: string;
  series?: string;
  subjectType?: string;
  date?: string;
}) {
  const rows = (
    await pool.query(
      `SELECT id,list_definition AS list,effective_date::text AS "effectiveDate",version,previous_id AS "previousId",replaces_id AS "replacesId",published_at AS "publishedAt",public_digest AS "publicDigest",public_contents AS contents
     FROM ranking_publication ORDER BY effective_date DESC,version DESC,id`,
    )
  ).rows;
  const matches = rows.filter(
    (r) =>
      (!params.discipline || r.list.discipline === params.discipline) &&
      (!params.family || r.list.family === params.family) &&
      (!params.season || r.list.season === params.season) &&
      (!params.series || r.list.seriesId === params.series) &&
      (!params.subjectType || r.list.subjectType === params.subjectType) &&
      (!params.date || r.effectiveDate === params.date),
  );
  const selected = params.id
    ? matches.find((r) => r.id === identifier(params.id))
    : matches[0];
  if (params.id && !selected)
    throw new EntryError(
      "Approved publication not found in this selection.",
      404,
    );
  const header = ({ contents: _contents, ...r }: (typeof rows)[number]) => r;
  return {
    publications: matches.map(header),
    selected: selected
      ? {
          ...header(selected),
          data: JSON.parse(selected.contents) as PublicRankingList,
        }
      : null,
  };
}
