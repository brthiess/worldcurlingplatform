import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { authRequest } from "./auth-request";
import pg from "pg";
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
      members: ids
        .slice(0, 4)
        .map((playerId) => ({
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
