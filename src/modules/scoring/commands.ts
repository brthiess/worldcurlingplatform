import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { permitted, type Grant } from "@/domain/permissions";
import {
  validateEnd,
  scoreTotals,
  commandDecision,
  type End,
} from "@/domain/scoring";
export class ScoringError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type Command = {
  requestId: string;
  expectedVersion: number;
  action: "start" | "end";
  hammer: "a" | "b" | null;
  endNumber?: number;
  end?: End;
};
export function parseCommand(value: unknown): Command {
  const c = value as Command;
  if (
    !c ||
    typeof c.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(c.requestId) ||
    !Number.isSafeInteger(c.expectedVersion) ||
    c.expectedVersion < 0 ||
    !["start", "end"].includes(c.action) ||
    ![null, "a", "b"].includes(c.hammer)
  )
    throw new ScoringError(
      400,
      "Provide a request identifier, version, action and known or unknown hammer",
    );
  const base = {
    requestId: c.requestId,
    expectedVersion: c.expectedVersion,
    action: c.action,
    hammer: c.hammer,
  };
  if (c.action === "start") return base;
  if (!Number.isInteger(c.endNumber) || c.endNumber! < 1 || c.endNumber! > 20)
    throw new ScoringError(400, "Choose an end from 1 to 20");
  try {
    return { ...base, endNumber: c.endNumber, end: validateEnd(c.end) };
  } catch (e) {
    throw new ScoringError(400, (e as Error).message);
  }
}
async function snapshot(client: PoolClient, id: string) {
  const g = (
    await client.query(
      `SELECT g.id,g.state,g.version,g.hammer,g.scoring_source AS "scoringSource",g.total_a AS "totalA",g.total_b AS "totalB",g.sheet,coalesce(a.display_name,g.slot_a) AS "nameA",coalesce(b.display_name,g.slot_b) AS "nameB",g.entry_a AS "entryA",g.entry_b AS "entryB",d.event_id AS "eventId",d.discipline,ds.number AS "drawNumber" FROM game g JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=ds.division_id LEFT JOIN event_entry a ON a.id=g.entry_a LEFT JOIN event_entry b ON b.id=g.entry_b WHERE g.id=$1`,
      [id],
    )
  ).rows[0];
  if (!g)
    throw new ScoringError(403, "This game is outside your assigned scope");
  const rows = (
    await client.query(
      "SELECT end_number,side,state,points FROM game_end_score WHERE game_id=$1 ORDER BY end_number",
      [id],
    )
  ).rows;
  const hammers = (
    await client.query(
      "SELECT end_number,hammer FROM game_end_hammer WHERE game_id=$1",
      [id],
    )
  ).rows;
  const count = Math.max(8, ...rows.map((r) => r.end_number));
  const ends: End[] = Array.from({ length: count }, (_, i) => {
    const a = rows.find((r) => r.end_number === i + 1 && r.side === "a"),
      b = rows.find((r) => r.end_number === i + 1 && r.side === "b");
    return {
      state: a?.state === b?.state ? (a?.state ?? "upcoming") : "unknown",
      a: a?.points ?? null,
      b: b?.points ?? null,
    };
  });
  const last = rows
    .filter((r) => r.state === "played" || r.state === "unknown")
    .reduce((n, r) => Math.max(n, r.end_number), 0);
  const hammerEnd = g.state === "live" && last < 20 ? last + 1 : null;
  const endHammer = Array.from(
    { length: count },
    (_, i) => hammers.find((h) => h.end_number === i + 1)?.hammer ?? null,
  );
  return {
    ...g,
    ends,
    endHammer,
    hammerEnd,
    hammer:
      hammerEnd === null
        ? null
        : (hammers.find((h) => h.end_number === hammerEnd)?.hammer ?? null),
  };
}
async function authorize(client: PoolClient, actorId: string, id: string) {
  // Hold both the game and current grants while accepting a command. Grant revocation
  // and source changes cannot race past this authorization check.
  await client.query("SELECT id FROM game WHERE id=$1 FOR UPDATE", [id]);
  const g = await snapshot(client, id);
  const grants = await client.query<Grant>(
    'SELECT role,event_id AS "eventId",game_id AS "gameId" FROM role_grant WHERE user_id=$1 FOR SHARE',
    [actorId],
  );
  if (!permitted(grants.rows, "score", { eventId: g.eventId, gameId: id }))
    throw new ScoringError(
      403,
      "This game is outside your assigned scoring scope",
    );
  return g;
}
export async function scoringGame(actorId: string, id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const g = await authorize(client, actorId, id);
    const history = (
      await client.query(
        `SELECT actor_id AS "actorId",request_id AS "requestId",resource_version AS version,action,created_at AS "createdAt",before_state AS before,after_state AS after FROM audit_record WHERE resource_id=$1 AND request_id IS NOT NULL ORDER BY resource_version DESC`,
        [id],
      )
    ).rows;
    await client.query("COMMIT");
    return { ...g, history };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function saveScoring(actorId: string, id: string, input: unknown) {
  const command = parseCommand(input),
    client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await authorize(client, actorId, id);
    if (before.scoringSource !== "manual")
      throw new ScoringError(409, "Manual scoring is not the active source");
    const previous = (
      await client.query(
        "SELECT command,response FROM scoring_command WHERE game_id=$1 AND actor_id=$2 AND request_id=$3",
        [id, actorId, command.requestId],
      )
    ).rows[0];
    const matches = previous
      ? (
          await client.query("SELECT $1::jsonb=$2::jsonb AS same", [
            previous.command,
            command,
          ])
        ).rows[0].same
      : undefined;
    const decision = commandDecision(
      before.version,
      command.expectedVersion,
      matches,
    );
    if (decision === "conflict")
      throw new ScoringError(
        409,
        "Request identifier already used for a different command",
      );
    if (decision === "replay") {
      await client.query("COMMIT");
      return previous.response;
    }
    if (decision === "stale")
      throw new ScoringError(
        409,
        "Scores changed. Reload the accepted game before applying your edit",
      );
    if (!["men_four", "women_four"].includes(before.discipline))
      throw new ScoringError(400, "This editor supports four-player games");
    if (command.action === "start") {
      if (before.state !== "scheduled" || !before.entryA || !before.entryB)
        throw new ScoringError(
          409,
          "Start requires a scheduled game with both opponents assigned",
        );
      await client.query("UPDATE game SET state='live' WHERE id=$1", [id]);
    } else {
      if (before.state !== "live")
        throw new ScoringError(
          409,
          "Start this game before saving live ends; confirmed results use the correction workflow",
        );
      for (const [side, points] of [
        ["a", command.end!.a],
        ["b", command.end!.b],
      ])
        await client.query(
          "INSERT INTO game_end_score(game_id,side,end_number,state,points) VALUES($1,$2,$3,$4,$5) ON CONFLICT(game_id,side,end_number) DO UPDATE SET state=EXCLUDED.state,points=EXCLUDED.points",
          [id, side, command.endNumber, command.end!.state, points],
        );
    }
    await client.query(
      "INSERT INTO game_end_hammer(game_id,end_number,hammer) VALUES($1,$2,$3) ON CONFLICT(game_id,end_number) DO UPDATE SET hammer=EXCLUDED.hammer",
      [id, command.action === "start" ? 1 : command.endNumber, command.hammer],
    );
    const changed = await snapshot(client, id),
      totals = scoreTotals(changed.ends);
    await client.query(
      "UPDATE game SET version=version+1,hammer=$2,hammer_end=$5,total_a=$3,total_b=$4,updated_at=now() WHERE id=$1",
      [id, changed.hammer, totals.a, totals.b, changed.hammerEnd],
    );
    const after = await snapshot(client, id),
      auditId = randomUUID(),
      response = { requestId: command.requestId, version: after.version };
    await client.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id,request_id,resource_version,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        auditId,
        actorId,
        command.action === "start" ? "game_started" : "end_saved",
        id,
        command.requestId,
        after.version,
        before,
        after,
      ],
    );
    await client.query(
      "INSERT INTO scoring_command(game_id,actor_id,request_id,command,response,audit_id) VALUES($1,$2,$3,$4,$5,$6)",
      [id, actorId, command.requestId, command, response, auditId],
    );
    await client.query("COMMIT");
    return response;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
