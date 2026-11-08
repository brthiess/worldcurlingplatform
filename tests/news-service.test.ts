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
test("failed source audit rolls back approval and immutable audit rows cannot be rewritten", async () => {
  const publisher = "Rollback fixture " + crypto.randomUUID(),
    feedUrl = "https://publisher.example/rollback-" + crypto.randomUUID();
  await pool.query(
    `CREATE OR REPLACE FUNCTION news_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.details->>'publisher' LIKE 'Rollback fixture %' THEN RAISE EXCEPTION 'controlled audit failure'; END IF; RETURN NEW; END $$`,
  );
  await pool.query(
    "CREATE TRIGGER news_test_audit_failure BEFORE INSERT ON news_audit FOR EACH ROW EXECUTE FUNCTION news_test_audit_failure()",
  );
  try {
    await assert.rejects(
      () =>
        manageSource(pool, "demo-administrator", {
          publisher,
          feedUrl,
          approved: true,
          reason: "Audit must be atomic with approval",
        }),
      /controlled audit failure/,
    );
    assert.equal(
      (await staffNews(pool, "demo-administrator")).sources.some(
        (s) => s.feedUrl === feedUrl,
      ),
      false,
    );
  } finally {
    await pool.query("DROP TRIGGER news_test_audit_failure ON news_audit");
    await pool.query("DROP FUNCTION news_test_audit_failure()");
  }
  const source = await manageSource(pool, "demo-administrator", {
    publisher,
    feedUrl,
    approved: true,
    reason: "Retry after restored audit persistence",
  });
  await assert.rejects(
    () =>
      pool.query(
        "UPDATE news_audit SET reason='tampered audit' WHERE resource_id=$1",
        [source.id],
      ),
    /immutable/i,
  );
  const changes = await Promise.allSettled([
    manageSource(pool, "demo-administrator", {
      id: source.id,
      version: 1,
      approved: false,
      reason: "First concurrent source change",
    }),
    manageSource(pool, "demo-administrator", {
      id: source.id,
      version: 1,
      approved: false,
      reason: "Second concurrent source change",
    }),
  ]);
  assert.equal(changes.filter((c) => c.status === "fulfilled").length, 1);
  assert.equal(changes.filter((c) => c.status === "rejected").length, 1);
});

test("fetched RSS drops impossible RFC calendar dates and persists valid offset leap-day instants", async () => {
  const key = crypto.randomUUID();
  const server = createServer((_request, response) => {
    const dates = [
      "Tue, 31 Feb 2026 10:00:00 GMT",
      "31 Apr 2026 10:00:00 +0200",
      "Thu, 29 Feb 2025 23:00:00 -0500",
      "Thu, 29 Feb 2024 23:30:00 -0500",
      "Fri, 01 Mar 2024 00:30:00 +1400",
    ];
    response.end(
      `<rss><channel>${dates.map((date, index) => `<item><title>Controlled calendar fixture ${index}</title><link>https://publisher.example/calendar-${key}-${index}</link><pubDate>${date}</pubDate><description>Supplied calendar fixture excerpt.</description></item>`).join("")}</channel></rss>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.NEWS_FIXTURE_ORIGIN = `http://127.0.0.1:${(server.address() as any).port}`;
  const source = await manageSource(pool, "demo-administrator", {
    publisher: "Controlled calendar fixture",
    feedUrl: process.env.NEWS_FIXTURE_ORIGIN + "/" + key,
    approved: true,
    reason: "Verify supplied RFC calendar dates through real persistence",
  });
  try {
    await fetchSource(pool, source.id, "calendar-" + key);
    const items = (await publicNews(pool)).items.filter(
      (item) => item.sourceId === source.id,
    );
    assert.deepEqual(
      items.map((item) => ({
        title: item.title,
        publishedAt: new Date(item.publishedAt).toISOString(),
      })),
      [
        {
          title: "Controlled calendar fixture 3",
          publishedAt: "2024-03-01T04:30:00.000Z",
        },
        {
          title: "Controlled calendar fixture 4",
          publishedAt: "2024-02-29T10:30:00.000Z",
        },
      ],
    );
  } finally {
    await manageSource(pool, "demo-administrator", {
      id: source.id,
      version: 1,
      approved: false,
      reason: "Controlled calendar acceptance finished",
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
