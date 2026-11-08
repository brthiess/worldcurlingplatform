import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
const base = process.env.BETTER_AUTH_URL!;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(() => pool.end());
const sessions = new Map<string, string>();
async function login(role = "organizer") {
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
async function request(
  eventId: string,
  cookie = "",
  body?: unknown,
  origin = base,
) {
  return fetch(`${base}/api/v1/events/${eventId}/schedule`, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: origin, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("organizer saves explicit venue sessions and game assignments with retained history, replay and public consistency", async () => {
  const cookie = await login();
  const initial = await request("prairie-2026", cookie);
  assert.equal(initial.status, 200);
  const before = await initial.json(),
    id = randomUUID();
  const command = {
    requestId: randomUUID(),
    expectedVersion: before.version,
    reason: "Add evening session",
    action: "session",
    session: {
      id,
      divisionId: "prairie-men",
      number:
        Math.max(
          ...before.draws
            .filter((d: any) => d.divisionId === "prairie-men")
            .map((d: any) => d.number),
        ) + 1,
      localStart: "2026-11-09T18:15",
      utcOffset: "-06:00",
      durationMinutes: 135,
    },
  };
  const saved = await request("prairie-2026", cookie, command);
  assert.equal(saved.status, 200);
  const response = await saved.json();
  assert.equal(response.version, before.version + 1);
  assert.equal(
    response.draws.find((d: any) => d.id === id).startsAt,
    "2026-11-10T00:15:00.000Z",
  );
  assert.deepEqual(
    await (await request("prairie-2026", cookie, command)).json(),
    response,
  );
  assert.equal(
    (
      await request("prairie-2026", cookie, {
        ...command,
        reason: "Changed payload",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("prairie-2026", cookie, {
        ...command,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  const gameId = randomUUID();
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,slot_a,slot_b) VALUES($1,'draw-3','Z','Scheduling acceptance','scheduled','Unknown side A','Unknown side B')",
    [gameId],
  );
  const assigned = await request("prairie-2026", cookie, {
    requestId: randomUUID(),
    expectedVersion: response.version,
    reason: "Assign existing game",
    action: "assign",
    gameId,
    drawId: id,
    sheet: "C",
  });
  assert.equal(assigned.status, 200);
  const publicData = await (
    await fetch(base + "/api/v1/public/events/prairie-2026")
  ).json();
  assert.equal(
    publicData.draws.find((d: any) => d.id === id).durationMinutes,
    135,
  );
  assert.equal(publicData.games.find((g: any) => g.id === gameId).drawId, id);
  assert.equal(
    publicData.games.find((g: any) => g.id === gameId).state,
    "scheduled",
  );
  assert.doesNotMatch(
    JSON.stringify(publicData),
    /actorId|requestId|command|demo-organizer/,
  );
  const history = await (await request("prairie-2026", cookie)).json();
  assert.equal(history.history[0].reason, "Assign existing game");
  assert.equal(history.history[1].reason, "Add evening session");
  const persisted = await pool.query(
    "SELECT r.version,a.action FROM schedule_revision r JOIN audit_record a ON a.id=r.audit_id WHERE r.event_id='prairie-2026' AND r.actor_id='demo-organizer' ORDER BY version DESC LIMIT 1",
  );
  assert.equal(persisted.rows[0].version, response.version + 1);
  assert.equal(persisted.rows[0].action, "schedule.assign");
  await assert.rejects(
    pool.query(
      "UPDATE schedule_revision SET response='{}' WHERE event_id='prairie-2026'",
    ),
    /immutable/,
  );
});

async function fixture() {
  const eventId = randomUUID(),
    a = randomUUID(),
    b = randomUUID(),
    d1 = randomUUID(),
    d2 = randomUUID();
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES($1,'prairie','Schedule acceptance','Acceptance ice','Edmonton','America/Edmonton','2026-11-01','2026-11-10','fictional_demo',true,'approved')",
    [eventId],
  );
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$3,'Four-player A','men_four','Existing games'),($2,$3,'Four-player B','women_four','Existing games')",
    [a, b, eventId],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-organizer','organizer',$2)",
    [randomUUID(), eventId],
  );
  await pool.query(
    "INSERT INTO draw_session(id,division_id,number,starts_at,state,duration_minutes) VALUES($1,$3,1,'2026-11-01T07:30:00Z','scheduled',120),($2,$4,1,'2026-11-01T08:30:00Z','scheduled',60)",
    [d1, d2, a, b],
  );
  return { eventId, a, b, d1, d2 };
}
async function publicEvent(id: string, division: string) {
  return (
    await fetch(`${base}/api/v1/public/events/${id}?division=${division}`)
  ).json();
}
test("current authorization, origin, division boundaries and concurrent stale commands protect schedule atomicity", async () => {
  const f = await fixture(),
    cookie = await login(),
    reviewer = await login("reviewer"),
    scorer = await login("scorekeeper");
  assert.equal((await request(f.eventId)).status, 401);
  for (const c of [reviewer, scorer]) {
    assert.equal((await request(f.eventId, c)).status, 403);
  }
  assert.equal((await request("other-2026", cookie)).status, 403);
  const command = {
    requestId: randomUUID(),
    expectedVersion: 0,
    reason: "DST occurrence",
    action: "session",
    session: {
      id: f.d1,
      divisionId: f.a,
      number: 1,
      localStart: "2026-11-01T01:30",
      utcOffset: "-07:00",
      durationMinutes: 90,
    },
  };
  assert.equal(
    (await request(f.eventId, cookie, command, "https://untrusted.invalid"))
      .status,
    403,
  );
  assert.equal((await request(f.eventId, reviewer, command)).status, 403);
  assert.equal(
    (
      await request(f.eventId, cookie, {
        ...command,
        session: { ...command.session, divisionId: "other-men" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(f.eventId, cookie, {
        ...command,
        session: { ...command.session, localStart: "2026-03-08T02:30" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(f.eventId, cookie, {
        ...command,
        session: { ...command.session, durationMinutes: 0 },
      })
    ).status,
    400,
  );
  const race = await Promise.all([
    request(f.eventId, cookie, command),
    request(f.eventId, cookie, {
      ...command,
      requestId: randomUUID(),
      reason: "Other organizer edit",
    }),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  const data = await (await request(f.eventId, cookie)).json();
  assert.equal(data.version, 1);
  assert.equal(data.history.length, 1);
  assert.equal(
    data.draws.find((d: any) => d.id === f.d1).startsAt,
    "2026-11-01T08:30:00.000Z",
  );
  const publicData = await publicEvent(f.eventId, f.a);
  assert.equal(publicData.draws[0].startsAt, "2026-11-01T08:30:00.000Z");
  assert.equal(publicData.draws[0].state, "scheduled");
  // Replay rechecks authority rather than granting a permanent bypass to an old receipt.
  await pool.query(
    "DELETE FROM role_grant WHERE user_id='demo-organizer' AND event_id=$1",
    [f.eventId],
  );
  assert.equal((await request(f.eventId, cookie, command)).status, 403);
});

test("declared rotating-five and referenced game lineups detect cross-division conflicts, exclude coaches and preserve confirmed evidence when moved", async () => {
  const f = await fixture(),
    cookie = await login(),
    players = Array.from({ length: 9 }, () => randomUUID()),
    coach = randomUUID();
  const createEntry = async (
    divisionId: string,
    ids: string[],
    newIds: string[],
    name: string,
  ) => {
    const entryId = randomUUID();
    const r = await fetch(base + "/api/v1/entries", {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entryId,
        version: 0,
        requestId: randomUUID(),
        entry: {
          divisionId,
          name,
          coreKnown: true,
          corePlayerIds: ids,
          members: [
            ...ids.map((playerId) => ({
              playerId,
              role: "core",
              position: "rotating",
              participation: "declared",
            })),
            {
              playerId: coach,
              role: "coach",
              position: "Coach",
              participation: "declared",
            },
          ],
          newPlayers: newIds.map((id) => ({
            id,
            name: id === coach ? "Shared coach" : "Schedule player",
            provisional: id === coach,
          })),
        },
      }),
    });
    assert.equal(r.status, 201);
    return { entryId, saved: await r.json() };
  };
  const first = await createEntry(
    f.a,
    players.slice(0, 5),
    [...players.slice(0, 5), coach],
    "Five regulars",
  );
  const second = await createEntry(
    f.b,
    [players[4], ...players.slice(5, 8)],
    players.slice(5, 8),
    "Cross-division four",
  );
  const opponentPlayers = Array.from({ length: 4 }, () => randomUUID());
  const opponent = await createEntry(
    f.a,
    opponentPlayers,
    opponentPlayers,
    "Known opponent",
  );
  const games = [randomUUID(), randomUUID(), randomUUID()];
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,$4,'A','Schedule test','scheduled',$6,NULL,'A','Opponent pending'),($2,$5,'A','Schedule test','scheduled',$7,NULL,'B','Opponent pending'),($3,$4,'B','Same-entry check','scheduled',$6,NULL,'A','Opponent pending')",
    [...games, f.d1, f.d2, first.entryId, second.entryId],
  );
  let data = await (await request(f.eventId, cookie)).json();
  const pair = data.conflicts.filter(
    (c: any) => c.gameIds.includes(games[0]) && c.gameIds.includes(games[1]),
  );
  assert.deepEqual(
    pair.map((c: any) => [c.kind, c.resource]),
    [
      ["sheet", "A"],
      ["player", players[4]],
    ],
  );
  assert.ok(
    data.conflicts.some(
      (c: any) => c.kind === "entry" && c.resource === first.entryId,
    ),
  );
  assert.ok(
    !data.conflicts.some(
      (c: any) => c.kind === "player" && c.resource === coach,
    ),
  );
  assert.equal(
    data.games.find((g: any) => g.id === games[0]).lineupReferences[0]
      .eventLineupVersion,
    1,
  );
  const score = async (body: object) =>
    fetch(`${base}/api/v1/games/${games[0]}/scoring`, {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: randomUUID(), hammer: null, ...body }),
    });
  // A known distinct opponent is required for confirmation; retain same-entry overlap on the separate third game.
  await pool.query("UPDATE game SET entry_b=$2 WHERE id=$1", [
    games[0],
    opponent.entryId,
  ]);
  const knownPlayingCoverage = await (await request(f.eventId, cookie)).json();
  assert.equal(
    knownPlayingCoverage.games.find((g: any) => g.id === games[0]).coverage,
    "Declared/defaulted players; participation unverified",
  );
  assert.equal(
    (await score({ expectedVersion: 0, action: "start" })).status,
    200,
  );
  assert.equal(
    (
      await score({
        expectedVersion: 1,
        action: "confirm",
        outcome: "forfeit",
        winnerEntryId: first.entryId,
        reason: "Opponent forfeit",
      })
    ).status,
    200,
  );
  const readGame = async () =>
    (
      await fetch(`${base}/api/v1/games/${games[0]}/scoring`, {
        headers: { cookie },
      })
    ).json();
  const evidence = await readGame();
  const newSession = randomUUID();
  let r = await request(f.eventId, cookie, {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "session",
    reason: "Move planned slot only",
    session: {
      id: newSession,
      divisionId: f.a,
      number: 2,
      localStart: "2040-01-01T12:00",
      utcOffset: "-07:00",
      durationMinutes: 120,
    },
  });
  assert.equal(r.status, 200);
  data = await r.json();
  r = await request(f.eventId, cookie, {
    requestId: randomUUID(),
    expectedVersion: data.version,
    action: "assign",
    reason: "Correct planned sheet",
    gameId: games[0],
    drawId: newSession,
    sheet: "C",
  });
  assert.equal(r.status, 200);
  const preserved = await readGame();
  assert.deepEqual(preserved.results, evidence.results);
  assert.deepEqual(preserved.lineupA, evidence.lineupA);
  assert.equal(preserved.version, evidence.version);
  assert.equal(preserved.scoringSource, evidence.scoringSource);
  assert.equal(preserved.entryA, evidence.entryA);
  assert.equal(preserved.state, "confirmed");
  const published = await publicEvent(f.eventId, f.a);
  assert.equal(
    published.draws.find((d: any) => d.id === newSession).state,
    "completed",
  );
  assert.equal(published.selection.selected, newSession);
  // Changing the event roster later cannot rewrite the frozen game reference.
  const amended = await fetch(base + `/api/v1/entries/${first.entryId}`, {
    method: "POST",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      version: 1,
      requestId: randomUUID(),
      entry: {
        divisionId: f.a,
        name: "Amended event lineup",
        coreKnown: true,
        corePlayerIds: players.slice(0, 5),
        members: players.slice(0, 4).map((playerId) => ({
          playerId,
          role: "core",
          position: "",
          participation: "declared",
        })),
        newPlayers: [],
        teamId: first.saved.teamId,
      },
    }),
  });
  assert.equal(amended.status, 200);
  data = await (await request(f.eventId, cookie)).json();
  assert.equal(
    data.games.find((g: any) => g.id === games[0]).lineupReferences[0]
      .eventLineupVersion,
    1,
  );
  assert.deepEqual((await readGame()).results, evidence.results);
});

test("a failed audit rolls the schedule revision back and the unchanged request can be retried", async () => {
  const f = await fixture(),
    cookie = await login(),
    name = "wcp018_" + randomUUID().replaceAll("-", "");
  const command = {
    requestId: randomUUID(),
    expectedVersion: 0,
    reason: "Atomic schedule revision",
    action: "session",
    session: {
      id: f.d1,
      divisionId: f.a,
      number: 1,
      localStart: "2026-11-01T04:00",
      utcOffset: "-07:00",
      durationMinutes: 60,
    },
  };
  await pool.query(
    `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id='${f.eventId}' AND NEW.action='schedule.session' THEN RAISE EXCEPTION 'WCP018 intentional audit failure'; END IF; RETURN NEW; END $$`,
  );
  await pool.query(
    `CREATE TRIGGER ${name} BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION ${name}()`,
  );
  try {
    assert.equal((await request(f.eventId, cookie, command)).status, 503);
    const unchanged = await (await request(f.eventId, cookie)).json();
    assert.equal(unchanged.version, 0);
    assert.equal(unchanged.history.length, 0);
    assert.equal(
      unchanged.draws.find((d: any) => d.id === f.d1).startsAt,
      "2026-11-01T07:30:00.000Z",
    );
  } finally {
    await pool.query(`DROP TRIGGER ${name} ON audit_record`);
    await pool.query(`DROP FUNCTION ${name}()`);
  }
  assert.equal((await request(f.eventId, cookie, command)).status, 200);
  const saved = await (await request(f.eventId, cookie)).json();
  assert.equal(saved.version, 1);
  assert.equal(
    saved.draws.find((d: any) => d.id === f.d1).startsAt,
    "2026-11-01T11:00:00.000Z",
  );
});
