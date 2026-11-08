import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createServer } from "node:http";
import {
  manageSource,
  staffNews,
  publicNews,
  fetchSource,
  moderateItem,
} from "../src/modules/news/service";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
after(() => pool.end());
test("approved-only durable feeds deduplicate, hide, suspend and retain audited failed attempts", async () => {
  let fail = false;
  const server = createServer((_q, r) => {
    if (fail) {
      r.writeHead(503);
      r.end();
      return;
    }
    r.end(
      `<rss><channel><item><title>Controlled fixture championship</title><link>https://publisher.example/fixture-${server.address() && typeof server.address() === "object" ? (server.address() as any).port : "x"}</link><pubDate>Sun, 08 Nov 2026 10:00:00 GMT</pubDate><description>Supplied controlled fixture excerpt.</description></item></channel></rss>`,
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.NEWS_FIXTURE_ORIGIN = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const source = await manageSource(pool, "demo-administrator", {
      publisher: "Fixture publisher",
      feedUrl: process.env.NEWS_FIXTURE_ORIGIN + "/feed",
      approved: false,
      reason: "Controlled test approval",
    });
    await assert.rejects(
      () =>
        manageSource(pool, "demo-organizer", {
          id: source.id,
          version: 1,
          approved: true,
          reason: "Not global authority",
        }),
      /administrator/i,
    );
    await fetchSource(pool, source.id, "unapproved-test");
    assert.equal(
      (await publicNews(pool)).items.some((i: any) => i.sourceId === source.id),
      false,
    );
    const approved = await manageSource(pool, "demo-administrator", {
      id: source.id,
      version: 1,
      approved: true,
      reason: "Approved controlled fixture",
    });
    await fetchSource(pool, source.id, "first-fetch");
    await fetchSource(pool, source.id, "retry-fetch");
    const workspace = await staffNews(pool, "demo-administrator");
    const items = workspace.items.filter((i: any) => i.sourceId === source.id);
    assert.equal(items.length, 1);
    assert.equal(items[0].excerpt, "Supplied controlled fixture excerpt.");
    assert.equal(
      (await publicNews(pool)).items.some((i: any) => i.id === items[0].id),
      true,
    );
    await moderateItem(pool, "demo-administrator", {
      id: items[0].id,
      version: 1,
      hidden: true,
      reason: "Unsuitable fixture story",
    });
    assert.equal(
      (await publicNews(pool)).items.some((i: any) => i.id === items[0].id),
      false,
    );
    fail = true;
    await assert.rejects(
      () => fetchSource(pool, source.id, "failed-fetch"),
      /503/,
    );
    const failed = (await staffNews(pool, "demo-administrator")).sources.find(
      (s: any) => s.id === source.id,
    );
    assert.match(failed.lastError, /503/);
    assert.ok(failed.lastSuccessAt);
    await manageSource(pool, "demo-administrator", {
      id: source.id,
      version: approved.version,
      approved: false,
      reason: "Suspend fixture source",
    });
    assert.equal(
      (await publicNews(pool)).sources.some((s: any) => s.id === source.id),
      false,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
