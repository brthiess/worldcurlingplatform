import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import {
  registrationDrawFixture,
  configuredDrawTerms,
} from "./registration-draw-fixture";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
});
const fixtures: Awaited<ReturnType<typeof registrationDrawFixture>>[] = [];
after(async () => {
  for (const f of fixtures) await f.cleanup();
  await pool.end();
});
const base = process.env.BETTER_AUTH_URL!;
let cookie = "";
async function request(path: string, body?: unknown) {
  if (!cookie) {
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
  }
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie,
      Origin: base,
      "Content-Type": "application/json",
      "X-WCP-Actor": "demo-organizer",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function fixture(count = 6) {
  const f = await registrationDrawFixture(pool, count);
  fixtures.push(f);
  return f;
}
async function open(f: { id: string }, format = "single_knockout") {
  const r = await request("/api/v1/registration", {
    action: "open",
    divisionId: f.id,
    version: 0,
    requestId: randomUUID(),
    terms: { ...configuredDrawTerms, format },
  });
  assert.equal(r.status, 200, await r.clone().text());
}
async function admit(f: { id: string; entries: string[] }) {
  for (const entryId of f.entries) {
    const r = await request("/api/v1/registration", {
      action: "request",
      divisionId: f.id,
      entryId,
      version: 0,
      requestId: randomUUID(),
    });
    assert.equal(r.status, 200, await r.clone().text());
    assert.equal((await r.json()).state, "accepted");
  }
}
const path = (f: { id: string }) => `/api/v1/divisions/${f.id}/draw`;
const preview = (f: { entries: string[] }, version = 0) => ({
  action: "preview",
  expectedVersion: version,
  seedEntryIds: f.entries,
  requestId: randomUUID(),
  reason: "Review complete configured accepted field",
});
const publish = () => ({
  action: "publish",
  expectedVersion: 1,
  requestId: randomUUID(),
  reason: "Publish reviewed configured field",
});

test("configured six and eight accepted fields publish below capacity16 with both submission origins", async () => {
  for (const count of [6, 8]) {
    const f = await fixture(count);
    await open(f);
    assert.equal(
      (await (await request(path(f))).json()).entries.length,
      0,
      "A manual pending entry is not an accepted field place",
    );
    await admit(f);
    const w = await (await request(path(f))).json();
    assert.deepEqual(
      w.entries.map((e: { id: string }) => e.id).sort(),
      [...f.entries].sort(),
    );
    let r = await request(path(f), preview(f));
    assert.equal(r.status, 200, await r.clone().text());
    assert.equal((await r.json()).graph.games.length, count === 6 ? 5 : 7);
    r = await request(path(f), publish());
    assert.equal(r.status, 200, await r.clone().text());
    const publicDraw = await (
      await fetch(base + `/api/v1/public/divisions/${f.id}/draw`)
    ).json();
    assert.equal(publicDraw.games.length, count === 6 ? 5 : 7);
    assert.ok(
      publicDraw.games.every(
        (g: { drawId: null; startsAt: null }) =>
          g.drawId === null && g.startsAt === null,
      ),
    );
    const registration = await (await request("/api/v1/registration")).json();
    const d = registration.divisions.find((d: { id: string }) => d.id === f.id);
    assert.equal(d.capacity, 16);
    assert.equal(d.remaining, 16 - count);
    assert.equal(d.format, "single_knockout");
  }
});

test("a configured initial draw cannot omit accepted peers at preview or after a new admission", async () => {
  const f = await fixture(8);
  await open(f);
  await admit(f);
  let r = await request(
    path(f),
    preview({ ...f, entries: f.entries.slice(0, 6) }),
  );
  assert.equal(r.status, 422);
  assert.match((await r.json()).error, /complete current accepted field/i);
  const original = preview(f);
  r = await request(path(f), original);
  assert.equal(r.status, 200);
  const extra = randomUUID();
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,'New accepted peer')",
    [extra, f.id],
  );
  await admit({ id: f.id, entries: [extra] });
  r = await request(path(f), publish());
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /complete current accepted field/i);
  assert.equal(
    (await request(path(f), original)).status,
    200,
    "Exact historical receipt is not reinterpreted as a fresh field selection",
  );
  const w = await (await request(path(f))).json();
  assert.equal(w.version, 1);
  assert.equal(w.state, "preview");
  assert.equal(
    (await fetch(base + `/api/v1/public/divisions/${f.id}/draw`)).status,
    404,
  );
});

test("pending invited held expired and waitlisted changes without lineup-version changes reject preview and publication", async () => {
  for (const state of ["pending", "invited", "held", "expired", "waitlisted"]) {
    const f = await fixture();
    await open(f);
    await admit(f);
    const original = preview(f);
    assert.equal((await request(path(f), original)).status, 200);
    // Owned fixture represents an independently changed admission (future withdrawal/payment command), not a lineup amendment.
    await pool.query(
      "UPDATE event_entry SET admission_state=$2,reservation_deadline=CASE WHEN $2='held' THEN clock_timestamp()+interval '1 minute' ELSE NULL END,admission_version=admission_version+1 WHERE id=$1",
      [f.entries[0], state],
    );
    let r = await request(path(f), preview(f, 1));
    assert.equal(r.status, 422);
    assert.match((await r.json()).error, /admitted|field place/i);
    r = await request(path(f), publish());
    assert.equal(r.status, 409);
    assert.match((await r.json()).error, /admission changed/i);
    const w = await (await request(path(f))).json();
    assert.equal(w.version, 1);
    assert.equal(w.entries.length, 5);
    assert.equal((await request(path(f), original)).status, 200);
  }
});

test("registered format family is checked at preview and publication while opened terms stay immutable", async () => {
  const mismatch = await fixture();
  await open(mismatch, "triple_knockout");
  await admit(mismatch);
  let r = await request(path(mismatch), preview(mismatch));
  assert.equal(r.status, 422);
  assert.match((await r.json()).error, /format family/i);
  const f = await fixture();
  await pool.query(
    "UPDATE event_entry SET entry_admission='organizer_recorded' WHERE division_id=$1",
    [f.id],
  );
  const original = preview(f);
  assert.equal((await request(path(f), original)).status, 200);
  await open(f, "triple_knockout");
  await admit(f);
  r = await request(path(f), publish());
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /format family/i);
  assert.equal((await request(path(f), original)).status, 200);
  const registration = await (await request("/api/v1/registration")).json();
  assert.equal(
    registration.divisions.find((d: { id: string }) => d.id === f.id).format,
    "triple_knockout",
  );
});

test("opening registration cannot overlook already-published unscheduled games", async () => {
  const f = await fixture();
  await pool.query(
    "UPDATE event_entry SET entry_admission='organizer_recorded' WHERE division_id=$1",
    [f.id],
  );
  assert.equal((await request(path(f), preview(f))).status, 200);
  assert.equal((await request(path(f), publish())).status, 200);
  const r = await request("/api/v1/registration", {
    action: "open",
    divisionId: f.id,
    version: 0,
    requestId: randomUUID(),
    terms: configuredDrawTerms,
  });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /before a competition draw/i);
});
