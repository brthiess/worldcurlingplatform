import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { drawFixtureEvent } from "./draws-fixture";
import { configuredDrawTerms } from "./registration-draw-fixture";
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
after(async () => {
  if (event) await event.cleanup();
  await pool.end();
});
function post(path: string, body: object) {
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
async function create(configured = false) {
  const id = "pool-" + randomUUID(),
    seeds: string[] = [];
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Two pools acceptance','men_four','round_robin')",
    [id, event.id],
  );
  for (let i = 1; i <= 8; i++) {
    const entry = id + "-" + i;
    seeds.push(entry);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [entry, id, "Fictional T" + i],
    );
  }
  if (configured) {
    let r = await post("/api/v1/registration", {
      requestId: randomUUID(),
      divisionId: id,
      action: "open",
      version: 0,
      terms: {
        ...configuredDrawTerms,
        format: "round_robin",
        formatNotes: "Adopted two pools four teams",
        capacity: 16,
      },
    });
    assert.equal(r.status, 200, await r.clone().text());
    for (const entryId of seeds) {
      r = await post("/api/v1/registration", {
        requestId: randomUUID(),
        divisionId: id,
        action: "request",
        entryId,
        version: 0,
      });
      assert.equal(r.status, 200, await r.clone().text());
    }
  }
  return { id, seeds, path: `/api/v1/divisions/${id}/draw` };
}
const preview = (seeds: string[]) => ({
  requestId: randomUUID(),
  expectedVersion: 0,
  action: "preview",
  template: "application-pools2x4-v1",
  seedEntryIds: seeds,
  reason: "Reviewed bounded application pools",
});
const publish = () => ({
  requestId: randomUUID(),
  expectedVersion: 1,
  action: "publish",
  reason: "Publish reviewed pools",
});
async function checked(path: string, body: object) {
  const r = await post(path, body);
  assert.equal(r.status, 200, await r.clone().text());
  return await r.json();
}
test("configured round-robin publication persists groups and all twelve results produce independent scoped standings", async () => {
  const f = await create(true),
    command = preview(f.seeds);
  const p = await checked(f.path, command);
  assert.equal(p.graph.groups.length, 2);
  assert.deepEqual(await checked(f.path, command), p);
  assert.equal(
    (await fetch(base + `/api/v1/public/divisions/${f.id}/draw`)).status,
    404,
  );
  await checked(f.path, publish());
  const read = async () =>
    await (await fetch(base + `/api/v1/public/divisions/${f.id}/draw`)).json();
  let data = await read();
  assert.equal(data.games.length, 12);
  assert.equal(data.terminals.length, 0);
  assert.ok(
    data.games.every((g: any) => g.drawId === null && g.totalA === null),
  );
  assert.ok(
    data.pools
      .flatMap((p: any) => p.rows)
      .every((r: any) => r.played === 0 && r.ties === 0 && r.pending === 3),
  );
  const literal = [
    ["A01", 1, 8, 1],
    ["A02", 4, 5, 4],
    ["A03", 1, 5, 1],
    ["A04", 8, 4, 4],
    ["A05", 1, 4, 1],
    ["A06", 5, 8, 5],
    ["B01", 2, 7, 2],
    ["B02", 3, 6, 3],
    ["B03", 2, 6, 2],
    ["B04", 7, 3, 3],
    ["B05", 2, 3, 2],
    ["B06", 6, 7, 6],
  ] as const;
  for (const [key, a, b, w] of literal) {
    const g = data.games.find((g: any) => g.key === key);
    assert.equal(g.entryA, f.seeds[a - 1]);
    assert.equal(g.entryB, f.seeds[b - 1]);
    const path = `/api/v1/games/${g.id}/scoring`;
    await checked(path, {
      requestId: randomUUID(),
      expectedVersion: g.version,
      action: "start",
      hammer: null,
    });
    await checked(path, {
      requestId: randomUUID(),
      expectedVersion: g.version + 1,
      action: "end",
      hammer: null,
      endNumber: 1,
      end: { state: "played", a: a === w ? 2 : 0, b: b === w ? 2 : 0 },
    });
    const c = {
      requestId: randomUUID(),
      expectedVersion: g.version + 2,
      action: "confirm",
      hammer: null,
      outcome: "conceded",
      winnerEntryId: f.seeds[w - 1],
      reason: "Independent lower-numbered winner fixture",
    };
    const confirmed = await checked(path, c);
    assert.deepEqual(await checked(path, c), confirmed);
  }
  data = await read();
  assert.deepEqual(
    data.pools.map((p: any) =>
      p.rows.map((r: any) => [
        f.seeds.indexOf(r.entryId) + 1,
        r.wins,
        r.losses,
        r.played,
        r.tied,
      ]),
    ),
    [
      [
        [1, 3, 0, 3, false],
        [4, 2, 1, 3, false],
        [5, 1, 2, 3, false],
        [8, 0, 3, 3, false],
      ],
      [
        [2, 3, 0, 3, false],
        [3, 2, 1, 3, false],
        [6, 1, 2, 3, false],
        [7, 0, 3, 3, false],
      ],
    ],
  );
  assert.equal(
    data.games.filter((g: any) => g.state === "confirmed").length,
    12,
  );
  assert.doesNotMatch(
    JSON.stringify(data),
    /actorId|requestId|command|demo-organizer|payment|email/,
  );
  const first = data.games.find((g: any) => g.key === "A01");
  await checked(`/api/v1/games/${first.id}/scoring`, {
    requestId: randomUUID(),
    expectedVersion: first.version,
    action: "correct",
    hammer: null,
    outcome: "conceded",
    winnerEntryId: f.seeds[7],
    ends: [{ state: "played", a: 0, b: 2 }],
    reason: "Correct actual pool result after all games played",
  });
  const revised = await read();
  assert.deepEqual(revised.graph, data.graph);
  assert.deepEqual(
    revised.games.map((g: any) => [g.entryA, g.entryB]),
    data.games.map((g: any) => [g.entryA, g.entryB]),
  );
  assert.deepEqual(
    revised.pools[0].rows.map((r: any) => [
      f.seeds.indexOf(r.entryId) + 1,
      r.wins,
      r.losses,
      r.tied,
    ]),
    [
      [1, 2, 1, true],
      [4, 2, 1, true],
      [5, 1, 2, true],
      [8, 1, 2, true],
    ],
  );
  assert.equal(revised.terminals.length, 0);
});

