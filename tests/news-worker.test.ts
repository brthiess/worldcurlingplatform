import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createServer } from "node:http";
import { startWorker } from "../src/worker/runtime";
import {
  manageSource,
  staffNews,
  publicNews,
} from "../src/modules/news/service";
import { authRequest } from "./auth-request";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
after(() => pool.end());
test("real pg-boss retries a failing approved HTTP fixture then persists exactly once", async () => {
  assert.ok(
    process.env.NEWS_FIXTURE_ORIGIN,
    "Configure a unique NEWS_FIXTURE_ORIGIN for the loopback app and its tests.",
  );
  const fixtureOrigin = new URL(process.env.NEWS_FIXTURE_ORIGIN).origin;
  let requests = 0;
  const feedPath = "/" + crypto.randomUUID();
  const story = "https://publisher.example/job-" + crypto.randomUUID();
  const server = createServer((q, r) => {
    if (q.url !== feedPath) {
      r.writeHead(404);
      r.end();
      return;
    }
    requests++;
    if (requests === 1) {
      r.writeHead(503);
      r.end();
      return;
    }
    r.setHeader("Content-Type", "application/rss+xml");
    r.end(
      `<rss><channel><item><title>Controlled worker fixture</title><link>${story}</link><pubDate>Sun, 08 Nov 2026 10:00:00 GMT</pubDate><description>Worker fixture supplied excerpt.</description></item><item><title>Duplicate</title><link>${story}</link><pubDate>Sun, 08 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`,
    );
  });
  await new Promise<void>((r) =>
    server.listen(Number(new URL(fixtureOrigin).port), "127.0.0.1", r),
  );
  const boss = await startWorker(pool);
  try {
    const source = await manageSource(pool, "demo-administrator", {
      publisher: "Controlled retry fixture",
      feedUrl: fixtureOrigin + feedPath,
      approved: true,
      reason: "Approved local controlled retry fixture",
    });
    const base = process.env.BETTER_AUTH_URL!;
    const sign = await authRequest(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "administrator@demo.invalid",
        password: process.env.DEMO_PASSWORD,
      }),
    });
    assert.equal(sign.status, 200);
    const cookie = sign.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const response = await fetch(base + "/api/v1/news", {
      method: "POST",
      headers: { Origin: base, cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetch", ...source }),
    });
    assert.equal(response.status, 200);
    const { jobId } = await response.json();
    const deadline = Date.now() + 35000;
    let workspace;
    while (Date.now() < deadline) {
      workspace = await staffNews(pool, "demo-administrator");
      if (workspace.items.some((i) => i.url === story)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.equal(workspace!.items.filter((i) => i.url === story).length, 1);
    assert.equal(requests, 2);
    const attempts = workspace!.attempts.filter((a) => a.jobId === jobId);
    assert.deepEqual(attempts.map((a) => a.state).sort(), [
      "failed",
      "succeeded",
    ]);
    assert.match(attempts.find((a) => a.state === "failed")!.error, /503/);
    assert.equal(
      (await publicNews(pool)).items.filter((i) => i.url === story).length,
      1,
    );
    await manageSource(pool, "demo-administrator", {
      id: source.id,
      version: 1,
      approved: false,
      reason: "Controlled retry acceptance finished",
    });
  } finally {
    await boss.stop({ graceful: true, timeout: 5000 });
    await new Promise<void>((r) => server.close(() => r()));
  }
});
