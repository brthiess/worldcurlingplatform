import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { scoringFixtureDraw } from "./scoring-fixture";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});
after(async () => {
  await pool.query("DELETE FROM role_grant WHERE id LIKE 'results-%'");
  await pool.end();
});
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
  await scoringFixtureDraw(pool);
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,'scoring-test-draw','R','Result test','scheduled','entry-1','entry-3','North','Prairie')",
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
  assert.equal((await post(command(0, "start", { hammer: "a" }))).status, 200);
  assert.equal(
    (
      await post(
        command(1, "end", {
          endNumber: 1,
          end: { state: "played", a: 2, b: 0 },
          hammer: "b",
        }),
      )
    ).status,
    200,
  );
  for (let endNumber = 2; endNumber <= 8; endNumber++)
    assert.equal(
      (
        await post(
          command(endNumber, "end", {
            endNumber,
            end: { state: "played", a: 0, b: 0 },
          }),
        )
      ).status,
      200,
    );
  const confirm = command(9, "confirm", {
    outcome: "normal",
    winnerEntryId: "entry-1",
    reason: "",
  });
  assert.equal((await post(confirm)).status, 200);
  const first = await get();
  assert.equal(first.state, "confirmed");
  assert.equal(first.results[0].version, 10);
  assert.equal(first.results[0].result.winnerEntryId, "entry-1");
  assert.equal(first.results[0].actorId, "demo-scorekeeper");
  assert.equal(first.results[0].result.endHammer[0], "b");
  assert.equal(first.results[0].result.lineupA.entryId, "entry-1");
  assert.equal(first.results[0].result.lineupA.mode, "defaulted");
  assert.equal(first.results[0].result.lineupA.eventLineupVersion, null);
  assert.deepEqual(first.results[0].result.lineupA.members, []);
  assert.equal(first.ends[1].state, "played");
  const duplicate = await post(confirm);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).version, 10);
  const correct = command(10, "correct", {
    outcome: "conceded",
    winnerEntryId: "entry-3",
    reason: "North conceded; winner initially reversed",
    ends: [{ state: "played", a: 2, b: 0 }],
    endHammer: ["a"],
  });
  assert.equal((await post(correct)).status, 200);
  const revised = await get();
  assert.equal(revised.version, 11);
  assert.equal(revised.results.length, 2);
  assert.equal(revised.results[0].result.winnerEntryId, "entry-3");
  assert.equal(revised.results[0].result.outcome, "conceded");
  assert.equal(revised.endHammer[0], "a");
  assert.equal(revised.results[0].result.endHammer[0], "a");
  assert.deepEqual(revised.results[1], first.results[0]);
  assert.equal(
    (await post({ ...correct, requestId: randomUUID() })).status,
    409,
  );
  const reviewer = await login("reviewer");
  assert.equal(
    (
      await post(
        command(11, "correct", {
          ...correct,
          requestId: randomUUID(),
          expectedVersion: 11,
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
test("referenced defaults, declared differences and corrected downstream conflicts retain actual sporting evidence atomically", async () => {
  const cookie = await login(),
    organizer = await login("organizer"),
    id = `results-${randomUUID()}`,
    down = `results-${randomUUID()}`,
    entryId = randomUUID(),
    ids = Array.from({ length: 5 }, () => randomUUID());
  const headers = { cookie, Origin: base, "Content-Type": "application/json" };
  const request = (path: string, body?: object, c = cookie) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { ...headers, cookie: c },
      body: body ? JSON.stringify(body) : undefined,
    });
  const entry = {
    divisionId: "prairie-men",
    name: "Result test North",
    coreKnown: true,
    corePlayerIds: ids.slice(0, 4),
    members: ids.map((playerId, i) => ({
      playerId,
      role: i === 4 ? "alternate" : "core",
      position: i === 0 ? "Skip" : "",
      participation: "declared",
    })),
    newPlayers: ids.map((id, i) => ({
      id,
      name: `Result player ${i + 1}`,
      provisional: false,
    })),
    registerSeason: { season: "2026-27", version: 0 },
  };
  let r = await request(
    "/api/v1/entries",
    { id: entryId, version: 0, requestId: randomUUID(), entry },
    organizer,
  );
  assert.equal(r.status, 201);
  const originalEntry = await r.json();
  await scoringFixtureDraw(pool);
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b,total_a,total_b) VALUES($1,'scoring-test-draw','R','Lineup test','scheduled',$3,'entry-3','North','Prairie',null,null),($2,'scoring-test-draw','S','Played downstream','confirmed',$3,'entry-2','North','Granite',5,3)",
    [id, down, entryId],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$1),($2,'demo-scorekeeper','scorekeeper','prairie-2026',$2)",
    [id, down],
  );
  const get = async (target = id) =>
    (await request(`/api/v1/games/${target}/scoring`)).json();
  const post = (expectedVersion: number, action: string, extra = {}) =>
    request(`/api/v1/games/${id}/scoring`, {
      requestId: randomUUID(),
      expectedVersion,
      action,
      hammer: null,
      ...extra,
    });
  assert.equal((await post(0, "start")).status, 200);
  const defaulted = await get();
  assert.equal(defaulted.lineupA.eventLineupVersion, 1);
  assert.equal(defaulted.lineupA.members[0].participation, "defaulted");
  r = await request(
    `/api/v1/entries/${entryId}`,
    {
      version: 1,
      requestId: randomUUID(),
      entry: {
        ...entry,
        newPlayers: [],
        registerSeason: undefined,
        teamId: originalEntry.teamId,
        registrationId: originalEntry.registration.id,
        members: entry.members.map((m) => ({
          ...m,
          position: "Revised event position",
        })),
      },
    },
    organizer,
  );
  assert.equal(r.status, 200);
  assert.deepEqual((await get()).lineupA, defaulted.lineupA);
  assert.equal(
    (
      await post(1, "lineup", {
        side: "a",
        members: ids.slice(1).map((playerId) => ({ playerId, position: "" })),
      })
    ).status,
    200,
  );
  let g = await get();
  assert.equal(g.lineupA.mode, "difference");
  assert.deepEqual(
    g.lineupA.members.map((m: { playerId: string }) => m.playerId),
    ids.slice(1),
  );
  assert.equal(g.lineupA.eventLineupVersion, 1);
  assert.equal(
    (
      await post(2, "end", {
        endNumber: 1,
        end: { state: "played", a: 2, b: 0 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(3, "confirm", {
        outcome: "conceded",
        winnerEntryId: entryId,
        reason: "Prairie conceded",
      })
    ).status,
    200,
  );
  const first = (await get()).results[0];
  await pool.query(
    "INSERT INTO game_assignment_dependency VALUES($1,$2,'a','winner')",
    [id, down],
  );
  const played = await get(down);
  assert.equal(
    (
      await post(4, "correct", {
        outcome: "conceded",
        winnerEntryId: "entry-3",
        reason: "Reversed end and corrected game rotation",
        ends: [{ state: "played", a: 0, b: 4 }],
        lineups: {
          a: ids.slice(0, 4).map((playerId) => ({ playerId, position: "" })),
        },
      })
    ).status,
    200,
  );
  g = await get();
  assert.deepEqual(g.results[1], first);
  assert.equal(g.results[0].result.totalA, 0);
  assert.equal(g.results[0].result.totalB, 4);
  assert.equal(g.attention[0].downstreamGameId, down);
  assert.equal(g.attention[0].actualEntryId, entryId);
  assert.equal(g.attention[0].expectedEntryId, "entry-3");
  const preserved = await get(down);
  assert.equal(preserved.entryA, played.entryA);
  assert.equal(preserved.state, "confirmed");
  assert.equal(preserved.totalA, 5);
  assert.equal(preserved.totalB, 3);
  assert.equal(preserved.version, 0);
  const legacyCorrection = await request(`/api/v1/games/${down}/scoring`, {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "correct",
    hammer: null,
    outcome: "conceded",
    winnerEntryId: entryId,
    reason: "Legacy score correction",
    ends: [
      { state: "played", a: 5, b: 0 },
      { state: "played", a: 0, b: 2 },
    ],
  });
  assert.equal(legacyCorrection.status, 200);
  const legacyRevised = await get(down);
  assert.equal(legacyRevised.results[0].result.correction, true);
  assert.equal(legacyRevised.results[0].result.legacyBefore.totalA, 5);
  assert.equal(legacyRevised.results[0].result.legacyBefore.totalB, 3);
  assert.equal(
    legacyRevised.results[0].result.legacyBefore.attribution,
    "Not recorded",
  );
  assert.equal(legacyRevised.lineupA.eventLineupVersion, null);
  const unchangedEntry = await (
    await request(`/api/v1/entries/${entryId}`, undefined, organizer)
  ).json();
  assert.equal(unchangedEntry.teamId, originalEntry.teamId);
  assert.equal(unchangedEntry.registration.version, 1);
  assert.equal(unchangedEntry.lineup.version, 2);
  assert.equal(
    unchangedEntry.lineup.members[0].position,
    "Revised event position",
  );
  await assert.rejects(
    () =>
      pool.query(
        "UPDATE game_result_version SET result='{}' WHERE game_id=$1",
        [id],
      ),
    /immutable/,
  );
  await assert.rejects(
    () => pool.query("DELETE FROM game_lineup_version WHERE game_id=$1", [id]),
    /immutable/,
  );
  const atomic = {
    requestId: randomUUID(),
    expectedVersion: 5,
    action: "correct",
    hammer: null,
    outcome: "forfeit",
    winnerEntryId: "entry-3",
    reason: "Forfeit correction",
    ends: [{ state: "played", a: 0, b: 4 }],
    lineups: { a: [] },
  };
  await pool.query(
    "ALTER TABLE audit_record ADD CONSTRAINT wcp003_atomic CHECK(request_id IS DISTINCT FROM '" +
      atomic.requestId +
      "') NOT VALID",
  );
  try {
    assert.equal(
      (await request(`/api/v1/games/${id}/scoring`, atomic)).status,
      503,
    );
    assert.deepEqual((await get()).results, g.results);
    assert.deepEqual((await get()).lineupA, g.lineupA);
  } finally {
    await pool.query("ALTER TABLE audit_record DROP CONSTRAINT wcp003_atomic");
  }
  const pair = await Promise.all([
    request(`/api/v1/games/${id}/scoring`, atomic),
    request(`/api/v1/games/${id}/scoring`, atomic),
  ]);
  assert.deepEqual(
    pair.map((r) => r.status),
    [200, 200],
  );
  assert.deepEqual(await pair[0].json(), await pair[1].json());
  g = await get();
  assert.equal(g.version, 6);
  assert.equal(g.results.length, 3);
  assert.equal(g.totalA, null);
  assert.equal(g.totalB, null);
  assert.deepEqual(g.lineupA.members, []);
  assert.equal(g.history[0].after.confirmedResult.outcome, "forfeit");
  assert.equal(
    (
      await request(`/api/v1/games/${id}/scoring`, {
        ...atomic,
        reason: "Conflicting request",
      })
    ).status,
    409,
  );
  await pool.query("UPDATE game SET scoring_source='feed' WHERE id=$1", [id]);
  assert.equal(
    (await request(`/api/v1/games/${id}/scoring`, atomic)).status,
    409,
  );
  await pool.query("UPDATE game SET scoring_source='manual' WHERE id=$1", [id]);
  await pool.query("DELETE FROM role_grant WHERE game_id=$1", [id]);
  assert.equal(
    (await request(`/api/v1/games/${id}/scoring`, atomic)).status,
    403,
  );
});
