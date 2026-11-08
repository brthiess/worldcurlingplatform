import "dotenv/config";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { startWorker } from "../../src/worker/runtime";
import { manageSource } from "../../src/modules/news/service";
import { signInWithRateWindow } from "./auth-fixture";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
test.afterAll(() => pool.end());
test("controlled feed cards, real queued fetch, failure, moderation and external destination work at three widths", async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  expect(
    process.env.NEWS_FIXTURE_ORIGIN,
    "Configure a unique NEWS_FIXTURE_ORIGIN for the loopback app and its tests.",
  ).toBeTruthy();
  const fixtureOrigin = new URL(process.env.NEWS_FIXTURE_ORIGIN!).origin;
  const key = crypto.randomUUID(),
    feedPath = "/browser-" + key,
    publisher = "Controlled browser fixture",
    title = "Controlled feed fixture: championship coverage " + key.slice(0, 6),
    story = "https://publisher.example/controlled-" + key;
  let failing = false;
  const server = createServer((q, r) => {
    if (q.url !== feedPath) {
      r.writeHead(404);
      r.end();
      return;
    }
    if (failing) {
      r.writeHead(503);
      r.end();
      return;
    }
    r.end(
      `<rss><channel><item><title><![CDATA[${title}<script>alert('unsafe')</script>]]></title><link>${story}</link><pubDate>${new Date().toISOString()}</pubDate><description><![CDATA[<p>A supplied excerpt from a controlled feed fixture. This is browser acceptance data, not a real news report.</p><script>window.bad=true</script>]]></description><content:encoded>Full article text must never appear.</content:encoded></item></channel></rss>`,
    );
  });
  await new Promise<void>((r) =>
    server.listen(Number(new URL(fixtureOrigin).port), "127.0.0.1", r),
  );
  const boss = await startWorker(pool);
  const source = await manageSource(pool, "demo-administrator", {
    publisher,
    feedUrl: fixtureOrigin + feedPath,
    approved: true,
    reason: "Controlled local browser feed fixture",
  });
  const errors: string[] = [],
    unexpected: number[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 500) unexpected.push(r.status());
  });
  const publicContext = await browser.newContext(),
    publicPage = await publicContext.newPage();
  publicPage.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/admin");
    await page.getByLabel("Demo persona").selectOption("administrator");
    await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
    await signInWithRateWindow(
      page,
      page.getByRole("button", { name: "Sign in", exact: true }),
    );
    await expect(
      page.getByRole("heading", { name: "Your workspace" }),
    ).toBeVisible();
    await page.goto("/admin/news");
    const card = page.getByRole("article").filter({
      has: page.getByText(fixtureOrigin + feedPath, {
        exact: true,
      }),
    });
    await card.getByRole("button", { name: "Fetch now" }).click();
    await expect(page.getByRole("status")).toContainText("Fetch queued");
    await expect(async () => {
      await page.getByRole("button", { name: "Refresh status" }).click();
      await expect(
        page.getByRole("heading", { name: title + " ↗", exact: true }),
      ).toBeVisible();
    }).toPass({ timeout: 15000 });
    await pool.query(
      "UPDATE news_source SET last_success_at=now()-interval '25 hours' WHERE id=$1",
      [source.id],
    );
    await publicPage.goto(process.env.BETTER_AUTH_URL! + "/news");
    const publicCard = publicPage.getByRole("article").filter({
      has: publicPage.getByRole("heading", { name: title, exact: true }),
    });
    await expect(publicCard).toBeVisible();
    await expect(publicCard).toContainText(
      "A supplied excerpt from a controlled feed fixture.",
    );
    await expect(publicPage.getByRole("status")).toContainText("Some sources");
    await expect(
      publicPage.getByText("Full article text must never appear."),
    ).toHaveCount(0);
    expect(await publicPage.evaluate(() => !!(window as any).bad)).toBe(false);
    await mkdir("docs/verification/assets/WCP-044", { recursive: true });
    for (const [name, width, height] of [
      ["phone", 360, 800],
      ["tablet", 768, 1024],
      ["desktop", 1440, 1000],
    ] as const) {
      await publicPage.setViewportSize({ width, height });
      await publicPage.evaluate(() => scrollTo(0, 0));
      await publicPage
        .getByRole("button", { name: "Refresh news", exact: true })
        .focus();
      await expect(
        publicPage.getByRole("button", { name: "Refresh news", exact: true }),
      ).toBeFocused();
      expect(
        await publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page: publicPage }).analyze()).violations,
      ).toEqual([]);
      await publicPage.screenshot({
        path: `docs/verification/assets/WCP-044/${name}-controlled-public.png`,
      });
      await publicCard.screenshot({
        path: `docs/verification/assets/WCP-044/${name}-controlled-card.png`,
      });
    }
    await publicContext.route("https://publisher.example/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<title>Original publisher fixture</title><h1>Original publisher fixture</h1>",
      }),
    );
    const external = publicCard.getByRole("link", { name: /Read at/ });
    await expect(external).toHaveAttribute("href", story);
    await expect(external).toHaveAttribute("rel", "noopener noreferrer");
    const popupPromise = publicPage.waitForEvent("popup");
    await external.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(story);
    await expect(
      popup.getByRole("heading", { name: "Original publisher fixture" }),
    ).toBeVisible();
    await popup.close();
    await publicPage.route("**/api/v1/public/news", (route) => route.abort(), {
      times: 1,
    });
    await publicPage
      .getByRole("button", { name: "Refresh news", exact: true })
      .click();
    await expect(publicPage.locator("main").getByRole("alert")).toContainText(
      "temporarily unavailable",
    );
    await expect(publicCard).toBeVisible();
    await publicPage.screenshot({
      path: "docs/verification/assets/WCP-044/public-refresh-error.png",
    });
    const item = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: title + " ↗", exact: true }),
    });
    await item
      .getByLabel("Change reason")
      .fill("Unsuitable controlled fixture item");
    await item.getByRole("button", { name: "Hide item" }).click();
    await expect(item.getByText("Hidden from public news")).toBeVisible();
    await publicPage
      .getByRole("button", { name: "Refresh news", exact: true })
      .click();
    await expect(publicCard).toHaveCount(0);
    await item.getByRole("button", { name: "Restore item" }).click();
    await publicPage
      .getByRole("button", { name: "Refresh news", exact: true })
      .click();
    await expect(publicCard).toBeVisible();
    failing = true;
    await new Promise((r) => setTimeout(r, 31000));
    await card.getByRole("button", { name: "Fetch now" }).click();
    await expect(async () => {
      await page.getByRole("button", { name: "Refresh status" }).click();
      await expect(
        card.getByText("Feed returned HTTP 503.", { exact: true }),
      ).toBeVisible();
    }).toPass({ timeout: 15000 });
    for (const [name, width, height] of [
      ["phone", 360, 800],
      ["tablet", 768, 1024],
      ["desktop", 1440, 1000],
    ] as const) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await card.screenshot({
        path: `docs/verification/assets/WCP-044/${name}-controlled-source-failure.png`,
      });
    }
    await card
      .getByLabel("Change reason")
      .fill("Suspend controlled fixture source");
    await card.getByRole("button", { name: "Suspend source" }).click();
    await expect(card.getByText("Suspended", { exact: true })).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Fetch now" }),
    ).toBeDisabled();
    await publicPage
      .getByRole("button", { name: "Refresh news", exact: true })
      .click();
    await expect(publicCard).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
  } finally {
    await publicContext.close();
    await boss.stop({ graceful: true, timeout: 5000 });
    await new Promise<void>((r) => server.close(() => r()));
  }
});
