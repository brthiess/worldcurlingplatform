import { pool } from "@/db";
import type { PoolClient } from "pg";
import { EntryError, identifier, plainText } from "@/domain/entries";
import {
  represents,
  representationActions,
  type RepresentationAction,
} from "@/domain/representation";
import { isAdministrator, recordAuthority } from "./authority";
type Reader = Pick<PoolClient, "query">;
export async function representationFor(
  c: Reader,
  userId: string,
  teamId: string | null,
  registrationId: string | null,
  season: string | null,
  action: RepresentationAction | "read",
) {
  if (!teamId || !registrationId || !season)
    throw new EntryError(
      "Team-season authority and a configured division entry season are required.",
      403,
    );
  const grants = await c.query(
    'SELECT g.id,g.user_id AS "userId",r.team_id AS "teamId",r.season,g.actions,g.revoked_at AS "revokedAt" FROM team_representation g JOIN season_registration r ON r.id=g.registration_id WHERE g.user_id=$1 AND g.registration_id=$2 FOR SHARE OF g,r',
    [userId, registrationId],
  );
  const grant = grants.rows.find((g) =>
    (action === "read" ? representationActions : [action]).some((a) =>
      represents(g, userId, teamId, season, a),
    ),
  );
  if (!grant)
    throw new EntryError(
      `Current ${action} authority for this exact team and season is required. Player-profile links grant no team authority.`,
      403,
    );
  return grant.id as string;
}
export async function representationWorkspace(userId: string) {
  const admin = await isAdministrator(pool, userId);
  const grants = (
    await pool.query(
      'SELECT g.id,g.user_id AS "userId",u.name AS "userName",g.registration_id AS "registrationId",r.team_id AS "teamId",r.season,g.actions,g.revoked_at AS "revokedAt",g.revocation_reason AS "revocationReason",v.display_name AS name FROM team_representation g JOIN auth_user u ON u.id=g.user_id JOIN season_registration r ON r.id=g.registration_id JOIN season_roster_version v ON v.registration_id=r.id AND v.version=r.version WHERE $2 OR g.user_id=$1 ORDER BY g.created_at DESC',
      [userId, admin],
    )
  ).rows;
  const divisions = (
    await pool.query(
      'SELECT d.id,d.name,e.name AS "eventName",d.entry_season AS season,d.entry_season_version AS "seasonVersion" FROM division d JOIN event_edition e ON e.id=d.event_id WHERE $1 ORDER BY e.starts_on DESC,d.id',
      [admin],
    )
  ).rows;
  const registrations = admin
    ? (
        await pool.query(
          'SELECT r.id,r.team_id AS "teamId",r.season,v.display_name AS name FROM season_registration r JOIN season_roster_version v ON v.registration_id=r.id AND v.version=r.version ORDER BY v.display_name,r.season',
        )
      ).rows
    : [];
  const users = admin
    ? (await pool.query("SELECT id,name FROM auth_user ORDER BY name,id")).rows
    : [];
  const history = (
    await pool.query(
      'SELECT h.id,h.kind,h.resource_id AS "resourceId",h.reason,h.before_state AS before,h.after_state AS after,h.created_at AS "createdAt",u.name AS "actorName" FROM authority_history h JOIN auth_user u ON u.id=h.actor_id WHERE h.kind LIKE \'team_representation_%\' AND ($2 OR EXISTS(SELECT 1 FROM team_representation g WHERE g.id=h.resource_id AND g.user_id=$1)) ORDER BY h.created_at DESC',
      [userId, admin],
    )
  ).rows;
  const receipts = (
    await pool.query(
      'SELECT request_id AS "requestId",command FROM team_representation_command WHERE actor_id=$1 ORDER BY created_at DESC',
      [userId],
    )
  ).rows;
  return {
    actorId: userId,
    isAdministrator: admin,
    grants,
    divisions,
    registrations,
    users,
    history,
    receipts,
  };
}
function seasonValue(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^20\d{2}-\d{2}$/.test(value) ||
    (Number(value.slice(0, 4)) + 1) % 100 !== Number(value.slice(5))
  )
    throw new EntryError("Use a season such as 2026-27.");
  return value;
}
export async function representationCommand(userId: string, raw: unknown) {
  const v = raw as Record<string, unknown>;
  if (!v || !["grant", "revoke", "configure-season"].includes(String(v.action)))
    throw new EntryError("Choose a representation command.");
  const requestId = identifier(v.requestId),
    reason = plainText(v.reason, 1000);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    if (!(await isAdministrator(c, userId)))
      throw new EntryError(
        "Only World Curling staff control team-season representation and entry-season setup.",
        403,
      );
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `team-representation-request:${userId}:${requestId}`,
    ]);
    const duplicate = await c.query(
      "SELECT command=$3::jsonb AS same FROM team_representation_command WHERE actor_id=$1 AND request_id=$2",
      [userId, requestId, JSON.stringify(v)],
    );
    if (duplicate.rowCount) {
      if (!duplicate.rows[0].same)
        throw new EntryError(
          "This command identifier was used for another command.",
          409,
        );
      await c.query("COMMIT");
      return representationWorkspace(userId);
    }
    let before: unknown = null,
      after: unknown,
      resourceId: string;
    if (v.action === "configure-season") {
      resourceId = identifier(v.divisionId);
      const season = seasonValue(v.season);
      const d = (
        await c.query(
          "SELECT id,entry_season,entry_season_version FROM division WHERE id=$1 FOR UPDATE",
          [resourceId],
        )
      ).rows[0];
      if (!d) throw new EntryError("Division not found.", 404);
      if (
        !Number.isSafeInteger(v.version) ||
        v.version !== d.entry_season_version
      )
        throw new EntryError(
          "The division season changed. Reload its current version.",
          409,
        );
      before = d;
      after = (
        await c.query(
          "UPDATE division SET entry_season=$2,entry_season_version=entry_season_version+1 WHERE id=$1 RETURNING id,entry_season,entry_season_version",
          [resourceId, season],
        )
      ).rows[0];
    } else {
      resourceId = identifier(v.id);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `team-representation:${resourceId}`,
      ]);
      const grant = (
        await c.query(
          "SELECT * FROM team_representation WHERE id=$1 FOR UPDATE",
          [resourceId],
        )
      ).rows[0];
      before = grant ?? null;
      if (v.action === "grant") {
        if (grant)
          throw new EntryError(
            "Grant identifier already exists. Revoke and grant separately.",
            409,
          );
        const recipient = identifier(v.userId),
          registration = identifier(v.registrationId);
        if (
          !Array.isArray(v.actions) ||
          !v.actions.length ||
          v.actions.length > 4 ||
          new Set(v.actions).size !== v.actions.length ||
          !v.actions.every((a) =>
            representationActions.includes(a as RepresentationAction),
          )
        )
          throw new EntryError(
            "Choose explicit submit, amend, withdraw or payment actions.",
          );
        if (
          !(await c.query("SELECT id FROM auth_user WHERE id=$1", [recipient]))
            .rowCount ||
          !(
            await c.query(
              "SELECT id FROM season_registration WHERE id=$1 FOR SHARE",
              [registration],
            )
          ).rowCount
        )
          throw new EntryError(
            "Choose an existing account and team-season registration.",
          );
        after = (
          await c.query(
            "INSERT INTO team_representation(id,user_id,registration_id,actions,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
            [resourceId, recipient, registration, v.actions, userId],
          )
        ).rows[0];
      } else {
        if (!grant)
          throw new EntryError("Representation grant not found.", 404);
        if (grant.revoked_at)
          throw new EntryError(
            "Grant already revoked. Recover its original command.",
            409,
          );
        after = (
          await c.query(
            "UPDATE team_representation SET revoked_at=now(),revocation_reason=$2 WHERE id=$1 RETURNING *",
            [resourceId, reason],
          )
        ).rows[0];
      }
    }
    const auditId = await recordAuthority(
      c,
      userId,
      `team_representation_${v.action}`,
      resourceId,
      reason,
      before,
      after,
    );
    await c.query(
      "INSERT INTO team_representation_command(actor_id,request_id,command,audit_id) VALUES($1,$2,$3,$4)",
      [userId, requestId, JSON.stringify(v), auditId],
    );
    await c.query("COMMIT");
    return representationWorkspace(userId);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
