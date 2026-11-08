import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db";
import { hashPassword } from "better-auth/crypto";
const base = process.env.BETTER_AUTH_URL!;
async function call(path: string, body?: unknown, cookie = "") {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Origin: base, "Content-Type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const sessions = new Map<string, string>();
async function login(role: string): Promise<string> {
  if (sessions.has(role)) return sessions.get(role)!;
  let r = await call("/api/auth/sign-in/email", {
    email: role + "@demo.invalid",
    password: process.env.DEMO_PASSWORD,
  });
  if (r.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 61000));
    r = await call("/api/auth/sign-in/email", {
      email: role + "@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    });
  }
  assert.equal(r.status, 200);
  const cookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  sessions.set(role, cookie);
  return cookie;
}
async function fixture() {
  const key = crypto.randomUUID(),
    playerId = "test-player-" + key,
    role = "claimant-" + key;
  await pool.query(
    "INSERT INTO player(id,name,origin) VALUES($1,'Alex Demo','fictional_demo')",
    [playerId],
  );
  await pool.query(
    "INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,$2,$3,true)",
    [role, "Synthetic claimant", role + "@demo.invalid"],
  );
  await pool.query(
    "INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now())",
    [crypto.randomUUID(), role, await hashPassword(process.env.DEMO_PASSWORD!)],
  );
  return { playerId, cookie: await login(role) };
}
test("public players are independent of accounts; approved claims permit only their own text changes", async () => {
  const fixtureData = await fixture(),
    playerId = fixtureData.playerId;
  const publicResponse = await call("/api/v1/public/players/" + playerId);
  assert.equal(publicResponse.status, 200);
  const publicPlayer = await publicResponse.json();
  assert.equal(publicPlayer.name, "Alex Demo");
  assert.equal(publicPlayer.origin, "fictional_demo");
  assert.deepEqual(Object.keys(publicPlayer).sort(), [
    "biography",
    "handedness",
    "id",
    "name",
    "origin",
  ]);
  const cookie = fixtureData.cookie,
    admin = await login("administrator"),
    organizer = await login("organizer");
  const profile = {
    biography: "Community curling volunteer.",
    handedness: "left",
    version: 0,
  };
  assert.equal(
    (await call("/api/v1/players/" + playerId + "/profile", profile, cookie))
      .status,
    403,
  );
  const id = "claim-" + crypto.randomUUID();
  const claim = {
    id,
    playerId,
    message: "This fictional profile represents me in the demonstration.",
  };
  assert.equal(
    (await call("/api/v1/player-claims", claim, cookie)).status,
    201,
  );
  assert.equal(
    (await call("/api/v1/player-claims", claim, cookie)).status,
    201,
  );
  assert.equal(
    (
      await call(
        "/api/v1/player-claims/" + id + "/review",
        {
          decision: "approved",
          reason: "Identity reviewed for local demonstration.",
        },
        organizer,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/v1/player-claims/" + id + "/review",
        {
          decision: "approved",
          reason: "Identity reviewed for local demonstration.",
        },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/api/v1/players/" + playerId + "/profile", profile, cookie))
      .status,
    200,
  );
  assert.equal(
    (await call("/api/v1/players/" + playerId + "/profile", profile, cookie))
      .status,
    409,
  );
  assert.equal(
    (
      await call(
        "/api/v1/players/" + playerId + "/profile",
        { ...profile, version: 1, name: "Renamed" },
        cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/api/v1/players/" + playerId + "/profile",
        { ...profile, version: 1 },
        organizer,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/v1/players/" + playerId + "/profile",
        { ...profile, version: 1 },
        admin,
      )
    ).status,
    403,
  );
  assert.equal(
    (await call("/api/v1/players/demo-player-other/profile", profile, cookie))
      .status,
    403,
  );
  assert.equal(
    (await call("/api/v1/games/game-2/access", undefined, cookie)).status,
    403,
  );
  const after = await (await call("/api/v1/public/players/" + playerId)).json();
  assert.equal(after.biography, "Community curling volunteer.");
  assert.equal(after.handedness, "left");
  const mine = await (
    await call("/api/v1/player-claims", undefined, cookie)
  ).json();
  assert.equal(
    mine.claims.find((c: { id: string }) => c.id === id).status,
    "approved",
  );
  assert.equal(mine.owned[0].version, 1);
  assert.equal(
    (
      await call(
        "/api/v1/player-claims/" + id + "/review",
        { decision: "rejected", reason: "Changed decision." },
        admin,
      )
    ).status,
    409,
  );
});
test("concurrent reviews preserve a single link and final history; private claims stay scoped", async () => {
  const a = await fixture(),
    b = await fixture(),
    admin = await login("administrator");
  const ids = ["claim-" + crypto.randomUUID(), "claim-" + crypto.randomUUID()];
  for (const [index, cookie] of [a.cookie, b.cookie].entries())
    assert.equal(
      (
        await call(
          "/api/v1/player-claims",
          {
            id: ids[index],
            playerId: a.playerId,
            message: "Synthetic identity evidence for local review.",
          },
          cookie,
        )
      ).status,
      201,
    );
  const result = await Promise.all(
    ids.map((id) =>
      call(
        "/api/v1/player-claims/" + id + "/review",
        { decision: "approved", reason: "Reviewed local synthetic evidence." },
        admin,
      ),
    ),
  );
  assert.deepEqual(result.map((r) => r.status).sort(), [200, 409]);
  const winner = result[0].status === 200 ? 0 : 1,
    loser = 1 - winner;
  const pending = await (
    await call(
      "/api/v1/player-claims",
      undefined,
      loser === 0 ? a.cookie : b.cookie,
    )
  ).json();
  assert.equal(
    pending.claims.find((claim: { id: string }) => claim.id === ids[loser])
      .status,
    "pending",
  );
  assert.equal(
    (
      await call(
        "/api/v1/player-claims/" + ids[winner] + "/review",
        { decision: "approved", reason: "Reviewed local synthetic evidence." },
        admin,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/api/v1/player-claims/" + ids[loser] + "/review",
        {
          decision: "rejected",
          reason: "Player already linked to another account.",
        },
        admin,
      )
    ).status,
    200,
  );
  const aView = await (
      await call("/api/v1/player-claims", undefined, a.cookie)
    ).json(),
    bView = await (
      await call("/api/v1/player-claims", undefined, b.cookie)
    ).json();
  assert.deepEqual(
    aView.claims.map((c: { id: string }) => c.id),
    [ids[0]],
  );
  assert.deepEqual(
    bView.claims.map((c: { id: string }) => c.id),
    [ids[1]],
  );
  const winnerCookie = winner === 0 ? a.cookie : b.cookie;
  assert.equal(
    (
      await call(
        "/api/v1/player-claims",
        {
          id: "claim-" + crypto.randomUUID(),
          playerId: b.playerId,
          message: "Cannot claim a second player with the same account.",
        },
        winnerCookie,
      )
    ).status,
    409,
  );
  const malicious = await fetch(base + "/api/v1/player-claims", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.invalid",
      cookie: a.cookie,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(malicious.status, 403);
  assert.equal((await call("/api/v1/player-claims", {}, a.cookie)).status, 400);
});
test.after(async () => {
  await pool.end();
});
