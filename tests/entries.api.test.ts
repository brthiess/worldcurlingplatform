import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
const base = process.env.BETTER_AUTH_URL!;
const sessions = new Map<string, string>();
async function login(role: string) {
  if (sessions.has(role)) return sessions.get(role)!;
  const r = await fetch(base + "/api/auth/sign-in/email", {
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
async function request(path: string, cookie = "", body?: unknown) {
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const members = (ids: string[]) =>
  ids.map((playerId) => ({
    playerId,
    role: "core",
    position: "",
    participation: "declared",
  }));

test("explicit staff season amendments retain old entry roster snapshots and deny organizer-only roster control", async () => {
  const organizer = await login("organizer"),
    admin = await login("administrator"),
    e = assembled(),
    id = randomUUID();
  let r = await request("/api/v1/entries", organizer, {
    id,
    version: 0,
    requestId: randomUUID(),
    entry: e,
  });
  assert.equal(r.status, 201);
  const first = await r.json();
  const alternateId = randomUUID();
  const revised = {
    ...e,
    newPlayers: [
      { id: alternateId, name: "Season alternate", provisional: false },
    ],
    members: [
      ...e.members,
      {
        playerId: alternateId,
        role: "alternate",
        position: "alternate",
        participation: "declared",
      },
    ],
    teamId: first.teamId,
    registrationId: first.registration.id,
    registerSeason: { season: "2026-27", version: 1 },
  };
  const command = {
    id: randomUUID(),
    version: 0,
    requestId: randomUUID(),
    entry: revised,
  };
  assert.equal(
    (await request("/api/v1/entries", organizer, command)).status,
    403,
  );
  assert.equal(
    (await request(`/api/v1/public/players/${alternateId}`)).status,
    404,
  );
  r = await request("/api/v1/entries", admin, command);
  assert.equal(r.status, 201);
  const saved = await r.json();
  assert.equal(saved.registration.version, 2);
  assert.equal(saved.registration.members.length, 5);
  assert.equal((await request("/api/v1/entries", admin, command)).status, 201);
  const old = await (await request(`/api/v1/entries/${id}`, organizer)).json();
  assert.equal(old.registration.version, 1);
  assert.equal(old.registration.members.length, 4);
  const team = await (
    await request(`/api/v1/public/teams/${first.teamId}`)
  ).json();
  assert.equal(team.registrations[0].version, 2);
  assert.equal(team.registrations[0].members.length, 5);
  const stale = await request("/api/v1/entries", admin, {
    ...command,
    id: randomUUID(),
    requestId: randomUUID(),
    entry: { ...revised, newPlayers: [] },
  });
  assert.equal(stale.status, 409);
});
function assembled() {
  const ids = Array.from({ length: 4 }, () => randomUUID());
  return {
    divisionId: "prairie-men",
    name: "WCP006 North",
    coreKnown: true,
    corePlayerIds: ids,
    members: members(ids),
    newPlayers: ids.map((id, i) => ({
      id,
      name: `WCP006 Player ${i + 1}`,
      provisional: false,
    })),
    registerSeason: { season: "2026-27", version: 0 },
  };
}

test("a known core can identify a team while its incomplete event lineup remains provisional", async () => {
  const cookie = await login("organizer"),
    entry = assembled();
  const r = await request("/api/v1/entries", cookie, {
    id: randomUUID(),
    requestId: randomUUID(),
    version: 0,
    entry: { ...entry, members: [], registerSeason: undefined },
  });
  assert.equal(r.status, 201);
  const saved = await r.json();
  assert.equal(saved.core.length, 4);
  assert(saved.teamId);
  assert.equal(saved.status, "provisional");
  assert.deepEqual(saved.lineup.members, []);
});

test("an audit failure rolls back players, identity, season and entry; exact retry later commits one complete version", async () => {
  const cookie = await login("organizer"),
    id = randomUUID(),
    e = assembled(),
    command = { id, version: 0, requestId: randomUUID(), entry: e };
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
    suffix = randomUUID().replaceAll("-", ""),
    name = `wcp006_audit_${suffix}`;
  try {
    await db.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id='${id}' THEN RAISE EXCEPTION 'WCP006 injected audit failure'; END IF; RETURN NEW; END $$`,
    );
    await db.query(
      `CREATE TRIGGER ${name} BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    );
    const failed = await request("/api/v1/entries", cookie, command);
    assert.equal(failed.status, 503);
    assert.equal(
      (await request(`/api/v1/public/players/${e.corePlayerIds[0]}`)).status,
      404,
    );
    assert.equal((await request(`/api/v1/entries/${id}`, cookie)).status, 404);
  } finally {
    await db.query(`DROP TRIGGER IF EXISTS ${name} ON audit_record`);
    await db.query(`DROP FUNCTION IF EXISTS ${name}()`);
    await db.end();
  }
  const r = await request("/api/v1/entries", cookie, command);
  assert.equal(r.status, 201);
  const saved = await r.json();
  assert.equal(saved.version, 1);
  assert.equal(saved.core.length, 4);
  assert.equal(saved.registration.version, 1);
  assert.equal((await request("/api/v1/entries", cookie, command)).status, 201);
});
test("organizer assembles account-free players, creates/reuses team and season roster, and preserves versioned temporary event substitutes", async () => {
  const cookie = await login("organizer"),
    id = randomUUID(),
    entry = assembled();
  const create = { id, requestId: randomUUID(), version: 0, entry };
  let r = await request("/api/v1/entries", cookie, create);
  assert.equal(r.status, 201);
  const first = await r.json();
  assert.equal(first.version, 1);
  assert.equal(first.status, "declared");
  assert.equal(first.core.length, 4);
  assert.equal(first.lineup.members.length, 4);
  assert.equal(first.registration.version, 1);
  assert.equal((await request("/api/v1/entries", cookie, create)).status, 201);
  const returning = {
    ...entry,
    corePlayerIds: [...entry.corePlayerIds].reverse(),
    newPlayers: [],
    registerSeason: undefined,
  };
  r = await request("/api/v1/entries", cookie, {
    id: randomUUID(),
    requestId: randomUUID(),
    version: 0,
    entry: returning,
  });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).teamId, first.teamId);
  const subId = randomUUID();
  const edit = {
    version: 1,
    requestId: randomUUID(),
    entry: {
      ...returning,
      name: "North with guest",
      teamId: first.teamId,
      registrationId: first.registration.id,
      members: [
        ...members(entry.corePlayerIds.slice(0, 3)),
        {
          playerId: subId,
          role: "substitute",
          position: "fourth",
          participation: "declared",
        },
      ],
      newPlayers: [{ id: subId, name: "New Guest", provisional: true }],
    },
  };
  r = await request(`/api/v1/entries/${id}`, cookie, edit);
  assert.equal(r.status, 200);
  const saved = await r.json();
  assert.equal(saved.teamId, first.teamId);
  assert.equal(saved.version, 2);
  assert.equal(saved.status, "provisional");
  assert.equal(saved.registration.version, 1);
  assert.equal(saved.registration.members.length, 4);
  assert.equal(saved.lineup.members[3].role, "substitute");
  const old = await (
    await request(`/api/v1/entries/${id}?version=1`, cookie)
  ).json();
  assert.equal(old.name, "WCP006 North");
  assert.deepEqual(
    old.lineup.members.map((m: { playerId: string }) => m.playerId),
    entry.corePlayerIds,
  );
  const pub = await (await request(`/api/v1/public/entries/${id}`)).json();
  assert.equal(pub.name, "North with guest");
  assert.equal(pub.lineup.version, 2);
  assert.equal(pub.lineup.members[3].identityStatus, "provisional");
  assert.doesNotMatch(
    JSON.stringify(pub),
    /requestId|actorId|email|commandDigest/,
  );
  const team = await (
    await request(`/api/v1/public/teams/${first.teamId}`)
  ).json();
  assert.equal(team.core.length, 4);
  assert.equal(team.registrations[0].members.length, 4);
  assert(team.entries.some((e: { id: string }) => e.id === id));
});

test("five rotating cores, alternate/coach/name/position changes, distinct disciplines and returning seasons preserve the specified identities", async () => {
  const cookie = await login("organizer"),
    e = assembled(),
    ids = e.corePlayerIds;
  const fifth = randomUUID(),
    coach = randomUUID();
  const provisional = {
    ...e,
    coreKnown: false,
    registerSeason: undefined,
    newPlayers: [
      ...e.newPlayers,
      { id: fifth, name: "Same display name", provisional: false },
      { id: coach, name: "Same display name", provisional: true },
    ],
    members: [
      ...e.members,
      {
        playerId: fifth,
        role: "alternate",
        position: "",
        participation: "declared",
      },
      {
        playerId: coach,
        role: "coach",
        position: "",
        participation: "declared",
      },
    ],
  };
  let r = await request("/api/v1/entries", cookie, {
    id: randomUUID(),
    requestId: randomUUID(),
    version: 0,
    entry: provisional,
  });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).teamId, null);
  const save = async (entry: unknown) => {
    const r = await request("/api/v1/entries", cookie, {
      id: randomUUID(),
      requestId: randomUUID(),
      version: 0,
      entry,
    });
    assert.equal(r.status, 201);
    return r.json();
  };
  const four = await save({ ...e, newPlayers: [], registerSeason: undefined });
  const changed = await save({
    ...e,
    newPlayers: [],
    name: "New team label",
    members: [
      ...e.members.map((m) => ({ ...m, position: "lead" })),
      {
        playerId: fifth,
        role: "alternate",
        position: "alternate",
        participation: "declared",
      },
      {
        playerId: coach,
        role: "coach",
        position: "",
        participation: "declared",
      },
    ],
    registerSeason: undefined,
  });
  assert.equal(changed.teamId, four.teamId);
  const five = await save({
    ...e,
    newPlayers: [],
    corePlayerIds: [...ids, fifth],
    members: [
      ...e.members,
      {
        playerId: fifth,
        role: "core",
        position: "rotating",
        participation: "declared",
      },
    ],
    registerSeason: undefined,
  });
  assert.notEqual(five.teamId, four.teamId);
  assert.equal(five.core.length, 5);
  const permanent = await save({
    ...e,
    newPlayers: [],
    corePlayerIds: [...ids.slice(0, 3), fifth],
    members: members([...ids.slice(0, 3), fifth]),
    registerSeason: undefined,
  });
  assert.notEqual(permanent.teamId, four.teamId);
  assert.notEqual(permanent.teamId, five.teamId);
  const returning = await save({
    ...e,
    newPlayers: [],
    corePlayerIds: [...ids].reverse(),
    registerSeason: { season: "2027-28", version: 0 },
  });
  assert.equal(returning.teamId, four.teamId);
  assert.equal(returning.registration.season, "2027-28");
  const eventId = randomUUID(),
    womenId = randomUUID(),
    mixedId = randomUUID();
  const app = await request("/api/v1/applications", cookie, {
    id: eventId,
    requestId: randomUUID(),
    action: "create",
    application: {
      organizationId: "prairie-club",
      seriesId: "prairie",
      name: "Identity discipline fixture",
      startsOn: "2028-11-08",
      endsOn: "2028-11-10",
      city: "Regina",
      country: "Canada",
      venue: "",
      timezone: "America/Regina",
      divisions: [
        { id: womenId, name: "Women", discipline: "women_four" },
        { id: mixedId, name: "Mixed", discipline: "mixed_doubles" },
      ],
    },
  });
  assert.equal(app.status, 201);
  const women = await save({
    ...e,
    divisionId: womenId,
    newPlayers: [],
    registerSeason: undefined,
  });
  assert.notEqual(women.teamId, four.teamId);
  const pair = await save({
    ...e,
    divisionId: mixedId,
    newPlayers: [],
    corePlayerIds: ids.slice(0, 2),
    members: members(ids.slice(0, 2)),
    registerSeason: undefined,
  });
  assert.equal(pair.core.length, 2);
  assert.equal(pair.discipline, "mixed_doubles");
  assert.equal(
    (await request(`/api/v1/public/teams/${women.teamId}`)).status,
    200,
  );
  assert.equal(
    (await request(`/api/v1/public/entries/${women.id}`)).status,
    404,
  );
  assert.equal(changed.lineup.members[4].playerId, fifth);
  assert.equal(changed.lineup.members[5].playerId, coach);
  assert.notEqual(
    changed.lineup.members[4].playerId,
    changed.lineup.members[5].playerId,
  );
});

