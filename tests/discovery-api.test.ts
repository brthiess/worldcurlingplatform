import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { authRequest } from "./auth-request";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
test("calendar filters public editions by overlapping date and same division, with evidence-based status", async () => {
  const response = await fetch(
    base +
      "/api/v1/public/calendar?division=prairie-men&from=2026-11-10&to=2026-11-10&status=live",
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(
    data.events.map((e: { id: string }) => e.id),
    ["prairie-2026"],
  );
  assert.equal(data.events[0].status, "live");
  assert.equal(
    (
      await (
        await fetch(
          base +
            "/api/v1/public/calendar?division=prairie-men&discipline=women_four",
        )
      ).json()
    ).events.length,
    0,
  );
  assert.equal(
    (
      await (
        await fetch(
          base + "/api/v1/public/calendar?from=2026-11-12&to=2026-11-01",
        )
      ).json()
    ).events.length,
    0,
  );
  assert.doesNotMatch(
    JSON.stringify(data),
    /password|email|claim|account|storage|reviewer/i,
  );
});
test("confirmed history stays with its frozen core after an authorized current entry core change", async () => {
  const login = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "organizer@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const post = (path: string, body: unknown) =>
    fetch(base + path, {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const id = randomUUID(),
    game = randomUUID(),
    live = randomUUID(),
    future = randomUUID(),
    unknown = randomUUID(),
    players = Array.from({ length: 5 }, () => randomUUID());
  const entry = {
    divisionId: "prairie-men",
    name: "History original core",
    coreKnown: true,
    corePlayerIds: players.slice(0, 4),
    members: players
      .slice(0, 4)
      .map((playerId) => ({
        playerId,
        role: "core",
        position: "",
        participation: "declared",
      })),
    newPlayers: players
      .slice(0, 4)
      .map((id, i) => ({
        id,
        name: `History fixture player ${i + 1}`,
        provisional: false,
      })),
  };
  const firstResponse = await post("/api/v1/entries", {
    id,
    requestId: randomUUID(),
    version: 0,
    entry,
  });
  assert.equal(firstResponse.status, 201);
  const first = await firstResponse.json();
  await pool.query(
    "INSERT INTO game(id,division_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,'prairie-men','H','History retention','scheduled',$2,'entry-1','Core','North'),($3,'prairie-men','J','Upcoming core','scheduled',$2,'entry-2','Core','Granite'),($4,'prairie-men','K','Legacy unknown core','confirmed',$2,'entry-2','Core','Granite'),($5,'prairie-men','L','Started retained core','scheduled','entry-1',$2,'North','Core')",
    [game, id, future, unknown, live],
  );
  let r = await post(`/api/v1/games/${game}/scoring`, {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "start",
    hammer: null,
  });
  assert.equal(r.status, 200);
  r = await post(`/api/v1/games/${game}/scoring`, {
    requestId: randomUUID(),
    expectedVersion: 1,
    action: "end",
    endNumber: 1,
    end: { state: "played", a: 2, b: 0 },
    hammer: null,
  });
  assert.equal(r.status, 200);
  r = await post(`/api/v1/games/${game}/scoring`, {
    requestId: randomUUID(),
    expectedVersion: 2,
    action: "confirm",
    outcome: "conceded",
    winnerEntryId: id,
    reason: "Fictional history fixture concession",
    hammer: null,
  });
  assert.equal(r.status, 200);
  r = await post(`/api/v1/games/${live}/scoring`, {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "start",
    hammer: null,
  });
  assert.equal(r.status, 200);
  r = await post(`/api/v1/games/${live}/scoring`, {
    requestId: randomUUID(),
    expectedVersion: 1,
    action: "end",
    endNumber: 1,
    end: { state: "unknown", a: null, b: null },
    hammer: null,
  });
  assert.equal(r.status, 200);
  const next = {
    ...entry,
    name: "History replacement core",
    corePlayerIds: players.slice(1),
    members: players
      .slice(1)
      .map((playerId) => ({
        playerId,
        role: "core",
        position: "",
        participation: "declared",
      })),
    newPlayers: [
      { id: players[4], name: "History fixture player 5", provisional: false },
    ],
  };
  r = await post(`/api/v1/entries/${id}`, {
    requestId: randomUUID(),
    version: 1,
    entry: next,
  });
  assert.equal(r.status, 200);
  const revised = await r.json();
  assert.notEqual(revised.teamId, first.teamId);
  const oldActivity = await (
    await fetch(base + `/api/v1/public/activity?kind=team&id=${first.teamId}`)
  ).json();
  const newActivity = await (
    await fetch(base + `/api/v1/public/activity?kind=team&id=${revised.teamId}`)
  ).json();
  assert.deepEqual(
    oldActivity.games.map((g: { id: string }) => g.id).sort(),
    [game, live].sort(),
  );
  assert.equal(
    oldActivity.games.find((g: { id: string }) => g.id === game).nameA,
    "History original core",
  );
  assert.deepEqual(
    newActivity.games.map((g: { id: string }) => g.id),
    [future],
  );
  const score = await (
    await fetch(base + `/api/v1/public/games/${game}`)
  ).json();
  assert.equal(score.games[0].teamA, first.teamId);
  assert.equal(score.games[0].nameA, "History original core");
  const liveScore = await (
    await fetch(base + `/api/v1/public/games/${live}`)
  ).json();
  assert.equal(liveScore.games[0].teamB, first.teamId);
  assert.equal(liveScore.games[0].nameB, "History original core");
  assert.equal(liveScore.games[0].totalA, null);
  assert.equal(liveScore.games[0].totalB, null);
  const legacy = await (
    await fetch(base + `/api/v1/public/games/${unknown}`)
  ).json();
  assert.equal(legacy.games[0].teamA, null);
});
test("public current names and season history keep exact cores; private entry labels and games stay private", async () => {
  const suffix = randomUUID(),
    team = `discovery-core-${suffix}`,
    other = `discovery-other-${suffix}`,
    player = `discovery-player-${suffix}`;
  await pool.query(
    "INSERT INTO player(id,name,origin) VALUES($1,'Discovery core player','fictional_demo')",
    [player],
  );
  await pool.query(
    "INSERT INTO team(id,discipline,core_key) VALUES($1,'men_four',$1),($2,'men_four',$2)",
    [team, other],
  );
  await pool.query(
    "INSERT INTO team_core_member(team_id,player_id) VALUES($1,$2)",
    [team, player],
  );
  for (const [season, name] of [
    ["2025-26", "Archived season name"],
    ["2026-27", "Current season name"],
  ]) {
    const registration = `${team}-${season}`;
    await pool.query(
      "INSERT INTO season_registration(id,team_id,season,version) VALUES($1,$2,$3,1)",
      [registration, team, season],
    );
    await pool.query(
      "INSERT INTO season_roster_version(registration_id,version,display_name,actor_id) VALUES($1,1,$2,'demo-administrator')",
      [registration, name],
    );
  }
  const privateEntry = `discovery-private-${suffix}`;
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name,team_id) VALUES($1,'other-men','Private entry label',$2)",
    [privateEntry, team],
  );
  const publicEntry = `discovery-public-${suffix}`;
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name,team_id) VALUES($1,'prairie-men','Public entry name',$2)",
    [publicEntry, team],
  );
  await pool.query(
    "INSERT INTO game(id,division_id,sheet,phase,state,entry_a,slot_a,slot_b,total_a,total_b) VALUES($1,'prairie-men','C','Test unknown','live',$2,'Public entry name','Known opponent',0,0)",
    [`discovery-game-${suffix}`, publicEntry],
  );
  await pool.query(
    "INSERT INTO game_end_score(game_id,side,end_number,state,points) VALUES($1,'a',1,'unknown',null)",
    [`discovery-game-${suffix}`],
  );
  const current = await (
    await fetch(base + `/api/v1/public/teams/${team}`)
  ).json();
  assert.equal(current.name, "Current season name");
  assert.deepEqual(
    current.registrations.map((r: { name: string }) => r.name),
    ["Current season name", "Archived season name"],
  );
  assert.deepEqual(
    current.entries.map((e: { id: string }) => e.id),
    [publicEntry],
  );
  const activity = await (
    await fetch(base + `/api/v1/public/activity?kind=team&id=${team}`)
  ).json();
  assert.deepEqual(activity.games, []); // No frozen historical core: never credit the current association.
  const unknownScore = await (
    await fetch(base + `/api/v1/public/games/discovery-game-${suffix}`)
  ).json();
  assert.equal(unknownScore.games[0].teamA, null);
  assert.equal(unknownScore.games[0].totalA, null);
  assert.equal(unknownScore.games[0].totalB, null);
  assert.doesNotMatch(
    JSON.stringify({ current, activity }),
    /Private entry label|other-men|other-2026/,
  );
  assert.equal(
    (
      await (
        await fetch(base + `/api/v1/public/activity?kind=team&id=${other}`)
      ).json()
    ).games.length,
    0,
  );
});
test("team activity follows the exact canonical core and known scheduled assignment; player context is declared evidence", async () => {
  const entry = await (
    await fetch(base + "/api/v1/public/entries/main-triple-entry-16")
  ).json();
  const r = await fetch(
    base + "/api/v1/public/activity?kind=team&id=" + entry.teamId,
  );
  assert.equal(r.status, 200);
  const activity = await r.json();
  assert.equal(activity.nextGame.nameA, "Fictional T16");
  assert.equal(activity.nextGame.nameB, "Fictional T05");
  assert.equal(
    activity.games.filter((g: { state: string }) => g.state === "confirmed")
      .length,
    2,
  );
  assert.ok(
    activity.games.every(
      (g: { eventId: string }) => g.eventId === "main-triple-2026",
    ),
  );
  const player = await (
    await fetch(
      base +
        "/api/v1/public/activity?kind=player&id=main-triple-entry-16-player-1",
    )
  ).json();
  assert.equal(player.teams[0].id, entry.teamId);
  assert.equal(player.entries[0].evidence, "Declared event lineup");
  assert.equal(player.games, undefined);
  assert.equal(
    (await fetch(base + "/api/v1/public/activity?kind=team&id=no-such-team"))
      .status,
    404,
  );
  assert.doesNotMatch(
    JSON.stringify({ activity, player }),
    /password|email|claim|account|storage|payment|audit|reviewedBy/i,
  );
});
