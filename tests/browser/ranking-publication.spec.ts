import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import {
  overallFixture,
  overallReviewEvidence,
} from "../overall-rankings-fixture";
import { signInWithRateWindow } from "./auth-fixture";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
test.afterAll(() => db.end());
test.setTimeout(180000);
async function ready(page: any) {
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption("administrator");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  const send = async (path: string, body?: unknown) => {
    const r = body
      ? await page.request.post(path, {
          headers: { Origin: process.env.BETTER_AUTH_URL! },
          data: body,
        })
      : await page.request.get(path);
    return { status: r.status(), json: () => r.json(), text: () => r.text() };
  };
  const f = await overallFixture(db, send),
    w = await (
      await page.request.get(
        `/api/v1/overall-rankings?discipline=${f.discipline}&date=2026-11-23&rules=${f.rulesId}`,
      )
    ).json();
  const r = await page.request.post("/api/v1/overall-rankings", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      action: "calculate",
      discipline: f.discipline,
      effectiveDate: "2026-11-23",
      rulesId: f.rulesId,
      version: w.version,
      sourceDigest: w.review.sourceDigest,
      requestId: crypto.randomUUID(),
      evidence: overallReviewEvidence(w.review, f),
    },
  });
  expect(r.status()).toBe(200);
  const draft = await r.json();
  expect(draft.result.state).toBe("ready");
  return { f, draft };
}
async function select(page: any, id: string) {
  await page.goto("/admin/ranking-publications");
  await page.getByLabel("Calculated draft").selectOption(id);
  await expect(
    page.getByRole("heading", { name: "Approve this exact list" }),
  ).toBeVisible();
}
async function fill(page: any) {
  for (const checkbox of await page.getByRole("checkbox").all())
    await checkbox.check();
  await page
    .getByLabel("Private approval rationale")
    .fill(
      "Fictional complete publication, not official World Curling endorsement.",
    );
}
test("staff compare and publish exact contributions, then public selectors, keyboard and responsive accessibility work", async ({
  page,
}, info) => {
  const { f, draft } = await ready(page),
    issues: string[] = [];
  page.on("pageerror", (e) => issues.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") issues.push(m.text());
  });
  page.on("requestfailed", (r) => issues.push(`${r.method()} ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 500) issues.push(`HTTP${r.status()} ${r.url()}`);
  });
  await select(page, draft.id);
  const approve = page.getByRole("button", {
    name: "Approve & publish exact list",
  });
  await expect(approve).toBeDisabled();
  const first = page.getByRole("checkbox").first();
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await fill(page);
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await approve.scrollIntoViewIfNeeded();
    await approve.focus();
    await expect(approve).toBeFocused();
    await page.screenshot({
      path: info.outputPath(`staff-${width}.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Enter");
  const publicLink = page.getByRole("link", {
    name: "Open this exact approved publication",
  });
  await expect(publicLink).toBeVisible();
  const href = await publicLink.getAttribute("href");
  await publicLink.click();
  await expect(
    page.getByRole("heading", { name: "Women’s four-player overall" }),
  ).toBeVisible();
  const article = page.locator(`#subject-${f.seasonIds[0]}`);
  await article
    .getByText(`Points & event contributions for Fictional team 1`, {
      exact: true,
    })
    .click();
  await expect(article).toContainText("102");
  await expect(article).toContainText("75");
  await expect(article).toContainText("27");
  await expect(article).toContainText("Counted");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await article.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`public-${width}.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByLabel("Discipline", { exact: true })
    .selectOption("mixed_doubles");
  await expect(
    page.getByText(/No approved publication matches these filters/),
  ).toBeVisible();
  await page
    .getByLabel("Discipline", { exact: true })
    .selectOption("women_four");
  await expect(
    page.getByRole("heading", { name: "Women’s four-player overall" }),
  ).toBeVisible();
  await page.getByLabel("List", { exact: true }).selectOption("series");
  await expect(
    page.getByText(/No approved publication matches these filters/),
  ).toBeVisible();
  await page.goto(href!);
  await expect(
    page.getByRole("heading", { name: "Women’s four-player overall" }),
  ).toBeVisible();
  expect(issues).toEqual([]);
});
test("public loading, empty, failed refresh and retry preserve the last exact approved list", async ({
  page,
}, info) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/rankings?**", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/rankings");
  await expect(page.getByRole("status")).toContainText(
    "Loading approved rankings",
  );
  await page.screenshot({
    path: info.outputPath("public-loading.png"),
    fullPage: true,
  });
  release();
  await expect(
    page.getByRole("heading", { name: "Women’s four-player overall" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/rankings?**");
  await page.route("**/api/v1/rankings?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Controlled publication read failure" }),
    }),
  );
  await page
    .getByLabel("Discipline", { exact: true })
    .selectOption("women_four");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "selection is stale",
  );
  await expect(
    page.getByRole("heading", { name: "Women’s four-player overall" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("public-stale.png"),
    fullPage: true,
  });
  await page.unroute("**/api/v1/rankings?**");
  await page.getByRole("button", { name: "Retry rankings" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
test("uncertain approval retains exact command across reload and reconciles only the matching receipt without POST", async ({
  page,
}, info) => {
  const { draft } = await ready(page);
  await select(page, draft.id);
  await fill(page);
  await page.route("**/api/v1/ranking-publications", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("connectionfailed");
  });
  await page
    .getByRole("button", { name: "Approve & publish exact list" })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "not confirmed",
  );
  await page.unroute("**/api/v1/ranking-publications");
  await page.reload();
  await expect(page.getByText(/Unconfirmed command retained/)).toBeVisible();
  await page.screenshot({
    path: info.outputPath("retained-command.png"),
    fullPage: true,
  });
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page
    .getByRole("button", {
      name: "Reconcile recorded publication command",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "The original command was reconciled with recorded history. Review its current status below.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open this exact approved publication" }),
  ).toBeVisible();
  expect(posts).toEqual([]);
});
test("current input change makes staff approval stale and blocks a previously ready draft", async ({
  page,
}, info) => {
  const { f, draft } = await ready(page);
  await select(page, draft.id);
  await fill(page);
  const input = await (
    await page.request.get(`/api/v1/ranking-inputs?id=${f.reviewIds[0]}`)
  ).json();
  const changed = await page.request.post("/api/v1/ranking-inputs", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      id: input.id,
      kind: "season",
      version: input.version,
      state: "draft",
      requestId: crypto.randomUUID(),
      data: input.data,
    },
  });
  expect(changed.status()).toBe(200);
  await page
    .getByRole("button", { name: "Approve & publish exact list" })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Publication blocked",
  );
  await expect(page.getByText(/This review is stale/)).toBeVisible();
  await page
    .getByRole("button", {
      name: "Reload current publication review",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Publication blocked" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve & publish exact list" }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("staff-blocked.png"),
    fullPage: true,
  });
});
