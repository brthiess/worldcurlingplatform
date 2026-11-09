import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { authRequest } from "./auth-request";
import pg from "pg";
import { assessmentFixture } from "./event-assessments-fixture";
const base = process.env.BETTER_AUTH_URL!;
const sessions = new Map<string, string>();
async function login(role = "administrator") {
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
async function req(path: string, body?: unknown, role = "administrator") {
  return fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie: await login(role),
      Origin: base,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function fixture() {
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const id = randomUUID();
  const r = await req("/api/v1/entries", {
    id,
    version: 0,
    requestId: randomUUID(),
    entry: {
      divisionId: "prairie-men",
      name: `Factual fixture ${id}`,
      coreKnown: true,
      corePlayerIds: ids.slice(0, 4),
      members: ids.slice(0, 4).map((playerId) => ({
        playerId,
        role: "core",
        position: "",
        participation: "declared",
      })),
      newPlayers: ids
        .map((id, i) => ({
          id,
          name: i === 4 ? "Correct identity" : "Same name selection",
          provisional: i === 0,
        }))
        .slice(0, 4),
    },
  });
  assert.equal(r.status, 201);
  const entry = await r.json();
  // Create the distinct candidate through the ordinary entry interface.
  const candidate = await req("/api/v1/entries", {
    id: randomUUID(),
    version: 0,
    requestId: randomUUID(),
    entry: {
      divisionId: "prairie-men",
      name: "Candidate record",
      coreKnown: false,
      corePlayerIds: [],
      members: [
        {
          playerId: ids[4],
          role: "substitute",
          position: "",
          participation: "declared",
        },
      ],
      newPlayers: [
        { id: ids[4], name: "Correct identity", provisional: false },
      ],
    },
  });
  assert.equal(candidate.status, 201);
  return { id, ids, entry };
}
test("candidate disambiguation exposes only public context and leaves the existing profile projection unchanged", async () => {
  const f = await fixture(),
    eventId = randomUUID(),
    divisionId = randomUUID(),
    secretName = `Unpublished candidate context ${randomUUID()}`;
  const app = await req("/api/v1/applications", {
    id: eventId,
    requestId: randomUUID(),
    action: "create",
    application: {
      organizationId: "prairie-club",
      seriesId: "prairie",
      name: secretName,
      startsOn: "2031-11-08",
      endsOn: "2031-11-10",
      city: "Regina",
      country: "Canada",
      venue: "",
      timezone: "America/Regina",
      divisions: [
        {
          id: divisionId,
          name: "Private draft division",
          discipline: "men_four",
        },
      ],
    },
  });
  assert.equal(app.status, 201);
  const hidden = await req("/api/v1/entries", {
    id: randomUUID(),
    requestId: randomUUID(),
    version: 0,
    entry: {
      divisionId,
      name: "Hidden candidate participation",
      coreKnown: false,
      corePlayerIds: [],
      members: [
        {
          playerId: f.ids[0],
          role: "substitute",
          position: "",
          participation: "declared",
        },
      ],
    },
  });
  assert.equal(hidden.status, 201);
  const r = await fetch(base + "/api/v1/public/player-candidates");
  assert.equal(r.status, 200);
  const candidates = await r.json();
  const p = candidates.find((p: any) => p.id === f.ids[0]);
  assert.deepEqual(Object.keys(p).sort(), [
    "contexts",
    "id",
    "identityStatus",
    "name",
    "origin",
  ]);
  assert.ok(p.contexts.includes("Prairie Open 2026 · Men’s four-player"));
  assert.equal(JSON.stringify(candidates).includes(secretName), false);
  assert.equal(
    JSON.stringify(candidates).includes("Private draft division"),
    false,
  );
  const publicProfile = await (
    await fetch(base + `/api/v1/public/players/${f.ids[0]}`)
  ).json();
  assert.deepEqual(Object.keys(publicProfile).sort(), [
    "biography",
    "handedness",
    "id",
    "identityStatus",
    "name",
    "origin",
    "photoUrl",
  ]);
});
test("staff factual correction appends evidence and preserves the exact old lineup; retries are actor and byte bound", async () => {
  const f = await fixture();
  const body = {
    requestId: randomUUID(),
    entryId: f.id,
    version: 1,
    fromPlayerId: f.ids[0],
    toPlayerId: f.ids[4],
    reason: "Wrong sport record selected during entry",
    source: "Organizer signed lineup 2026-11-08",
  };
  const r = await req("/api/v1/identity-corrections", body);
  assert.equal(r.status, 200);
  const receipt = await r.json();
  assert.equal(receipt.outcome, "applied");
  assert.equal(receipt.before.version, 1);
  assert.equal(receipt.after.version, 2);
  const old = await (await req(`/api/v1/entries/${f.id}?version=1`)).json();
  assert.deepEqual(old.lineup, f.entry.lineup);
  const current = await (await req(`/api/v1/entries/${f.id}`)).json();
  assert.equal(current.version, 2);
  assert.equal(
    current.core.some((p: { playerId: string }) => p.playerId === f.ids[0]),
    false,
  );
  assert.equal(
    current.core.some((p: { playerId: string }) => p.playerId === f.ids[4]),
    true,
  );
  assert.notEqual(current.teamId, f.entry.teamId);
  assert.deepEqual(
    await (await req("/api/v1/identity-corrections", body)).json(),
    receipt,
  );
  assert.equal(
    (
      await req("/api/v1/identity-corrections", {
        ...body,
        reason: "Altered evidence",
      })
    ).status,
    409,
  );
  assert.equal(
    (await req("/api/v1/identity-corrections", body, "organizer")).status,
    403,
  );
  assert.equal(
    (
      await req("/api/v1/identity-corrections", {
        ...body,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  const history = await (
    await req(`/api/v1/identity-corrections?requestId=${body.requestId}`)
  ).json();
  assert.deepEqual(history, receipt);
});

test("person, team, entry and ranking-subject collisions retain durable issues without partial canonical changes", async () => {
  const f = await fixture();
  const body = {
    requestId: randomUUID(),
    entryId: f.id,
    version: 1,
    fromPlayerId: f.ids[0],
    toPlayerId: f.ids[1],
    reason: "Suspected duplicate requires explicit review",
    source: "Two named lineup records supplied by organizer",
  };
  let response = await req("/api/v1/identity-corrections", body);
  assert.equal(response.status, 200);
  const person = await response.json();
  assert.equal(person.outcome, "issue");
  assert.deepEqual(
    person.collisions.map((c: { kind: string }) => c.kind),
    ["person"],
  );
  assert.deepEqual(
    (await (await req(`/api/v1/entries/${f.id}`)).json()).lineup,
    f.entry.lineup,
  );
  const correctedIds = [f.ids[4], ...f.ids.slice(1, 4)];
  response = await req("/api/v1/entries", {
    id: randomUUID(),
    version: 0,
    requestId: randomUUID(),
    entry: {
      divisionId: "prairie-men",
      name: "Already registered corrected team",
      coreKnown: true,
      corePlayerIds: correctedIds,
      members: correctedIds.map((playerId) => ({
        playerId,
        role: "core",
        position: "",
        participation: "declared",
      })),
      registerSeason: { season: "2026-27", version: 0 },
    },
  });
  assert.equal(response.status, 201);
  const target = await response.json();
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Fixture-only ranking subject; evidence is exercised via the staff correction interface.
    await db.query(
      "INSERT INTO ranking_record(id,kind,registration_id,version) VALUES($1,'season',$2,1)",
      [randomUUID(), target.registration.id],
    );
    const stateBefore = await db.query(
      "SELECT (SELECT count(*)::int FROM team) AS teams,(SELECT count(*)::int FROM event_lineup_version WHERE entry_id=$1) AS versions",
      [f.id],
    );
    const collisionBody = {
      ...body,
      requestId: randomUUID(),
      toPlayerId: f.ids[4],
    };
    response = await req("/api/v1/identity-corrections", collisionBody);
    assert.equal(response.status, 200);
    const issue = await response.json();
    assert.equal(issue.outcome, "issue");
    assert.equal(issue.after, null);
    assert.deepEqual(
      issue.collisions.map((c: { kind: string }) => c.kind),
      ["team", "entry", "ranking_subject"],
    );
    assert.deepEqual(
      (await (await req(`/api/v1/entries/${f.id}`)).json()).lineup,
      f.entry.lineup,
    );
    assert.deepEqual(
      (await (await req(`/api/v1/entries/${target.id}`)).json()).lineup,
      target.lineup,
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT (SELECT count(*)::int FROM team) AS teams,(SELECT count(*)::int FROM event_lineup_version WHERE entry_id=$1) AS versions",
          [f.id],
        )
      ).rows,
      stateBefore.rows,
    );
    assert.deepEqual(
      await (await req("/api/v1/identity-corrections", collisionBody)).json(),
      issue,
    );
    const workspace = await (await req("/api/v1/identity-corrections")).json();
    assert.equal(
      workspace.records.find((r: { id: string }) => r.id === issue.id).outcome,
      "issue",
    );
  } finally {
    await db.end();
  }
});

test("current authority is checked before an existing receipt; exact raw bytes are enforced", async () => {
  const f = await fixture();
  const command = {
    requestId: randomUUID(),
    entryId: f.id,
    version: 1,
    fromPlayerId: f.ids[0],
    toPlayerId: f.ids[1],
    reason: "Collision record with authority boundary",
    source: "Reviewed source record",
  };
  assert.equal(
    (await req("/api/v1/identity-corrections", command)).status,
    200,
  );
  const changedWhitespace = await fetch(base + "/api/v1/identity-corrections", {
    method: "POST",
    headers: {
      cookie: await login(),
      Origin: base,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command, null, 2),
  });
  assert.equal(changedWhitespace.status, 409);
  assert.equal(
    (
      await req(
        `/api/v1/identity-corrections?requestId=${command.requestId}`,
        undefined,
        "organizer",
      )
    ).status,
    403,
  );
  const wrongActor = await fetch(base + "/api/v1/identity-corrections", {
    method: "POST",
    headers: {
      cookie: await login(),
      Origin: base,
      "Content-Type": "application/json",
      "X-WCP-Actor": "another-account",
    },
    body: JSON.stringify(command),
  });
  assert.equal(wrongActor.status, 403);
});

test("revoked staff cannot recover a previously recorded receipt", async () => {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const grant = randomUUID(),
    f = await fixture();
  const body = {
    requestId: randomUUID(),
    entryId: f.id,
    version: 1,
    fromPlayerId: f.ids[0],
    toPlayerId: f.ids[1],
    reason: "Evidence retained for authorized staff only",
    source: "Original signed entry form",
  };
  try {
    await db.query(
      "INSERT INTO role_grant(id,user_id,role) VALUES($1,'demo-ungranted','administrator')",
      [grant],
    );
    assert.equal(
      (await req("/api/v1/identity-corrections", body, "ungranted")).status,
      200,
    );
    await db.query("DELETE FROM role_grant WHERE id=$1", [grant]);
    assert.equal(
      (await req("/api/v1/identity-corrections", body, "ungranted")).status,
      403,
    );
    assert.equal(
      (
        await req(
          `/api/v1/identity-corrections?requestId=${body.requestId}`,
          undefined,
          "ungranted",
        )
      ).status,
      403,
    );
  } finally {
    await db.query("DELETE FROM role_grant WHERE id=$1", [grant]);
    await db.end();
  }
});

test("a persistence failure rolls back the entry, new core and audit together", async () => {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const f = await fixture(),
    requestId = randomUUID(),
    constraint = `fixture_${requestId.replaceAll("-", "")}`;
  const body = {
    requestId,
    entryId: f.id,
    version: 1,
    fromPlayerId: f.ids[0],
    toPlayerId: f.ids[4],
    reason: "Atomic failure fixture",
    source: "Original organizer lineup",
  };
  try {
    await db.query(
      `ALTER TABLE identity_correction ADD CONSTRAINT ${constraint} CHECK(request_id<>'${requestId}') NOT VALID`,
    );
    const before = await db.query(
      "SELECT (SELECT count(*)::int FROM team) AS teams,(SELECT count(*)::int FROM audit_record WHERE resource_id=$1) AS audits",
      [f.id],
    );
    assert.equal((await req("/api/v1/identity-corrections", body)).status, 503);
    assert.deepEqual(
      (await (await req(`/api/v1/entries/${f.id}`)).json()).lineup,
      f.entry.lineup,
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT (SELECT count(*)::int FROM team) AS teams,(SELECT count(*)::int FROM audit_record WHERE resource_id=$1) AS audits",
          [f.id],
        )
      ).rows,
      before.rows,
    );
    assert.equal(
      (await req(`/api/v1/identity-corrections?requestId=${requestId}`)).status,
      404,
    );
  } finally {
    await db.query(
      `ALTER TABLE identity_correction DROP CONSTRAINT IF EXISTS ${constraint}`,
    );
    await db.end();
  }
});

test("a factual core correction never transfers an old representative grant or player account link", async () => {
  const f = await fixture(),
    db = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
    divisionId = randomUUID(),
    entryId = randomUUID(),
    ownerId = randomUUID();
  try {
    await db.query(
      "INSERT INTO division(id,event_id,name,discipline,format,entry_season) VALUES($1,'prairie-2026','Correction authority fixture','men_four','Organizer recorded','2026-27')",
      [divisionId],
    );
    const created = await req("/api/v1/entries", {
      id: entryId,
      version: 0,
      requestId: randomUUID(),
      entry: {
        divisionId,
        name: "Represented mistaken identity",
        coreKnown: true,
        corePlayerIds: f.ids.slice(0, 4),
        members: f.ids
          .slice(0, 4)
          .map((playerId) => ({
            playerId,
            role: "core",
            position: "",
            participation: "declared",
          })),
        registerSeason: { season: "2026-27", version: 0 },
      },
    });
    assert.equal(created.status, 201);
    const before = await created.json();
    const granted = await req("/api/v1/team-representation", {
      action: "grant",
      id: randomUUID(),
      requestId: randomUUID(),
      userId: "demo-reviewer",
      registrationId: before.registration.id,
      actions: ["amend"],
      reason: "Explicit original team-season authority",
    });
    assert.equal(granted.status, 200);
    await db.query(
      "INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,'Correction account fixture',$2,true)",
      [ownerId, `${ownerId}@demo.invalid`],
    );
    await db.query(
      "INSERT INTO player_account_link(player_id,user_id) VALUES($1,$2)",
      [f.ids[0], ownerId],
    );
    const links = await db.query(
      "SELECT * FROM player_account_link WHERE user_id=$1",
      [ownerId],
    );
    assert.equal(
      (await req(`/api/v1/entries/${entryId}`, undefined, "reviewer")).status,
      200,
    );
    const corrected = await req("/api/v1/identity-corrections", {
      requestId: randomUUID(),
      entryId,
      version: 1,
      fromPlayerId: f.ids[0],
      toPlayerId: f.ids[4],
      reason: "Wrong regular player selected, not a permanent transition",
      source: "Reviewed original entry form",
    });
    assert.equal(corrected.status, 200);
    assert.equal((await corrected.json()).outcome, "applied");
    assert.equal(
      (await req(`/api/v1/entries/${entryId}`, undefined, "reviewer")).status,
      403,
    );
    assert.equal(
      (await req(`/api/v1/entries/${entryId}?version=1`, undefined, "reviewer"))
        .status,
      403,
    );
    const current = await (await req(`/api/v1/entries/${entryId}`)).json();
    assert.equal(current.registration, null);
    assert.deepEqual(
      (
        await db.query("SELECT * FROM player_account_link WHERE user_id=$1", [
          ownerId,
        ])
      ).rows,
      links.rows,
    );
    assert.equal(
      (await (await req(`/api/v1/entries/${entryId}?version=1`)).json())
        .registration.id,
      before.registration.id,
    );
  } finally {
    await db.end();
  }
});

test("factual correction preserves frozen results, season inputs and assessment bytes; finalization and scheduler obey real lock barriers", async () => {
  const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
  });
  const c = await db.connect();
  let correcting: Promise<Response> | undefined,
    finalizing: Promise<Response> | undefined,
    scheduling: Promise<Response> | undefined;
  async function blockedBy(pid: number) {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      const r = await db.query(
        "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) ORDER BY query_start",
        [pid],
      );
      if (r.rowCount) return Number(r.rows[0].pid);
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(
      "Real correction writer did not reach the expected lock barrier",
    );
  }
  try {
    const f = await assessmentFixture(db, req);
    const candidate = await fixture();
    const readAssessment = async () =>
      (
        await req(
          `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
        )
      ).json();
    const initial = await readAssessment();
    let r = await req("/api/v1/event-assessments", {
      action: "calculate",
      divisionId: f.divisionId,
      version: 0,
      requestId: randomUUID(),
      sourceDigest: initial.review.sourceDigest,
      evidence: f.evidence,
    });
    assert.equal(r.status, 200);
    let assessed: any;
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      assessed = await readAssessment();
      if (assessed.selected?.state === "completed") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(assessed.selected?.state, "completed");
    assert.equal(
      JSON.parse(assessed.selected.resultContents).result.awards.find(
        (a: any) => a.entryId === f.entries[0],
      ).points,
      "27",
    );
    const finalization = await (
      await req(`/api/v1/division-finalizations?division=${f.divisionId}`)
    ).json();
    const frozen = await db.query(
      "SELECT (SELECT jsonb_agg(to_jsonb(r) ORDER BY game_id,version) FROM game_result_version r WHERE game_id=ANY($1::text[])) AS results,(SELECT jsonb_agg(to_jsonb(r) ORDER BY version) FROM division_finalization r WHERE division_id=$2) AS finals,(SELECT jsonb_agg(to_jsonb(r) ORDER BY record_id,version) FROM ranking_revision r WHERE record_id=ANY($3::text[])) AS inputs,(SELECT jsonb_agg(to_jsonb(r) ORDER BY assessment_id) FROM event_assessment_result r WHERE assessment_id=$4) AS assessments",
      [
        f.games.map((g) => g.id),
        f.divisionId,
        f.reviewIds,
        assessed.selected.id,
      ],
    );
    assert.ok(frozen.rows[0].results?.length);
    assert.ok(frozen.rows[0].finals?.length);
    assert.equal(frozen.rows[0].inputs.length, 8);
    assert.equal(frozen.rows[0].assessments.length, 1);
    const command = {
      requestId: randomUUID(),
      entryId: f.entries[0],
      version: 1,
      fromPlayerId: f.playerLists[0][0],
      toPlayerId: candidate.ids[4],
      reason: "Factual mistaken selection supported by signed source",
      source: "Fictional corrected original event entry form",
    };
    // Hold division: correction must take entry UPDATE before waiting on division SHARE.
    await c.query("BEGIN");
    const pid = Number(
      (await c.query("SELECT pg_backend_pid() AS pid")).rows[0].pid,
    );
    await c.query("SELECT id FROM division WHERE id=$1 FOR UPDATE", [
      f.divisionId,
    ]);
    correcting = req("/api/v1/identity-corrections", command);
    const correctionPid = await blockedBy(pid);
    finalizing = req("/api/v1/division-finalizations", {
      divisionId: f.divisionId,
      version: 1,
      requestId: randomUUID(),
      sourceDigest: finalization.sourceDigest,
      placements: f.entries.map((entryId, i) => ({
        entryId,
        place: i < 4 ? i + 1 : 5,
      })),
      note: "Concurrent organizer revision",
      rulesReference: "Fictional event rules",
    });
    await blockedBy(correctionPid);
    await c.query("ROLLBACK");
    assert.equal((await correcting).status, 200);
    assert.equal((await finalizing).status, 409);
    const after = await readAssessment();
    assert.equal(
      after.selected.resultContents,
      assessed.selected.resultContents,
    );
    assert.notEqual(after.review.sourceDigest, assessed.review.sourceDigest);
    const frozenAfter = await db.query(
      "SELECT (SELECT jsonb_agg(to_jsonb(r) ORDER BY game_id,version) FROM game_result_version r WHERE game_id=ANY($1::text[])) AS results,(SELECT jsonb_agg(to_jsonb(r) ORDER BY version) FROM division_finalization r WHERE division_id=$2) AS finals,(SELECT jsonb_agg(to_jsonb(r) ORDER BY record_id,version) FROM ranking_revision r WHERE record_id=ANY($3::text[])) AS inputs,(SELECT jsonb_agg(to_jsonb(r) ORDER BY assessment_id) FROM event_assessment_result r WHERE assessment_id=$4) AS assessments",
      [
        f.games.map((g) => g.id),
        f.divisionId,
        f.reviewIds,
        assessed.selected.id,
      ],
    );
    assert.deepEqual(frozenAfter.rows, frozen.rows);
    const corrected = await (
      await req(`/api/v1/entries/${f.entries[0]}`)
    ).json();
    assert.equal(corrected.registration, null);
    assert.equal(
      (await (await req(`/api/v1/entries/${f.entries[0]}?version=1`)).json())
        .registration.id,
      f.seasonIds[0],
    );
    const schedule = await (
      await req(`/api/v1/events/${f.eventId}/schedule`)
    ).json();
    await c.query("BEGIN");
    await c.query("SELECT id FROM division WHERE id=$1 FOR UPDATE", [
      f.divisionId,
    ]);
    correcting = req("/api/v1/identity-corrections", {
      ...command,
      requestId: randomUUID(),
      version: 2,
      fromPlayerId: f.playerLists[0][1],
      toPlayerId: f.playerLists[1][0],
    });
    const correction2Pid = await blockedBy(pid);
    scheduling = req(`/api/v1/events/${f.eventId}/schedule`, {
      action: "session",
      requestId: randomUUID(),
      expectedVersion: schedule.version,
      reason: "Real event-first lock regression",
      session: {
        id: randomUUID(),
        divisionId: f.divisionId,
        number: 99,
        localStart: "2026-11-22T20:00",
        utcOffset: "+00:00",
        durationMinutes: 120,
      },
    });
    await blockedBy(correction2Pid);
    await c.query("ROLLBACK");
    assert.equal((await correcting).status, 200);
    assert.equal((await scheduling).status, 200);
  } finally {
    await c.query("ROLLBACK");
    await Promise.allSettled(
      [correcting, finalizing, scheduling].filter(Boolean),
    );
    c.release();
    await db.end();
  }
});
