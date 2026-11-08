import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  ScheduleError,
  scheduleConflicts,
  venueInstant,
  drawEvidenceState,
} from "@/domain/scheduling";
import { gameLineup } from "@/modules/scoring/lineups";

type SessionInput = {
  id: string;
  divisionId: string;
  number: number;
  localStart: string;
  utcOffset: string;
  durationMinutes: number;
};
type Base = { requestId: string; expectedVersion: number; reason: string };
type Command = Base &
  (
    | { action: "session"; session: SessionInput }
    | { action: "assign"; gameId: string; drawId: string; sheet: string }
  );
const identifier = (s: unknown): s is string =>
  typeof s === "string" && /^[a-zA-Z0-9-]{1,100}$/.test(s);
function parse(value: unknown): Command {
  const c = value as Command;
  if (
    !c ||
    !identifier(c.requestId) ||
    !Number.isSafeInteger(c.expectedVersion) ||
    c.expectedVersion < 0 ||
    typeof c.reason !== "string" ||
    !c.reason.trim() ||
    c.reason.length > 500
  )
    throw new ScheduleError(
      "Provide a request identifier, current schedule version and revision reason.",
    );
  const base = {
    requestId: c.requestId,
    expectedVersion: c.expectedVersion,
    reason: c.reason.trim(),
  };
  if (c.action === "session") {
    const s = c.session;
    if (
      !s ||
      !identifier(s.id) ||
      !identifier(s.divisionId) ||
      !Number.isSafeInteger(s.number) ||
      s.number < 1 ||
      s.number > 100000 ||
      !Number.isInteger(s.durationMinutes) ||
      s.durationMinutes < 15 ||
      s.durationMinutes > 1440 ||
      typeof s.localStart !== "string" ||
      typeof s.utcOffset !== "string"
    )
      throw new ScheduleError(
        "Provide the division, draw number, venue time, UTC offset and duration (15–1440 minutes).",
      );
    return {
      ...base,
      action: "session",
      session: {
        id: s.id,
        divisionId: s.divisionId,
        number: s.number,
        localStart: s.localStart,
        utcOffset: s.utcOffset,
        durationMinutes: s.durationMinutes,
      },
    };
  }
  if (
    c.action === "assign" &&
    identifier(c.gameId) &&
    identifier(c.drawId) &&
    typeof c.sheet === "string" &&
    /^[A-Za-z0-9 -]{1,16}$/.test(c.sheet) &&
    c.sheet.trim()
  )
    return {
      ...base,
      action: "assign",
      gameId: c.gameId,
      drawId: c.drawId,
      sheet: c.sheet.trim().toUpperCase(),
    };
  throw new ScheduleError(
    "Choose a session revision or an existing game and sheet assignment.",
  );
}
async function authorize(c: PoolClient, userId: string, eventId: string) {
  const grants = await c.query(
    "SELECT 1 FROM role_grant WHERE user_id=$1 AND ((role='administrator' AND event_id IS NULL AND game_id IS NULL) OR (role='organizer' AND event_id=$2 AND game_id IS NULL)) FOR SHARE",
    [userId, eventId],
  );
  if (!grants.rowCount)
    throw new ScheduleError(
      "Organizer authority for this edition is required.",
      403,
    );
}
async function snapshot(c: PoolClient, eventId: string) {
  const event = (
    await c.query(
      "SELECT id,name,venue,timezone,schedule_version AS version FROM event_edition WHERE id=$1",
      [eventId],
    )
  ).rows[0];
  if (!event) throw new ScheduleError("Edition not found.", 404);
  const divisions = (
    await c.query(
      "SELECT id,name,discipline FROM division WHERE event_id=$1 ORDER BY name,id",
      [eventId],
    )
  ).rows;
  const draws = (
    await c.query(
      'SELECT ds.id,ds.division_id AS "divisionId",ds.number,ds.starts_at AS "startsAt",ds.duration_minutes AS "durationMinutes",ds.state FROM draw_session ds JOIN division d ON d.id=ds.division_id WHERE d.event_id=$1 ORDER BY ds.starts_at,ds.number,ds.id',
      [eventId],
    )
  ).rows.map((d) => ({ ...d, startsAt: d.startsAt.toISOString() }));
  const rows = (
    await c.query(
      'SELECT g.id,g.draw_id AS "drawId",g.division_id AS "divisionId",g.sheet,g.state,g.entry_a AS "entryA",g.entry_b AS "entryB",coalesce(a.display_name,g.slot_a) AS "nameA",coalesce(b.display_name,g.slot_b) AS "nameB" FROM game g LEFT JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=g.division_id LEFT JOIN event_entry a ON a.id=g.entry_a LEFT JOIN event_entry b ON b.id=g.entry_b WHERE d.event_id=$1 ORDER BY g.id',
      [eventId],
    )
  ).rows;
  const games = [];
  for (const row of rows) {
    const lineups = await Promise.all(
      (["a", "b"] as const).map((side) =>
        row[side === "a" ? "entryA" : "entryB"]
          ? gameLineup(
              c,
              row.id,
              side,
              row[side === "a" ? "entryA" : "entryB"],
              row.state === "confirmed",
            )
          : null,
      ),
    );
    const unknown = lineups.some(
      (l) =>
        !l ||
        l.members.filter((m) => m.role !== "coach").length <
          (divisions.find((d) => d.id === row.divisionId)?.discipline ===
          "mixed_doubles"
            ? 2
            : 4) ||
        l.members.some(
          (m) => m.role !== "coach" && m.identityStatus === "provisional",
        ),
    );
    games.push({
      ...row,
      coverage: unknown
        ? "Incomplete / unresolved player coverage"
        : "Declared/defaulted players; participation unverified",
      lineupReferences: lineups.filter(Boolean).map((l) => ({
        entryId: l!.entryId,
        eventLineupVersion: l!.eventLineupVersion,
        mode: l!.mode,
      })),
      players: [
        ...new Set(
          lineups.flatMap(
            (l) =>
              l?.members
                .filter((m) => m.role !== "coach")
                .map((m) => m.playerId) ?? [],
          ),
        ),
      ],
      playerNames: Object.fromEntries(
        lineups.flatMap(
          (l) =>
            l?.members
              .filter((m) => m.role !== "coach")
              .map((m) => [m.playerId, m.name]) ?? [],
        ),
      ),
    });
  }
  const conflicts = scheduleConflicts(
    games.filter((g) => draws.some(d=>d.id===g.drawId)).map((g) => {
      const d = draws.find((d) => d.id === g.drawId)!;
      return {
        id: g.id,
        startsAt: d.startsAt,
        durationMinutes: d.durationMinutes,
        sheet: g.sheet,
        entries: [g.entryA, g.entryB].filter(Boolean),
        players: g.players,
      };
    }),
  );
  for (const draw of draws)
    draw.state = drawEvidenceState(
      games.filter((g) => g.drawId === draw.id).map((g) => g.state),
    );
  return {
    event,
    version: event.version as number,
    divisions,
    draws,
    games,
    conflicts,
  };
}
export type ScheduleSnapshot = Awaited<ReturnType<typeof snapshot>>;
export async function readSchedule(userId: string, eventId: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await authorize(c, userId, eventId);
    const data = await snapshot(c, eventId);
    const history = (
      await c.query(
        "SELECT version,created_at AS \"createdAt\",command->>'reason' AS reason,command->>'action' AS action FROM schedule_revision WHERE event_id=$1 ORDER BY version DESC",
        [eventId],
      )
    ).rows;
    await c.query("COMMIT");
    return { ...data, history };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function saveSchedule(
  userId: string,
  eventId: string,
  input: unknown,
) {
  const command = parse(input),
    c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      eventId,
    ]);
    await authorize(c, userId, eventId);
    const previous = (
      await c.query(
        "SELECT command,response,command=$4::jsonb AS same FROM schedule_revision WHERE event_id=$1 AND actor_id=$2 AND request_id=$3",
        [eventId, userId, command.requestId, JSON.stringify(command)],
      )
    ).rows[0];
    if (previous) {
      if (!previous.same)
        throw new ScheduleError(
          "Request identifier already used for a different revision.",
          409,
        );
      await c.query("COMMIT");
      return previous.response as ScheduleSnapshot;
    }
    // Serialize with actual scoring/lineup commands. No game score/version/source is rewritten.
    await c.query(
      "SELECT g.id FROM game g LEFT JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=g.division_id WHERE d.event_id=$1 ORDER BY g.id FOR UPDATE OF g",
      [eventId],
    );
    await c.query(
      "SELECT e.id FROM event_entry e JOIN division d ON d.id=e.division_id WHERE d.event_id=$1 ORDER BY e.id FOR SHARE OF e",
      [eventId],
    );
    const before = await snapshot(c, eventId);
    if (command.expectedVersion !== before.version)
      throw new ScheduleError(
        "Schedule changed. Reload the accepted schedule before applying your edit.",
        409,
      );
    if (command.action === "session") {
      const s = command.session,
        existing = (
          await c.query("SELECT division_id FROM draw_session WHERE id=$1", [
            s.id,
          ])
        ).rows[0];
      if (
        !before.divisions.some((d) => d.id === s.divisionId) ||
        (existing && existing.division_id !== s.divisionId)
      )
        throw new ScheduleError(
          "Session is outside this division/edition.",
          403,
        );
      const instant = venueInstant(
        s.localStart,
        before.event.timezone,
        s.utcOffset,
      );
      const changed = await c.query(
        "INSERT INTO draw_session(id,division_id,number,starts_at,state,duration_minutes) VALUES($1,$2,$3,$4,'scheduled',$5) ON CONFLICT(id) DO UPDATE SET number=excluded.number,starts_at=excluded.starts_at,duration_minutes=excluded.duration_minutes WHERE draw_session.division_id=excluded.division_id RETURNING id",
        [s.id, s.divisionId, s.number, instant, s.durationMinutes],
      );
      if (!changed.rowCount)
        throw new ScheduleError(
          "Session is outside this division/edition.",
          403,
        );
    } else {
      const game = before.games.find((g) => g.id === command.gameId),
        draw = before.draws.find((d) => d.id === command.drawId);
      if (!game || !draw || game.divisionId !== draw.divisionId)
        throw new ScheduleError(
          "Game and session must belong to the same authorized division.",
          403,
        );
      await c.query("UPDATE game SET draw_id=$2,sheet=$3 WHERE id=$1", [
        command.gameId,
        command.drawId,
        command.sheet,
      ]);
    }
    await c.query(
      "UPDATE event_edition SET schedule_version=schedule_version+1 WHERE id=$1",
      [eventId],
    );
    const response = await snapshot(c, eventId),
      auditId = randomUUID();
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id,request_id,resource_version,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        auditId,
        userId,
        `schedule.${command.action}`,
        eventId,
        command.requestId,
        response.version,
        JSON.stringify(before),
        JSON.stringify(response),
      ],
    );
    await c.query(
      "INSERT INTO schedule_revision(event_id,version,actor_id,request_id,command,before_state,response,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        eventId,
        response.version,
        userId,
        command.requestId,
        JSON.stringify(command),
        JSON.stringify(before),
        JSON.stringify(response),
        auditId,
      ],
    );
    await c.query("COMMIT");
    return response;
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      throw new ScheduleError(
        "Draw number or identifier already exists. Reload and choose another.",
        409,
      );
    throw e;
  } finally {
    c.release();
  }
}
