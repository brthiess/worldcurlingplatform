import { randomUUID } from "node:crypto";
import {
  sportingEvidence,
  placementHammer,
  type SportingEvidence,
} from "@/domain/disciplines";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { permitted, type Grant } from "@/domain/permissions";
import {
  validateResult,
  lineupDifference,
  type Outcome,
  type DifferenceMember,
} from "@/domain/results";
import { gameLineup, freezeLineups } from "./lineups";
import { advanceDraw } from "@/modules/draws/advance";
import {
  validateEnd,
  scoreTotals,
  commandDecision,
  applyEnd,
  normalizeEnds,
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
  action: "start" | "end" | "confirm" | "correct" | "lineup" | "evidence";
  sporting?: SportingEvidence;
  hammer: "a" | "b" | null;
  endNumber?: number;
  end?: End;
  outcome?: Outcome;
  winnerEntryId?: string;
  reason?: string;
  ends?: End[];
  endHammer?: ("a" | "b" | null)[];
  side?: "a" | "b";
  members?: { playerId: string; position: string }[];
  lineups?: Partial<Record<"a" | "b", DifferenceMember[]>>;
};
export function parseCommand(value: unknown): Command {
  const c = value as Command;
  if (
    !c ||
    typeof c.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(c.requestId) ||
    !Number.isSafeInteger(c.expectedVersion) ||
    c.expectedVersion < 0 ||
    !["start", "end", "confirm", "correct", "lineup", "evidence"].includes(
      c.action,
    ) ||
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
  if (c.action === "evidence") {
    if (!c.sporting || typeof c.sporting !== "object")
      throw new ScoringError(400, "Provide sporting evidence");
    return { ...base, sporting: c.sporting };
  }
  if (c.action === "start") return base;
  if (c.action === "confirm" || c.action === "correct") {
    if (
      !["normal", "conceded", "forfeit"].includes(c.outcome!) ||
      typeof c.winnerEntryId !== "string" ||
      typeof c.reason !== "string" ||
      (c.action === "correct" && !Array.isArray(c.ends))
    )
      throw new ScoringError(
        400,
        "Provide outcome, participating winner and reason; corrections require the full line score",
      );
    let lineups: Command["lineups"];
    if (
      c.endHammer !== undefined &&
      (c.action !== "correct" ||
        !Array.isArray(c.endHammer) ||
        c.endHammer.length !== c.ends!.length ||
        c.endHammer.some((h) => ![null, "a", "b"].includes(h)))
    )
      throw new ScoringError(
        400,
        "Provide known or unknown hammer for each corrected end",
      );
    if (c.lineups !== undefined) {
      if (
        c.action !== "correct" ||
        !c.lineups ||
        typeof c.lineups !== "object" ||
        Object.keys(c.lineups).some((k) => !["a", "b"].includes(k))
      )
        throw new ScoringError(400, "Only corrections accept lineup changes");
      try {
        lineups = {};
        for (const side of ["a", "b"] as const)
          if (c.lineups[side] !== undefined)
            lineups[side] = lineupDifference(c.lineups[side]);
      } catch (e) {
        throw new ScoringError(400, (e as Error).message);
      }
    }
    return {
      ...base,
      outcome: c.outcome,
      winnerEntryId: c.winnerEntryId,
      reason: c.reason,
      ...(c.action === "correct" ? { ends: c.ends } : {}),
      ...(lineups ? { lineups } : {}),
      ...(c.endHammer ? { endHammer: c.endHammer } : {}),
      ...(c.action === "correct" && c.sporting !== undefined
        ? { sporting: c.sporting }
        : {}),
    };
  }
  if (c.action === "lineup") {
    if (!["a", "b"].includes(c.side!))
      throw new ScoringError(400, "Choose a lineup side");
    try {
      return { ...base, side: c.side, members: lineupDifference(c.members) };
    } catch (e) {
      throw new ScoringError(400, (e as Error).message);
    }
  }
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
      `SELECT g.id,g.state,g.version,g.hammer,g.scoring_source AS "scoringSource",g.total_a AS "totalA",g.total_b AS "totalB",g.sheet,coalesce(a.display_name,g.slot_a) AS "nameA",coalesce(b.display_name,g.slot_b) AS "nameB",g.entry_a AS "entryA",g.entry_b AS "entryB",d.event_id AS "eventId",d.discipline,ds.number AS "drawNumber" FROM game g LEFT JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=g.division_id LEFT JOIN event_entry a ON a.id=g.entry_a LEFT JOIN event_entry b ON b.id=g.entry_b WHERE g.id=$1`,
      [id],
    )
  ).rows[0];
  if (!g)
    throw new ScoringError(403, "This game is outside your assigned scope");
  const sporting = (
    await client.query(
      "SELECT evidence,version FROM game_sporting_version WHERE game_id=$1 AND entry_a=$2 AND entry_b=$3 ORDER BY version DESC LIMIT 1",
      [id, g.entryA, g.entryB],
    )
  ).rows[0];
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
  const count = Math.max(
    sporting?.evidence.regulationEnds ?? 8,
    ...rows.map((r) => r.end_number),
  );
  const ends: End[] = normalizeEnds(
    Array.from({ length: count }, (_, i) => {
      const a = rows.find((r) => r.end_number === i + 1 && r.side === "a"),
        b = rows.find((r) => r.end_number === i + 1 && r.side === "b");
      return {
        state:
          a?.state === b?.state
            ? (a?.state ?? (g.state === "confirmed" ? "unknown" : "upcoming"))
            : "unknown",
        a: a?.points ?? null,
        b: b?.points ?? null,
      };
    }),
  );
  const last = rows
    .filter((r) => r.state === "played" || r.state === "unknown")
    .reduce((n, r) => Math.max(n, r.end_number), 0);
  const hammerEnd = g.state === "live" && last < 20 ? last + 1 : null;
  const endHammer = Array.from(
    { length: count },
    (_, i) => hammers.find((h) => h.end_number === i + 1)?.hammer ?? null,
  );
  const results = (
    await client.query(
      'SELECT version,actor_id AS "actorId",confirmed_by AS "confirmedBy",created_at AS "createdAt",result FROM game_result_version WHERE game_id=$1 ORDER BY version DESC',
      [id],
    )
  ).rows;
  const attention = (
    await client.query(
      'SELECT upstream_game_id AS "upstreamGameId",result_version AS "resultVersion",downstream_game_id AS "downstreamGameId",side,actual_entry_id AS "actualEntryId",expected_entry_id AS "expectedEntryId",downstream_state AS "downstreamState" FROM game_assignment_attention WHERE upstream_game_id=$1 OR downstream_game_id=$1 ORDER BY result_version DESC',
      [id],
    )
  ).rows;
  return {
    ...g,
    ...(sporting
      ? {
          sporting: sporting.evidence as SportingEvidence,
          sportingVersion: sporting.version,
        }
      : {}),
    ...(g.state === "live" && ends.some((e) => e.state === "unknown")
      ? { totalA: null, totalB: null }
      : {}),
    ends,
    results,
    attention,
    lineupA: g.entryA
      ? await gameLineup(client, id, "a", g.entryA, g.state === "confirmed")
      : null,
    lineupB: g.entryB
      ? await gameLineup(client, id, "b", g.entryB, g.state === "confirmed")
      : null,
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
  const lockedEdition = (
    await client.query(
      "SELECT e.id FROM event_edition e JOIN division d ON d.event_id=e.id JOIN game g ON g.division_id=d.id WHERE g.id=$1 FOR UPDATE OF e",
      [id],
    )
  ).rows[0]?.id;
  await client.query("SELECT id FROM game WHERE id=$1 FOR UPDATE", [id]);
  const g = await snapshot(client, id);
  if (g.eventId !== lockedEdition)
    throw new ScoringError(
      409,
      "Game edition changed. Reload the current game before applying this command.",
    );
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
async function saveDifference(
  client: PoolClient,
  id: string,
  version: number,
  side: "a" | "b",
  members: DifferenceMember[],
  before: Awaited<ReturnType<typeof snapshot>>,
  auditId: string,
) {
  try {
    members = lineupDifference(members, before.discipline);
  } catch (e) {
    throw new ScoringError(400, (e as Error).message);
  }
  const lineup = side === "a" ? before.lineupA : before.lineupB;
  if (!lineup)
    throw new ScoringError(
      409,
      "Assign both participants before recording lineups",
    );
  const selected = await client.query(
    'SELECT id AS "playerId",name,identity_status AS "identityStatus" FROM player WHERE id=ANY($1::text[])',
    [members.map((m) => m.playerId)],
  );
  if (selected.rowCount !== members.length)
    throw new ScoringError(400, "Every lineup player must exist");
  await client.query(
    "INSERT INTO game_lineup_version(game_id,version,side,entry_id,event_lineup_version,mode,members,audit_id) VALUES($1,$2,$3,$4,$5,'difference',$6,$7)",
    [
      id,
      version,
      side,
      lineup.entryId,
      lineup.eventLineupVersion,
      JSON.stringify(
        members.map((m) => ({
          ...selected.rows.find((p) => p.playerId === m.playerId),
          position: m.position,
          participation: "declared",
        })),
      ),
      auditId,
    ],
  );
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
  const auditId = randomUUID(),
    command = parseCommand(input),
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
            input,
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
    if (
      !["men_four", "women_four", "mixed_doubles"].includes(before.discipline)
    )
      throw new ScoringError(400, "Choose a supported scoring discipline");
    if (command.action === "end") {
      try {
        command.end = validateEnd(command.end, before.discipline);
      } catch (e) {
        throw new ScoringError(400, (e as Error).message);
      }
    }
    let evidence: SportingEvidence | undefined = before.sporting;
    if (command.sporting !== undefined) {
      if (before.state === "confirmed" && command.action !== "correct")
        throw new ScoringError(
          409,
          "Use an ordinary result correction for confirmed sporting evidence",
        );
      try {
        evidence = sportingEvidence(command.sporting, before.discipline);
      } catch (e) {
        throw new ScoringError(400, (e as Error).message);
      }
      if (!before.entryA || !before.entryB)
        throw new ScoringError(
          409,
          "Assign both participants before recording evidence",
        );
      const ids = [
        ...new Set(
          ["a", "b"].flatMap((side) => [
            ...evidence!.lsd[side as "a" | "b"].flatMap((p) =>
              p.playerId ? [p.playerId] : [],
            ),
            ...evidence!.participation[side as "a" | "b"].playerIds,
          ]),
        ),
      ];
      const players = await client.query(
        "SELECT id FROM player WHERE id=ANY($1::text[]) FOR SHARE",
        [ids],
      );
      if (players.rowCount !== ids.length)
        throw new ScoringError(400, "Every observed or LSD player must exist");
      const all = [
        ...evidence.participation.a.playerIds,
        ...evidence.participation.b.playerIds,
      ];
      if (new Set(all).size !== all.length)
        throw new ScoringError(
          400,
          "A player cannot participate for both sides in this game",
        );
      if (
        before.state !== "scheduled" &&
        evidence.regulationEnds !== (before.sporting?.regulationEnds ?? 8)
      )
        throw new ScoringError(
          409,
          "Regulation length must be set before the game starts",
        );
    }
    let result: ReturnType<typeof validateResult> | undefined;
    if (command.action === "confirm" || command.action === "correct") {
      try {
        result = validateResult(
          before.state,
          command.action,
          [before.entryA, before.entryB],
          {
            outcome: command.outcome!,
            winnerEntryId: command.winnerEntryId!,
            reason: command.reason!,
            ends: command.action === "correct" ? command.ends! : before.ends,
          },
          before.discipline,
          evidence?.regulationEnds ?? 8,
        );
      } catch (e) {
        throw new ScoringError(409, (e as Error).message);
      }
      if (
        before.results[0] &&
        (before.results[0].result.entryA !== before.entryA ||
          before.results[0].result.entryB !== before.entryB)
      )
        throw new ScoringError(
          409,
          "Recorded result participants must be preserved; review the assignment inconsistency",
        );
      result.ends = Array.from(
        { length: Math.max(evidence?.regulationEnds ?? 8, result.ends.length) },
        (_, i) => result!.ends[i] ?? { state: "unplayed", a: null, b: null },
      );
      for (const side of ["a", "b"] as const)
        if (command.lineups?.[side] !== undefined)
          await saveDifference(
            client,
            id,
            before.version + 1,
            side,
            command.lineups[side]!,
            before,
            auditId,
          );
      await freezeLineups(client, id, before.version + 1, before, auditId);
      await client.query(
        "UPDATE game SET state='confirmed',total_a=$2,total_b=$3 WHERE id=$1",
        [id, result.totalA, result.totalB],
      );
      await client.query("DELETE FROM game_end_score WHERE game_id=$1", [id]);
      if (command.endHammer)
        for (const [i, hammer] of command.endHammer.entries())
          await client.query(
            "INSERT INTO game_end_hammer(game_id,end_number,hammer) VALUES($1,$2,$3) ON CONFLICT(game_id,end_number) DO UPDATE SET hammer=EXCLUDED.hammer",
            [id, i + 1, hammer],
          );
      for (const [i, end] of result.ends.entries())
        for (const [side, points] of [
          ["a", end.a],
          ["b", end.b],
        ])
          await client.query(
            "INSERT INTO game_end_score(game_id,side,end_number,state,points) VALUES($1,$2,$3,$4,$5)",
            [id, side, i + 1, end.state, points],
          );
    } else if (command.action === "evidence") {
      // Evidence shares the scoring command's version, current authority, audit and receipt.
    } else if (command.action === "lineup") {
      if (before.state === "confirmed")
        throw new ScoringError(
          409,
          "Record lineup changes in a result correction",
        );
      const entryId = command.side === "a" ? before.entryA : before.entryB;
      if (!entryId)
        throw new ScoringError(
          409,
          "Assign the participant before recording its game lineup",
        );
      await freezeLineups(
        client,
        id,
        before.version + 1,
        before,
        auditId,
        command.side,
      );
      await saveDifference(
        client,
        id,
        before.version + 1,
        command.side!,
        command.members!,
        before,
        auditId,
      );
    } else if (command.action === "start") {
      if (before.state !== "scheduled" || !before.entryA || !before.entryB)
        throw new ScoringError(
          409,
          "Start requires a scheduled game with both opponents assigned",
        );
      await client.query("UPDATE game SET state='live' WHERE id=$1", [id]);
      await freezeLineups(client, id, before.version + 1, before, auditId);
    } else {
      if (before.state !== "live")
        throw new ScoringError(
          409,
          "Start this game before saving live ends; confirmed results use the correction workflow",
        );
      let next: End[];
      try {
        next = applyEnd(before.ends, command.endNumber!, command.end!);
        if (before.discipline === "mixed_doubles")
          for (let i = 8; i < next.length; i++) {
            if (!["played", "unknown"].includes(next[i].state)) continue;
            const previous = next.slice(0, i),
              total = scoreTotals(previous);
            if (
              previous.some((e) => e.state !== "played") ||
              total.a === null ||
              total.a !== total.b
            )
              throw Error(
                "An extra end requires complete tied preceding ends; no end follows a decisive extra end",
              );
          }
      } catch (e) {
        throw new ScoringError(409, (e as Error).message);
      }
      for (const [i, end] of next.entries()) {
        if (i !== command.endNumber! - 1 && before.ends[i]?.state === end.state)
          continue;
        for (const [side, points] of [
          ["a", end.a],
          ["b", end.b],
        ])
          await client.query(
            "INSERT INTO game_end_score(game_id,side,end_number,state,points) VALUES($1,$2,$3,$4,$5) ON CONFLICT(game_id,side,end_number) DO UPDATE SET state=EXCLUDED.state,points=EXCLUDED.points",
            [id, side, i + 1, end.state, points],
          );
      }
    }
    if (command.action === "start" || command.action === "end")
      await client.query(
        "INSERT INTO game_end_hammer(game_id,end_number,hammer) VALUES($1,$2,$3) ON CONFLICT(game_id,end_number) DO UPDATE SET hammer=EXCLUDED.hammer",
        [
          id,
          command.action === "start" ? 1 : command.endNumber,
          command.hammer,
        ],
      );
    if (evidence) {
      const hammers = (
        await client.query(
          "SELECT end_number,hammer FROM game_end_hammer WHERE game_id=$1",
          [id],
        )
      ).rows;
      for (const [i, p] of evidence.placements.entries()) {
        const h = placementHammer(p),
          recorded = hammers.find((r) => r.end_number === i + 1)?.hammer;
        if (h && recorded && h !== recorded)
          throw new ScoringError(
            409,
            "Recorded hammer disagrees with the placement choice; correct both facts together",
          );
      }
    }
    if (command.sporting !== undefined)
      await client.query(
        "INSERT INTO game_sporting_version(game_id,version,entry_a,entry_b,evidence,audit_id) VALUES($1,$2,$3,$4,$5,$6)",
        [
          id,
          before.version + 1,
          before.entryA,
          before.entryB,
          evidence,
          auditId,
        ],
      );
    const changed = await snapshot(client, id),
      totals = scoreTotals(changed.ends);
    await client.query(
      "UPDATE game SET version=version+1,hammer=$2,hammer_end=$5,total_a=$3,total_b=$4,updated_at=now() WHERE id=$1",
      [
        id,
        changed.hammer,
        result
          ? result.totalA
          : command.action === "lineup" || command.action === "evidence"
            ? before.totalA
            : totals.a,
        result
          ? result.totalB
          : command.action === "lineup" || command.action === "evidence"
            ? before.totalB
            : totals.b,
        changed.hammerEnd,
      ],
    );
    const after = await snapshot(client, id),
      response = { requestId: command.requestId, version: after.version };
    const frozenResult = result
      ? {
          ...result,
          endHammer: after.endHammer,
          correction: command.action === "correct",
          entryA: before.entryA,
          entryB: before.entryB,
          nameA: before.nameA,
          nameB: before.nameB,
          lineupA: after.lineupA,
          lineupB: after.lineupB,
          ...(evidence ? { sporting: evidence } : {}),
          ...(command.action === "correct" && !before.results.length
            ? {
                legacyBefore: {
                  entryA: before.entryA,
                  entryB: before.entryB,
                  nameA: before.nameA,
                  nameB: before.nameB,
                  totalA: before.totalA,
                  totalB: before.totalB,
                  ends: before.ends,
                  endHammer: before.endHammer,
                  attribution: "Not recorded",
                },
              }
            : {}),
        }
      : undefined;
    await client.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id,request_id,resource_version,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        auditId,
        actorId,
        command.action === "start"
          ? "game_started"
          : command.action === "confirm"
            ? "result_confirmed"
            : command.action === "correct"
              ? "result_corrected"
              : command.action === "lineup"
                ? "game_lineup_recorded"
                : command.action === "evidence"
                  ? "sporting_evidence_recorded"
                  : "end_saved",
        id,
        command.requestId,
        after.version,
        before,
        result
          ? {
              ...after,
              confirmedResult: frozenResult,
            }
          : after,
      ],
    );
    if (result) {
      const name = (
        await client.query("SELECT name FROM auth_user WHERE id=$1", [actorId])
      ).rows[0].name;
      await client.query(
        "INSERT INTO game_result_version(game_id,version,actor_id,confirmed_by,result,audit_id) VALUES($1,$2,$3,$4,$5,$6)",
        [id, after.version, actorId, name, frozenResult, auditId],
      );
      await advanceDraw(
        client,
        id,
        after.version,
        result.winnerEntryId,
        [before.entryA, before.entryB],
        auditId,
      );
      if (
        command.action === "correct" &&
        before.results[0]?.result.winnerEntryId !== result.winnerEntryId
      ) {
        const deps = await client.query(
          "SELECT d.*,g.state,g.entry_a,g.entry_b FROM game_assignment_dependency d JOIN game g ON g.id=d.downstream_game_id WHERE upstream_game_id=$1 AND NOT EXISTS(SELECT 1 FROM draw_node n JOIN competition_draw cd ON cd.division_id=n.division_id AND cd.version=n.revision AND cd.state='published' WHERE n.game_id=g.id) ORDER BY g.id FOR UPDATE OF g",
          [id],
        );
        for (const dep of deps.rows) {
          const expected =
            dep.route === "winner"
              ? result.winnerEntryId
              : [before.entryA, before.entryB].find(
                  (e) => e !== result!.winnerEntryId,
                );
          const actual = dep.side === "a" ? dep.entry_a : dep.entry_b;
          if (actual !== expected)
            await client.query(
              "INSERT INTO game_assignment_attention(upstream_game_id,result_version,downstream_game_id,side,actual_entry_id,expected_entry_id,downstream_state) VALUES($1,$2,$3,$4,$5,$6,$7)",
              [
                id,
                after.version,
                dep.downstream_game_id,
                dep.side,
                actual,
                expected,
                dep.state,
              ],
            );
        }
      }
    }
    await client.query(
      "INSERT INTO scoring_command(game_id,actor_id,request_id,command,response,audit_id) VALUES($1,$2,$3,$4,$5,$6)",
      [id, actorId, command.requestId, input, response, auditId],
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
export async function scoringReceipt(
  actorId: string,
  id: string,
  requestId: string,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await authorize(c, actorId, id);
    const row = (
      await c.query(
        'SELECT command,response,audit_id AS "auditId" FROM scoring_command WHERE game_id=$1 AND actor_id=$2 AND request_id=$3',
        [id, actorId, requestId],
      )
    ).rows[0];
    await c.query("COMMIT");
    return row
      ? {
          ...row,
          actorId,
          path: `/api/v1/games/${encodeURIComponent(id)}/scoring`,
        }
      : null;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
