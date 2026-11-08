import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import {
  finalizationFixtureEvent,
  clearFinalizationScoringGrants,
} from "./finalization-fixture";
import {
  rulesFixture,
  source as rankingSource,
} from "./ranking-inputs-fixtures";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});
after(async () => {
  await clearFinalizationScoringGrants(pool);
  await pool.end();
});
const base = process.env.BETTER_AUTH_URL!;
async function waitForBlockedSession(blockerPid: number) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const waiting = await pool.query(
      "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) ORDER BY query_start",
      [blockerPid],
    );
    if (waiting.rowCount) return waiting.rows[0].pid as number;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    "The real command did not reach its expected row-lock barrier.",
  );
}
const sessions = new Map<string, string>();
async function login(role: string) {
  if (sessions.has(role)) return sessions.get(role)!;
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
  sessions.set(role, cookie);
  return cookie;
}
const request = (path: string, cookie = "", body?: unknown) =>
  fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
async function fixture(cookie: string, registered = false) {
  const eventId = await finalizationFixtureEvent(pool);
  const divisionId = `final-${randomUUID()}`,
    drawId = randomUUID(),
    gameId = randomUUID();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Finalization review','men_four','Organizer recorded final')",
    [divisionId, eventId],
  );
  const entries = [],
    registrations = [];
  for (const name of ["Final North", "Final Lake"]) {
    const id = randomUUID(),
      players = Array.from({ length: 4 }, () => randomUUID());
    const r = await request("/api/v1/entries", cookie, {
      id,
      version: 0,
      requestId: randomUUID(),
      entry: {
        divisionId,
        name,
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
          name: `${name} player ${i + 1}`,
          provisional: false,
        })),
        ...(registered
          ? { registerSeason: { season: "2026-27", version: 0 } }
          : {}),
      },
    });
    assert.equal(r.status, 201, await r.clone().text());
    entries.push(id);
    registrations.push(await r.json());
  }
  await pool.query(
    "INSERT INTO draw_session VALUES($1,$2,1,'2041-01-01T12:00:00Z','completed')",
    [drawId, divisionId],
  );
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,$2,'A','Final','scheduled',$3,$4,'North','Lake')",
    [gameId, drawId, ...entries],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper',$2,$1)",
    [gameId, eventId],
  );
  const confirm = await request(
    `/api/v1/games/${gameId}/scoring`,
    await login("scorekeeper"),
    {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: "confirm",
      hammer: null,
      outcome: "forfeit",
      winnerEntryId: entries[0],
      reason: "Fictional fixture forfeit",
    },
  );
  assert.equal(confirm.status, 200, await confirm.clone().text());
  return { divisionId, gameId, entries, registrations };
}
test("finalization is a scoped organizer command with a public immutable history boundary", async () => {
  assert.equal((await request("/api/v1/division-finalizations")).status, 401);
  assert.equal(
    (
      await request(
        "/api/v1/division-finalizations",
        await login("scorekeeper"),
      )
    ).status,
    403,
  );
  const r = await request(
    "/api/v1/division-finalizations",
    await login("organizer"),
  );
  assert.equal(r.status, 200);
  assert.ok(
    (await r.json()).divisions.some(
      (d: { id: string }) => d.id === "prairie-men",
    ),
  );
});
test("organizer sees only scoped ranking issues: complete drafts are not reviewed, and later roster changes invalidate reviewed readiness", async () => {
  const cookie = await login("organizer"),
    admin = await login("administrator"),
    f = await fixture(cookie, true),
    rulesId = randomUUID();
  let r = await request("/api/v1/ranking-inputs", admin, {
    id: rulesId,
    kind: "rules",
    version: 0,
    requestId: randomUUID(),
    state: "reviewed",
    data: rulesFixture(),
  });
  assert.equal(r.status, 200);
  const first = f.registrations[0],
    players = first.lineup.members.map((m: { playerId: string }) => m.playerId),
    evidenceId = randomUUID();
  const data = {
    registrationId: first.registration.id,
    rosterVersion: 1,
    rulesId,
    rulesVersion: 1,
    effectiveFrom: "2026-08-01",
    effectiveTo: "2027-08-01",
    rankingPlayerIds: players,
    rankingAlternateIds: [],
    rosterSourceId: "official",
    allocationOption: "four-equal",
    allocations: players.map((playerId: string) => ({
      playerId,
      share: "1/4",
    })),
    sources: [rankingSource],
    contributions: players.map((playerId: string) => ({
      playerId,
      amount: "50",
      basis: "documented-individual",
      sourceId: "official",
      ownershipSourceId: "official",
      eligibilitySourceId: "official",
      note: "Exact synthetic entitlement privately reviewed",
    })),
    reviewNote: "Private World Curling rationale",
  };
  const command = {
    id: evidenceId,
    kind: "season",
    version: 0,
    requestId: randomUUID(),
    state: "draft",
    data,
  };
  r = await request("/api/v1/ranking-inputs", admin, command);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).currentReadiness.complete, true);
  const read = async () => {
    const r = await request(
      `/api/v1/division-finalizations?division=${f.divisionId}`,
      cookie,
    );
    assert.equal(r.status, 200);
    return r.json();
  };
  let review = await read();
  assert.ok(
    review.ranking.issues.some(
      (i: { entryId: string; code: string }) =>
        i.entryId === f.entries[0] && i.code === "starting-evidence",
    ),
  );
  r = await request("/api/v1/ranking-inputs", admin, {
    ...command,
    version: 1,
    requestId: randomUUID(),
    state: "reviewed",
  });
  assert.equal(r.status, 200);
  review = await read();
  assert.equal(
    review.ranking.issues.some(
      (i: { entryId: string; code: string }) =>
        i.entryId === f.entries[0] && i.code === "starting-evidence",
    ),
    false,
  );
  assert.equal(review.ranking.approved, false);
  assert.equal(
    JSON.stringify(review).includes("Private World Curling rationale"),
    false,
  );
  assert.equal(JSON.stringify(review).includes("contributions"), false);
  assert.equal(JSON.stringify(review).includes("startingInput"), false);
  const alternate = randomUUID();
  r = await request("/api/v1/entries", admin, {
    id: randomUUID(),
    version: 0,
    requestId: randomUUID(),
    entry: {
      divisionId: "prairie-men",
      name: "Roster amendment fixture",
      teamId: first.teamId,
      registrationId: first.registration.id,
      registerSeason: { season: "2026-27", version: 1 },
      coreKnown: true,
      corePlayerIds: players,
      members: [
        ...players.map((playerId: string) => ({
          playerId,
          role: "core",
          position: "",
          participation: "declared",
        })),
        {
          playerId: alternate,
          role: "alternate",
          position: "Alternate",
          participation: "declared",
        },
      ],
      newPlayers: [
        { id: alternate, name: "New alternate", provisional: false },
      ],
    },
  });
  assert.equal(r.status, 201, await r.clone().text());
  review = await read();
  assert.ok(
    review.ranking.issues.some(
      (i: { entryId: string; code: string }) =>
        i.entryId === f.entries[0] && i.code === "starting-evidence",
    ),
  );
});
test("two divisions finalize independently; ordinary correction marks and replaces only its division while old bytes and digests survive", async () => {
  const organizer = await login("organizer"),
    a = await fixture(organizer),
    b = await fixture(organizer);
  const unused = randomUUID();
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,'Unused entry, no sporting participation')",
    [unused, a.divisionId],
  );
  const read = async (id: string, version?: number) => {
    const r = await request(
      `/api/v1/division-finalizations?division=${id}${version ? `&version=${version}` : ""}`,
      organizer,
    );
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  };
  const command = async (f: typeof a) => {
    const data = await read(f.divisionId);
    return {
      divisionId: f.divisionId,
      version: 0,
      sourceDigest: data.sourceDigest,
      requestId: randomUUID(),
      placements: f.entries.map((entryId, i) => ({ entryId, place: i + 1 })),
      note: "Organizer reviewed final placements",
      rulesReference: "Event competition rules · fictional review edition 1",
    };
  };
  const ca = await command(a),
    cb = await command(b);
  assert.equal(
    (await read(a.divisionId)).source.entries.some(
      (e: { id: string }) => e.id === unused,
    ),
    false,
  );
  const post = (body: unknown, cookie = organizer) =>
    request("/api/v1/division-finalizations", cookie, body);
  assert.equal((await post(ca, await login("scorekeeper"))).status, 403);
  let r = await post(ca);
  assert.equal(r.status, 200, await r.clone().text());
  const first = await r.json();
  assert.deepEqual(await (await post(ca)).json(), first);
  assert.equal((await post({ ...ca, note: "Different content" })).status, 409);
  assert.equal((await post(cb)).status, 200);
  const originalA = await read(a.divisionId),
    originalB = await read(b.divisionId);
  const frozen = JSON.parse(originalA.selected.contents);
  assert.equal(frozen.source.games[0].result.outcome, "forfeit");
  assert.equal(frozen.source.games[0].result.lineupA.members.length, 4);
  assert.equal(frozen.source.entries[0].lineup.version, 1);
  assert.equal(
    originalA.selected.digest,
    createHash("sha256").update(originalA.selected.contents).digest("hex"),
  );
  assert.equal(originalA.ranking.scope, "division-ranking-evidence");
  assert.equal(originalA.ranking.approved, false);
  assert.ok(
    originalA.ranking.issues.some(
      (i: { code: string }) => i.code === "eligibility",
    ),
  );
  assert.equal(JSON.stringify(originalA).includes("contributions"), false);
  r = await request(
    `/api/v1/games/${a.gameId}/scoring`,
    await login("scorekeeper"),
    {
      requestId: randomUUID(),
      expectedVersion: 1,
      action: "correct",
      hammer: null,
      outcome: "forfeit",
      winnerEntryId: a.entries[1],
      reason: "Ordinary winner correction",
      ends: [],
    },
  );
  assert.equal(r.status, 200, await r.clone().text());
  const changed = await read(a.divisionId);
  assert.equal(changed.dirty, true);
  assert.equal((await read(b.divisionId)).dirty, false);
  assert.equal(
    (await post({ ...ca, requestId: randomUUID(), version: 1 })).status,
    409,
  );
  r = await post({
    ...ca,
    requestId: randomUUID(),
    version: 1,
    sourceDigest: changed.sourceDigest,
    placements: [
      { entryId: a.entries[1], place: 1 },
      { entryId: a.entries[0], place: 2 },
    ],
    note: "Direct replacement after ordinary correction",
  });
  assert.equal(r.status, 200, await r.clone().text());
  const revised = await read(a.divisionId);
  assert.equal(revised.version, 2);
  assert.equal(revised.dirty, false);
  assert.equal(revised.selected.replacesVersion, 1);
  assert.equal(
    JSON.parse(revised.selected.contents).source.games[0].result.winnerEntryId,
    a.entries[1],
  );
  const old = await read(a.divisionId, 1);
  assert.equal(old.selected.contents, originalA.selected.contents);
  assert.equal(old.selected.digest, originalA.selected.digest);
  assert.equal(
    (await read(b.divisionId)).selected.contents,
    originalB.selected.contents,
  );
  const publicR = await request(
    `/api/v1/public/divisions/${a.divisionId}/results?version=1`,
  );
  assert.equal(publicR.status, 200);
  const publicData = await publicR.json();
  const inspect = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const child of value) inspect(child);
      return;
    }
    if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value)) {
        assert.equal(
          [
            "actorId",
            "auditId",
            "resultAuditId",
            "requestId",
            "commandDigest",
            "scoringSource",
            "sourceDigest",
            "registrationId",
            "registrationVersion",
          ].includes(key),
          false,
          `Private field ${key} must not be public`,
        );
        inspect(child);
      }
  };
  inspect(publicData);
  inspect(JSON.parse(publicData.selected.contents));
  assert.equal(publicData.selected.visibility, "public-sporting-projection");
  assert.equal(publicData.selected.snapshotDigest, old.selected.digest);
  assert.equal(
    publicData.selected.digest,
    createHash("sha256").update(publicData.selected.contents).digest("hex"),
  );
  assert.notEqual(publicData.selected.contents, old.selected.contents);
  assert.equal(
    JSON.parse(publicData.selected.contents).source.games[0].result
      .winnerEntryId,
    a.entries[0],
  );
  assert.equal(
    JSON.parse(publicData.selected.contents).source.games[0].result.reason,
    "Fictional fixture forfeit",
  );
  assert.equal(
    (await read(a.divisionId, 1)).selected.contents,
    old.selected.contents,
  );
  assert.equal(typeof old.selected.auditId, "string");
  const audits = await pool.query(
    "SELECT action,resource_version FROM audit_record WHERE resource_id=$1 AND action='division_finalized' ORDER BY resource_version",
    [a.divisionId],
  );
  assert.deepEqual(audits.rows, [
    { action: "division_finalized", resource_version: 1 },
    { action: "division_finalized", resource_version: 2 },
  ]);
});
test("prerequisites, placements, current sources, duplicates and audit failure preserve a coherent immutable revision", async () => {
  const organizer = await login("organizer"),
    f = await fixture(organizer),
    path = `/api/v1/division-finalizations?division=${f.divisionId}`;
  const read = async () => {
    const r = await request(path, organizer);
    assert.equal(r.status, 200);
    return r.json();
  };
  const initial = await read(),
    body = {
      divisionId: f.divisionId,
      version: 0,
      sourceDigest: initial.sourceDigest,
      requestId: randomUUID(),
      placements: f.entries.map((entryId, i) => ({ entryId, place: i + 1 })),
      rulesReference: "Competition rules edition 1",
      note: "Reviewed recorded outcomes",
    };
  const post = (b: object) =>
    request("/api/v1/division-finalizations", organizer, b);
  assert.equal((await request(path, await login("reviewer"))).status, 403);
  assert.equal(
    (
      await request(
        "/api/v1/division-finalizations?division=other-men",
        organizer,
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/v1/public/divisions/other-men/results")).status,
    404,
  );
  assert.equal((await request(path + "&version=-1", organizer)).status, 400);
  assert.equal(
    (await post({ ...body, placements: [{ entryId: f.entries[0], place: 1 }] }))
      .status,
    400,
  );
  assert.equal((await post({ ...body, rulesReference: "" })).status, 400);
  assert.equal(
    (
      await fetch(base + "/api/v1/division-finalizations", {
        method: "POST",
        headers: {
          cookie: organizer,
          "Content-Type": "application/json",
          Origin: "https://untrusted.example",
        },
        body: JSON.stringify(body),
      })
    ).status,
    403,
  );
  // A new real entry revision invalidates the exact source previously reviewed.
  assert.equal(
    (
      await fetch(base + "/api/v1/division-finalizations", {
        method: "POST",
        headers: {
          cookie: organizer,
          Origin: base,
          "Content-Type": "application/json",
          "X-WCP-Actor": "demo-administrator",
        },
        body: JSON.stringify(body),
      })
    ).status,
    403,
  );
  const entry = initial.source.entries.find(
    (e: { id: string }) => e.id === f.entries[0],
  );
  let r = await request(`/api/v1/entries/${entry.id}`, organizer, {
    version: 1,
    requestId: randomUUID(),
    entry: {
      divisionId: f.divisionId,
      name: "Final North revised entry",
      coreKnown: true,
      corePlayerIds: entry.lineup.members.map(
        (m: { playerId: string }) => m.playerId,
      ),
      members: entry.lineup.members.map((m: { playerId: string }) => ({
        playerId: m.playerId,
        role: "core",
        position: "",
        participation: "declared",
      })),
      newPlayers: [],
    },
  });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await post(body)).status, 409);
  const current = await read(),
    updated = { ...body, sourceDigest: current.sourceDigest };
  // Keep every accepted immutable result/lineup guard active while injecting a
  // transaction-boundary failure. A failed audit must not leave a finalization.
  const trigger = `wcp027_${randomUUID().replaceAll("-", "")}`;
  await pool.query(
    `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id='${f.divisionId}' AND NEW.action='division_finalized' THEN RAISE EXCEPTION 'WCP027 injected audit failure'; END IF; RETURN NEW; END $$`,
  );
  await pool.query(
    `CREATE TRIGGER ${trigger} BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION ${trigger}()`,
  );
  try {
    assert.equal((await post(updated)).status, 503);
    assert.equal((await read()).version, 0);
  } finally {
    await pool.query(`DROP TRIGGER ${trigger} ON audit_record`);
    await pool.query(`DROP FUNCTION ${trigger}()`);
  }
  const [first, retry] = await Promise.all([post(updated), post(updated)]);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.deepEqual(await first.json(), await retry.json());
  const frozen = await read();
  assert.equal(frozen.history.length, 1);
  assert.equal(
    JSON.parse(frozen.selected.contents).source.entries.find(
      (e: { id: string }) => e.id === entry.id,
    ).name,
    "Final North revised entry",
  );
  assert.equal(
    JSON.parse(frozen.selected.contents).source.games[0].result.nameA,
    "Final North",
  );
  for (const statement of [
    "UPDATE division_finalization SET contents='{}' WHERE division_id=$1",
    "DELETE FROM division_finalization WHERE division_id=$1",
  ])
    await assert.rejects(pool.query(statement, [f.divisionId]), /immutable/);
  const races = await Promise.all([
    post({
      ...updated,
      version: 1,
      requestId: randomUUID(),
      note: "Second revision A",
    }),
    post({
      ...updated,
      version: 1,
      requestId: randomUUID(),
      note: "Second revision B",
    }),
  ]);
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await read()).history.length, 2);
});
test("scheduled games and legacy totals cannot be passed off as completed explicit sporting outcomes", async () => {
  const eventId = await finalizationFixtureEvent(pool);
  const cookie = await login("organizer"),
    divisionId = `final-incomplete-${randomUUID()}`,
    drawId = randomUUID(),
    gameId = randomUUID();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Incomplete final review','men_four','Manual review')",
    [divisionId, eventId],
  );
  await pool.query(
    "INSERT INTO draw_session VALUES($1,$2,1,'2042-01-01T12:00:00Z','scheduled')",
    [drawId, divisionId],
  );
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,slot_a,slot_b) VALUES($1,$2,'A','Final','scheduled','Pending','Pending')",
    [gameId, drawId],
  );
  const d = await (
    await request(
      `/api/v1/division-finalizations?division=${divisionId}`,
      cookie,
    )
  ).json();
  assert.deepEqual(d.prerequisites, [
    "Every game must be confirmed.",
    "Every game needs an explicitly confirmed outcome; legacy totals alone are insufficient.",
    "Both recorded participants must belong to this division.",
  ]);
  const r = await request("/api/v1/division-finalizations", cookie, {
    divisionId,
    version: 0,
    sourceDigest: d.sourceDigest,
    requestId: randomUUID(),
    placements: [],
    note: "Cannot finalize",
    rulesReference: "Event rules",
  });
  assert.equal(r.status, 422);
  const publicR = await request(
    `/api/v1/public/divisions/${divisionId}/results`,
  );
  assert.equal(publicR.status, 200);
  assert.equal((await publicR.json()).selected, null);
});
test("accepted schedule edits and finalization serialize without a partial or mixed-source snapshot", async () => {
  const cookie = await login("organizer"),
    f = await fixture(cookie),
    eventId = await finalizationFixtureEvent(pool);
  const reviewed = await (
    await request(
      `/api/v1/division-finalizations?division=${f.divisionId}`,
      cookie,
    )
  ).json();
  const schedule = await request(`/api/v1/events/${eventId}/schedule`, cookie);
  assert.equal(schedule.status, 200);
  const current = await schedule.json(),
    blocker = await pool.connect();
  let scheduling!: Promise<Response>, finalizing!: Promise<Response>;
  async function blockedBy(pid: number) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const r = await pool.query(
        "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))",
        [pid],
      );
      if (r.rowCount) return r.rows[0].pid as number;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("The real API did not reach its queued source lock.");
  }
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM game WHERE id=$1 FOR UPDATE", [
      f.gameId,
    ]);
    const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    scheduling = request(`/api/v1/events/${eventId}/schedule`, cookie, {
      requestId: randomUUID(),
      expectedVersion: current.version,
      reason: "Concurrent new draw changes reviewed division context",
      action: "session",
      session: {
        id: randomUUID(),
        divisionId: f.divisionId,
        number: 2,
        localStart: "2041-01-01T18:00",
        utcOffset: "+00:00",
        durationMinutes: 120,
      },
    });
    const schedulePid = await blockedBy(pid);
    finalizing = request("/api/v1/division-finalizations", cookie, {
      divisionId: f.divisionId,
      version: 0,
      sourceDigest: reviewed.sourceDigest,
      requestId: randomUUID(),
      placements: f.entries.map((entryId, i) => ({ entryId, place: i + 1 })),
      note: "Review before queued schedule edit",
      rulesReference: "Event rules edition 1",
    });
    await blockedBy(schedulePid);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
  const [scheduled, finalized] = await Promise.all([scheduling, finalizing]);
  assert.equal(scheduled.status, 200, await scheduled.clone().text());
  assert.equal(finalized.status, 409, await finalized.clone().text());
  const after = await (
    await request(
      `/api/v1/division-finalizations?division=${f.divisionId}`,
      cookie,
    )
  ).json();
  assert.equal(after.version, 0);
  assert.equal(after.selected, null);
  assert.equal(after.source.draws.length, 2);
  assert.notEqual(after.sourceDigest, reviewed.sourceDigest);
});
test("a queued command cannot carry old organizer authority into a division's changed edition, even with a matching source digest", async () => {
  const cookie = await login("organizer"),
    f = await fixture(cookie),
    eventId = await finalizationFixtureEvent(pool),
    target = randomUUID();
  const before = await (
    await request(
      `/api/v1/division-finalizations?division=${f.divisionId}`,
      cookie,
    )
  ).json();
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES($1,'finalization-test','Changed edition destination','Review ice','Fictional location','UTC','2041-01-01','2041-01-02','fictional_demo',true,'approved')",
    [target],
  );
  // The caller deliberately supplies the exact post-move source fingerprint.
  // A fingerprint is freshness evidence, never substitute authorization.
  const canonical = (value: unknown): string =>
    Array.isArray(value)
      ? "[" + value.map(canonical).join(",") + "]"
      : value && typeof value === "object"
        ? "{" +
          Object.keys(value)
            .sort()
            .map(
              (k) =>
                JSON.stringify(k) +
                ":" +
                canonical((value as Record<string, unknown>)[k]),
            )
            .join(",") +
          "}"
        : JSON.stringify(value);
  const futureSource = {
    ...before.source,
    division: {
      ...before.source.division,
      eventId: target,
      eventName: "Changed edition destination",
    },
  };
  const digest = createHash("sha256")
      .update(canonical(futureSource))
      .digest("hex"),
    blocker = await pool.connect();
  let command!: Promise<Response>;
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      eventId,
    ]);
    const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    command = request("/api/v1/division-finalizations", cookie, {
      divisionId: f.divisionId,
      version: 0,
      sourceDigest: digest,
      requestId: randomUUID(),
      placements: f.entries.map((entryId, i) => ({ entryId, place: i + 1 })),
      rulesReference: "Reviewed event rules",
      note: "Old organizer cannot act in new scope",
    });
    let queued = false;
    for (let i = 0; i < 100; i++) {
      if (
        (
          await pool.query(
            "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))",
            [pid],
          )
        ).rowCount
      ) {
        queued = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(
      queued,
      true,
      "Finalization must actually wait at the edition barrier",
    );
    await blocker.query("UPDATE division SET event_id=$2 WHERE id=$1", [
      f.divisionId,
      target,
    ]);
    await blocker.query("COMMIT");
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
  try {
    const r = await command;
    assert.equal(r.status, 409, await r.clone().text());
    assert.equal(
      (
        await request(
          `/api/v1/division-finalizations?division=${f.divisionId}`,
          cookie,
        )
      ).status,
      403,
    );
    const current = await (
      await request(
        `/api/v1/division-finalizations?division=${f.divisionId}`,
        await login("administrator"),
      )
    ).json();
    assert.equal(current.sourceDigest, digest);
    assert.equal(current.version, 0);
    assert.equal(current.selected, null);
  } finally {
    await pool.query(
      "DELETE FROM role_grant WHERE id=$1 AND user_id='demo-scorekeeper'",
      [f.gameId],
    );
  }
});
test("an exact saved receipt rechecks its locked edition scope while valid dirty-source retries remain read-only", async () => {
  const cookie = await login("organizer"),
    admin = await login("administrator"),
    f = await fixture(cookie),
    eventId = await finalizationFixtureEvent(pool),
    target = randomUUID();
  const path = `/api/v1/division-finalizations?division=${f.divisionId}`;
  const reviewed = await (await request(path, cookie)).json();
  const original = {
    divisionId: f.divisionId,
    version: 0,
    sourceDigest: reviewed.sourceDigest,
    requestId: randomUUID(),
    placements: f.entries.map((entryId, i) => ({ entryId, place: i + 1 })),
    rulesReference: "Receipt fixture competition rules edition 1",
    note: "Original finalization for exact receipt replay",
  };
  const body = JSON.stringify(original);
  const replay = () =>
    fetch(base + "/api/v1/division-finalizations", {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body,
    });
  const saved = await replay();
  assert.equal(saved.status, 200, await saved.clone().text());
  const receipt = await saved.json();
  const before = await (await request(path, admin)).json(),
    immutable = before.selected;
  const auditCount = async () =>
    Number(
      (
        await pool.query(
          "SELECT count(*) AS n FROM audit_record WHERE action='division_finalized' AND resource_id=$1",
          [f.divisionId],
        )
      ).rows[0].n,
    );
  assert.equal(await auditCount(), 1);
  assert.deepEqual(await (await replay()).json(), receipt);
  const correction = await request(
    `/api/v1/games/${f.gameId}/scoring`,
    await login("scorekeeper"),
    {
      requestId: randomUUID(),
      expectedVersion: 1,
      action: "correct",
      hammer: null,
      outcome: "forfeit",
      winnerEntryId: f.entries[1],
      reason: "Ordinary correction after the recorded receipt",
      ends: [],
    },
  );
  assert.equal(correction.status, 200, await correction.clone().text());
  assert.equal((await (await request(path, cookie)).json()).dirty, true);
  const dirtyReplay = await replay();
  assert.equal(dirtyReplay.status, 200);
  assert.deepEqual(await dirtyReplay.json(), receipt);
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES($1,'finalization-test','Receipt moved destination','Review ice','Fictional location','UTC','2041-01-01','2041-01-02','fictional_demo',true,'approved')",
    [target],
  );
  const blocker = await pool.connect();
  let queued!: Promise<Response>;
  try {
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      eventId,
    ]);
    const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    queued = replay();
    let reached = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (
        (
          await pool.query(
            "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))",
            [pid],
          )
        ).rowCount
      ) {
        reached = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(
      reached,
      true,
      "The exact saved receipt must wait at the real edition barrier",
    );
    await blocker.query("UPDATE division SET event_id=$2 WHERE id=$1", [
      f.divisionId,
      target,
    ]);
    await blocker.query("COMMIT");
    const denied = await queued;
    // Read current authority and all immutable evidence before asserting the
    // rejection, so a failed red still reports the exact reproduced boundary.
    const currentStatus = (await request(path, cookie)).status;
    const after = await (await request(path, admin)).json();
    assert.equal(currentStatus, 403);
    assert.equal(after.version, 1);
    assert.equal(after.history.length, 1);
    assert.equal(after.selected.contents, immutable.contents);
    assert.equal(after.selected.digest, immutable.digest);
    assert.equal(after.selected.auditId, immutable.auditId);
    assert.equal(await auditCount(), 1);
    assert.equal(denied.status, 409, await denied.clone().text());
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
    await pool.query("UPDATE division SET event_id=$2 WHERE id=$1", [
      f.divisionId,
      eventId,
    ]);
    if (queued) await queued;
  }
  const restored = await replay();
  assert.equal(restored.status, 200);
  assert.deepEqual(await restored.json(), receipt);
  const final = await (await request(path, admin)).json();
  assert.equal(final.dirty, true);
  assert.equal(final.history.length, 1);
  assert.equal(final.selected.contents, immutable.contents);
  assert.equal(final.selected.digest, immutable.digest);
  assert.equal(await auditCount(), 1);
});
for (const first of ["amendment", "finalization"] as const) {
  test(`entry/finalization race: ${first} first preserves current source and immutable snapshots`, async () => {
    const cookie = await login("organizer"),
      f = await fixture(cookie),
      path = `/api/v1/division-finalizations?division=${f.divisionId}`;
    const read = async () => {
      const r = await request(path, cookie);
      assert.equal(r.status, 200);
      return r.json();
    };
    const before = await read(),
      original = f.registrations[0],
      amendment = {
        requestId: randomUUID(),
        version: 1,
        entry: {
          divisionId: f.divisionId,
          name: `Race ${first} amended`,
          coreKnown: true,
          corePlayerIds: original.core.map(
            (p: { playerId: string }) => p.playerId,
          ),
          teamId: original.teamId,
          members: original.lineup.members.map(
            (m: {
              playerId: string;
              role: string;
              position: string;
              participation: string;
            }) => ({
              playerId: m.playerId,
              role: m.role,
              position: m.position,
              participation: m.participation,
            }),
          ),
          newPlayers: [],
        },
      },
      finalization = {
        divisionId: f.divisionId,
        version: 0,
        sourceDigest: before.sourceDigest,
        requestId: randomUUID(),
        placements: f.entries.map((entryId, i) => ({ entryId, place: i + 1 })),
        note: "Real entry/finalization serialization regression",
        rulesReference: "Fictional event rules edition 1",
      },
      barrier = await pool.connect();
    let amending: Promise<Response> | undefined,
      finalizing: Promise<Response> | undefined;
    try {
      await barrier.query("BEGIN");
      const pid = (await barrier.query("SELECT pg_backend_pid() AS pid"))
        .rows[0].pid;
      // SHARE blocks the finalizer's division UPDATE; UPDATE blocks the
      // amendment's division SHARE. Observe both real wait edges before release.
      await barrier.query(
        `SELECT id FROM division WHERE id=$1 FOR ${first === "amendment" ? "UPDATE" : "SHARE"}`,
        [f.divisionId],
      );
      if (first === "amendment") {
        amending = request(
          `/api/v1/entries/${f.entries[0]}`,
          cookie,
          amendment,
        );
        const amendmentPid = await waitForBlockedSession(pid);
        finalizing = request(
          "/api/v1/division-finalizations",
          cookie,
          finalization,
        );
        await waitForBlockedSession(amendmentPid);
      } else {
        finalizing = request(
          "/api/v1/division-finalizations",
          cookie,
          finalization,
        );
        const finalizerPid = await waitForBlockedSession(pid);
        amending = request(
          `/api/v1/entries/${f.entries[0]}`,
          cookie,
          amendment,
        );
        await waitForBlockedSession(finalizerPid);
      }
      await barrier.query("ROLLBACK");
      const [amended, finalized] = await Promise.all([amending, finalizing]);
      assert.equal(amended.status, 200, await amended.clone().text());
      assert.equal(
        finalized.status,
        first === "amendment" ? 409 : 200,
        await finalized.clone().text(),
      );
      const after = await read();
      const current = after.source.entries.find(
        (e: { id: string }) => e.id === f.entries[0],
      );
      assert.equal(current.version, 2);
      assert.equal(current.name, amendment.entry.name);
      assert.equal(current.lineup.version, 2);
      assert.notEqual(after.sourceDigest, before.sourceDigest);
      assert.equal(after.version, first === "amendment" ? 0 : 1);
      assert.equal(after.history.length, first === "amendment" ? 0 : 1);
      assert.equal(after.dirty, first === "finalization");
      const frozenOriginal =
        first === "finalization" ? after.selected.contents : null;
      if (frozenOriginal) {
        const frozen = JSON.parse(frozenOriginal).source.entries.find(
          (e: { id: string }) => e.id === f.entries[0],
        );
        assert.equal(frozen.version, 1);
        assert.equal(frozen.name, original.name);
      }
      const fresh = {
        ...finalization,
        version: after.version,
        sourceDigest: after.sourceDigest,
        requestId: randomUUID(),
      };
      const saved = await request(
        "/api/v1/division-finalizations",
        cookie,
        fresh,
      );
      assert.equal(saved.status, 200, await saved.clone().text());
      assert.equal(
        (await request("/api/v1/division-finalizations", cookie, fresh)).status,
        200,
      );
      assert.equal(
        (await request(`/api/v1/entries/${f.entries[0]}`, cookie, amendment))
          .status,
        200,
      );
      const final = await read();
      assert.equal(final.version, after.version + 1);
      assert.equal(final.dirty, false);
      assert.equal(final.history.length, after.version + 1);
      const latest = JSON.parse(final.selected.contents).source.entries.find(
        (e: { id: string }) => e.id === f.entries[0],
      );
      assert.equal(latest.version, 2);
      assert.equal(latest.name, amendment.entry.name);
      if (frozenOriginal) {
        const historical = await (
          await request(`${path}&version=1`, cookie)
        ).json();
        assert.equal(historical.selected.contents, frozenOriginal);
      }
      const audit = await pool.query(
        "SELECT resource_version FROM audit_record WHERE action='division_finalized' AND resource_id=$1 ORDER BY resource_version",
        [f.divisionId],
      );
      assert.deepEqual(
        audit.rows.map((r) => r.resource_version),
        first === "amendment" ? [1] : [1, 2],
      );
    } finally {
      await barrier.query("ROLLBACK");
      barrier.release();
      await Promise.allSettled(
        [amending, finalizing].filter((p): p is Promise<Response> => !!p),
      );
    }
  });
}
