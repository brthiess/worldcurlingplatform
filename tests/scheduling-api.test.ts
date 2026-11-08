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
