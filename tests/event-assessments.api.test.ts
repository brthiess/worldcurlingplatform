import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { assessmentFixture } from "./event-assessments-fixture";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 }),
  base = process.env.BETTER_AUTH_URL!,
  sessions = new Map<string, string>();
after(() => db.end());
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
  const c = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  sessions.set(role, c);
  return c;
}
const request = (cookie: string, path: string, body?: unknown) =>
  fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
test("complete real event queues immutable duplicate-safe assessment and worker returns independent F2 awards", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send);
  const workspace = async () => {
    const r = await send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    );
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  };
  const reviewed = await workspace(),
    cmd = {
      action: "calculate",
      divisionId: f.divisionId,
      version: 0,
      requestId: randomUUID(),
      sourceDigest: reviewed.review.sourceDigest,
      evidence: f.evidence,
    };
  const submitted = await send("/api/v1/event-assessments", cmd);
  assert.equal(submitted.status, 200, await submitted.clone().text());
  const first = await submitted.json();
  const deliveries = await Promise.all(
    Array.from({ length: 3 }, () => send("/api/v1/event-assessments", cmd)),
  );
  for (const r of deliveries) {
    assert.equal(r.status, 200);
    assert.equal((await r.json()).id, first.id);
  }
  assert.equal(
    (
      await send("/api/v1/event-assessments", {
        ...cmd,
        evidence: { ...f.evidence, reviewNote: "conflicting retry" },
      })
    ).status,
    409,
  );
  const deadline = Date.now() + 20000;
  let done: any;
  while (Date.now() < deadline) {
    done = (await workspace()).selected;
    if (["completed", "blocked"].includes(done.state)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(done.state, "completed", done.resultContents);
  const result = JSON.parse(done.resultContents).result;
  assert.equal(result.sfm, "18/5");
  assert.deepEqual(
    f.entries.map(
      (entryId) => result.awards.find((a: any) => a.entryId === entryId).points,
    ),
    ["27", "99/5", "261/20", "261/20", "27/20", "27/20", "27/20", "27/20"],
  );
  assert.equal(done.inputDigest, first.digest);
  assert.equal(
    createHash("sha256").update(first.contents).digest("hex"),
    first.digest,
  );
  assert.equal(
    createHash("sha256").update(done.resultContents).digest("hex"),
    done.resultDigest,
  );
});
