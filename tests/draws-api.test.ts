import "dotenv/config";
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { drawFixtureEvent } from "./draws-fixture";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let event: Awaited<ReturnType<typeof drawFixtureEvent>>;
before(async () => {
  event = await drawFixtureEvent(pool);
});
after(async () => {
  if (event) await event.cleanup();
  await pool.end();
});
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
async function waitForEditionBarrier() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const blocked = await pool.query(
      "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND (query LIKE '%FROM event_edition WHERE id=$1 FOR UPDATE%' OR query LIKE '%FOR UPDATE OF e%')",
    );
    if (blocked.rowCount) return;
    await new Promise((r) => setTimeout(r, 40));
  }
  assert.fail("Expected the HTTP writer to wait on its edition barrier");
}
test("organizer persists a private seeded preview, publishes the reviewed version and exposes only public graph data", async () => {
  const id = "knockout-" + randomUUID(),
    cookie = await login();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Single knockout API','men_four','single knockout')",
    [id, event.id],
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
  const barrier = await pool.connect();
  await barrier.query("BEGIN");
  await barrier.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
    event.id,
  ]);
  const pendingPreview = request(preview);
  try {
    await waitForEditionBarrier();
    // A waiting graph writer must not own lower division/entry locks.
    await pool.query("SELECT id FROM division WHERE id=$1 FOR UPDATE NOWAIT", [
      id,
    ]);
    await pool.query(
      "SELECT id FROM event_entry WHERE id=$1 FOR UPDATE NOWAIT",
      [seeds[0]],
    );
  } finally {
    await barrier.query("COMMIT");
    barrier.release();
  }
  const r = await pendingPreview;
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
  const scheduleUrl = base + "/api/v1/events/" + event.id + "/schedule";
  const initialSchedule = await (
    await fetch(scheduleUrl, { headers: { cookie } })
  ).json();
  assert.equal(
    initialSchedule.games.find((g: any) => g.id === q2.id).divisionId,
    id,
  );
  const drawId = randomUUID();
  const sessionResponse = await fetch(scheduleUrl, {
    method: "POST",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: randomUUID(),
      expectedVersion: initialSchedule.version,
      reason: "Schedule actual published game",
      action: "session",
      session: {
        id: drawId,
        divisionId: id,
        number: 1,
        localStart: "2026-11-09T09:00",
        utcOffset: "-06:00",
        durationMinutes: 120,
      },
    }),
  });
  assert.equal(
    sessionResponse.status,
    200,
    await sessionResponse.clone().text(),
  );
  const sessionData = await sessionResponse.json();
  const assignmentResponse = await fetch(scheduleUrl, {
    method: "POST",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: randomUUID(),
      expectedVersion: sessionData.version,
      reason: "Assign published quarterfinal to known session",
      action: "assign",
      gameId: q2.id,
      drawId,
      sheet: "A",
    }),
  });
  assert.equal(
    assignmentResponse.status,
    200,
    await assignmentResponse.clone().text(),
  );
  const scheduled = await (
    await fetch(base + "/api/v1/public/divisions/" + id + "/draw")
  ).json();
  assert.equal(scheduled.games.find((g: any) => g.key === "Q2").drawId, drawId);
  assert.equal(
    scheduled.games.find((g: any) => g.key === "Q2").startsAt,
    "2026-11-09T15:00:00.000Z",
  );
  const score = async (gameId: string, body: object) =>
    fetch(base + "/api/v1/games/" + gameId + "/scoring", {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const scoreBarrier = await pool.connect();
  await scoreBarrier.query("BEGIN");
  await scoreBarrier.query(
    "SELECT id FROM event_edition WHERE id=$1 FOR UPDATE",
    [event.id],
  );
  const pendingStart = score(q2.id, {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "start",
    hammer: null,
  });
  try {
    await waitForEditionBarrier();
    await pool.query("SELECT id FROM game WHERE id=$1 FOR UPDATE NOWAIT", [
      q2.id,
    ]);
  } finally {
    await scoreBarrier.query("COMMIT");
    scoreBarrier.release();
  }
  assert.equal((await pendingStart).status, 200);
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
  const schedule = await fetch(
    base + "/api/v1/events/" + event.id + "/schedule",
    {
      headers: { cookie },
    },
  );
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
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Eight-entry API','men_four','single knockout')",
    [id, event.id],
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

test("actor-bound commands and current scoring grants protect unscheduled published games", async () => {
  const cookie = await login(),
    id = "scope-" + randomUUID(),
    seeds: string[] = [];
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Scoped knockout','men_four','single knockout')",
    [id, event.id],
  );
  for (let n = 1; n <= 6; n++) {
    const en = id + "-" + n;
    seeds.push(en);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [en, id, "Scope team " + n],
    );
  }
  const url = base + "/api/v1/divisions/" + id + "/draw",
    preview = {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: "preview",
      seedEntryIds: seeds,
      reason: "Scoped profile",
    };
  const headers = { cookie, Origin: base, "Content-Type": "application/json" };
  assert.equal(
    (
      await fetch(url, {
        method: "POST",
        headers: { ...headers, "X-WCP-Actor": "demo-administrator" },
        body: JSON.stringify(preview),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(url, {
        method: "POST",
        headers: { ...headers, "X-WCP-Actor": "demo-organizer" },
        body: JSON.stringify(preview),
      })
    ).status,
    200,
  );
  const publish = {
    requestId: randomUUID(),
    expectedVersion: 1,
    action: "publish",
    reason: "Publish scoped profile",
  };
  const published = await (
    await fetch(url, { method: "POST", headers, body: JSON.stringify(publish) })
  ).json();
  const q2 = published.graph.games.find((g: any) => g.key === "Q2"),
    grant = randomUUID();
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES($1,'demo-scorekeeper','scorekeeper',$2,$3)",
    [grant, event.id, q2.id],
  );
  const volunteer = await login("scorekeeper"),
    scoring = base + "/api/v1/games/" + q2.id + "/scoring";
  try {
    const read = await fetch(scoring, { headers: { cookie: volunteer } });
    assert.equal(read.status, 200);
    const game = await read.json();
    assert.equal(game.drawNumber, null);
    assert.equal(game.sheet, "");
    assert.equal(game.entryA, seeds[3]);
    const start = {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: "start",
      hammer: null,
    };
    assert.equal(
      (
        await fetch(scoring, {
          method: "POST",
          headers: { ...headers, cookie: volunteer },
          body: JSON.stringify(start),
        })
      ).status,
      200,
    );
    await pool.query("DELETE FROM role_grant WHERE id=$1", [grant]);
    assert.equal(
      (
        await fetch(scoring, {
          method: "POST",
          headers: { ...headers, cookie: volunteer },
          body: JSON.stringify(start),
        })
      ).status,
      403,
    );
  } finally {
    await pool.query("DELETE FROM role_grant WHERE id=$1", [grant]);
  }
});

test("queued graph writer rechecks the division association after acquiring edition and division locks", async () => {
  const cookie = await login();
  for (const receiptExists of [false, true]) {
    const id = "association-" + randomUUID(),
      seeds: string[] = [];
    await pool.query(
      "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Queued scope fixture','men_four','single knockout')",
      [id, event.id],
    );
    for (let n = 1; n <= 6; n++) {
      const en = id + "-" + n;
      seeds.push(en);
      await pool.query(
        "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
        [en, id, "Queued team " + n],
      );
    }
    const original = {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: "preview",
      seedEntryIds: seeds,
      reason: "Queued original edition",
    };
    const send = () =>
      fetch(base + "/api/v1/divisions/" + id + "/draw", {
        method: "POST",
        headers: { cookie, Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify(original),
      });
    if (receiptExists) assert.equal((await send()).status, 200);
    const c = await pool.connect();
    await c.query("BEGIN");
    await c.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      event.id,
    ]);
    const pending = send();
    try {
      await waitForEditionBarrier();
      await c.query("UPDATE division SET event_id='other-2026' WHERE id=$1", [
        id,
      ]);
    } finally {
      await c.query("COMMIT");
      c.release();
    }
    const rejected = await pending;
    assert.equal(rejected.status, 409, await rejected.clone().text());
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::integer AS n FROM draw_revision WHERE division_id=$1",
          [id],
        )
      ).rows[0].n,
      receiptExists ? 1 : 0,
    );
  }
});