test("a first core-creation race converges, foreign player references roll back new records, and profile ownership confers no organizer authority", async () => {
  const cookie = await login("organizer"),
    e = assembled();
  const pending = await request("/api/v1/entries", cookie, {
    id: randomUUID(),
    requestId: randomUUID(),
    version: 0,
    entry: { ...e, coreKnown: false, registerSeason: undefined },
  });
  assert.equal(pending.status, 201);
  const responses = await Promise.all(
    [1, 2].map(() =>
      request("/api/v1/entries", cookie, {
        id: randomUUID(),
        requestId: randomUUID(),
        version: 0,
        entry: { ...e, newPlayers: [], registerSeason: undefined },
      }),
    ),
  );
  assert.deepEqual(
    responses.map((r) => r.status),
    [201, 201],
  );
  const [a, b] = await Promise.all(responses.map((r) => r.json()));
  assert.equal(a.teamId, b.teamId);
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await db.query(
      "INSERT INTO player_account_link(player_id,user_id) VALUES('demo-player-other','demo-ungranted') ON CONFLICT DO NOTHING",
    );
    const owner = await login("ungranted");
    const attempt = await request("/api/v1/entries", owner, {
      id: randomUUID(),
      requestId: randomUUID(),
      version: 0,
      entry: { ...e, newPlayers: [], registerSeason: undefined },
    });
    assert.equal(attempt.status, 403);
    const newId = randomUUID();
    const invalid = await request("/api/v1/entries", cookie, {
      id: randomUUID(),
      requestId: randomUUID(),
      version: 0,
      entry: {
        ...e,
        coreKnown: false,
        corePlayerIds: [],
        newPlayers: [{ id: newId, name: "Must roll back", provisional: true }],
        members: [
          {
            playerId: newId,
            role: "substitute",
            position: "",
            participation: "declared",
          },
          {
            playerId: randomUUID(),
            role: "substitute",
            position: "",
            participation: "declared",
          },
        ],
        registerSeason: undefined,
      },
    });
    assert.equal(invalid.status, 400);
    assert.equal(
      (await request(`/api/v1/public/players/${newId}`)).status,
      404,
    );
    const rel = await db.query(
      "SELECT count(*)::int AS count FROM team_core_member WHERE team_id=$1",
      [a.teamId],
    );
    assert.equal(rel.rows[0].count, 4);
    await assert.rejects(
      db.query(
        "UPDATE event_lineup_version SET display_name='Silent overwrite' WHERE entry_id=$1 AND version=1",
        [a.id],
      ),
      /immutable/,
    );
    await assert.rejects(
      db.query("DELETE FROM team_core_member WHERE team_id=$1", [a.teamId]),
      /immutable/,
    );
    const audits = await db.query(
      "SELECT count(*)::int AS count FROM event_lineup_version v JOIN audit_record a ON a.id=v.audit_id WHERE v.entry_id=$1",
      [a.id],
    );
    assert.equal(audits.rows[0].count, 1);
  } finally {
    await db.end();
  }
});

