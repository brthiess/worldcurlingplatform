import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { drawFixtureEvent } from "./draws-fixture";
import { configuredDrawTerms } from "./registration-draw-fixture";
import { tripleResults, expectedTripleSources } from "./triple-draws-fixture";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const base = process.env.BETTER_AUTH_URL!;
let event: Awaited<ReturnType<typeof drawFixtureEvent>>, cookie: string;
before(async () => {
  event = await drawFixtureEvent(pool);
  const r = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "organizer@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(r.status, 200);
  cookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
});
test("forty confirmed scoring API games follow all stored routes, eight qualifiers and final joint placements; correction preserves played opponents", async () => {
  const { id, seeds } = await create();
  const path = "/api/v1/divisions/" + id + "/draw",
    publicPath = base + "/api/v1/public/divisions/" + id + "/draw";
  for (const body of [
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: "preview",
      template: "application-tko16-q8-233-v1",
      seedEntryIds: seeds,
      reason: "Full reviewed literal result fixture",
    },
    {
      requestId: randomUUID(),
      expectedVersion: 1,
      action: "publish",
      reason: "Publish full forty-game fixture",
    },
  ]) {
    const r = await post(path, body);
    assert.equal(r.status, 200, await r.clone().text());
  }
  const read = async () => await (await fetch(publicPath)).json();
  const completed = new Map<string, { winner: string; loser: string }>();
  const qSources: Record<string, string> = {
    QA1: "A13",
    QA2: "A14",
    QB1: "B09",
    QB2: "B10",
    QB3: "B11",
    QC1: "C06",
    QC2: "C07",
    QC3: "C08",
  };
  let gameIds: Record<string, string> = {};
  for (const row of tripleResults) {
    const data = await read(),
      g = data.games.find((g: any) => g.key === row.key);
    gameIds[row.key] = g.id;
    assert.equal(g.entryA, seeds[row.a - 1], row.key + " actual slot A");
    assert.equal(g.entryB, seeds[row.b - 1], row.key + " actual slot B");
    const scorePath = "/api/v1/games/" + g.id + "/scoring";
    const end = {
      state: "played",
      a: row.winner === row.a ? 2 : 0,
      b: row.winner === row.b ? 2 : 0,
    };
    for (const command of [
      {
        requestId: randomUUID(),
        expectedVersion: g.version,
        action: "start",
        hammer: null,
      },
      {
        requestId: randomUUID(),
        expectedVersion: g.version + 1,
        action: "end",
        hammer: null,
        endNumber: 1,
        end,
      },
    ]) {
      const r = await post(scorePath, command);
      assert.equal(r.status, 200, await r.clone().text());
    }
    const confirm = {
      requestId: randomUUID(),
      expectedVersion: g.version + 2,
      action: "confirm",
      hammer: null,
      outcome: "conceded",
      winnerEntryId: seeds[row.winner - 1],
      reason: "Literal fictional fixture concession after one end",
    };
    const r = await post(scorePath, confirm);
    assert.equal(r.status, 200, await r.clone().text());
    const confirmed = await r.json();
    assert.deepEqual(await (await post(scorePath, confirm)).json(), confirmed);
    if (row.key === "A01") {
      for (const [version, winner] of [
        [g.version + 3, seeds[15]],
        [g.version + 4, seeds[0]],
      ] as const) {
        const correction = await post(scorePath, {
          requestId: randomUUID(),
          expectedVersion: version,
          action: "correct",
          hammer: null,
          outcome: "conceded",
          winnerEntryId: winner,
          reason: "Ordinary correction before dependent games start",
          ends: [
            {
              state: "played",
              a: winner === seeds[0] ? 2 : 0,
              b: winner === seeds[15] ? 2 : 0,
            },
          ],
        });
        assert.equal(correction.status, 200, await correction.clone().text());
        const revised = await read();
        assert.equal(
          revised.games.find((n: any) => n.key === "A09").entryA,
          winner,
        );
        assert.equal(
          revised.games.find((n: any) => n.key === "B01").entryA,
          winner === seeds[0] ? seeds[15] : seeds[0],
        );
      }
    }
    completed.set(row.key, {
      winner: seeds[row.winner - 1],
      loser: seeds[(row.winner === row.a ? row.b : row.a) - 1],
    });
    const advanced = await read();
    for (const line of expectedTripleSources.split("\n")) {
      const [key, a, b] = line.split(" ");
      for (const [token, side] of [
        [a, "entryA"],
        [b, "entryB"],
      ]) {
        const upstream = qSources[token] ?? token.slice(1);
        if (upstream !== row.key) continue;
        const expected =
          completed.get(upstream)![token.startsWith("L") ? "loser" : "winner"];
        assert.equal(
          advanced.games.find((g: any) => g.key === key)[side],
          expected,
          `${row.key} -> ${key}.${side}`,
        );
      }
    }
  }
  const complete = await read();
  assert.equal(
    complete.games.filter((g: any) => g.state === "confirmed").length,
    40,
  );
  assert.deepEqual(
    complete.terminals
      .filter((t: any) => t.kind === "qualified")
      .map((t: any) => [t.label, seeds.indexOf(t.entryId) + 1])
      .sort(),
    [
      ["QA1", 1],
      ["QA2", 2],
      ["QB1", 4],
      ["QB2", 3],
      ["QB3", 8],
      ["QC1", 5],
      ["QC2", 16],
      ["QC3", 13],
    ],
  );
  assert.deepEqual(
    complete.terminals
      .filter((t: any) => t.kind === "placed")
      .map((t: any) => [seeds.indexOf(t.entryId) + 1, t.place])
      .sort((a: any, b: any) => a[0] - b[0]),
    [
      [1, 2],
      [2, 5],
      [3, 3],
      [4, 5],
      [5, 3],
      [8, 5],
      [13, 5],
      [16, 1],
    ],
  );
  assert.deepEqual(
    complete.terminals
      .filter((t: any) => t.kind === "eliminated")
      .map((t: any) => seeds.indexOf(t.entryId) + 1)
      .sort((a: number, b: number) => a - b),
    [6, 7, 9, 10, 11, 12, 14, 15],
  );
  const t16games = complete.games.filter(
    (g: any) => g.entryA === seeds[15] || g.entryB === seeds[15],
  );
  assert.equal(
    t16games.filter((g: any) => g.winnerEntryId === seeds[15]).length,
    6,
  );
  assert.equal(t16games.length, 8);
  const beforeDownstream = await (
    await fetch(base + "/api/v1/public/games/" + gameIds.C04)
  ).json();
  const g = complete.games.find((g: any) => g.key === "B05");
  const correction = await post("/api/v1/games/" + g.id + "/scoring", {
    requestId: randomUUID(),
    expectedVersion: g.version,
    action: "correct",
    hammer: null,
    outcome: "conceded",
    winnerEntryId: seeds[15],
    reason: "Correct upstream after C games were actually played",
    ends: [{ state: "played", a: 2, b: 0 }],
  });
  assert.equal(correction.status, 200, await correction.clone().text());
  const changed = await read();
  assert.equal(
    changed.games.find((g: any) => g.key === "C04").entryB,
    seeds[15],
  );
  assert.equal(changed.games.find((g: any) => g.key === "C04").attention, true);
  const afterDownstream = await (
    await fetch(base + "/api/v1/public/games/" + gameIds.C04)
  ).json();
  assert.equal(beforeDownstream.games[0].results.length, 1);
  assert.deepEqual(
    afterDownstream.games[0].results,
    beforeDownstream.games[0].results,
  );
  assert.deepEqual(changed.terminals, complete.terminals);
  const c07 = changed.games.find((g: any) => g.key === "C07");
  const originalTerminals = (
    await pool.query(
      "SELECT * FROM draw_terminal_result WHERE upstream_game_id=$1 ORDER BY route",
      [c07.id],
    )
  ).rows;
  const qualifierCorrection = await post(
    "/api/v1/games/" + c07.id + "/scoring",
    {
      requestId: randomUUID(),
      expectedVersion: c07.version,
      action: "correct",
      hammer: null,
      outcome: "conceded",
      winnerEntryId: seeds[6],
      reason: "Ordinary qualifier correction preserves already played playoffs",
      ends: [{ state: "played", a: 0, b: 2 }],
    },
  );
  assert.equal(
    qualifierCorrection.status,
    200,
    await qualifierCorrection.clone().text(),
  );
  const qualifierChanged = await read();
  assert.equal(
    qualifierChanged.terminals.find((t: any) => t.label === "QC2").entryId,
    seeds[6],
  );
  assert.equal(
    qualifierChanged.terminals.find(
      (t: any) => t.key === "C07" && t.kind === "eliminated",
    ).entryId,
    seeds[15],
  );
  assert.equal(
    qualifierChanged.games.find((g: any) => g.key === "P03").entryB,
    seeds[15],
  );
  assert.equal(
    qualifierChanged.games.find((g: any) => g.key === "P03").attention,
    true,
  );
  assert.deepEqual(
    (
      await pool.query(
        "SELECT * FROM draw_terminal_result WHERE upstream_game_id=$1 AND result_version=$2 ORDER BY route",
        [c07.id, originalTerminals[0].result_version],
      )
    ).rows,
    originalTerminals,
  );
});
after(async () => {
  if (event) await event.cleanup();
  await pool.end();
});
async function post(path: string, body: object) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      cookie,
      Origin: base,
      "Content-Type": "application/json",
      "X-WCP-Actor": "demo-organizer",
    },
    body: JSON.stringify(body),
  });
}
async function create() {
  const id = "tko-" + randomUUID();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Main sixteen team triple knockout','men_four','triple knockout')",
    [id, event.id],
  );
  const seeds = [];
  for (let n = 1; n <= 16; n++) {
    const entry = id + "-" + n;
    seeds.push(entry);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [entry, id, "Fictional T" + String(n).padStart(2, "0")],
    );
  }
  return { id, seeds };
}
test("configured triple16 uses its actual operated family and the complete accepted field under a capacity ceiling", async () => {
  const { id, seeds } = await create();
  const registration = (body: object) =>
    post("/api/v1/registration", {
      requestId: randomUUID(),
      divisionId: id,
      ...body,
    });
  let r = await registration({
    action: "open",
    version: 0,
    terms: {
      ...configuredDrawTerms,
      capacity: 20,
      format: "triple_knockout",
      formatNotes: "Adopted application sixteen-team 2 A / 3 B / 3 C",
    },
  });
  assert.equal(r.status, 200, await r.clone().text());
  for (const entryId of seeds) {
    r = await registration({ action: "request", entryId, version: 0 });
    assert.equal(r.status, 200, await r.clone().text());
    assert.equal((await r.json()).state, "accepted");
  }
  r = await post("/api/v1/divisions/" + id + "/draw", {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "preview",
    template: "application-tko16-q8-233-v1",
    seedEntryIds: seeds,
    reason: "Complete accepted configured triple field",
  });
  assert.equal(r.status, 200, await r.clone().text());
  r = await post("/api/v1/divisions/" + id + "/draw", {
    requestId: randomUUID(),
    expectedVersion: 1,
    action: "publish",
    reason: "Publish compatible accepted triple field",
  });
  assert.equal(r.status, 200, await r.clone().text());
  const data = await (
    await fetch(base + "/api/v1/public/divisions/" + id + "/draw")
  ).json();
  assert.equal(data.games.length, 40);
  const workspace = await (
    await fetch(base + "/api/v1/registration", { headers: { cookie } })
  ).json();
  assert.equal(workspace.divisions.find((d: any) => d.id === id).remaining, 4);
});
async function openAndAdmit(
  f: { id: string; seeds: string[] },
  format = "triple_knockout",
) {
  const command = (body: object) =>
    post("/api/v1/registration", {
      requestId: randomUUID(),
      divisionId: f.id,
      ...body,
    });
  let r = await command({
    action: "open",
    version: 0,
    terms: {
      ...configuredDrawTerms,
      capacity: 20,
      format,
      formatNotes: "Explicit accepted application configuration",
    },
  });
  assert.equal(r.status, 200, await r.clone().text());
  for (const entryId of f.seeds) {
    r = await command({ action: "request", entryId, version: 0 });
    assert.equal(r.status, 200, await r.clone().text());
  }
}
const triplePreview = (seeds: string[], version = 0) => ({
  requestId: randomUUID(),
  expectedVersion: version,
  action: "preview",
  template: "application-tko16-q8-233-v1",
  seedEntryIds: seeds,
  reason: "Review current configured triple field",
});
const triplePublish = () => ({
  requestId: randomUUID(),
  expectedVersion: 1,
  action: "publish",
  reason: "Publish exact reviewed current field",
});
test("triple preview and publication reject a different registered family without changing its terms or historical receipt", async () => {
  const first = await create();
  await openAndAdmit(first, "single_knockout");
  let r = await post(
    "/api/v1/divisions/" + first.id + "/draw",
    triplePreview(first.seeds),
  );
  assert.equal(r.status, 422);
  assert.match((await r.json()).error, /format family/);
  const f = await create(),
    path = "/api/v1/divisions/" + f.id + "/draw",
    original = triplePreview(f.seeds);
  r = await post(path, original);
  assert.equal(r.status, 200);
  await openAndAdmit(f, "single_knockout");
  r = await post(path, triplePublish());
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /format family/);
  assert.equal((await post(path, original)).status, 200);
  const terms = (
    await pool.query(
      "SELECT format FROM division_registration WHERE division_id=$1",
      [f.id],
    )
  ).rows[0];
  assert.equal(terms.format, "single_knockout");
  assert.equal(
    (await fetch(base + "/api/v1/public/divisions/" + f.id + "/draw")).status,
    404,
  );
});
test("triple preview and publication cannot omit a seventeenth accepted peer under capacity20", async () => {
  for (const afterPreview of [false, true]) {
    const f = await create();
    await openAndAdmit(f);
    const path = "/api/v1/divisions/" + f.id + "/draw",
      original = triplePreview(f.seeds);
    if (afterPreview) {
      const r = await post(path, original);
      assert.equal(r.status, 200);
    }
    const peer = f.id + "-17";
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,'Additional accepted peer')",
      [peer, f.id],
    );
    let r = await post("/api/v1/registration", {
      requestId: randomUUID(),
      divisionId: f.id,
      action: "request",
      entryId: peer,
      version: 0,
    });
    assert.equal(r.status, 200);
    r = await post(
      path,
      afterPreview ? triplePublish() : triplePreview(f.seeds),
    );
    assert.equal(r.status, afterPreview ? 409 : 422);
    assert.match((await r.json()).error, /complete current accepted field/);
    if (afterPreview) assert.equal((await post(path, original)).status, 200);
    assert.equal(
      (await fetch(base + "/api/v1/public/divisions/" + f.id + "/draw")).status,
      404,
    );
  }
});
test("triple publication rechecks selected admission independently from lineup version", async () => {
  const f = await create();
  await openAndAdmit(f);
  const path = "/api/v1/divisions/" + f.id + "/draw",
    original = triplePreview(f.seeds);
  let r = await post(path, original);
  assert.equal(r.status, 200);
  // An owned fixture represents an independently amended admission; no future
  // withdrawal/payment engine or application persistence response is mocked.
  await pool.query(
    "UPDATE event_entry SET admission_state='pending',admission_version=admission_version+1 WHERE id=$1",
    [f.seeds[0]],
  );
  r = await post(path, triplePublish());
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /admission changed/);
  const w = await (await fetch(base + path, { headers: { cookie } })).json();
  assert.equal(w.entries.length, 15);
  assert.equal(w.version, 1);
  assert.equal(w.seeds[0].version, 0);
  assert.equal((await post(path, original)).status, 200);
  assert.equal(
    (await fetch(base + "/api/v1/public/divisions/" + f.id + "/draw")).status,
    404,
  );
});
test("organizer previews and publishes the exact sixteen-team profile with stored loser and qualification feeds", async () => {
  const { id, seeds } = await create();
  const path = "/api/v1/divisions/" + id + "/draw";
  const preview = {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "preview",
    template: "application-tko16-q8-233-v1",
    seedEntryIds: seeds,
    reason: "Adopt reviewed exact sixteen-team profile",
  };
  const r = await post(path, preview);
  assert.equal(r.status, 200, await r.clone().text());
  const data = await r.json();
  assert.equal(data.graph.games.length, 40);
  assert.equal(data.template, "application-tko16-q8-233-v1");
  assert.deepEqual(await (await post(path, preview)).json(), data);
  assert.equal(
    (await fetch(base + "/api/v1/public/divisions/" + id + "/draw")).status,
    404,
  );
  const p = await post(path, {
    requestId: randomUUID(),
    expectedVersion: 1,
    action: "publish",
    reason: "Publish reviewed triple graph",
  });
  assert.equal(p.status, 200, await p.clone().text());
  const publicData = await (
    await fetch(base + "/api/v1/public/divisions/" + id + "/draw")
  ).json();
  assert.equal(publicData.games.length, 40);
  assert.equal(
    publicData.graph.games.find((g: any) => g.key === "B01").a.loser,
    "A01",
  );
  assert.equal(
    publicData.graph.games.find((g: any) => g.key === "P03").b.qualifier,
    "QC2",
  );
  assert.ok(
    publicData.games.every(
      (g: any) => g.drawId === null && g.startsAt === null && g.totalA === null,
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(publicData),
    /actorId|requestId|command|demo-organizer/,
  );
});
