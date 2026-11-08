import { pool } from "@/db";
import type { PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import {
  FinalizationError,
  finalizationPrerequisites,
  finalizationState,
  freezeContents,
  validatePlacements,
} from "@/domain/finalization";
import { readEventLineup } from "@/modules/entries/entries";
import { competitionRankingStatus } from "@/modules/rankings/inputs";
import { publicFinalizationResponse } from "./public-finalization";
async function authorize(c: PoolClient, userId: string, eventId?: string) {
  const r = await c.query(
    "SELECT id FROM role_grant WHERE user_id=$1 AND ((role='administrator' AND event_id IS NULL AND game_id IS NULL) OR (role='organizer' AND ($2::text IS NULL OR event_id=$2) AND game_id IS NULL)) FOR SHARE",
    [userId, eventId ?? null],
  );
  if (!r.rowCount)
    throw new FinalizationError(
      "Organizer authority for this edition is required.",
      403,
    );
}
const historySql =
  'SELECT version,replaces_version AS "replacesVersion",source_digest AS "sourceDigest",digest,contents,actor_id AS "actorId",request_id AS "requestId",finalized_by AS "finalizedBy",created_at AS "createdAt",audit_id AS "auditId" FROM division_finalization WHERE division_id=$1';
async function source(c: PoolClient, id: string, lock = false) {
  const d = (
    await c.query(
      'SELECT d.id,d.event_id AS "eventId",d.name,d.discipline,d.format,e.name AS "eventName",e.origin,e.starts_on::text AS "startsOn",e.ends_on::text AS "endsOn" FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.id=$1' +
        (lock ? " FOR UPDATE OF d FOR SHARE OF e" : ""),
      [id],
    )
  ).rows[0];
  if (!d) throw new FinalizationError("Division not found.", 404);
  const draws = (
    await c.query(
      'SELECT id,number,starts_at AS "startsAt" FROM draw_session WHERE division_id=$1 ORDER BY id' +
        (lock ? " FOR UPDATE" : ""),
      [id],
    )
  ).rows;
  const entries = (
    await c.query(
      'SELECT id,display_name AS name,version,team_id AS "teamId" FROM event_entry WHERE division_id=$1 ORDER BY id' +
        (lock ? " FOR SHARE" : ""),
      [id],
    )
  ).rows;
  const lineups = [];
  if (lock)
    await c.query(
      "SELECT p.id FROM player p JOIN event_lineup_member m ON m.player_id=p.id JOIN event_entry e ON e.id=m.entry_id AND e.version=m.version WHERE e.division_id=$1 ORDER BY p.id FOR SHARE OF p",
      [id],
    );
  for (const entry of entries)
    lineups.push({ ...entry, lineup: await readEventLineup(c, entry.id) });
  const games = (
    await c.query(
      'SELECT g.id,g.draw_id AS "drawId",g.sheet,g.phase,g.state,g.version,g.entry_a AS "entryA",g.entry_b AS "entryB" FROM game g JOIN draw_session ds ON ds.id=g.draw_id WHERE ds.division_id=$1 ORDER BY g.id' +
        (lock ? " FOR SHARE OF g" : ""),
      [id],
    )
  ).rows;
  const results = [];
  for (const game of games) {
    const result = (
      await c.query(
        'SELECT version,actor_id AS "actorId",confirmed_by AS "confirmedBy",created_at AS "createdAt",result,audit_id AS "auditId" FROM game_result_version WHERE game_id=$1 ORDER BY version DESC LIMIT 1',
        [game.id],
      )
    ).rows[0];
    results.push({
      ...game,
      resultVersion: result?.version ?? null,
      result: result?.result ?? null,
      confirmedBy: result?.confirmedBy ?? null,
      confirmedAt: result?.createdAt ?? null,
      resultAuditId: result?.auditId ?? null,
    });
  }
  // A declaration/submission is not proof of admission or sporting participation.
  // Freeze only the field actually assigned to the recorded games. Later entry
  // admission workflows remain independent of these sporting observations.
  const participantIds = new Set(
    games.flatMap((g) => [g.entryA, g.entryB]).filter(Boolean),
  );
  return {
    division: d,
    draws,
    entries: lineups.filter((e) => participantIds.has(e.id)),
    games: results,
  };
}
/** Private current sporting projection; calculation callers own edition/entry/division/game locks. */
export const currentFinalizationSource = source;
async function ranking(c: PoolClient, s: Awaited<ReturnType<typeof source>>) {
  const issues: { code: string; message: string; entryId?: string }[] = [];
  const d = (
    await c.query("SELECT ranking_status FROM division WHERE id=$1", [
      s.division.id,
    ])
  ).rows[0];
  if (d.ranking_status !== "eligible")
    issues.push({
      code: "eligibility",
      message:
        d.ranking_status === "ineligible"
          ? "This division is recorded as ineligible for ranking points."
          : "Division ranking eligibility remains unresolved.",
    });
  for (const entry of s.entries) {
    if (!entry.lineup || entry.lineup.status === "provisional")
      issues.push({
        code: "lineup",
        entryId: entry.id,
        message: "Entry lineup or identity remains provisional.",
      });
    if (!entry.lineup?.registrationId)
      issues.push({
        code: "season-evidence",
        entryId: entry.id,
        message:
          "No referenced season ranking evidence is available for this entry.",
      });
    else {
      const status = await competitionRankingStatus(
        c,
        entry.lineup.registrationId,
      );
      if (!status.reviewed || !status.complete)
        issues.push({
          code: "starting-evidence",
          entryId: entry.id,
          message:
            "World Curling starting-input review is missing, incomplete or no longer current.",
        });
    }
  }
  return {
    scope: "division-ranking-evidence",
    approved: false,
    issues,
    note: "Sporting finalization grants no ranking approval or eligibility waiver. Event assessment and ranking publication are separate reviews.",
  };
}
async function detail(
  c: PoolClient,
  id: string,
  version?: number,
  includeRanking = true,
) {
  const s = await source(c, id);
  const history = (await c.query(historySql + " ORDER BY version DESC", [id]))
    .rows;
  const sourceDigest = freezeContents(s).digest;
  const selected =
    version === undefined
      ? (history[0] ?? null)
      : history.find((v) => v.version === version);
  if (version !== undefined && !selected)
    throw new FinalizationError("Finalization version not found.", 404);
  const prerequisites = finalizationPrerequisites(s.games);
  if (
    s.games.some(
      (g) =>
        !s.entries.some((e) => e.id === g.entryA) ||
        !s.entries.some((e) => e.id === g.entryB),
    )
  )
    prerequisites.push(
      "Both recorded participants must belong to this division.",
    );
  if (
    s.games.some(
      (g) =>
        g.result &&
        (g.result.entryA !== g.entryA || g.result.entryB !== g.entryB),
    )
  )
    prerequisites.push(
      "Recorded result participants differ from current assignments; organizer attention is required.",
    );
  return {
    source: s,
    sourceDigest,
    ...finalizationState(history[0] ?? null, sourceDigest),
    prerequisites,
    selected,
    history: history.map(({ contents, ...h }) => h),
    ...(includeRanking ? { ranking: await ranking(c, s) } : {}),
  };
}
export async function finalizationWorkspace(
  userId: string,
  id?: string,
  version?: number,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    if (id) {
      const event = (
        await c.query("SELECT event_id FROM division WHERE id=$1", [id])
      ).rows[0];
      await authorize(c, userId, event?.event_id ?? "unavailable");
      const result = await detail(c, id, version);
      await c.query("COMMIT");
      return result;
    }
    await authorize(c, userId);
    const divisions = await c.query(
      "SELECT d.id,d.name,d.event_id AS \"eventId\",e.name AS \"eventName\" FROM division d JOIN event_edition e ON e.id=d.event_id WHERE EXISTS(SELECT 1 FROM role_grant r WHERE r.user_id=$1 AND ((r.role='administrator' AND r.event_id IS NULL AND r.game_id IS NULL) OR (r.role='organizer' AND r.event_id=d.event_id AND r.game_id IS NULL))) ORDER BY e.name,d.name,d.id",
      [userId],
    );
    await c.query("COMMIT");
    return { divisions: divisions.rows };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function saveFinalization(userId: string, raw: unknown) {
  const input = raw as {
    divisionId: string;
    version: number;
    requestId: string;
    sourceDigest: string;
    placements: unknown;
    note: string;
    rulesReference: string;
  };
  if (
    !input ||
    typeof input.divisionId !== "string" ||
    !/^[-\w]{1,80}$/.test(input.divisionId) ||
    !Number.isSafeInteger(input.version) ||
    input.version < 0 ||
    typeof input.requestId !== "string" ||
    !/^[-\w]{1,80}$/.test(input.requestId) ||
    typeof input.sourceDigest !== "string" ||
    !/^[0-9a-f]{64}$/.test(input.sourceDigest)
  )
    throw new FinalizationError(
      "Provide the division, expected version, source digest and request identifier.",
    );
  for (const [label, value] of [
    ["Review note", input.note],
    ["Competition rules reference", input.rulesReference],
  ])
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > 2000 ||
      /[<>\u0000-\u001f]/.test(value)
    )
      throw new FinalizationError(
        `${label} must be plain text, up to 2000 characters.`,
      );
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `finalize-request:${userId}:${input.requestId}`,
    ]);
    const event = (
      await c.query("SELECT event_id FROM division WHERE id=$1", [
        input.divisionId,
      ])
    ).rows[0];
    // Accepted scheduling writes take the edition first. Acquire it before
    // entry/division/draw locks so a queued new session cannot form a FK cycle.
    await c.query("SELECT id FROM event_edition WHERE id=$1 FOR SHARE", [
      event?.event_id ?? null,
    ]);
    await authorize(c, userId, event?.event_id ?? "unavailable");
    const command = {
      divisionId: input.divisionId,
      version: input.version,
      requestId: input.requestId,
      sourceDigest: input.sourceDigest,
      placements: input.placements,
      note: input.note.trim(),
      rulesReference: input.rulesReference.trim(),
    };
    const commandDigest = freezeContents(command).digest;
    // A saved receipt is still a currently authorized operation. Lock the same
    // scope as a new command before replay, without requiring its old source
    // digest or version to remain current after later ordinary corrections.
    await c.query(
      "SELECT id FROM event_entry WHERE division_id=$1 ORDER BY id FOR SHARE",
      [input.divisionId],
    );
    const lockedDivision = (
      await c.query("SELECT event_id FROM division WHERE id=$1 FOR UPDATE", [
        input.divisionId,
      ])
    ).rows[0];
    if (!lockedDivision)
      throw new FinalizationError("Division not found.", 404);
    if (lockedDivision.event_id !== event?.event_id)
      throw new FinalizationError(
        "The division changed editions. Reload its current scope before finalizing.",
        409,
      );
    const receipt = (
      await c.query(
        "SELECT division_id,version,command_digest,digest FROM division_finalization WHERE actor_id=$1 AND request_id=$2",
        [userId, input.requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.command_digest !== commandDigest)
        throw new FinalizationError(
          "Request identifier already used for different contents.",
          409,
        );
      await c.query("COMMIT");
      return {
        divisionId: receipt.division_id,
        version: receipt.version,
        digest: receipt.digest,
      };
    }
    const s = await source(c, input.divisionId, true);
    if (s.division.eventId !== event?.event_id)
      throw new FinalizationError(
        "The division changed editions. Reload its current scope before finalizing.",
        409,
      );
    const latest = (
      await c.query(historySql + " ORDER BY version DESC LIMIT 1", [
        input.divisionId,
      ])
    ).rows[0];
    const sourceDigest = freezeContents(s).digest;
    if (
      (latest?.version ?? 0) !== input.version ||
      sourceDigest !== input.sourceDigest
    )
      throw new FinalizationError(
        "Division results changed. Reload and review the current division before finalizing.",
        409,
      );
    const prerequisites = finalizationPrerequisites(s.games);
    if (
      s.games.some(
        (g) =>
          !s.entries.some((e) => e.id === g.entryA) ||
          !s.entries.some((e) => e.id === g.entryB),
      )
    )
      prerequisites.push(
        "Both recorded participants must belong to this division.",
      );
    if (
      s.games.some(
        (g) =>
          g.result &&
          (g.result.entryA !== g.entryA || g.result.entryB !== g.entryB),
      )
    )
      prerequisites.push(
        "Recorded result participants differ from current assignments; organizer attention is required.",
      );
    if (prerequisites.length)
      throw new FinalizationError(prerequisites.join(" "), 422);
    const placements = validatePlacements(
      s.entries.map((e) => e.id),
      input.placements,
      input.note,
    );
    const version = input.version + 1,
      auditId = randomUUID();
    const frozen = freezeContents({
      schema: "wcp.division-finalization.v1",
      source: s,
      placements,
      rulesReference: command.rulesReference,
      note: command.note,
    });
    const name = (
      await c.query("SELECT name FROM auth_user WHERE id=$1", [userId])
    ).rows[0].name;
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id,request_id,resource_version,before_state,after_state) VALUES($1,$2,'division_finalized',$3,$4,$5,$6,$7)",
      [
        auditId,
        userId,
        input.divisionId,
        input.requestId,
        version,
        latest ? { version: latest.version, digest: latest.digest } : null,
        {
          version,
          sourceDigest,
          digest: frozen.digest,
          contents: frozen.contents,
          replacesVersion: latest?.version ?? null,
        },
      ],
    );
    await c.query(
      "INSERT INTO division_finalization(division_id,version,replaces_version,source_digest,contents,digest,actor_id,finalized_by,request_id,command_digest,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
      [
        input.divisionId,
        version,
        latest?.version ?? null,
        sourceDigest,
        frozen.contents,
        frozen.digest,
        userId,
        name,
        input.requestId,
        commandDigest,
        auditId,
      ],
    );
    await c.query("COMMIT");
    return { divisionId: input.divisionId, version, digest: frozen.digest };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function publicFinalization(id: string, version?: number) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const visible = await c.query(
      "SELECT d.id FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.id=$1 AND e.published AND e.admission_status='approved'",
      [id],
    );
    if (!visible.rowCount)
      throw new FinalizationError("Division not found.", 404);
    const result = await detail(c, id, version, false);
    await c.query("COMMIT");
    return publicFinalizationResponse(result);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
