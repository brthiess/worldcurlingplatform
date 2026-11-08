import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { authRequest } from "./auth-request";
import { rulesFixture } from "./ranking-inputs-fixtures";
import pg from "pg";
const base = process.env.BETTER_AUTH_URL!;
const cookies = new Map<string, string>();
async function login(role = "administrator") {
  if (cookies.has(role)) return cookies.get(role)!;
  const r = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${role}@demo.invalid`,
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  cookies.set(role, cookie);
  return cookie;
}
async function request(
  cookie: string,
  path = "/api/v1/ranking-inputs",
  body?: unknown,
) {
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("staff save and revise exact rule-source editions with immutable retrievable history and retry/version safeguards", async () => {
  const cookie = await login(),
    id = randomUUID(),
    command = {
      id,
      kind: "rules",
      version: 0,
      requestId: randomUUID(),
      state: "reviewed",
      data: rulesFixture(),
    };
  let r = await request(cookie, undefined, command);
  assert.equal(r.status, 200);
  const first = await r.json();
  assert.equal(first.version, 1);
  assert.equal(first.state, "reviewed");
  assert.equal(
    (await (await request(cookie, undefined, command)).json()).version,
    1,
  );
  r = await request(cookie, undefined, {
    ...command,
    version: 1,
    requestId: randomUUID(),
    data: { ...command.data, title: "Revised sourced edition" },
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).version, 2);
  const old = await (
    await request(cookie, `/api/v1/ranking-inputs?id=${id}&version=1`)
  ).json();
  assert.equal(old.data.title, command.data.title);
  assert.equal(old.history.length, 2);
  assert.equal(
    (await request(cookie, undefined, { ...command, requestId: randomUUID() }))
      .status,
    409,
  );
  assert.equal(
    (
      await request(cookie, undefined, {
        ...command,
        data: { ...command.data, title: "Changed retry" },
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("", `/api/v1/ranking-inputs?id=${id}`)).status,
    401,
  );
  for (const role of ["organizer", "scorekeeper", "ungranted"]) {
    const other = await login(role);
    assert.equal(
      (await request(other, `/api/v1/ranking-inputs?id=${id}`)).status,
      403,
    );
    assert.equal(
      (
        await request(other, undefined, {
          ...command,
          id: randomUUID(),
          requestId: randomUUID(),
        })
      ).status,
      403,
    );
  }
});

test("starting evidence cannot be marked reviewed from aggregates, client readiness flags or unknown shares, and roster changes invalidate current readiness without rewriting history", async () => {
  const cookie = await login();
  const rulesId = randomUUID();
  let r = await request(cookie, undefined, {
    id: rulesId,
    kind: "rules",
    version: 0,
    requestId: randomUUID(),
    state: "reviewed",
    data: rulesFixture(),
  });
  assert.equal(r.status, 200);
  const players = Array.from({ length: 4 }, () => randomUUID());
  const entry = {
    divisionId: "prairie-men",
    name: "WCP032 source review fixture",
    coreKnown: true,
    corePlayerIds: players,
    members: players.map((playerId) => ({
      playerId,
      role: "core",
      position: "",
      participation: "declared",
    })),
    newPlayers: players.map((id, i) => ({
      id,
      name: `WCP032 synthetic player ${i + 1}`,
      provisional: false,
    })),
    registerSeason: { season: "2026-27", version: 0 },
  };
  r = await request(cookie, "/api/v1/entries", {
    id: randomUUID(),
    version: 0,
    requestId: randomUUID(),
    entry,
  });
  assert.equal(r.status, 201);
  const created = await r.json();
  const id = randomUUID(),
    source = rulesFixture().sources[0];
  const data = {
    registrationId: created.registration.id,
    rosterVersion: 1,
    rulesId,
    rulesVersion: 1,
    effectiveFrom: "2026-08-01",
    effectiveTo: "2027-08-01",
    rankingPlayerIds: players,
    rankingAlternateIds: [],
    rosterSourceId: "official",
    allocationOption: "four-equal",
    allocations: players.map((playerId) => ({ playerId, share: "1/4" })),
    sources: [source],
    contributions: players.map((playerId) => ({
      playerId,
      amount: "50",
      basis: "historical-aggregate",
      sourceId: "official",
      ownershipSourceId: "",
      eligibilitySourceId: "",
      note: "Only an old total was observed.",
    })),
    reviewNote: "Synthetic test review",
    biographyMissing: true,
  };
  const command = {
    id,
    kind: "season",
    version: 0,
    requestId: randomUUID(),
    state: "reviewed",
    data,
    complete: true,
  };
  assert.equal((await request(cookie, undefined, command)).status, 422);
  r = await request(cookie, undefined, { ...command, state: "draft" });
  assert.equal(r.status, 200);
  const draft = await r.json();
  assert.equal(draft.currentReadiness.complete, false);
  assert.equal(draft.currentReadiness.startingInput, null);
  const complete = {
    ...data,
    contributions: data.contributions.map((c) => ({
      ...c,
      basis: "documented-individual",
      ownershipSourceId: "official",
      eligibilitySourceId: "official",
      note: "Synthetic exact individually documented entitlement and eligibility, not inferred from aggregate.",
    })),
  };
  const review = {
    ...command,
    version: 1,
    requestId: randomUUID(),
    data: complete,
  };
  r = await request(cookie, undefined, review);
  assert.equal(r.status, 200);
  const ready = await r.json();
  assert.equal(ready.currentReadiness.complete, true);
  assert.equal(ready.currentReadiness.startingInput, "200");
  assert.equal(ready.currentReadiness.issues[0].severity, "informational");
  const old = await (
    await request(cookie, `/api/v1/ranking-inputs?id=${id}&version=1`)
  ).json();
  assert.equal(old.state, "draft");
  assert.equal(old.savedReadiness.complete, false);
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await assert.rejects(
      db.query("UPDATE ranking_revision SET state='draft' WHERE record_id=$1", [
        id,
      ]),
      /immutable/,
    );
  } finally {
    await db.end();
  }
  // Accepted006 staff season amendment creates a new roster snapshot; the old entry remains pinned to v1.
  r = await request(cookie, "/api/v1/entries", {
    id: randomUUID(),
    version: 0,
    requestId: randomUUID(),
    entry: {
      ...entry,
      newPlayers: [],
      teamId: created.teamId,
      registrationId: created.registration.id,
      registerSeason: { season: "2026-27", version: 1 },
    },
  });
  assert.equal(r.status, 201);
  const stale = await (
    await request(cookie, `/api/v1/ranking-inputs?id=${id}`)
  ).json();
  assert.equal(stale.savedReadiness.complete, true);
  assert.equal(stale.currentReadiness.complete, false);
  assert(
    stale.currentReadiness.issues.some(
      (i: { code: string }) => i.code === "roster-stale",
    ),
  );
  assert.equal(
    (
      await request(cookie, undefined, {
        ...review,
        version: 2,
        requestId: randomUUID(),
      })
    ).status,
    422,
  );
});

test("a separately sourced official roster can differ from the platform core while ownership, entry and season snapshots retain their exact meanings", async () => {
  const cookie = await login(),
    ids = Array.from({ length: 5 }, () => randomUUID()),
    rulesId = randomUUID();
  assert.equal(
    (
      await request(cookie, undefined, {
        id: rulesId,
        kind: "rules",
        version: 0,
        requestId: randomUUID(),
        state: "reviewed",
        data: rulesFixture(),
      })
    ).status,
    200,
  );
  const entryId = randomUUID();
  const r = await request(cookie, "/api/v1/entries", {
    id: entryId,
    version: 0,
    requestId: randomUUID(),
    entry: {
      divisionId: "prairie-men",
      name: "WCP032 independently registered roster",
      coreKnown: true,
      corePlayerIds: ids.slice(0, 4),
      members: ids.map((playerId, i) => ({
        playerId,
        role: i === 4 ? "alternate" : "core",
        position: "",
        participation: "declared",
      })),
      newPlayers: ids.map((id, i) => ({
        id,
        name: `Separate roster player ${i}`,
        provisional: false,
      })),
      registerSeason: { season: "2026-27", version: 0 },
    },
  });
  assert.equal(r.status, 201);
  const created = await r.json(),
    official = [ids[0], ids[1], ids[2], ids[4]],
    id = randomUUID();
  const data = {
    registrationId: created.registration.id,
    rosterVersion: 1,
    rulesId,
    rulesVersion: 1,
    effectiveFrom: "2026-08-01",
    effectiveTo: "2027-08-01",
    rankingPlayerIds: official,
    rankingAlternateIds: [ids[3]],
    rosterSourceId: "official",
    allocationOption: "four-equal",
    allocations: official.map((playerId) => ({ playerId, share: "1/4" })),
    sources: rulesFixture().sources,
    contributions: official.map((playerId, i) => ({
      playerId,
      amount: i === 3 ? "1000.123456789013" : "50",
      basis: "documented-individual",
      sourceId: "official",
      ownershipSourceId: "official",
      eligibilitySourceId: "official",
      note: "Explicit synthetic official roster declaration and individually evidenced rights, separately recorded from platform roles.",
    })),
    reviewNote:
      "Sourced official roles deliberately differ; platform identity and old season/entry remain intact.",
    biographyMissing: false,
  };
  const command = {
    id,
    kind: "season",
    version: 0,
    requestId: randomUUID(),
    state: "reviewed",
    data,
  };
  const saved = await request(cookie, undefined, command);
  assert.equal(saved.status, 200);
  const evidence = await saved.json();
  assert.equal(evidence.currentReadiness.complete, true);
  assert.equal(
    evidence.currentReadiness.startingInput,
    "1150123456789013/1000000000000",
  );
  assert.equal(
    evidence.data.contributions[3].amount,
    "1000123456789013/1000000000000",
  );
  // GET reparses canonical values and produces the same exact sum after persistence.
  const loaded = await (
    await request(cookie, `/api/v1/ranking-inputs?id=${id}`)
  ).json();
  assert.equal(
    loaded.currentReadiness.startingInput,
    "1150123456789013/1000000000000",
  );
  assert.deepEqual(loaded.data.rankingAlternateIds, [ids[3]]);
  assert.equal(
    (
      await request(cookie, undefined, {
        ...command,
        version: 1,
        requestId: randomUUID(),
        data: {
          ...data,
          allocations: ids
            .slice(0, 4)
            .map((playerId) => ({ playerId, share: "1/4" })),
        },
      })
    ).status,
    400,
  );
  const team = await (
    await request("", `/api/v1/public/teams/${created.teamId}`)
  ).json();
  assert.deepEqual(
    team.core.map((m: { playerId: string }) => m.playerId).sort(),
    ids.slice(0, 4).sort(),
  );
  assert.equal(team.registrations[0].version, 1);
  assert.equal(
    team.registrations[0].members.find(
      (m: { playerId: string }) => m.playerId === ids[4],
    ).role,
    "alternate",
  );
  const original = await (
    await request(cookie, `/api/v1/entries/${entryId}?version=1`)
  ).json();
  assert.equal(original.registration.version, 1);
  assert.equal(
    original.lineup.members.find(
      (m: { playerId: string }) => m.playerId === ids[4],
    ).role,
    "alternate",
  );
  assert.equal(
    original.core.some((m: { playerId: string }) => m.playerId === ids[3]),
    true,
  );
});

test("an audit failure rolls back the whole evidence revision and an exact retry subsequently commits once", async () => {
  const cookie = await login(),
    id = randomUUID(),
    name = "wcp032_" + randomUUID().replaceAll("-", ""),
    db = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
    command = {
      id,
      kind: "rules",
      version: 0,
      requestId: randomUUID(),
      state: "reviewed",
      data: rulesFixture(),
    };
  try {
    await db.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id='${id}' THEN RAISE EXCEPTION 'WCP032 injected audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.query(
      `CREATE TRIGGER ${name} BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    );
    assert.equal((await request(cookie, undefined, command)).status, 503);
    assert.equal(
      (await request(cookie, `/api/v1/ranking-inputs?id=${id}`)).status,
      404,
    );
  } finally {
    await db.query(`DROP TRIGGER IF EXISTS ${name} ON audit_record`);
    await db.query(`DROP FUNCTION IF EXISTS ${name}()`);
    await db.end();
  }
  const [a, b] = await Promise.all([
    request(cookie, undefined, command),
    request(cookie, undefined, command),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal((await a.json()).version, 1);
  assert.equal((await b.json()).version, 1);
  const competing = await Promise.all(
    ["A", "B"].map((title) =>
      request(cookie, undefined, {
        ...command,
        version: 1,
        requestId: randomUUID(),
        data: { ...command.data, title },
      }),
    ),
  );
  assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
});
