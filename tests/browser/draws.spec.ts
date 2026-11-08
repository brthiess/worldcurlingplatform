import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { signInApiWithRateWindow } from "./auth-fixture";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());
async function fixture() {
  const id = "browser-ko-" + randomUUID();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,'prairie-2026','Knockout browser fixture','men_four','single knockout')",
    [id],
  );
  const entries: string[] = [];
  for (let n = 1; n <= 6; n++) {
    const entry = id + "-" + n;
    entries.push(entry);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [entry, id, "Browser team " + n],
    );
  }
  return { id, entries };
}
for (const [device, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${device}: organizer previews and publishes; fan follows stored winner routes through bracket, list and game links`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const { id, entries } = await fixture(),
      errors: string[] = [],
      consoleErrors: string[] = [],
      networkErrors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 500) networkErrors.push(r.status() + " " + r.url());
    });
    expect(
      (
        await signInApiWithRateWindow(
          page.request,
          "organizer@demo.invalid",
          process.env.DEMO_PASSWORD,
        )
      ).status(),
    ).toBe(200);
    await page.goto("/admin/draws?division=" + id);
    await expect(page.getByLabel("Seed 1", { exact: true })).toBeVisible();
    for (let n = 1; n <= 6; n++)
      await page
        .getByLabel("Seed " + n, { exact: true })
        .selectOption(entries[n - 1]);
    await page
      .getByLabel("Revision reason", { exact: true })
      .fill(device + " seeded preview");
    await page
      .getByRole("button", { name: "Save preview", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved preview revision 1.",
    );
    await expect(
      page.getByRole("region", { name: "Saved draw preview" }),
    ).toContainText("No played game or win.");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(device + "-preview.png"),
      fullPage: true,
    });
    await page
      .getByLabel("Publication reason")
      .fill("Publish reviewed " + device + " field");
    await page
      .getByRole("button", { name: "Publish reviewed draw", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved published revision 2.",
    );
    await page
      .getByRole("link", { name: "Open public bracket and game list →" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Single knockout bracket",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Follow a team").selectOption(entries[3]);
    await expect(
      page.getByRole("article", { name: "Q2 · selected team", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "S1 · possible route", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Game list", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Knockout game list", exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const publicData = await (
      await page.request.get("/api/v1/public/divisions/" + id + "/draw")
    ).json();
    const q2 = publicData.games.find((g: any) => g.key === "Q2");
    const post = async (body: object) =>
      await page.request.post("/api/v1/games/" + q2.id + "/scoring", {
        headers: { Origin: process.env.BETTER_AUTH_URL! },
        data: body,
      });
    expect(
      (
        await post({
          requestId: randomUUID(),
          expectedVersion: 0,
          action: "start",
          hammer: null,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await post({
          requestId: randomUUID(),
          expectedVersion: 1,
          action: "end",
          endNumber: 1,
          end: { state: "played", a: 2, b: 0 },
          hammer: null,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await post({
          requestId: randomUUID(),
          expectedVersion: 2,
          action: "confirm",
          outcome: "conceded",
          winnerEntryId: entries[3],
          reason: "Browser opponent concession",
          hammer: null,
        })
      ).status(),
    ).toBe(200);
    await expect(
      page.getByRole("article", { name: "S1 · selected team", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("Follow a team")).toHaveValue(entries[3]);
    await expect(
      page.getByRole("button", { name: "Game list", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: info.outputPath(device + "-list-advanced.png"),
      fullPage: true,
    });
    const gameLink = page.getByRole("link", {
      name: "Open Q2 game →",
      exact: true,
    });
    await gameLink.focus();
    await expect(gameLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Game details", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Time and sheet not scheduled", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Browser team 4");
    await page.screenshot({
      path: info.outputPath(device + "-game.png"),
      fullPage: true,
    });
    await page.goBack();
    await expect(page.getByLabel("Follow a team")).toHaveValue(entries[3]);
    await expect(
      page.getByRole("button", { name: "Game list", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
}

test("draw loading, empty, interruption, uncertain retry and stale preview are truthful", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { id, entries } = await fixture();
  expect(
    (
      await signInApiWithRateWindow(
        page.request,
        "organizer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
  await page.goto("/events/prairie-2026/bracket?division=" + id);
  await expect(page.getByRole("status")).toContainText(
    "No published competition draw",
  );
  await page.route("**/api/v1/divisions/" + id + "/draw", async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await page.goto("/admin/draws?division=" + id);
  await expect(page.getByRole("status")).toContainText("Loading saved draw");
  await expect(page.getByLabel("Seed 1", { exact: true })).toBeVisible();
  await page.unroute("**/api/v1/divisions/" + id + "/draw");
  for (let n = 1; n <= 6; n++)
    await page
      .getByLabel("Seed " + n, { exact: true })
      .selectOption(entries[n - 1]);
  await page
    .getByLabel("Revision reason", { exact: true })
    .fill("Uncertain browser delivery");
  let interrupted = false;
  await page.route("**/api/v1/divisions/" + id + "/draw", async (route) => {
    if (route.request().method() === "POST" && !interrupted) {
      interrupted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save preview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save preview", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved preview revision 1.",
  );
  await page.unroute("**/api/v1/divisions/" + id + "/draw");
  const sibling = await page.request.post("/api/v1/divisions/" + id + "/draw", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      requestId: randomUUID(),
      expectedVersion: 1,
      action: "preview",
      seedEntryIds: entries,
      reason: "Another organizer reviewed a new revision",
    },
  });
  expect(sibling.status()).toBe(200);
  await page.getByLabel("Publication reason").fill("Attempt stale publish");
  await page
    .getByRole("button", { name: "Publish reviewed draw", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Draw changed");
  await expect(
    page.getByRole("button", { name: "Save preview", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reload accepted draw", exact: true })
    .click();
  await expect(page.getByText(/Revision 2 · preview/)).toBeVisible();
  await page.getByLabel("Publication reason").fill("Publish current version");
  await page
    .getByRole("button", { name: "Publish reviewed draw", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved published revision 3.",
  );
  await page
    .getByRole("link", { name: "Open public bracket and game list →" })
    .click();
  await expect(page.getByLabel("Follow a team")).toBeVisible();
  await page.route(
    "**/api/v1/public/divisions/" + id + "/draw",
    async (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Fixture unavailable"}',
      }),
  );
  await page.getByRole("button", { name: "Game list", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Showing the last successful draw",
    { timeout: 15000 },
  );
  await expect(
    page.getByRole("region", { name: "Knockout game list", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/public/divisions/" + id + "/draw");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
});
