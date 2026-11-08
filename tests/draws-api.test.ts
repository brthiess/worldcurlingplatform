import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
async function login(role = "organizer") {
  const r = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: role + "@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(r.status, 200);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
test("organizer persists a private seeded preview, publishes the reviewed version and exposes only public graph data", async () => {
  const id = "knockout-" + randomUUID(),
    cookie = await login();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,'prairie-2026','Single knockout API','men_four','single knockout')",
    [id],
  );
  const seeds: string[] = [];
  for (let n = 1; n <= 6; n++) {
    const entry = id + "-" + n;
    seeds.push(entry);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [entry, id, "Fixture team " + n],
    );
  }
  const url = base + "/api/v1/divisions/" + id + "/draw";
  const request = (body?: object, auth = cookie) =>
    fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        cookie: auth,
        Origin: base,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const preview = {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "preview",
    seedEntryIds: seeds,
    reason: "Review independent six-entry fixture",
  };
  const r = await request(preview);
  assert.equal(r.status, 200, await r.clone().text());
  const data = await r.json();
  assert.equal(data.state, "preview");
  assert.equal(data.version, 1);
  assert.deepEqual(
    data.graph.games.map((g: any) => g.key),
    ["Q2", "Q4", "S1", "S2", "F"],
  );
  assert.equal(data.graph.byes.length, 2);
  assert.deepEqual(await (await request(preview)).json(), data);
  assert.equal(
    (await request({ ...preview, reason: "Conflicting retry" })).status,
    409,
  );
  assert.equal(
    (await request({ ...preview, requestId: randomUUID() })).status,
    409,
  );
  assert.equal((await request(undefined, "")).status, 401);
  const reviewer = await login("reviewer");
  assert.equal((await request(undefined, reviewer)).status, 403);
  assert.equal(
    (await fetch(base + "/api/v1/public/divisions/" + id + "/draw")).status,
    404,
  );
  const publish = {
    requestId: randomUUID(),
    expectedVersion: 1,
    action: "publish",
    reason: "Publish reviewed bracket",
  };
  const p = await request(publish);
  assert.equal(p.status, 200, await p.clone().text());
  const published = await p.json();
  assert.equal(published.state, "published");
  assert.equal(published.version, 2);
  assert.deepEqual(await (await request(publish)).json(), published);
  assert.equal(
    (await request({ ...preview, requestId: randomUUID(), expectedVersion: 2 }))
      .status,
    409,
  );
  const frozen = (
    await pool.query(
      "SELECT md5(response::text) AS digest FROM draw_revision WHERE division_id=$1 AND version=2",
      [id],
    )
  ).rows[0].digest;
  const publicData = await (
    await fetch(base + "/api/v1/public/divisions/" + id + "/draw")
  ).json();
  assert.equal(publicData.games.length, 5);
  assert.ok(
    publicData.games.every(
      (g: any) =>
        g.drawId === null &&
        g.startsAt === null &&
        g.totalA === null &&
        g.totalB === null,
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(publicData),
    /actorId|requestId|command|demo-organizer/,
  );
  const q2 = publicData.games.find((g: any) => g.key === "Q2");
  const score = async (gameId: string, body: object) =>
    fetch(base + "/api/v1/games/" + gameId + "/scoring", {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await score(q2.id, {
        requestId: randomUUID(),
        expectedVersion: 0,
        action: "start",
        hammer: null,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await score(q2.id, {
        requestId: randomUUID(),
        expectedVersion: 1,
        action: "end",
        hammer: null,
        endNumber: 1,
        end: { state: "played", a: 2, b: 0 },
      })
    ).status,
    200,
  );
  const confirm = {
    requestId: randomUUID(),
    expectedVersion: 2,
    action: "confirm",
    hammer: null,
    outcome: "conceded",
    winnerEntryId: seeds[3],
    reason: "Opponent conceded after the first end",
  };
  const finished = await score(q2.id, confirm);
  assert.equal(finished.status, 200, await finished.clone().text());
  const advanced = await (
    await fetch(base + "/api/v1/public/divisions/" + id + "/draw")
  ).json();
  assert.equal(
    advanced.games.find((g: any) => g.key === "S1").entryB,
    seeds[3],
  );
  const firstResponse = await finished.json();
  assert.deepEqual(await (await score(q2.id, confirm)).json(), firstResponse);
  assert.equal(
    (await score(q2.id, { ...confirm, requestId: randomUUID() })).status,
    409,
  );
  const read = async () =>
    await (
      await fetch(base + "/api/v1/public/divisions/" + id + "/draw")
    ).json();
  for (const [key, winner] of [
    ["Q4", seeds[2]],
    ["S1", seeds[0]],
    ["S2", seeds[1]],
    ["F", seeds[0]],
  ]) {
    let game = (await read()).games.find((g: any) => g.key === key);
    assert.equal(
      (
        await score(game.id, {
          requestId: randomUUID(),
          expectedVersion: game.version,
          action: "start",
          hammer: null,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await score(game.id, {
          requestId: randomUUID(),
          expectedVersion: game.version + 1,
          action: "end",
          hammer: null,
          endNumber: 1,
          end: { state: "played", a: 2, b: 0 },
        })
      ).status,
      200,
    );
    const completed = await score(game.id, {
      requestId: randomUUID(),
      expectedVersion: game.version + 2,
      action: "confirm",
      hammer: null,
      outcome: "conceded",
      winnerEntryId: winner,
      reason: "Opponent conceded this fixture",
    });
    assert.equal(completed.status, 200, await completed.clone().text());
  }
  const complete = await read();
  assert.deepEqual(
    complete.games.map((g: any) => [g.key, g.winnerEntryId]),
    [
      ["Q2", seeds[3]],
      ["Q4", seeds[2]],
      ["S1", seeds[0]],
      ["S2", seeds[1]],
      ["F", seeds[0]],
    ],
  );
  const record = await pool.query(
    "SELECT count(*)::integer AS wins FROM game_result_version WHERE result->>'winnerEntryId'=$1",
    [seeds[0]],
  );
  assert.equal(record.rows[0].wins, 2);
  const s1 = complete.games.find((g: any) => g.key === "S1");
  const s1history = (
    await pool.query(
      "SELECT result FROM game_result_version WHERE game_id=$1",
      [s1.id],
    )
  ).rows;
  const corrected = await score(q2.id, {
    requestId: randomUUID(),
    expectedVersion: 3,
    action: "correct",
    hammer: null,
    outcome: "conceded",
    winnerEntryId: seeds[4],
    reason: "Ordinary winner correction after downstream play",
    ends: [{ state: "played", a: 0, b: 2 }],
  });
  assert.equal(corrected.status, 200, await corrected.clone().text());
  const afterCorrection = await read();
  assert.equal(
    afterCorrection.games.find((g: any) => g.key === "S1").entryB,
    seeds[3],
  );
  assert.equal(
    afterCorrection.games.find((g: any) => g.key === "S1").attention,
    true,
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT result FROM game_result_version WHERE game_id=$1",
        [s1.id],
      )
    ).rows,
    s1history,
  );
  const direct = await (
    await fetch(base + "/api/v1/games/" + s1.id + "/scoring", {
      headers: { cookie },
    })
  ).json();
  assert.equal(direct.attention[0].expectedEntryId, seeds[4]);
  const assignment = (
    await pool.query(
      "SELECT disposition,actual_entry_id,expected_entry_id FROM draw_assignment_revision WHERE upstream_game_id=$1 ORDER BY result_version",
      [q2.id],
    )
  ).rows;
  assert.deepEqual(assignment, [
    {
      disposition: "assigned",
      actual_entry_id: seeds[3],
      expected_entry_id: seeds[3],
    },
    {
      disposition: "preserved",
      actual_entry_id: seeds[3],
      expected_entry_id: seeds[4],
    },
  ]);
  assert.equal(
    (
      await pool.query(
        "SELECT md5(response::text) AS digest FROM draw_revision WHERE division_id=$1 AND version=2",
        [id],
      )
    ).rows[0].digest,
    frozen,
  );
  await assert.rejects(
    pool.query(
      "UPDATE draw_slot SET side='b' WHERE division_id=$1 AND revision=2 AND node_key='F' AND side='a'",
      [id],
    ),
    /immutable/,
  );
  const publicGame = await fetch(base + "/api/v1/public/games/" + s1.id);
  assert.equal(publicGame.status, 200);
  assert.equal(
    (await publicGame.json()).games[0].results[0].result.entryB,
    seeds[3],
  );
  const schedule = await fetch(base + "/api/v1/events/prairie-2026/schedule", {
    headers: { cookie },
  });
  assert.equal(schedule.status, 200);
  assert.ok(
    (await schedule.json()).games.some(
      (g: any) => g.id === s1.id && g.drawId === null,
    ),
  );
});

test("invalid fields, cross-scope seeds and stale entry previews cannot publish; eight-entry correction updates only an unstarted slot", async () => {
  const cookie = await login(),
    id = "full-" + randomUUID();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,'prairie-2026','Eight-entry API','men_four','single knockout')",
    [id],
  );
  const seeds: string[] = [];
  for (let n = 1; n <= 8; n++) {
    const entry = id + "-" + n;
    seeds.push(entry);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [entry, id, "Eight team " + n],
    );
  }
  const post = (body: object, target = id, origin = base) =>
    fetch(`${base}/api/v1/divisions/${target}/draw`, {
      method: "POST",
      headers: { cookie, Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const preview = (entries = seeds, version = 0) => ({
    requestId: randomUUID(),
    expectedVersion: version,
    action: "preview",
    seedEntryIds: entries,
    reason: "Eight-entry review",
  });
  assert.equal((await post(preview(seeds.slice(0, 7)))).status, 400);
  assert.equal(
    (await post(preview([seeds[0], ...seeds.slice(0, 7)]))).status,
    400,
  );
  assert.equal(
    (await post(preview(["entry-1", ...seeds.slice(1)]))).status,
    403,
  );
  assert.equal((await post(preview(), "other-men")).status, 403);
  assert.equal(
    (await post(preview(), id, "https://untrusted.invalid")).status,
    403,
  );
  assert.equal((await post(preview())).status, 200);
  await pool.query("UPDATE event_entry SET version=version+1 WHERE id=$1", [
    seeds[0],
  ]);
  const publish = {
    requestId: randomUUID(),
    expectedVersion: 1,
    action: "publish",
    reason: "Publish stale preview",
  };
  assert.equal((await post(publish)).status, 409);
  const competing = await Promise.all([
    post(preview(seeds, 1)),
    post(preview(seeds, 1)),
  ]);
  assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
  const p = await post({
    ...publish,
    requestId: randomUUID(),
    expectedVersion: 2,
  });
  assert.equal(p.status, 200, await p.clone().text());
  const read = async () =>
    await (
      await fetch(base + "/api/v1/public/divisions/" + id + "/draw")
    ).json();
  const graph = await read();
  assert.equal(graph.games.length, 7);
  assert.deepEqual(graph.graph.byes, []);
  const q1 = graph.games.find((g: any) => g.key === "Q1"),
    s1 = graph.games.find((g: any) => g.key === "S1");
  const score = (body: object) =>
    fetch(base + "/api/v1/games/" + q1.id + "/scoring", {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await score({
        requestId: randomUUID(),
        expectedVersion: 0,
        action: "confirm",
        hammer: null,
        outcome: "forfeit",
        winnerEntryId: seeds[0],
        reason: "Opponent forfeited",
      })
    ).status,
    200,
  );
  assert.equal(
    (await read()).games.find((g: any) => g.key === "S1").entryA,
    seeds[0],
  );
  assert.equal(
    (
      await score({
        requestId: randomUUID(),
        expectedVersion: 1,
        action: "correct",
        hammer: null,
        outcome: "forfeit",
        winnerEntryId: seeds[7],
        reason: "Correct participant awarded forfeit",
        ends: [],
      })
    ).status,
    200,
  );
  const corrected = (await read()).games.find((g: any) => g.key === "S1");
  assert.equal(corrected.entryA, seeds[7]);
  assert.equal(corrected.attention, false);
  assert.equal(corrected.state, "scheduled");
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::integer AS count FROM game_result_version WHERE game_id=$1",
        [s1.id],
      )
    ).rows[0].count,
    0,
  );
  await assert.rejects(
    pool.query("UPDATE game SET entry_a=$2 WHERE id=$1", [s1.id, "entry-1"]),
    /division/,
  );
});
