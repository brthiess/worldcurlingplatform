import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
const base = process.env.BETTER_AUTH_URL!;
test("concurrent entry amendment and scheduling follow event-first locking and both retain their atomic versions", async () => {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
  });
  const signIn = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "organizer@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(signIn.status, 200);
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const request = (path: string, body?: unknown) =>
    fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  const id = randomUUID(),
    entry = {
      divisionId: "prairie-men",
      name: "Concurrent entry before",
      coreKnown: false,
      corePlayerIds: [],
      members: [],
      newPlayers: [],
    };
  assert.equal(
    (
      await request("/api/v1/entries", {
        id,
        requestId: randomUUID(),
        version: 0,
        entry,
      })
    ).status,
    201,
  );
  const schedule = await (
    await request("/api/v1/events/prairie-2026/schedule")
  ).json();
  const amendment = {
    requestId: randomUUID(),
    version: 1,
    entry: { ...entry, name: "Concurrent entry after" },
  };
  const scheduling = {
    requestId: randomUUID(),
    expectedVersion: schedule.version,
    reason: "Concurrent edition lock regression",
    action: "session",
    session: {
      id: randomUUID(),
      divisionId: "prairie-men",
      number:
        Math.max(
          ...schedule.draws
            .filter(
              (d: { divisionId: string }) => d.divisionId === "prairie-men",
            )
            .map((d: { number: number }) => d.number),
        ) + 1,
      localStart: "2026-11-10T20:15",
      utcOffset: "-06:00",
      durationMinutes: 120,
    },
  };
  const barrier = await pool.connect();
  let amendmentResult: Promise<Response> | undefined,
    scheduleResult: Promise<Response> | undefined;
  async function blockedBy(pid: number) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const waiting = await pool.query(
        "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid)) ORDER BY query_start",
        [pid],
      );
      if (waiting.rowCount) return waiting.rows[0].pid as number;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("Expected database lock barrier was not reached.");
  }
  try {
    await barrier.query("BEGIN");
    const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    await barrier.query(
      "SELECT id FROM division WHERE id='prairie-men' FOR UPDATE",
    );
    amendmentResult = request(`/api/v1/entries/${id}`, amendment);
    const mutationPid = await blockedBy(pid);
    scheduleResult = request(
      "/api/v1/events/prairie-2026/schedule",
      scheduling,
    );
    await blockedBy(mutationPid);
    await barrier.query("ROLLBACK");
    const results = await Promise.all([amendmentResult, scheduleResult]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200],
    );
    const savedEntry = await (await request(`/api/v1/entries/${id}`)).json();
    assert.equal(savedEntry.version, 2);
    assert.equal(savedEntry.name, "Concurrent entry after");
    const savedSchedule = await (
      await request("/api/v1/events/prairie-2026/schedule")
    ).json();
    assert.equal(savedSchedule.version, schedule.version + 1);
    assert.equal(
      savedSchedule.draws.some(
        (d: { id: string }) => d.id === scheduling.session.id,
      ),
      true,
    );
    assert.equal(
      (await request(`/api/v1/entries/${id}`, amendment)).status,
      200,
    );
    assert.equal(
      (await request("/api/v1/events/prairie-2026/schedule", scheduling))
        .status,
      200,
    );
  } finally {
    await barrier.query("ROLLBACK");
    barrier.release();
    await Promise.allSettled(
      [amendmentResult, scheduleResult].filter(
        (p): p is Promise<Response> => !!p,
      ),
    );
    await pool.end();
  }
});
