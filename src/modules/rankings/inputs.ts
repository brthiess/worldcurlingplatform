import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { identifier } from "@/domain/entries";
import {
  RankingInputError,
  rulesInput,
  seasonInput,
  readiness,
  positiveVersion,
  type RulesInput,
  type SeasonInput,
  type ReviewContext,
} from "@/domain/ranking-inputs";
type Reader = Pick<PoolClient, "query">;
/** Competition receives scoped status only. Never expose private allocations,
 * global starting entitlements, staff notes or source evidence to organizers. */
export async function competitionRankingStatus(
  c: Reader,
  registrationId: string,
) {
  const r = await c.query(
    "SELECT id FROM ranking_record WHERE registration_id=$1",
    [registrationId],
  );
  if (!r.rowCount) return { reviewed: false, complete: false };
  const row = await detail(c, r.rows[0].id);
  return {
    reviewed: row.state === "reviewed",
    complete: row.currentReadiness?.complete === true,
  };
}
async function staff(c: Reader, userId: string) {
  const r = await c.query(
    "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
    [userId],
  );
  if (!r.rowCount)
    throw new RankingInputError(
      "World Curling staff authority is required to review official ranking inputs.",
      403,
    );
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(v) ?? "null";
}
async function context(c: Reader, input: SeasonInput): Promise<ReviewContext> {
  const r = await c.query(
    "SELECT r.season,r.version,t.discipline FROM season_registration r JOIN team t ON t.id=r.team_id WHERE r.id=$1 FOR SHARE OF r,t",
    [input.registrationId],
  );
  if (!r.rowCount)
    throw new RankingInputError("Season registration not found.", 404);
  const members = await c.query(
    'SELECT m.player_id AS "playerId",m.role,p.identity_status AS "identityStatus" FROM season_roster_member m JOIN player p ON p.id=m.player_id WHERE m.registration_id=$1 AND m.version=$2 ORDER BY p.name,p.id FOR SHARE OF m,p',
    [input.registrationId, input.rosterVersion],
  );
  if (!members.rowCount)
    throw new RankingInputError(
      "The referenced season roster version does not exist.",
    );
  const rule = await c.query(
    "SELECT v.data,v.state FROM ranking_revision v JOIN ranking_record r ON r.id=v.record_id WHERE r.id=$1 AND v.version=$2 AND r.kind='rules' FOR SHARE OF r,v",
    [input.rulesId, input.rulesVersion],
  );
  if (!rule.rowCount)
    throw new RankingInputError(
      "The exact rule/source version does not exist.",
    );
  const rankingPlayers = await c.query(
    'SELECT id AS "playerId",name,identity_status AS "identityStatus",\'ranking\' AS role FROM player WHERE id=ANY($1::text[]) ORDER BY name,id FOR SHARE',
    [[...input.rankingPlayerIds, ...input.rankingAlternateIds]],
  );
  if (
    rankingPlayers.rowCount !==
    new Set([...input.rankingPlayerIds, ...input.rankingAlternateIds]).size
  )
    throw new RankingInputError("A referenced ranking player does not exist.");
  return {
    ...r.rows[0],
    rosterVersion: r.rows[0].version,
    members: rankingPlayers.rows,
    rules: rulesInput(rule.rows[0].data),
    rulesReviewed: rule.rows[0].state === "reviewed",
  };
}
async function detail(c: Reader, id: string, version?: number) {
  const r = await c.query(
    'SELECT r.id,r.kind,r.version AS "latestVersion",v.version,v.state,v.data,v.readiness AS "savedReadiness",v.created_at AS "createdAt",v.actor_id AS "actorId" FROM ranking_record r JOIN ranking_revision v ON v.record_id=r.id AND v.version=coalesce($2,r.version) WHERE r.id=$1',
    [id, version ?? null],
  );
  if (!r.rowCount)
    throw new RankingInputError(
      "Ranking evidence record/version not found.",
      404,
    );
  const row = r.rows[0];
  const history = await c.query(
    'SELECT version,state,actor_id AS "actorId",created_at AS "createdAt" FROM ranking_revision WHERE record_id=$1 ORDER BY version DESC',
    [id],
  );
  const rosterSnapshot =
    row.kind === "season"
      ? await c.query(
          'SELECT m.player_id AS "playerId",p.name,m.role,m.position,p.identity_status AS "identityStatus" FROM season_roster_member m JOIN player p ON p.id=m.player_id WHERE m.registration_id=$1 AND m.version=$2 ORDER BY p.name,p.id',
          [row.data.registrationId, row.data.rosterVersion],
        )
      : null;
  return {
    ...row,
    rosterSnapshot: rosterSnapshot?.rows ?? null,
    rankingPlayers:
      row.kind === "season"
        ? (
            await c.query(
              "SELECT id AS \"playerId\",name,identity_status AS \"identityStatus\",'ranking' AS role,'' AS position FROM player WHERE id=ANY($1::text[]) ORDER BY name,id",
              [
                [
                  ...row.data.rankingPlayerIds,
                  ...(row.data.rankingAlternateIds ?? []),
                ],
              ],
            )
          ).rows
        : [],
    history: history.rows,
    currentReadiness:
      row.kind === "season"
        ? readiness(
            seasonInput(row.data),
            await context(c, seasonInput(row.data)),
          )
        : null,
  };
}
export async function rankingWorkspace(
  userId: string,
  id?: string,
  version?: number,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await staff(c, userId);
    if (id) {
      const result = await detail(c, identifier(id), version);
      await c.query("COMMIT");
      return result;
    }
    const rules = await c.query(
      "SELECT r.id,r.version,v.data,v.state FROM ranking_record r JOIN ranking_revision v ON v.record_id=r.id AND v.version=r.version WHERE r.kind='rules' ORDER BY v.created_at DESC,r.id",
    );
    const registrations = await c.query(
      'SELECT r.id,r.team_id AS "teamId",r.season,r.version,v.display_name AS name,t.discipline,x.id AS "reviewId" FROM season_registration r JOIN team t ON t.id=r.team_id JOIN season_roster_version v ON v.registration_id=r.id AND v.version=r.version LEFT JOIN ranking_record x ON x.registration_id=r.id ORDER BY r.season DESC,v.display_name,r.id',
    );
    const results = [];
    for (const r of registrations.rows) {
      const members = await c.query(
        "SELECT m.player_id AS \"playerId\",p.name,m.role,m.position,p.identity_status AS \"identityStatus\" FROM season_roster_member m JOIN player p ON p.id=m.player_id WHERE m.registration_id=$1 AND m.version=$2 ORDER BY CASE m.role WHEN 'core' THEN 0 WHEN 'alternate' THEN 1 ELSE 2 END,p.name,p.id",
        [r.id, r.version],
      );
      const core = await c.query(
        'SELECT player_id AS "playerId" FROM team_core_member WHERE team_id=$1 ORDER BY player_id',
        [r.teamId],
      );
      results.push({
        ...r,
        members: members.rows,
        platformCore: core.rows.map((p) => p.playerId),
      });
    }
    await c.query("COMMIT");
    return { rules: rules.rows, registrations: results };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function saveRankingInput(userId: string, raw: unknown) {
  if (!raw || typeof raw !== "object")
    throw new RankingInputError("Provide a ranking evidence command.");
  const cmd = raw as Record<string, unknown>,
    id = identifier(cmd.id),
    requestId = identifier(cmd.requestId);
  if (
    !["rules", "season"].includes(String(cmd.kind)) ||
    !["draft", "reviewed"].includes(String(cmd.state)) ||
    !Number.isSafeInteger(cmd.version) ||
    Number(cmd.version) < 0
  )
    throw new RankingInputError(
      "Select a record kind, draft/reviewed state and current version.",
    );
  const digest = createHash("sha256").update(canonical(cmd)).digest("hex");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await staff(c, userId);
    for (const key of [
      `ranking-request:${userId}:${requestId}`,
      `ranking-record:${id}`,
    ])
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        key,
      ]);
    const duplicate = await c.query(
      "SELECT record_id,version,command_digest FROM ranking_revision WHERE actor_id=$1 AND request_id=$2",
      [userId, requestId],
    );
    if (duplicate.rowCount) {
      const old = duplicate.rows[0];
      if (old.record_id !== id || old.command_digest !== digest)
        throw new RankingInputError(
          "Request identifier already used for different evidence.",
          409,
        );
      const result = await detail(c, id, old.version);
      await c.query("COMMIT");
      return result;
    }
    const old = await c.query(
      "SELECT * FROM ranking_record WHERE id=$1 FOR UPDATE",
      [id],
    );
    if ((old.rows[0]?.version ?? 0) !== cmd.version)
      throw new RankingInputError(
        "This evidence changed. Reload the current version before saving a revision.",
        409,
      );
    if (old.rowCount && old.rows[0].kind !== cmd.kind)
      throw new RankingInputError("Record kind cannot change.");
    const data =
      cmd.kind === "rules" ? rulesInput(cmd.data) : seasonInput(cmd.data);
    let ready: ReturnType<typeof readiness> | null = null;
    if (
      cmd.kind === "rules" &&
      cmd.state === "reviewed" &&
      (!(data as RulesInput).reviewNote ||
        !(data as RulesInput).checkpoints.length)
    )
      throw new RankingInputError(
        "Review rationale and sourced checkpoints are required for a reviewed rules edition.",
      );
    if (cmd.kind === "season") {
      const input = data as SeasonInput;
      if (old.rowCount && old.rows[0].registration_id !== input.registrationId)
        throw new RankingInputError(
          "An evidence record cannot move to another season registration.",
        );
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `ranking-season:${input.registrationId}`,
      ]);
      ready = readiness(input, await context(c, input));
      if (cmd.state === "reviewed" && !ready.complete)
        throw new RankingInputError(
          "Required evidence remains unresolved. Save a draft and resolve its blocking issues before review.",
          422,
        );
    }
    const version = Number(cmd.version) + 1;
    if (!old.rowCount)
      await c.query(
        "INSERT INTO ranking_record(id,kind,registration_id,version) VALUES($1,$2,$3,$4)",
        [
          id,
          cmd.kind,
          cmd.kind === "season" ? (data as SeasonInput).registrationId : null,
          version,
        ],
      );
    else
      await c.query("UPDATE ranking_record SET version=$2 WHERE id=$1", [
        id,
        version,
      ]);
    const auditId = randomUUID();
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [auditId, userId, `ranking_${cmd.kind}_${cmd.state}`, id],
    );
    const input = cmd.kind === "season" ? (data as SeasonInput) : null;
    await c.query(
      "INSERT INTO ranking_revision(record_id,version,state,data,readiness,rule_record_id,rule_version,registration_id,roster_version,audit_id,actor_id,request_id,command_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [
        id,
        version,
        cmd.state,
        JSON.stringify(data),
        ready ? JSON.stringify(ready) : null,
        input?.rulesId ?? null,
        input?.rulesVersion ?? null,
        input?.registrationId ?? null,
        input?.rosterVersion ?? null,
        auditId,
        userId,
        requestId,
        digest,
      ],
    );
    const result = await detail(c, id, version);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      throw new RankingInputError(
        "A season evidence record already exists. Reload its current version.",
        409,
      );
    throw e;
  } finally {
    c.release();
  }
}
