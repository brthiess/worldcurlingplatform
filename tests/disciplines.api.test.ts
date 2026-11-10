import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { emptySportingEvidence } from "../src/domain/disciplines";
import { scoringFixtureDraw } from "./scoring-fixture";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
async function login(role = "organizer") {
  const r = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: role + "@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(r.status, 200);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
test("explicit ten-end four-player profile retains eight-point scoring and untouched old public history", async () => {
  const cookie = await login(),
    id = "four-ten-" + randomUUID();
  await scoringFixtureDraw(pool);
  const old = await (await fetch(base + "/api/v1/public/games/game-1")).json();
  const oldGame = old.games.find((g: { id: string }) => g.id === "game-1");
  assert(!Object.hasOwn(oldGame, "sporting"));
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,'scoring-test-draw','T','Ten end profile','scheduled','entry-1','entry-3','North','Prairie')",
    [id],
  );
  const url = base + "/api/v1/games/" + id + "/scoring",
    headers = { cookie, Origin: base, "Content-Type": "application/json" };
  const get = async () => {
    const r = await fetch(url, { headers });
    assert.equal(r.status, 200);
    return r.json();
  };
  const post = async (action: string, extra = {}) => {
    const g = await get();
    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        requestId: randomUUID(),
        expectedVersion: g.version,
        hammer: null,
        action,
        ...extra,
      }),
    });
  };
  const sporting = {
    ...emptySportingEvidence(),
    regulationEnds: 10,
    stage: "Explicit ten-end synthetic profile",
  };
  assert.equal((await post("evidence", { sporting })).status, 200);
  assert.equal((await get()).ends.length, 10);
  assert.equal((await post("start")).status, 200);
  for (let n = 1; n <= 8; n++)
    assert.equal(
      (
        await post("end", {
          endNumber: n,
          end: { state: "played", a: n === 1 ? 8 : 0, b: 0 },
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await post("confirm", {
        outcome: "normal",
        winnerEntryId: "entry-1",
        reason: "",
      })
    ).status,
    409,
  );
  for (let n = 9; n <= 10; n++)
    assert.equal(
      (
        await post("end", {
          endNumber: n,
          end: { state: "played", a: 0, b: 0 },
        })
      ).status,
      200,
    );
  assert.equal(
    (
      await post("confirm", {
        outcome: "normal",
        winnerEntryId: "entry-1",
        reason: "",
      })
    ).status,
    200,
  );
  const current = await (
    await fetch(base + "/api/v1/public/games/game-1")
  ).json();
  assert.deepEqual(
    current.games.find((g: { id: string }) => g.id === "game-1"),
    oldGame,
  );
  const game = await get();
  assert.equal(game.results[0].result.ends.length, 10);
  assert.equal(game.results[0].result.totalA, 8);
});
test("mixed doubles authorized entry and scoring reaches an immutable confirmed public game", async () => {
  const cookie = await login(),
    id = "md-" + randomUUID(),
    division = id + "-d",
    draw = id + "-draw";
  const request = (path: string, body?: unknown, session = cookie) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        cookie: session,
        Origin: base,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,'prairie-2026','Mixed doubles API','mixed_doubles','manual')",
    [division],
  );
  await pool.query(
    "INSERT INTO draw_session(id,division_id,number,starts_at,state) VALUES($1,$2,999,'2000-01-01T12:00:00Z','scheduled')",
    [draw, division],
  );
  const entries: string[] = [],
    people: string[][] = [];
  for (const side of ["Red", "Yellow"]) {
    const entryId = id + "-" + side,
      players = [randomUUID(), randomUUID()];
    const r = await request("/api/v1/entries", {
      id: entryId,
      version: 0,
      requestId: randomUUID(),
      entry: {
        divisionId: division,
        name: "MD " + side,
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
          name: side + " player " + (i + 1),
          provisional: false,
        })),
        registerSeason: { season: "2026-27", version: 0 },
      },
    });
    assert.equal(r.status, 201, await r.text());
    entries.push(entryId);
    people.push(players);
  }
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,$2,'M','Mixed doubles','scheduled',$3,$4,'Red','Yellow')",
    [id, draw, ...entries],
  );
  const path = "/api/v1/games/" + id + "/scoring";
  const start = {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "start",
    hammer: null,
  };
  const r = await request(path, start);
  assert.equal(r.status, 200, await r.text());
  const get = async () => {
    const r = await request(path);
    assert.equal(r.status, 200);
    return r.json();
  };
  let g = await get();
  assert.equal(g.lineupA.members.length, 2);
  assert(g.lineupA.members.every((p: any) => p.participation === "defaulted"));
  const sporting = emptySportingEvidence();
  sporting.stage = "Synthetic round robin";
  sporting.lsdRequired = true;
  sporting.placements = [
    { decider: "a", choice: "B", powerPlay: true, blankReason: "unknown" },
  ];
  sporting.lsd.a = [
    {
      kind: "measured-edge",
      playerId: people[0][0],
      rotation: "cw",
      value: 10,
      unit: "mm",
      centreCm: null,
      source: "Independent edge fixture",
      reason: "",
    },
    {
      kind: "assigned-maximum",
      playerId: people[0][1],
      rotation: "ccw",
      value: null,
      unit: null,
      centreCm: null,
      source: "Official recorded determination",
      reason: "Outside house",
    },
  ];
  sporting.lsd.b = [
    {
      kind: "measured-centre",
      playerId: people[1][0],
      rotation: "cw",
      value: 0,
      unit: "cm",
      centreCm: null,
      source: "Synthetic tee-centre fixture",
      reason: "",
    },
    sporting.lsd.b[1],
  ];
  const evidenceCommand = {
    requestId: randomUUID(),
    expectedVersion: 1,
    action: "evidence",
    hammer: null,
    sporting,
  };
  let e = await request(path, evidenceCommand);
  assert.equal(e.status, 200, await e.text());
  g = await get();
  assert.equal(g.sporting.lsd.a[0].centreCm, 15.2);
  assert.equal(g.sporting.lsd.a[1].centreCm, 199.6);
  assert.equal(g.sporting.lsd.b[0].centreCm, 0);
  assert.equal(g.sporting.lsd.b[1].centreCm, null);
  assert.equal(g.sporting.participation.a.kind, "unknown");
  assert.equal(g.hammer, null);
  assert.equal(g.endHammer[0], null);
  assert.equal(g.sporting.placements[0].decider, "a");
  assert.equal(
    (
      await request(path, {
        requestId: randomUUID(),
        expectedVersion: 2,
        action: "evidence",
        hammer: null,
        sporting: { ...sporting, regulationEnds: 10 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(path, {
        requestId: randomUUID(),
        expectedVersion: 2,
        action: "evidence",
        hammer: null,
        sporting: {
          ...sporting,
          placements: [sporting.placements[0], sporting.placements[0]],
        },
      })
    ).status,
    400,
  );
  const receipt = await (
    await request(path + "?requestId=" + evidenceCommand.requestId)
  ).json();
  assert.deepEqual(receipt.command, evidenceCommand);
  assert.equal(receipt.actorId, "demo-organizer");
  assert.equal(receipt.path, path);
  assert.equal(receipt.response.version, 2);
  assert(receipt.auditId);
  assert.equal(
    (await request(path, { ...evidenceCommand, extra: "changed entire body" }))
      .status,
    409,
  );
  assert.equal((await request(path, evidenceCommand)).status, 200);
  assert.equal((await get()).version, 2);
  assert.equal(
    (await request(path, { ...evidenceCommand, requestId: randomUUID() }))
      .status,
    409,
  );
  const reviewer = await login("reviewer");
  assert.equal((await request(path, undefined, reviewer)).status, 403);
  assert.equal((await request(path, evidenceCommand, reviewer)).status, 403);
  assert.equal(
    (
      await request(path, {
        requestId: randomUUID(),
        expectedVersion: 2,
        action: "lineup",
        hammer: null,
        side: "a",
        members: [...people[0], people[1][0]].map((playerId) => ({
          playerId,
          position: "",
        })),
      })
    ).status,
    400,
  );
  const entryBefore = await (
    await request("/api/v1/entries/" + entries[0])
  ).json();
  assert.equal(
    (
      await request(path, {
        requestId: randomUUID(),
        expectedVersion: 2,
        action: "lineup",
        hammer: null,
        side: "a",
        members: people[0].map((playerId, i) => ({
          playerId,
          position: i === 0 ? "First and fifth" : "Second, third and fourth",
        })),
      })
    ).status,
    200,
  );
  const entryAfter = await (
    await request("/api/v1/entries/" + entries[0])
  ).json();
  assert.deepEqual(entryAfter, entryBefore);
  const saveEnd = async (n: number, a: number, b: number) => {
    const current = await get();
    return request(path, {
      requestId: randomUUID(),
      expectedVersion: current.version,
      action: "end",
      hammer: null,
      endNumber: n,
      end: { state: "played", a, b },
    });
  };
  assert.equal((await saveEnd(1, 7, 0)).status, 400);
  assert.equal((await saveEnd(1, 6, 0)).status, 200);
  for (let n = 2; n <= 8; n++)
    assert.equal((await saveEnd(n, 0, 0)).status, 200);
  assert.equal((await saveEnd(9, 0, 0)).status, 409);
  g = await get();
  const confirm = {
    requestId: randomUUID(),
    expectedVersion: g.version,
    action: "confirm",
    hammer: null,
    outcome: "normal",
    winnerEntryId: entries[0],
    reason: "",
  };
  assert.equal((await request(path, confirm)).status, 200);
  const confirmed = await get();
  assert.equal(confirmed.results[0].result.sporting.lsd.a[0].centreCm, 15.2);
  assert.equal(confirmed.results[0].result.lineupA.members.length, 2);
  assert.equal(
    (
      await request(path, {
        ...evidenceCommand,
        requestId: randomUUID(),
        expectedVersion: confirmed.version,
      })
    ).status,
    409,
  );
  sporting.lsd.a[0] = { ...sporting.lsd.a[0], value: 20 };
  sporting.participation.a = {
    kind: "observed",
    playerIds: people[0],
    source: "Synthetic scorekeeper observed both players",
  };
  const correction = {
    requestId: randomUUID(),
    expectedVersion: confirmed.version,
    action: "correct",
    hammer: null,
    outcome: "normal",
    winnerEntryId: entries[0],
    reason: "Correct measured edge transcription",
    ends: confirmed.ends,
    sporting,
  };
  // A real database failure must roll back evidence, result, audit, version and receipt.
  await pool.query(
    `CREATE FUNCTION wcp026_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id='${id}' THEN RAISE EXCEPTION 'WCP026 injected audit failure'; END IF; RETURN NEW; END $$`,
  );
  await pool.query(
    "CREATE TRIGGER wcp026_reject_audit BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION wcp026_reject_audit()",
  );
  try {
    assert.equal((await request(path, correction)).status, 503);
    assert.equal((await get()).version, confirmed.version);
    assert.equal(
      await (await request(path + "?requestId=" + correction.requestId)).json(),
      null,
    );
  } finally {
    await pool.query("DROP TRIGGER wcp026_reject_audit ON audit_record");
    await pool.query("DROP FUNCTION wcp026_reject_audit()");
  }
  assert.equal((await request(path, correction)).status, 200);
  const corrected = await get();
  assert.equal(corrected.results.length, 2);
  assert.equal(corrected.results[0].result.sporting.lsd.a[0].centreCm, 16.2);
  assert.equal(corrected.results[1].result.sporting.lsd.a[0].centreCm, 15.2);
  assert.deepEqual(corrected.lineupA, confirmed.lineupA);
  assert.equal(corrected.sporting.participation.a.kind, "observed");
  assert.equal(
    corrected.results[1].result.sporting.participation.a.kind,
    "unknown",
  );
  assert.equal((await request(path, correction)).status, 200);
  assert.equal((await get()).version, corrected.version);
  const published = await (await request("/api/v1/public/games/" + id)).json();
  assert.equal(published.games[0].sporting.lsd.a[0].centreCm, 16.2);
  assert.equal(
    published.games[0].results[1].result.sporting.lsd.a[0].centreCm,
    15.2,
  );
  assert.doesNotMatch(
    JSON.stringify(published),
    /actorId|requestId|auditId|scoringSource/,
  );
  const rows = (
    await pool.query(
      "SELECT version,evidence,audit_id FROM game_sporting_version WHERE game_id=$1 ORDER BY version",
      [id],
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[1].evidence.lsd.a[0].centreCm, 16.2);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM audit_record WHERE resource_id=$1",
        [id],
      )
    ).rows[0].n,
    corrected.version,
  );
  await assert.rejects(
    pool.query(
      "UPDATE game_sporting_version SET evidence=evidence WHERE game_id=$1",
      [id],
    ),
    /immutable/,
  );
  const forfeitId = id + "-forfeit";
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,$2,'F','Mixed doubles forfeit','scheduled',$3,$4,'Red','Yellow')",
    [forfeitId, draw, ...entries],
  );
  const forfeited = await request("/api/v1/games/" + forfeitId + "/scoring", {
    requestId: randomUUID(),
    expectedVersion: 0,
    action: "confirm",
    hammer: null,
    outcome: "forfeit",
    winnerEntryId: entries[1],
    reason: "One player unavailable; recorded official forfeit",
  });
  assert.equal(forfeited.status, 200, await forfeited.text());
  const f = await (
    await request("/api/v1/games/" + forfeitId + "/scoring")
  ).json();
  assert.equal(f.totalA, null);
  assert.equal(f.totalB, null);
  assert.equal(f.results[0].result.winnerEntryId, entries[1]);
  assert(f.ends.every((e: any) => e.a === null && e.b === null));
});
