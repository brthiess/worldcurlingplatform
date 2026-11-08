import { pool } from "@/db";
import { ApplicationError } from "@/modules/events/applications";
import { isAdministrator, recordAuthority } from "./authority";
const fail = (status: number, message: string): never => {
  throw new ApplicationError(status, message);
};
export async function staffWorkspace(userId: string) {
  const admin = await isAdministrator(pool, userId);
  const events = (
    await pool.query(
      `SELECT e.id,e.name FROM event_edition e WHERE $2 OR EXISTS(SELECT 1 FROM role_grant r WHERE r.user_id=$1 AND r.role='organizer' AND r.event_id=e.id AND r.game_id IS NULL) ORDER BY e.name`,
      [userId, admin],
    )
  ).rows;
  const ids = events.map((e) => e.id);
  const games = (
    await pool.query(
      'SELECT g.id,d.event_id AS "eventId",g.sheet,ds.number AS "drawNumber" FROM game g JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=ds.division_id WHERE d.event_id=ANY($1::text[]) ORDER BY ds.starts_at,g.sheet',
      [ids],
    )
  ).rows;
  const grants = (
    await pool.query(
      'SELECT r.id,r.user_id AS "userId",u.name,r.role,r.event_id AS "eventId",r.game_id AS "gameId" FROM role_grant r JOIN auth_user u ON u.id=r.user_id WHERE r.event_id=ANY($1::text[]) AND ($2 OR r.role=\'scorekeeper\') ORDER BY u.name,r.event_id,r.game_id',
      [ids, admin],
    )
  ).rows;
  return { isAdministrator: admin, events, games, grants };
}
export async function staffCommand(userId: string, raw: unknown) {
  const input = raw as {
    action?: string;
    id: string;
    role: string;
    userId: string;
    recipientEmail?: string;
    eventId: string;
    gameId: string | null;
    reason?: string;
  };
  const action = input?.action ?? "grant",
    reason =
      input?.reason === undefined
        ? "Event staff assignment"
        : typeof input.reason === "string"
          ? input.reason.trim()
          : "";
  if (
    !input ||
    !["grant", "revoke"].includes(action) ||
    typeof input.id !== "string" ||
    !/^[-\w]{1,80}$/.test(input.id) ||
    !reason ||
    reason.length > 1000 ||
    /[\u0000-\u001f]/.test(reason)
  )
    fail(400, "Provide a grant identifier and reason.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `staff:${input.id}`,
    ]);
    const before = (
      await c.query(
        'SELECT r.id,r.user_id AS "userId",u.name,r.role,r.event_id AS "eventId",r.game_id AS "gameId" FROM role_grant r JOIN auth_user u ON u.id=r.user_id WHERE r.id=$1',
        [input.id],
      )
    ).rows[0];
    const admin = await isAdministrator(c, userId);
    const eventId = action === "revoke" ? before?.eventId : input.eventId;
    const organizer = !!(
      await c.query(
        "SELECT id FROM role_grant WHERE user_id=$1 AND role='organizer' AND event_id=$2 AND game_id IS NULL FOR SHARE",
        [userId, eventId],
      )
    ).rowCount;
    if (
      !admin &&
      (!organizer ||
        (action === "revoke" ? before?.role : input.role) !== "scorekeeper")
    )
      fail(
        403,
        "Only World Curling or this event’s organizer can assign scoring access.",
      );
    if (action === "revoke") {
      if (!before) fail(404, "Assignment not found.");
      if (before.role === "administrator")
        fail(400, "This command manages event staff assignments.");
      await c.query("DELETE FROM role_grant WHERE id=$1", [input.id]);
      await recordAuthority(
        c,
        userId,
        "staff_revoked",
        input.id,
        reason,
        before,
        null,
      );
    } else {
      if (typeof input.recipientEmail === "string") {
        const recipient = (
          await c.query(
            "SELECT id FROM auth_user WHERE lower(email)=lower($1)",
            [input.recipientEmail.trim()],
          )
        ).rows[0];
        if (!recipient)
          fail(400, "Account not found. Ask the recipient to register first.");
        input.userId = recipient.id;
      }
      if (
        !["reviewer", "organizer", "scorekeeper"].includes(input.role) ||
        typeof input.userId !== "string" ||
        typeof input.eventId !== "string" ||
        (input.role === "scorekeeper"
          ? typeof input.gameId !== "string"
          : input.gameId !== null)
      )
        fail(400, "Provide a user, role and matching event/game scope.");
      if (
        !(
          await c.query(
            "SELECT e.id FROM event_edition e JOIN auth_user u ON u.id=$2 WHERE e.id=$1 AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM game g JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=ds.division_id WHERE g.id=$3 AND d.event_id=e.id))",
            [input.eventId, input.userId, input.gameId],
          )
        ).rowCount
      )
        fail(400, "User or resource scope not found.");
      if (before) {
        if (
          before.userId !== input.userId ||
          before.role !== input.role ||
          before.eventId !== input.eventId ||
          before.gameId !== input.gameId
        )
          fail(409, "Request identifier already used for another grant.");
      } else {
        await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          `staff-scope:${input.userId}:${input.role}:${input.eventId}:${input.gameId ?? ""}`,
        ]);
        if (
          (
            await c.query(
              "SELECT id FROM role_grant WHERE user_id=$1 AND role=$2 AND event_id=$3 AND game_id IS NOT DISTINCT FROM $4",
              [input.userId, input.role, input.eventId, input.gameId],
            )
          ).rowCount
        )
          fail(
            409,
            "This account already has that assignment. Revoke the existing assignment before replacing it.",
          );
        if (
          (
            await c.query(
              "SELECT id FROM authority_history WHERE resource_id=$1 AND kind='staff_revoked'",
              [input.id],
            )
          ).rowCount
        )
          fail(
            409,
            "This identifier belongs to a revoked assignment. Create a new assignment.",
          );
        await c.query(
          "INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES($1,$2,$3,$4,$5)",
          [input.id, input.userId, input.role, input.eventId, input.gameId],
        );
        await recordAuthority(
          c,
          userId,
          "role_granted",
          input.id,
          reason,
          null,
          {
            userId: input.userId,
            name: (
              await c.query("SELECT name FROM auth_user WHERE id=$1", [
                input.userId,
              ])
            ).rows[0].name,
            role: input.role,
            eventId: input.eventId,
            gameId: input.gameId,
          },
        );
      }
    }
    await c.query("COMMIT");
    return { id: input.id };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
