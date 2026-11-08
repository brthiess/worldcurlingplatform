import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFeed,
  articleUrl,
  safeText,
  isPublicAddress,
} from "../src/domain/news";
test("RSS supplied summaries are plain text, bounded and canonical original links deduplicate", () => {
  const feed = `<rss><channel><item><title><![CDATA[<b>Final</b> &amp; scores]]></title><link>https://publisher.example/story?utm_source=feed#top</link><pubDate>Sun, 08 Nov 2026 10:00:00 GMT</pubDate><description><![CDATA[<script>bad()</script><p>Supplied summary.</p>]]></description></item><item><title>Duplicate</title><link>https://publisher.example/story</link><pubDate>2026-11-08T10:00:00Z</pubDate></item></channel></rss>`;
  assert.deepEqual(
    normalizeFeed(feed, "Approved Publisher", new Date("2026-11-08T12:00:00Z")),
    [
      {
        title: "Final & scores",
        publisher: "Approved Publisher",
        url: "https://publisher.example/story",
        publishedAt: "2026-11-08T10:00:00.000Z",
        excerpt: "Supplied summary.",
      },
    ],
  );
});
test("Atom keeps supplied summary only and drops unsafe, missing and future values", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Round one</title><link rel="alternate" href="https://publisher.example/atom"/><published>2026-11-07T10:00:00Z</published><summary type="html">&lt;p&gt;Summary&lt;/p&gt;</summary><content>Full article must never be copied</content></entry><entry><title>Bad</title><link href="javascript:alert(1)"/><updated>2026-11-07T10:00:00Z</updated></entry><entry><title>Future</title><link href="https://publisher.example/future"/><updated>2030-01-01T00:00:00Z</updated></entry><entry><title>Missing date</title><link href="https://publisher.example/missing"/></entry></feed>`;
  assert.deepEqual(normalizeFeed(xml, "Publisher", new Date("2026-11-08")), [
    {
      title: "Round one",
      publisher: "Publisher",
      url: "https://publisher.example/atom",
      publishedAt: "2026-11-07T10:00:00.000Z",
      excerpt: "Summary",
    },
  ]);
  for (const url of [
    "javascript:alert(1)",
    "http://example.com/a",
    "https://a:b@example.com",
    "https://127.0.0.1/a",
    "https://[::1]/",
    "https://169.254.169.254/",
    "https://10.2.3.4/",
  ])
    assert.throws(() => articleUrl(url));
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.1",
    "192.168.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "169.254.1.1",
  ])
    assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(safeText("<p>" + "x".repeat(400) + "</p>").length, 280);
  assert.throws(() =>
    normalizeFeed(
      '<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
      "P",
    ),
  );
  assert.throws(() => normalizeFeed("<html>Oops</html>", "P"));
  assert.throws(() => normalizeFeed("<rss><channel>", "P"));
});
test("reserved fetch addresses and impossible calendar dates are rejected", () => {
  for (const address of [
    "192.0.2.1",
    "198.51.100.2",
    "203.0.113.5",
    "192.88.99.1",
    "2001:2::1",
    "2001:db8::1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  const xml =
    "<rss><channel><item><title>Bad date</title><link>https://publisher.example/bad-date</link><pubDate>2026-02-30T10:00:00Z</pubDate></item></channel></rss>";
  assert.deepEqual(normalizeFeed(xml, "P", new Date("2026-11-08")), []);
});
