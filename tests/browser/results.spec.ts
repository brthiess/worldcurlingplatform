import {
  test,
  expect,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { scoringFixtureDraw } from "../scoring-fixture";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let session: BrowserContext;
test.beforeAll(async ({ browser }) => {
  session = await browser.newContext();
  const r = await session.request.post("/api/auth/sign-in/email", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      email: "scorekeeper@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    },
  });
  expect(r.status()).toBe(200);
});
test.beforeEach(async ({ context }) =>
  context.addCookies(await session.cookies()),
);
test.afterAll(async () => {
  await pool.query("DELETE FROM role_grant WHERE id LIKE 'browser-result-%'");
  await session.close();
  await pool.end();
});
async function fixture(request: APIRequestContext) {
  const id = `browser-result-${randomUUID()}`;
  await scoringFixtureDraw(pool);
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,'scoring-test-draw','R','Result browser','scheduled','entry-1','entry-3','North','Prairie')",
    [id],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$1)",
    [id],
  );
  for (const [expectedVersion, action, extra] of [
    [0, "start", {}],
    [1, "end", { endNumber: 1, end: { state: "played", a: 2, b: 0 } }],
  ] as const) {
    const r = await request.post(`/api/v1/games/${id}/scoring`, {
      headers: { Origin: process.env.BETTER_AUTH_URL! },
      data: {
        requestId: randomUUID(),
        expectedVersion,
        action,
        hammer: null,
        ...extra,
      },
    });
    expect(r.status()).toBe(200);
  }
  for (let endNumber = 2; endNumber <= 8; endNumber++) {
    const r = await request.post(`/api/v1/games/${id}/scoring`, {
      headers: { Origin: process.env.BETTER_AUTH_URL! },
      data: {
        requestId: randomUUID(),
        expectedVersion: endNumber,
        action: "end",
        hammer: null,
        endNumber,
        end: { state: "played", a: 0, b: 0 },
      },
    });
    expect(r.status()).toBe(200);
  }
  return id;
}
for (const [name, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const)
  test(`${name}: confirm and correct persists without a second approver`, async ({
    page,
  }, info) => {
    const id = await fixture(session.request);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/admin/games/${id}`);
    await expect(
      page.getByRole("button", { name: "Confirm result", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Result winner").selectOption("entry-1");
    await page
      .getByRole("button", { name: "Confirm result", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Final · normal", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Correct confirmed result" })
      .click();
    await page.getByLabel("Result outcome").selectOption("conceded");
    await page.getByLabel("Result winner").selectOption("entry-3");
    await page
      .getByLabel("Result reason")
      .fill("North conceded; winner corrected");
    await page
      .getByRole("button", { name: "Save correction", exact: true })
      .click();
    await expect(
      page.getByText("Corrected final · conceded", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${name}-corrected.png`),
      fullPage: true,
    });
    await page.goto(`/games/${id}`);
    await expect(
      page.getByText("North conceded; winner corrected", { exact: false }),
    ).toBeVisible();
    await page.getByText("Earlier result versions").click();
    await expect(page.getByText(/Version 3 · normal/)).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${name}-public-history.png`),
      fullPage: true,
    });
  });
test("live and corrected lineup differences are persistent declared evidence without changing the event", async ({
  page,
}) => {
  const id = await fixture(session.request),
    players = await (
      await session.request.get("/api/v1/public/players")
    ).json();
  const first = players[0],
    second = players[1];
  expect(first.id).not.toBe(second.id);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/admin/games/${id}`);
  await page.getByText("Record lineup differences", { exact: true }).click();
  await page
    .getByRole("button", { name: "Add game player · side A", exact: true })
    .click();
  await page
    .getByLabel("Player 1 · side A", { exact: true })
    .selectOption(first.id);
  await page.getByLabel("Position 1 · side A", { exact: true }).fill("Skip");
  await page
    .getByRole("button", {
      name: "Save lineup difference · side A",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Result ready · accepted version 10", { exact: true }),
  ).toBeVisible();
  await page.goto(`/games/${id}`);
  await page.getByText("Current game lineup evidence", { exact: true }).click();
  await expect(
    page.getByText(`${first.name} · Skip · declared`, { exact: false }),
  ).toBeVisible();
  await page.goto(`/admin/games/${id}`);
  await page.getByLabel("Result winner").selectOption("entry-1");
  await page
    .getByRole("button", { name: "Confirm result", exact: true })
    .click();
  await expect(page.getByText("Final · normal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Correct confirmed result" }).click();
  await page.getByLabel("Result reason").fill("Corrected game rotation");
  await page.getByText("Record lineup differences", { exact: true }).click();
  await page
    .getByLabel("Player 1 · side A", { exact: true })
    .selectOption(second.id);
  await page
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(
    page.getByText("Corrected final · normal", { exact: true }),
  ).toBeVisible();
  const g = await (
    await session.request.get(`/api/v1/games/${id}/scoring`)
  ).json();
  expect(g.results[0].result.lineupA.members[0].playerId).toBe(second.id);
  expect(g.results[1].result.lineupA.members[0].playerId).toBe(first.id);
});
test("result loading failure, stale edit and accepted-response loss retain an honest exact retry", async ({
  page,
}, info) => {
  const id = await fixture(session.request),
    url = `**/api/v1/games/${id}/scoring`;
  await page.route(url, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Scoring temporarily unavailable" }),
        })
      : route.continue(),
  );
  await page.goto(`/admin/games/${id}`);
  await expect(
    page.getByRole("alert", { name: "Score entry error" }),
  ).toContainText("Scoring temporarily unavailable");
  await expect(
    page.getByRole("button", { name: "Confirm result", exact: true }),
  ).toHaveCount(0);
  await page.unroute(url);
  await page.getByRole("button", { name: "Retry loading game" }).click();
  await page.getByLabel("Result winner").selectOption("entry-1");
  await page.reload();
  await expect(page.getByLabel("Result winner")).toHaveValue("entry-1");
  await expect(
    page.getByText("Unsent result edit · retained in this tab", {
      exact: true,
    }),
  ).toBeVisible();
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  let accepted: any,
    originalBody = "";
  await page.route(url, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    originalBody = route.request().postData()!;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    accepted = await response.json();
    await gate;
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Confirm result", exact: true })
    .click();
  await expect(
    page.getByText("Saving result · waiting for acknowledgement", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm result", exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByText("Uncertain result · retry required", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("uncertain-result.png"),
    fullPage: true,
  });
  await page.unroute(url);
  await page.reload();
  await expect(
    page.getByText("Uncertain result · retry required", { exact: true }),
  ).toBeVisible();
  let retryBody = "";
  await page.route(url, async (route) => {
    if (route.request().method() === "POST")
      retryBody = route.request().postData()!;
    await route.continue();
  });
  await page.getByRole("button", { name: "Retry same result request" }).click();
  await expect(page.getByText("Final · normal", { exact: true })).toBeVisible();
  expect(retryBody).toBe(originalBody);
  const saved = await (
    await session.request.get(`/api/v1/games/${id}/scoring`)
  ).json();
  expect(saved.version).toBe(accepted.version);
  expect(saved.results).toHaveLength(1);
  await page.unroute(url);
  await page.getByRole("button", { name: "Correct confirmed result" }).click();
  await page.getByLabel("Result reason").fill("Browser correction draft");
  const other = await session.request.post(`/api/v1/games/${id}/scoring`, {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      requestId: randomUUID(),
      expectedVersion: saved.version,
      action: "correct",
      hammer: null,
      outcome: "conceded",
      winnerEntryId: "entry-1",
      reason: "Other accepted correction",
      ends: saved.ends,
    },
  });
  expect(other.status()).toBe(200);
  await page
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(
    page.getByText("Result not applied · review accepted version", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Result reason")).toHaveValue(
    "Browser correction draft",
  );
  await page
    .getByRole("button", { name: "Review accepted result version" })
    .click();
  await expect(page.getByLabel("Result reason")).toHaveValue(
    "Browser correction draft",
  );
  await page
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(
    page.getByText("Result ready · accepted version 12", { exact: true }),
  ).toBeVisible();
});
