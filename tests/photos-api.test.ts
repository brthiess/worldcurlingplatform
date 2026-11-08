import { authRequest } from "./auth-request";
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../src/db";
const base = process.env.BETTER_AUTH_URL!;
async function login(role: string) {
  const signIn = () =>
    authRequest(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: role + "@demo.invalid",
        password: process.env.DEMO_PASSWORD,
      }),
    });
  let r = await signIn();
  assert.equal(r.status, 200);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
async function call(path: string, cookie = "", body?: unknown) {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Origin: base, cookie, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
test("linked player submits private immutable bytes and administrator publishes only that reviewed asset", async () => {
  const id = "photo-player-" + crypto.randomUUID();
  await pool.query(
    "INSERT INTO player(id,name,origin) VALUES($1,'Synthetic geometric photo fixture','fictional_demo')",
    [id],
  );
  await pool.query(
    "INSERT INTO player_account_link(player_id,user_id) VALUES($1,'demo-ungranted') ON CONFLICT(user_id) DO UPDATE SET player_id=excluded.player_id",
    [id],
  );
  const owner = await login("ungranted"),
    admin = await login("administrator"),
    other = await login("organizer");
  const bytes = await sharp({
    create: { width: 96, height: 96, channels: 3, background: "#009999" },
  })
    .png()
    .toBuffer();
  const upload = async (
    cookie: string,
    requestId = crypto.randomUUID(),
    data = bytes,
    type = "image/png",
  ) =>
    fetch(base + `/api/v1/players/${id}/photos`, {
      method: "POST",
      headers: {
        Origin: base,
        cookie,
        "Content-Type": type,
        "X-Request-Id": requestId,
      },
      body: new Uint8Array(data),
    });
  assert.equal((await upload(other)).status, 403);
  const requestId = crypto.randomUUID();
  const r = await upload(owner, requestId);
  assert.equal(r.status, 201);
  const first = await r.json();
  assert.equal((await upload(owner, requestId)).status, 201);
  const alternate = await sharp({
    create: { width: 96, height: 96, channels: 3, background: "#eeaa33" },
  })
    .png()
    .toBuffer();
  assert.equal((await upload(owner, requestId, alternate)).status, 409);
  assert.equal((await upload(owner)).status, 409);
  assert.equal(
    (
      await upload(
        owner,
        crypto.randomUUID(),
        Buffer.from("invalid"),
        "image/png",
      )
    ).status,
    400,
  );
  assert.equal(
    (await upload(owner, crypto.randomUUID(), bytes, "image/svg+xml")).status,
    400,
  );
  assert.equal(
    (
      await upload(
        owner,
        crypto.randomUUID(),
        Buffer.alloc(5 * 1024 * 1024 + 1),
      )
    ).status,
    413,
  );
  assert.equal(
    (await call("/api/v1/public/photos/" + first.assetId)).status,
    404,
  );
  assert.equal(
    (await call("/api/v1/photos/" + first.id + "/preview")).status,
    401,
  );
  assert.equal(
    (await call("/api/v1/photos/" + first.id + "/preview", other)).status,
    404,
  );
  const preview = await call("/api/v1/photos/" + first.id + "/preview", admin);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/png");
  const review = (
    photo: typeof first,
    decision: string,
    digest = photo.digest,
  ) =>
    call("/api/v1/photos/" + photo.id + "/review", admin, {
      decision,
      reason: "Reviewed synthetic geometry for local acceptance.",
      digest,
      currentAssetId: photo.currentAssetId,
    });
  assert.equal(
    (
      await call("/api/v1/photos/" + first.id + "/review", other, {
        decision: "approved",
        reason: "Unrelated organizer cannot review.",
        digest: first.digest,
        currentAssetId: null,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/v1/photos/" + first.id + "/review", {
        method: "POST",
        headers: {
          Origin: "https://untrusted.invalid",
          cookie: admin,
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal((await review(first, "approved", "0".repeat(64))).status, 409);
  // Exercise an actual PostgreSQL constraint failure after the public reference
  // update. The HTTP workflow must expose neither a partial approval nor image.
  await pool.query(
    `CREATE FUNCTION wcp013_acceptance_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id='${first.id}' AND NEW.action='player_photo_approved' THEN RAISE EXCEPTION 'Controlled acceptance audit failure'; END IF; RETURN NEW; END $$`,
  );
  await pool.query(
    "CREATE TRIGGER wcp013_acceptance_audit_failure BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION wcp013_acceptance_audit_failure()",
  );
  try {
    assert.equal((await review(first, "approved")).status, 503);
    assert.equal(
      (await call("/api/v1/public/photos/" + first.assetId)).status,
      404,
    );
    const rolledBack = await (await call("/api/v1/photos", owner)).json();
    assert.equal(
      rolledBack.submissions.find((p: { id: string }) => p.id === first.id)
        .status,
      "pending",
    );
    assert.equal(
      (await (await call("/api/v1/public/players/" + id)).json()).photoUrl,
      null,
    );
  } finally {
    await pool.query(
      "DROP TRIGGER wcp013_acceptance_audit_failure ON audit_record",
    );
    await pool.query("DROP FUNCTION wcp013_acceptance_audit_failure()");
  }
  assert.equal((await review(first, "approved")).status, 200);
  const publicBytes = await call("/api/v1/public/photos/" + first.assetId);
  assert.equal(publicBytes.status, 200);
  assert.deepEqual(
    Buffer.from(await publicBytes.arrayBuffer()),
    Buffer.from(await preview.arrayBuffer()),
  );
  assert.equal((await review(first, "approved")).status, 200);
  assert.equal((await review(first, "rejected")).status, 409);
  const second = await (await upload(owner)).json();
  assert.equal(
    (await call("/api/v1/public/photos/" + second.assetId)).status,
    404,
  );
  const before = await (await call("/api/v1/public/players/" + id)).json();
  assert.equal(before.photoUrl, "/api/v1/public/photos/" + first.assetId);
  assert.equal((await review(second, "rejected")).status, 200);
  assert.equal(
    (await call("/api/v1/public/photos/" + second.assetId)).status,
    404,
  );
  assert.equal(
    (await (await call("/api/v1/public/players/" + id)).json()).photoUrl,
    before.photoUrl,
  );
  const third = await (await upload(owner)).json();
  assert.equal((await review(third, "approved")).status, 200);
  assert.equal(
    (await (await call("/api/v1/public/players/" + id)).json()).photoUrl,
    "/api/v1/public/photos/" + third.assetId,
  );
  const fourth = await (await upload(owner)).json();
  const diskPath = path.join(
    process.env.MEDIA_STORAGE_ROOT!,
    fourth.assetId + ".png",
  );
  const original = await readFile(diskPath);
  await writeFile(diskPath, alternate);
  assert.equal(
    (await call("/api/v1/photos/" + fourth.id + "/preview", admin)).status,
    503,
  );
  assert.equal((await review(fourth, "approved")).status, 503);
  assert.equal(
    (await (await call("/api/v1/public/players/" + id)).json()).photoUrl,
    "/api/v1/public/photos/" + third.assetId,
  );
  await writeFile(diskPath, original);
  assert.equal((await review(fourth, "rejected")).status, 200);
  await assert.rejects(() =>
    pool.query("UPDATE player_photo_asset SET digest=$2 WHERE id=$1", [
      first.assetId,
      "0".repeat(64),
    ]),
  );
  await assert.rejects(() =>
    pool.query("UPDATE player_photo_submission SET asset_id=$2 WHERE id=$1", [
      first.id,
      third.assetId,
    ]),
  );
  const workspace = await (await call("/api/v1/photos", owner)).json();
  assert.equal(
    workspace.submissions.filter((p: { playerId: string }) => p.playerId === id)
      .length,
    4,
  );
  assert.equal(
    workspace.submissions.find((p: { id: string }) => p.id === second.id)
      .reason,
    "Reviewed synthetic geometry for local acceptance.",
  );
  const competing = await Promise.all([upload(owner), upload(owner)]);
  assert.deepEqual(competing.map((r) => r.status).sort(), [201, 409]);
  const last = await competing.find((r) => r.status === 201)!.json();
  const decisions = await Promise.all([
    review(last, "approved"),
    review(last, "rejected"),
  ]);
  assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 409]);
  const winningDecision = decisions[0].status === 200 ? "approved" : "rejected";
  const finalWorkspace = await (await call("/api/v1/photos", owner)).json();
  assert.equal(
    finalWorkspace.submissions.find((p: { id: string }) => p.id === last.id)
      .status,
    winningDecision,
  );
  assert.equal(
    (await (await call("/api/v1/public/players/" + id)).json()).photoUrl,
    "/api/v1/public/photos/" +
      (winningDecision === "approved" ? last.assetId : third.assetId),
  );
});
test.after(async () => {
  await pool.end();
});