test("pool preview/publication enforce current family, full admitted field, version and authority before receipts", async () => {
  const f = await create(true),
    command = preview(f.seeds);
  const saved = await checked(f.path, command);
  assert.equal(
    (await post(f.path, { ...command, requestId: randomUUID() })).status,
    409,
  );
  assert.equal(
    (await post(f.path, { ...command, seedEntryIds: [...f.seeds].reverse() }))
      .status,
    409,
  );
  await pool.query(
    "UPDATE event_entry SET admission_state='pending',admission_version=admission_version+1 WHERE id=$1",
    [f.seeds[0]],
  );
  assert.deepEqual(await checked(f.path, command), saved);
  assert.equal((await post(f.path, publish())).status, 409);
  assert.equal(
    (await fetch(base + `/api/v1/public/divisions/${f.id}/draw`)).status,
    404,
  );
  const workspace = await (
    await fetch(base + f.path, { headers: { cookie } })
  ).json();
  assert.equal(workspace.version, 1);
  assert.equal(workspace.entries.length, 7);
  await pool.query(
    "DELETE FROM role_grant WHERE event_id=$1 AND user_id='demo-organizer'",
    [event.id],
  );
  assert.equal((await post(f.path, command)).status, 403);
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-organizer','organizer',$2)",
    [randomUUID(), event.id],
  );
  const other = await create(true);
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name,admission_state) VALUES($1,$2,'Extra accepted team','accepted')",
    [randomUUID(), other.id],
  );
  const incomplete = await post(other.path, preview(other.seeds));
  assert.equal(incomplete.status, 422);
  assert.match(
    (await incomplete.json()).error,
    /complete current accepted field/,
  );
  const different = await create();
  const r = await post("/api/v1/registration", {
    requestId: randomUUID(),
    divisionId: different.id,
    action: "open",
    version: 0,
    terms: { ...configuredDrawTerms, format: "single_knockout" },
  });
  assert.equal(r.status, 200);
  for (const entryId of different.seeds)
    await checked("/api/v1/registration", {
      requestId: randomUUID(),
      divisionId: different.id,
      action: "request",
      entryId,
      version: 0,
    });
  const wrong = await post(different.path, preview(different.seeds));
  assert.equal(wrong.status, 422);
  assert.match((await wrong.json()).error, /format/);
});
