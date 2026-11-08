import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { ProfileError, claimDecision } from "@/domain/profiles";
import {
  processPhoto,
  photoDigest,
  photoReviewDecision,
  mayPreviewPhoto,
  mayPublishPhoto,
} from "@/domain/photos";
import { storePhoto, storedPhoto } from "./photo-storage";
async function transaction<T>(run: (c: PoolClient) => Promise<T>) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const value = await run(c);
    await c.query("COMMIT");
    return value;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
async function admin(c: PoolClient, userId: string) {
  return !!(
    await c.query(
      "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
      [userId],
    )
  ).rowCount;
}
export async function requirePhotoOwner(userId: string, playerId: string) {
  if (
    !(
      await pool.query(
        "SELECT player_id FROM player_account_link WHERE user_id=$1 AND player_id=$2",
        [userId, playerId],
      )
    ).rowCount
  )
    throw new ProfileError(
      "Only the approved profile owner may submit a photo.",
      403,
    );
}
export async function photoWorkspace(userId: string) {
  const result = await pool.query(
    `SELECT s.id,s.player_id AS "playerId",p.name,s.asset_id AS "assetId",a.digest,a.width,a.height,s.status,s.reason,s.created_at AS "createdAt",s.reviewed_at AS "reviewedAt",u.name AS "reviewedBy",p.photo_asset_id AS "currentAssetId" FROM player_photo_submission s JOIN player p ON p.id=s.player_id JOIN player_photo_asset a ON a.id=s.asset_id LEFT JOIN auth_user u ON u.id=s.reviewed_by WHERE s.user_id=$1 OR EXISTS(SELECT 1 FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL) ORDER BY s.created_at DESC,s.id`,
    [userId],
  );
  return { submissions: result.rows };
}
export async function submitPhoto(
  userId: string,
  playerId: string,
  id: string,
  bytes: Buffer,
  type: string,
) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id))
    throw new ProfileError("Invalid request identifier.");
  await requirePhotoOwner(userId, playerId);
  const processed = await processPhoto(bytes, type),
    sourceDigest = photoDigest(bytes);
  return transaction(async (c) => {
    const p = (
      await c.query(
        "SELECT photo_asset_id FROM player WHERE id=$1 FOR UPDATE",
        [playerId],
      )
    ).rows[0];
    if (
      !(
        await c.query(
          "SELECT player_id FROM player_account_link WHERE player_id=$1 AND user_id=$2 FOR SHARE",
          [playerId, userId],
        )
      ).rowCount
    )
      throw new ProfileError("Profile ownership changed.", 403);
    const previous = (
      await c.query(
        "SELECT s.*,a.digest FROM player_photo_submission s JOIN player_photo_asset a ON a.id=s.asset_id WHERE s.id=$1",
        [id],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.player_id !== playerId ||
        previous.user_id !== userId ||
        previous.source_digest !== sourceDigest
      )
        throw new ProfileError(
          "Request identifier already used for different content.",
          409,
        );
      return {
        id,
        assetId: previous.asset_id,
        digest: previous.digest,
        currentAssetId: p.photo_asset_id,
      };
    }
    if (
      (
        await c.query(
          "SELECT id FROM player_photo_submission WHERE player_id=$1 AND status='pending'",
          [playerId],
        )
      ).rowCount
    )
      throw new ProfileError(
        "A photo is already awaiting review. Refresh its status.",
        409,
      );
    const assetId = randomUUID();
    await storePhoto(assetId, processed.bytes);
    await c.query(
      "INSERT INTO player_photo_asset(id,digest,byte_size,width,height) VALUES($1,$2,$3,$4,$5)",
      [
        assetId,
        processed.digest,
        processed.bytes.length,
        processed.width,
        processed.height,
      ],
    );
    await c.query(
      "INSERT INTO player_photo_submission(id,player_id,user_id,asset_id,source_digest) VALUES($1,$2,$3,$4,$5)",
      [id, playerId, userId, assetId, sourceDigest],
    );
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,'player_photo_submitted',$3)",
      [randomUUID(), userId, id],
    );
    return {
      id,
      assetId,
      digest: processed.digest,
      currentAssetId: p.photo_asset_id,
    };
  });
}
export async function reviewPhoto(userId: string, id: string, value: unknown) {
  const input = value as Record<string, unknown>;
  if (
    !input ||
    Object.keys(input).sort().join(",") !==
      "currentAssetId,decision,digest,reason" ||
    typeof input.reason !== "string" ||
    input.reason.trim().length < 5 ||
    input.reason.length > 1000 ||
    /[<>\u0000-\u001f]/.test(input.reason) ||
    typeof input.digest !== "string" ||
    !/^[a-f0-9]{64}$/.test(input.digest) ||
    !(input.currentAssetId === null || typeof input.currentAssetId === "string")
  )
    throw new ProfileError(
      "Provide the reviewed digest, current image and a reason of 5–1000 plain-text characters.",
    );
  claimDecision("pending", String(input.decision));
  const reason = input.reason.trim();
  return transaction(async (c) => {
    if (!(await admin(c, userId)))
      throw new ProfileError(
        "World Curling administrator authority required.",
        403,
      );
    const s = (
      await c.query(
        "SELECT s.*,a.digest FROM player_photo_submission s JOIN player_photo_asset a ON a.id=s.asset_id WHERE s.id=$1 FOR UPDATE OF s",
        [id],
      )
    ).rows[0];
    if (!s) throw new ProfileError("Photo request not found.", 404);
    const p = (
      await c.query(
        "SELECT photo_asset_id FROM player WHERE id=$1 FOR UPDATE",
        [s.player_id],
      )
    ).rows[0];
    if (
      photoReviewDecision(
        {
          status: s.status,
          digest: s.digest,
          currentAssetId: p.photo_asset_id,
          reviewedBy: s.reviewed_by,
          reason: s.reason,
        },
        {
          decision: String(input.decision),
          digest: String(input.digest),
          currentAssetId: input.currentAssetId as string | null,
          reason,
        },
        userId,
      ) === "replay"
    )
      return { id, status: s.status };
    await storedPhoto(s.asset_id, s.digest);
    await c.query(
      "UPDATE player_photo_submission SET status=$2,reason=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1",
      [id, input.decision, reason, userId],
    );
    if (input.decision === "approved")
      await c.query("UPDATE player SET photo_asset_id=$2 WHERE id=$1", [
        s.player_id,
        s.asset_id,
      ]);
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [randomUUID(), userId, "player_photo_" + input.decision, id],
    );
    return { id, status: input.decision };
  });
}
export async function previewPhoto(userId: string, id: string) {
  const s = (
    await pool.query(
      `SELECT a.id,a.digest,s.user_id,EXISTS(SELECT 1 FROM role_grant WHERE user_id=$2 AND role='administrator' AND event_id IS NULL AND game_id IS NULL) AS administrator FROM player_photo_submission s JOIN player_photo_asset a ON a.id=s.asset_id WHERE s.id=$1`,
      [id, userId],
    )
  ).rows[0];
  if (!s || !mayPreviewPhoto(userId, s.user_id, s.administrator))
    throw new ProfileError("Photo not found.", 404);
  return storedPhoto(s.id, s.digest);
}
export async function publicPhoto(id: string) {
  const a = (
    await pool.query(
      "SELECT a.id,a.digest,s.status,p.photo_asset_id FROM player_photo_asset a JOIN player_photo_submission s ON s.asset_id=a.id JOIN player p ON p.id=s.player_id WHERE a.id=$1",
      [id],
    )
  ).rows[0];
  if (!a || !mayPublishPhoto(a.status, a.photo_asset_id, a.id))
    throw new ProfileError("Photo not found.", 404);
  return storedPhoto(a.id, a.digest);
}
