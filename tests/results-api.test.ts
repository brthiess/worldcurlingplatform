import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});
after(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
async function login(role = "scorekeeper") {
  const r = await authRequest(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${role}@demo.invalid`,
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(r.status, 200);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
test("assigned scorekeeper confirms, retries and corrects with recoverable immutable participant/result versions", async () => {
  const id = `results-${randomUUID()}`,
    cookie = await login();
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,'draw-2','R','Result test','scheduled','entry-1','entry-3','North','Prairie')",
    [id],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$1)",
    [id],
  );
  const headers = { cookie, Origin: base, "Content-Type": "application/json" };
  const post = (c: object, extra = {}) =>
    fetch(`${base}/api/v1/games/${id}/scoring`, {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(c),
    });
  const get = async () => {
    const r = await fetch(`${base}/api/v1/games/${id}/scoring`, { headers });
    assert.equal(r.status, 200);
    return r.json();
  };
  const command = (expectedVersion: number, action: string, extra = {}) => ({
    requestId: randomUUID(),
    expectedVersion,
    action,
    hammer: null,
    ...extra,
  });
  assert.equal((await post(command(0, "start"))).status, 200);
  assert.equal(
    (
      await post(
        command(1, "end", {
          endNumber: 1,
          end: { state: "played", a: 2, b: 0 },
        }),
      )
    ).status,
    200,
  );
  const confirm = command(2, "confirm", {
    outcome: "normal",
    winnerEntryId: "entry-1",
    reason: "",
  });
  assert.equal((await post(confirm)).status, 200);
  const first = await get();
  assert.equal(first.state, "confirmed");
  assert.equal(first.results[0].version, 3);
  assert.equal(first.results[0].result.winnerEntryId, "entry-1");
  assert.equal(first.results[0].actorId, "demo-scorekeeper");
  assert.equal(first.results[0].result.lineupA.entryId, "entry-1");
  assert.equal(first.results[0].result.lineupA.mode, "defaulted");
  assert.equal(first.results[0].result.lineupA.eventLineupVersion, null);
  assert.deepEqual(first.results[0].result.lineupA.members, []);
  assert.equal(first.ends[1].state, "unplayed");
  const duplicate = await post(confirm);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).version, 3);
  const correct = command(3, "correct", {
    outcome: "conceded",
    winnerEntryId: "entry-3",
    reason: "North conceded; winner initially reversed",
    ends: [{ state: "played", a: 2, b: 0 }],
  });
  assert.equal((await post(correct)).status, 200);
  const revised = await get();
  assert.equal(revised.version, 4);
  assert.equal(revised.results.length, 2);
  assert.equal(revised.results[0].result.winnerEntryId, "entry-3");
  assert.equal(revised.results[0].result.outcome, "conceded");
  assert.deepEqual(revised.results[1], first.results[0]);
  assert.equal(
    (await post({ ...correct, requestId: randomUUID() })).status,
    409,
  );
  const reviewer = await login("reviewer");
  assert.equal(
    (
      await post(
        command(4, "correct", {
          ...correct,
          requestId: randomUUID(),
          expectedVersion: 4,
        }),
        { cookie: reviewer },
      )
    ).status,
    403,
  );
  const publicData = await (
    await fetch(`${base}/api/v1/public/games/${id}`)
  ).json();
  assert.equal(publicData.games[0].results[0].result.winnerEntryId, "entry-3");
  assert.doesNotMatch(
    JSON.stringify(publicData),
    /actorId|requestId|demo-scorekeeper|scoringSource/,
  );
});
