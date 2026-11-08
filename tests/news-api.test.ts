import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { authRequest } from "./auth-request";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
after(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
async function login(role: string) {
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
const call = (path: string, cookie = "", body?: unknown, origin = base) =>
  fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, Origin: origin, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
test("public news omits staff data and global administrators alone manage approvals", async () => {
  assert.equal((await call("/api/v1/news")).status, 401);
  const admin = await login("administrator"),
    organizer = await login("organizer"),
    reviewer = await login("reviewer");
  for (const cookie of [organizer, reviewer])
    assert.equal((await call("/api/v1/news", cookie)).status, 403);
  const source = {
    publisher: "API controlled fixture " + crypto.randomUUID(),
    feedUrl: "https://publisher.example/" + crypto.randomUUID(),
    approved: false,
    reason: "Approved boundary fixture",
  };
  assert.equal(
    (await call("/api/v1/news", organizer, { action: "source", ...source }))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/v1/news",
        admin,
        { action: "source", ...source },
        "https://attacker.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call("/api/v1/news", admin, {
        action: "source",
        ...source,
        feedUrl: "http://169.254.169.254/",
      })
    ).status,
    400,
  );
  const created = await call("/api/v1/news", admin, {
    action: "source",
    ...source,
  });
  assert.equal(created.status, 200);
  const first = await created.json();
  assert.equal(
    (await call("/api/v1/news", admin, { action: "fetch", ...first })).status,
    409,
  );
  assert.equal(
    (
      await call("/api/v1/news", admin, {
        action: "source",
        id: first.id,
        version: 1,
        approved: true,
        reason: "Approve original publisher feed",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/api/v1/news", admin, {
        action: "source",
        id: first.id,
        version: 1,
        approved: false,
        reason: "Stale request cannot suspend",
      })
    ).status,
    409,
  );
  const publicResponse = await call("/api/v1/public/news");
  assert.equal(publicResponse.status, 200);
  const pub = await publicResponse.json();
  assert.ok(pub.sources.some((s: any) => s.id === first.id));
  assert.doesNotMatch(
    JSON.stringify(pub),
    /feedUrl|approvedBy|reason|actor|lastError|jobId/,
  );
  const audits = await pool.query(
    "SELECT action,reason FROM news_audit WHERE resource_id=$1 ORDER BY created_at",
    [first.id],
  );
  assert.deepEqual(
    audits.rows.map((r) => r.action),
    ["source-created", "source-approved"],
  );
  assert.equal(
    (
      await call("/api/v1/news", admin, {
        action: "source",
        id: first.id,
        version: 2,
        approved: false,
        reason: "Controlled API acceptance finished",
      })
    ).status,
    200,
  );
});
test("administrator input must retain a meaningful plain-text reason", async () => {
  const cookie = await login("administrator");
  const r = await call("/api/v1/news", cookie, {
    action: "source",
    publisher: "Reason fixture",
    feedUrl: "https://publisher.example/reason-" + crypto.randomUUID(),
    approved: true,
    reason: "<script>doSomething()</script>",
  });
  assert.equal(r.status, 400);
});