test("identity races and duplicate deliveries produce one core identity; stale writes and unrelated/profile-owner requests are denied atomically", async () => {
  const organizer = await login("organizer"),
    other = await login("ungranted"),
    scorer = await login("scorekeeper"),
    entry = assembled();
  const id = randomUUID(),
    command = {
      id,
      requestId: randomUUID(),
      version: 0,
      entry: { ...entry, registerSeason: undefined },
    };
  assert.equal((await request("/api/v1/entries", "", command)).status, 401);
  assert.equal((await request("/api/v1/entries", other, command)).status, 403);
  assert.equal((await request("/api/v1/entries", scorer, command)).status, 403);
  assert.equal(
    (
      await request("/api/v1/entries", organizer, {
        ...command,
        entry: { ...entry, divisionId: "other-men" },
      })
    ).status,
    403,
  );
  const duplicate = await Promise.all([
    request("/api/v1/entries", organizer, command),
    request("/api/v1/entries", organizer, command),
  ]);
  assert.deepEqual(
    duplicate.map((r) => r.status),
    [201, 201],
  );
  const [a, b] = await Promise.all(duplicate.map((r) => r.json()));
  assert.equal(a.teamId, b.teamId);
  assert.equal(a.version, 1);
  assert.equal(b.version, 1);
  assert.equal(
    (
      await request("/api/v1/entries", organizer, {
        ...command,
        entry: { ...command.entry, name: "Changed request" },
      })
    ).status,
    409,
  );
  const racing = await Promise.all(
    [1, 2].map(() =>
      request("/api/v1/entries", organizer, {
        id: randomUUID(),
        requestId: randomUUID(),
        version: 0,
        entry: { ...entry, newPlayers: [], registerSeason: undefined },
      }),
    ),
  );
  assert.deepEqual(
    racing.map((r) => r.status),
    [201, 201],
  );
  for (const r of racing) assert.equal((await r.json()).teamId, a.teamId);
  const competing = await Promise.all(
    ["Version A", "Version B"].map((name) =>
      request(`/api/v1/entries/${id}`, organizer, {
        version: 1,
        requestId: randomUUID(),
        entry: { ...entry, name, newPlayers: [], registerSeason: undefined },
      }),
    ),
  );
  assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
  const latest = await (
    await request(`/api/v1/entries/${id}`, organizer)
  ).json();
  assert.equal(latest.version, 2);
  assert.equal((await request(`/api/v1/entries/${id}`, other)).status, 403);
  const invalid = await request("/api/v1/entries", organizer, {
    id: randomUUID(),
    requestId: randomUUID(),
    version: 0,
    entry: {
      ...entry,
      newPlayers: [],
      corePlayerIds: [...entry.corePlayerIds.slice(0, 3), randomUUID()],
    },
  });
  assert.equal(invalid.status, 400);
  const incomplete = await request("/api/v1/entries", organizer, {
    id: randomUUID(),
    requestId: randomUUID(),
    version: 0,
    entry: {
      divisionId: "prairie-men",
      name: "Unresolved entry",
      coreKnown: false,
      corePlayerIds: [],
      members: [],
    },
  });
  assert.equal(incomplete.status, 201);
  const pending = await incomplete.json();
  assert.equal(pending.teamId, null);
  assert.equal(pending.status, "provisional");
  assert.deepEqual(pending.lineup.members, []);
});
