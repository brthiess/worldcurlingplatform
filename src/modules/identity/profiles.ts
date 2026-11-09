import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  canEditProfile,
  claimDecision,
  profileInput,
  ProfileError,
} from "@/domain/profiles";
export async function publicPlayers(id?: string) {
  const result = await pool.query(
    `SELECT p.id,p.name,p.origin,p.biography,p.handedness,p.identity_status AS "identityStatus",CASE WHEN p.photo_asset_id IS NOT NULL THEN '/api/v1/public/photos/' || p.photo_asset_id ELSE NULL END AS "photoUrl",
     ARRAY(SELECT DISTINCT ev.name || ' · ' || d.name FROM event_lineup_member m JOIN event_entry en ON en.id=m.entry_id AND en.version=m.version JOIN division d ON d.id=en.division_id JOIN event_edition ev ON ev.id=d.event_id WHERE m.player_id=p.id AND ev.published AND ev.admission_status='approved' ORDER BY 1 LIMIT 4) AS contexts
     FROM player p WHERE ($1::text IS NULL OR p.id=$1) ORDER BY p.name,p.id`,
    [id ?? null],
  );
  return id ? (result.rows[0] ?? null) : result.rows;
}
export async function claimWorkspace(userId: string) {
  const admin = await pool.query(
    "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL",
    [userId],
  );
  const claims = await pool.query(
    `SELECT c.id,c.player_id AS "playerId",p.name,c.status,c.message,c.reason,c.created_at AS "createdAt",c.reviewed_at AS "reviewedAt",u.name AS "claimantName" FROM player_claim c JOIN player p ON p.id=c.player_id JOIN auth_user u ON u.id=c.user_id WHERE c.user_id=$1 OR $2 ORDER BY c.created_at DESC,c.id`,
    [userId, !!admin.rowCount],
  );
  const owned = await pool.query(
    "SELECT p.id,p.name,p.biography,p.handedness,p.version FROM player p JOIN player_account_link l ON l.player_id=p.id WHERE l.user_id=$1",
    [userId],
  );
  return {
    canReview: !!admin.rowCount,
    claims: claims.rows,
    owned: owned.rows,
  };
}
async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505")
      throw new ProfileError(
        "A profile link or pending claim already exists. Refresh your claim status.",
        409,
      );
    throw error;
  } finally {
    client.release();
  }
}
function text(value: unknown, min: number, max: number) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max ||
    /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new ProfileError(`Use ${min}–${max} plain-text characters.`);
  return value.trim();
}
function keys(value: unknown, expected: string) {
  if (
    !value ||
    typeof value !== "object" ||
    Object.keys(value).sort().join(",") !== expected
  )
    throw new ProfileError("Unexpected or missing fields.");
}
export async function requestClaim(userId: string, value: unknown) {
  keys(value, "id,message,playerId");
  const input = value as Record<string, unknown>;
  const id = text(input.id, 1, 80),
    playerId = text(input.playerId, 1, 80),
    message = text(input.message, 10, 1000);
  if (!/^[a-zA-Z0-9-]+$/.test(id))
    throw new ProfileError("Invalid request identifier.");
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(721012)");
    const verified = await client.query(
      "SELECT id FROM auth_user WHERE id=$1 AND email_verified=true",
      [userId],
    );
    if (!verified.rowCount)
      throw new ProfileError(
        "Verify your email before requesting a profile.",
        403,
      );
    const previous = await client.query(
      "SELECT user_id,player_id,message FROM player_claim WHERE id=$1",
      [id],
    );
    if (previous.rowCount) {
      const p = previous.rows[0];
      if (
        p.user_id !== userId ||
        p.player_id !== playerId ||
        p.message !== message
      )
        throw new ProfileError("Request identifier already used.", 409);
      return { id };
    }
    if (
      !(await client.query("SELECT id FROM player WHERE id=$1", [playerId]))
        .rowCount
    )
      throw new ProfileError("Player not found.", 404);
    if (
      (
        await client.query(
          "SELECT player_id FROM player_account_link WHERE player_id=$1 OR user_id=$2",
          [playerId, userId],
        )
      ).rowCount
    )
      throw new ProfileError(
        "This player or account already has an approved link.",
        409,
      );
    await client.query(
      "INSERT INTO player_claim(id,player_id,user_id,message) VALUES($1,$2,$3,$4)",
      [id, playerId, userId, message],
    );
    await client.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), userId, "player_claim_requested", id],
    );
    return { id };
  });
}
export async function reviewClaim(userId: string, id: string, value: unknown) {
  keys(value, "decision,reason");
  const input = value as Record<string, unknown>;
  const reason = text(input.reason, 5, 1000);
  claimDecision("pending", String(input.decision));
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(721012)");
    if (
      !(
        await client.query(
          "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
          [userId],
        )
      ).rowCount
    )
      throw new ProfileError(
        "World Curling administrator authority required.",
        403,
      );
    const result = await client.query(
      "SELECT * FROM player_claim WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!result.rowCount) throw new ProfileError("Claim not found.", 404);
    const c = result.rows[0];
    if (claimDecision(c.status, String(input.decision)) === "replay") {
      if (c.reason !== reason || c.reviewed_by !== userId)
        throw new ProfileError(
          "This review differs from the recorded decision.",
          409,
        );
      return { id, status: c.status };
    }
    if (input.decision === "approved") {
      if (
        (
          await client.query(
            "SELECT player_id FROM player_account_link WHERE player_id=$1 OR user_id=$2",
            [c.player_id, c.user_id],
          )
        ).rowCount
      )
        throw new ProfileError(
          "Another approved claim conflicts with this request.",
          409,
        );
      await client.query(
        "INSERT INTO player_account_link(player_id,user_id) VALUES($1,$2)",
        [c.player_id, c.user_id],
      );
    }
    await client.query(
      "UPDATE player_claim SET status=$2,reason=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1",
      [id, input.decision, reason, userId],
    );
    await client.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), userId, "player_claim_" + input.decision, id],
    );
    return { id, status: input.decision };
  });
}
export async function editProfile(userId: string, id: string, value: unknown) {
  const input = profileInput(value);
  return transaction(async (client) => {
    const result = await client.query(
      "SELECT p.version,l.user_id FROM player p LEFT JOIN player_account_link l ON l.player_id=p.id WHERE p.id=$1 FOR UPDATE OF p",
      [id],
    );
    if (!result.rowCount) throw new ProfileError("Player not found.", 404);
    if (!canEditProfile(userId, result.rows[0].user_id ?? null))
      throw new ProfileError(
        "Only the approved profile owner may edit these fields.",
        403,
      );
    if (result.rows[0].version !== input.version)
      throw new ProfileError(
        "This profile changed. Reload before saving again.",
        409,
      );
    const next = input.version + 1;
    await client.query(
      "UPDATE player SET biography=$2,handedness=$3,version=$4 WHERE id=$1",
      [id, input.biography, input.handedness, next],
    );
    await client.query(
      "INSERT INTO player_profile_history(id,player_id,actor_id,version,biography,handedness) VALUES($1,$2,$3,$4,$5,$6)",
      [randomUUID(), id, userId, next, input.biography, input.handedness],
    );
    await client.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), userId, "player_profile_updated", id],
    );
    return { version: next };
  });
}
