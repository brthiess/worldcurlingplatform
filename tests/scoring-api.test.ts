import "dotenv/config";
import { authRequest } from "./auth-request";
import { scoringFixtureDraw } from "./scoring-fixture";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
const base = process.env.BETTER_AUTH_URL!;
after(() => pool.end());
async function login(role = "scorekeeper") {
  const r = await authRequest(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${role}@demo.invalid`,
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(r.status, 200);
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
test("real PostgreSQL scoring: start, scores, concurrency, retries, scope, source and atomic audit", async (t) => {
  const id = `wcp002-${randomUUID()}`,
    cookie = await login(),
    reviewer = await login("reviewer");
  const url = `${base}/api/v1/games/${id}/scoring`,
    headers = { cookie, Origin: base, "Content-Type": "application/json" };
  const get = async () => {
    const r = await fetch(url, { headers });
    assert.equal(r.status, 200);
    return r.json();
  };
  const post = (c: object, extra: Record<string, string> = {}, target = url) =>
    fetch(target, {
      method: "POST",
      headers: { ...headers, ...extra },
      body: JSON.stringify(c),
    });
  const command = (version: number, extra: object = {}) => ({
    requestId: randomUUID(),
    expectedVersion: version,
    action: "end",
    endNumber: 1,
    end: { state: "played", a: 2, b: 0 },
    hammer: "b",
    ...extra,
  });
  await scoringFixtureDraw(pool);
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,'scoring-test-draw','T','API test','scheduled','entry-1','entry-3','Team North','Team Prairie')",
    [id],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$2)",
    [id, id],
  );
  try {
    await t.test(
      "start requires explicit command; end and hammer become public with attributable audit",
      async () => {
        let before = await get();
        assert.equal(before.state, "scheduled");
        assert.equal(before.totalA, null);
        assert.equal((await post(command(0))).status, 409);
        const start = {
          requestId: randomUUID(),
          expectedVersion: 0,
          action: "start",
          hammer: "a",
        };
        assert.equal((await post(start)).status, 200);
        before = await get();
        assert.equal(before.state, "live");
        assert.equal(before.version, 1);
        assert.equal(before.hammer, "a");
        assert.equal((await post(command(1))).status, 200);
        const saved = await get();
        assert.deepEqual(saved.ends[0], { state: "played", a: 2, b: 0 });
        assert.equal(saved.totalA, 2);
        assert.equal(saved.totalB, 0);
        assert.equal(saved.history.length, 2);
        assert.equal(saved.history[0].actorId, "demo-scorekeeper");
        assert.equal(saved.history[0].version, 2);
        assert.deepEqual(saved.history[0].before.ends[0], {
          state: "upcoming",
          a: null,
          b: null,
        });
        assert.deepEqual(saved.history[0].after.ends[0], {
          state: "played",
          a: 2,
          b: 0,
        });
        const published = await (
          await fetch(`${base}/api/v1/public/games/${id}`)
        ).json();
        assert.equal(published.games[0].totalA, 2);
        assert.equal(published.games[0].hammer, null);
        assert.equal(published.games[0].hammerEnd, 2);
        assert.equal(published.games[0].endHammer[0], "b");
        assert.doesNotMatch(
          JSON.stringify(published),
          /requestId|actorId|before_state|scoringSource/,
        );
      },
    );
    await t.test(
      "known hammer belongs to its end; correcting a past end preserves current and other-end facts",
      async () => {
        let g = await get();
        assert.equal(
          (
            await post(
              command(g.version, {
                endNumber: 2,
                end: { state: "upcoming", a: null, b: null },
                hammer: "a",
              }),
            )
          ).status,
          200,
        );
        g = await get();
        assert.equal(g.hammer, "a");
        assert.equal(g.hammerEnd, 2);
        assert.equal(
          (await post(command(g.version, { endNumber: 1, hammer: "b" })))
            .status,
          200,
        );
        g = await get();
        assert.deepEqual(g.endHammer.slice(0, 2), ["b", "a"]);
        assert.equal(g.hammer, "a");
        assert.equal(g.hammerEnd, 2);
      },
    );
    await t.test(
      "concurrent duplicate delivery has one version and one audit; key reuse and stale edit fail",
      async () => {
        const before = await get(),
          c = command(before.version, {
            endNumber: 2,
            end: { state: "played", a: 0, b: 3 },
          });
        const pair = await Promise.all([post(c), post(c)]);
        assert.deepEqual(
          pair.map((r) => r.status),
          [200, 200],
        );
        assert.deepEqual(await pair[0].json(), await pair[1].json());
        const saved = await get();
        assert.equal(saved.version, before.version + 1);
        assert.equal(saved.history.length, before.history.length + 1);
        assert.equal(saved.totalA, 2);
        assert.equal(saved.totalB, 3);
        assert.equal(
          (await post({ ...c, end: { state: "played", a: 0, b: 4 } })).status,
          409,
        );
        assert.equal((await post(command(before.version))).status, 409);
        assert.equal((await get()).version, saved.version);
      },
    );
    await t.test(
      "two different edits at one version cannot overwrite one another",
      async () => {
        const before = await get(),
          a = command(before.version, {
            endNumber: 3,
            end: { state: "played", a: 4, b: 0 },
          }),
          b = command(before.version, {
            endNumber: 3,
            end: { state: "played", a: 0, b: 5 },
          });
        const pair = await Promise.all([post(a), post(b)]);
        assert.deepEqual(pair.map((r) => r.status).sort(), [200, 409]);
        const saved = await get();
        assert.equal(saved.version, before.version + 1);
        assert.equal(saved.history.length, before.history.length + 1);
        assert.deepEqual(saved.ends[2], pair[0].status === 200 ? a.end : b.end);
      },
    );
    await t.test(
      "blank, unknown, upcoming and not-played retain distinct meanings and totals",
      async () => {
        for (const [state, points, total] of [
          ["unknown", null, null],
          ["played", 0, 2],
          ["upcoming", null, 2],
          ["unplayed", null, 2],
        ] as const) {
          const before = await get();
          assert.equal(
            (
              await post(
                command(before.version, {
                  endNumber: 3,
                  end: { state, a: points, b: points },
                  hammer: null,
                }),
              )
            ).status,
            200,
          );
          const g = await get();
          assert.deepEqual(g.ends[2], { state, a: points, b: points });
          assert.equal(g.totalA, total);
          assert.equal(g.hammer, null);
        }
      },
    );
    await t.test(
      "malformed and out-of-scope writes, forged sessions and cross-origin commands are denied",
      async () => {
        const before = await get(),
          c = command(before.version);
        for (const invalid of [
          { ...c, end: { state: "played", a: 1, b: 1 } },
          { ...c, end: { state: "played", a: 9, b: 0 } },
          { ...c, hammer: "x" },
          { ...c, expectedVersion: -1 },
          { ...c, endNumber: 21 },
        ])
          assert.equal((await post(invalid)).status, 400);
        assert.equal((await post(c, { cookie: reviewer })).status, 403);
        assert.equal(
          (await post(c, { cookie: "better-auth.session_token=forged" }))
            .status,
          401,
        );
        assert.equal(
          (await post(c, { Origin: "https://untrusted.invalid" })).status,
          403,
        );
        assert.equal(
          (await post(c, {}, `${base}/api/v1/games/other-game/scoring`)).status,
          403,
        );
        assert.equal(
          (await post(c, {}, `${base}/api/v1/games/game-3/scoring`)).status,
          403,
        );
        assert.equal((await get()).version, before.version);
      },
    );
    await t.test(
      "a delayed request rechecks revoked scope after acquiring the game lock",
      async () => {
        const before = await get(),
          lock = await pool.connect();
        await lock.query("BEGIN");
        await lock.query("SELECT id FROM game WHERE id=$1 FOR UPDATE", [id]);
        const delayed = post(command(before.version));
        await new Promise((r) => setTimeout(r, 200));
        await pool.query("DELETE FROM role_grant WHERE id=$1", [id]);
        await lock.query("COMMIT");
        lock.release();
        assert.equal((await delayed).status, 403);
        await pool.query(
          "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$2)",
          [id, id],
        );
        assert.equal((await get()).version, before.version);
      },
    );
    await t.test(
      "source takeover rejects a queued manual command without version or history changes",
      async () => {
        const before = await get(),
          lock = await pool.connect();
        await lock.query("BEGIN");
        await lock.query(
          "UPDATE game SET scoring_source='test-feed' WHERE id=$1",
          [id],
        );
        const delayed = post(command(before.version));
        await new Promise((r) => setTimeout(r, 200));
        await lock.query("COMMIT");
        lock.release();
        assert.equal((await delayed).status, 409);
        assert.equal((await get()).version, before.version);
        await pool.query(
          "UPDATE game SET scoring_source='manual' WHERE id=$1",
          [id],
        );
      },
    );
    await t.test(
      "audit insertion failure rolls back scores, version and receipt; exact retry later succeeds",
      async () => {
        const before = await get(),
          c = command(before.version, {
            requestId: "wcp002-atomic-failure",
            end: { state: "played", a: 7, b: 0 },
          });
        await pool.query(
          "ALTER TABLE audit_record ADD CONSTRAINT wcp002_test_atomic_failure CHECK (request_id IS DISTINCT FROM 'wcp002-atomic-failure') NOT VALID",
        );
        try {
          assert.equal((await post(c)).status, 503);
          const failed = await get();
          assert.equal(failed.version, before.version);
          assert.deepEqual(failed.ends, before.ends);
          assert.deepEqual(failed.endHammer, before.endHammer);
          assert.equal(failed.history.length, before.history.length);
        } finally {
          await pool.query(
            "ALTER TABLE audit_record DROP CONSTRAINT wcp002_test_atomic_failure",
          );
        }
        assert.equal((await post(c)).status, 200);
        const saved = await get();
        assert.equal(saved.version, before.version + 1);
        assert.deepEqual(saved.ends[0], { state: "played", a: 7, b: 0 });
        assert.equal(saved.history[0].requestId, c.requestId);
      },
    );
    await t.test(
      "out-of-order end entry keeps its real end number in public scores",
      async () => {
        let before = await get();
        assert.equal(
          (
            await post(
              command(before.version, {
                endNumber: 10,
                end: { state: "played", a: 0, b: 2 },
                hammer: "a",
              }),
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await post(
              command(before.version, {
                endNumber: 3,
                end: { state: "unknown", a: null, b: null },
                hammer: null,
              }),
            )
          ).status,
          200,
        );
        before = await get();
        assert.equal(
          (
            await post(
              command(before.version, {
                endNumber: 10,
                end: { state: "played", a: 0, b: 2 },
                hammer: "a",
              }),
            )
          ).status,
          200,
        );
        const published = await (
          await fetch(`${base}/api/v1/public/games/${id}`)
        ).json();
        assert.deepEqual(published.games[0].endsB[9], {
          state: "played",
          points: 2,
        });
        assert.deepEqual(published.games[0].endsB[8], {
          state: "unknown",
          points: null,
        });
        assert.equal(published.games[0].endHammer[9], "a");
        assert.equal(published.games[0].totalA, null);
        assert.equal(published.games[0].totalB, null);
        const stored = await get();
        assert.deepEqual(stored.ends[8], {
          state: "unknown",
          a: null,
          b: null,
        });
        assert.equal(
          (
            await post(
              command(stored.version, {
                endNumber: 9,
                end: { state: "upcoming", a: null, b: null },
                hammer: null,
              }),
            )
          ).status,
          409,
        );
      },
    );
  } finally {
    await pool.query("DELETE FROM role_grant WHERE game_id=$1", [id]);
    // Retain immutable lineup evidence and its actual audit/receipt history.
  }
});
