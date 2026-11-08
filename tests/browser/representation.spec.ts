import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import "dotenv/config";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
test.afterAll(async () => {
  await pool.end();
});
const base = process.env.BETTER_AUTH_URL!;
async function login(request: APIRequestContext, id: string) {
  const send = () =>
    request.post("/api/auth/sign-in/email", {
      headers: { Origin: base },
      data: {
        email: `${id}@demo.invalid`,
        password: process.env.DEMO_PASSWORD,
      },
    });
  let r = await send();
  if (r.status() === 429) {
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(
          60000,
          Math.max(1000, Number(r.headers()["x-retry-after"] ?? 60) * 1000),
        ) + 250,
      ),
    );
    r = await send();
  }
  expect(r.status()).toBe(200);
}
async function fixture(request: APIRequestContext, label: string) {
  const userId = `wcp008-${label}-${randomUUID()}`;
  await pool.query(
    "INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,$2,$3,true)",
    [userId, `Representative ${label}`, `${userId}@demo.invalid`],
  );
  await pool.query(
    "INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now())",
    [randomUUID(), userId, await hashPassword(process.env.DEMO_PASSWORD!)],
  );
  await login(request, "organizer");
  const ids = Array.from({ length: 4 }, () => randomUUID()),
    name = `Browser representation ${label} ${randomUUID().slice(0, 8)}`;
  const r = await request.post("/api/v1/entries", {
    headers: { Origin: base },
    data: {
      id: randomUUID(),
      requestId: randomUUID(),
      version: 0,
      entry: {
        divisionId: "prairie-men",
        name,
        coreKnown: true,
        corePlayerIds: ids,
        members: ids.map((playerId) => ({
          playerId,
          role: "core",
          position: "",
          participation: "declared",
        })),
        newPlayers: ids.map((id, i) => ({
          id,
          name: `${label} core ${i + 1}`,
          provisional: false,
        })),
        registerSeason: { season: "2026-27", version: 0 },
      },
    },
  });
  expect(r.status()).toBe(201);
  return { userId, name, entry: await r.json() };
}
for (const [label, width, height] of [
  ["phone", 360, 900],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${label}: staff grants and representative submits/amends without roster powers`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      consoleErrors: string[] = [],
      networkErrors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 500)
        networkErrors.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText !== "net::ERR_ABORTED")
        networkErrors.push(request.failure()?.errorText ?? request.url());
    });
    const f = await fixture(page.request, label);
    await login(page.request, "administrator");
    await page.goto("/admin/representatives");
    await page
      .getByLabel("Division for self-entry", { exact: true })
      .selectOption("prairie-men");
    await page.getByLabel("Entry season", { exact: true }).fill("2026-27");
    await page
      .getByLabel("Season setup reason", { exact: true })
      .fill("Configure the represented season");
    await page
      .getByRole("button", { name: "Save division entry season", exact: true })
      .click();
    await expect(
      page.getByText("Team-season authority recorded.", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Representative account", { exact: true })
      .selectOption(f.userId);
    await page
      .getByLabel("Team and season", { exact: true })
      .selectOption(f.entry.registration.id);
    await page
      .getByLabel("Representation reason", { exact: true })
      .fill("Team appointed this representative");
    await page
      .getByRole("button", { name: "Grant team-season authority", exact: true })
      .click();
    await expect(
      page.getByLabel("Representation reason", { exact: true }),
    ).toHaveValue("");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`${label}-staff.png`),
      fullPage: false,
    });
    await login(page.request, f.userId);
    await page.goto("/admin/entries");
    await page
      .getByLabel("Search teams or core players", { exact: true })
      .fill(f.name);
    await page
      .getByRole("button", { name: `Select ${f.name}`, exact: true })
      .click();
    await expect(
      page.getByText(new RegExp(`Acting on behalf of ${f.name}`)),
    ).toBeVisible();
    await expect(
      page.getByLabel("Also register this season roster", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Assemble different permanent core",
        exact: true,
      }),
    ).toHaveCount(0);
    const name = `${f.name} submission`;
    await page.getByLabel("Entry name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Save entry", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Saved to the database.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/saving does not reserve a place/),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath(`${label}-representative.png`),
      fullPage: false,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByLabel("Entry name", { exact: true })
      .fill(name + " amended");
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expect(
      page.getByText("Saved to the database.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: `Edit ${name} amended`, exact: true })
      .click();
    await expect(page.getByLabel("Entry name", { exact: true })).toHaveValue(
      name + " amended",
    );
    await page
      .getByRole("link", { name: "View public entry", exact: true })
      .click();
    await expect(
      page.getByText(/this submission does not reserve a place/),
    ).toBeVisible();
    if (label === "desktop") {
      await login(page.request, "administrator");
      await page.goto("/admin/representatives");
      const grantCard = page.locator(".workspace-list > li").filter({
        has: page.getByRole("heading", {
          name: `${f.name} · 2026-27`,
          exact: true,
        }),
      });
      await grantCard
        .getByLabel("Revocation reason", { exact: true })
        .fill("Appointment ended after the event submission");
      await grantCard
        .getByRole("button", { name: "Revoke representation", exact: true })
        .click();
      await expect(
        grantCard.getByText("submit · amend · withdraw · payment · Revoked", {
          exact: true,
        }),
      ).toBeVisible();
    }
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
}
test("uncertain grant and entry keep exact commands across reload; current account and revoked authority deny recovery", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const f = await fixture(page.request, "recovery");
  await login(page.request, "administrator");
  await page.goto("/admin/representatives");
  await page
    .getByLabel("Representative account", { exact: true })
    .selectOption(f.userId);
  await page
    .getByLabel("Team and season", { exact: true })
    .selectOption(f.entry.registration.id);
  await page
    .getByLabel("Representation reason", { exact: true })
    .fill("Recover exact representation grant");
  let lost = true;
  const sent: string[] = [];
  await page.route("**/api/v1/team-representation", async (route) => {
    if (route.request().method() === "POST") {
      sent.push(route.request().postData()!);
      if (lost) {
        lost = false;
        const accepted = await route.fetch();
        expect(accepted.status()).toBe(200);
        return route.abort("failed");
      }
    }
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Grant team-season authority", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Retry exact team-season command",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", {
      name: "Retry exact team-season command",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Retry exact team-season command",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(sent.length).toBe(2);
  expect(sent[1]).toBe(sent[0]);
  await page.unroute("**/api/v1/team-representation");
  await login(page.request, f.userId);
  await page.goto("/admin/entries");
  await page
    .getByLabel("Search teams or core players", { exact: true })
    .fill(f.name);
  await page
    .getByRole("button", { name: `Select ${f.name}`, exact: true })
    .click();
  let loseEntry = true;
  const entryBodies: string[] = [];
  await page.route("**/api/v1/entries", async (route) => {
    if (route.request().method() === "POST") {
      entryBodies.push(route.request().postData()!);
      if (loseEntry) {
        loseEntry = false;
        const accepted = await route.fetch();
        expect(accepted.status()).toBe(201);
        return route.abort("failed");
      }
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry last save", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Entry name", { exact: true })).toBeDisabled();
  await page.reload();
  await page
    .getByRole("button", { name: "Retry last save", exact: true })
    .click();
  await expect(
    page.getByText("Saved to the database.", { exact: true }),
  ).toBeVisible();
  expect(entryBodies[1]).toBe(entryBodies[0]);
  await page.screenshot({
    path: info.outputPath("recovered-entry.png"),
    fullPage: false,
  });
  const created = JSON.parse(entryBodies[0]);
  let loseAmend = true;
  await page.route(`**/api/v1/entries/${created.id}`, async (route) => {
    if (route.request().method() === "POST" && loseAmend) {
      loseAmend = false;
      const accepted = await route.fetch();
      expect(accepted.status()).toBe(200);
      return route.abort("failed");
    }
    await route.continue();
  });
  await page
    .getByLabel("Entry name", { exact: true })
    .fill(f.name + " reconciled amendment");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry last save", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Reconcile recorded entry command",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry last save", exact: true }),
  ).toHaveCount(0);
  expect(
    (await (await page.request.get(`/api/v1/entries/${created.id}`)).json())
      .version,
  ).toBe(2);
  expect(
    (
      await page.request.get(`/api/v1/entries/${created.id}?version=3`)
    ).status(),
  ).toBe(404);
  loseAmend = true;
  await page
    .getByLabel("Entry name", { exact: true })
    .fill(f.name + " authority recovery");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry last save", exact: true }),
  ).toBeVisible();
  await login(page.request, "administrator");
  await page
    .getByRole("button", { name: "Retry last save", exact: true })
    .click();
  await expect(page.getByText(/signed-in account changed/)).toBeVisible();
  await expect(page.getByLabel("Entry name", { exact: true })).toBeDisabled();
  const grant = JSON.parse(sent[0]);
  expect(
    (
      await page.request.post("/api/v1/team-representation", {
        headers: { Origin: base },
        data: {
          action: "revoke",
          id: grant.id,
          requestId: randomUUID(),
          reason: "Representation revoked during recovery",
        },
      })
    ).status(),
  ).toBe(200);
  await login(page.request, f.userId);
  await page
    .getByRole("button", { name: "Retry last save", exact: true })
    .click();
  await expect(page.getByText(/Current amend authority/)).toBeVisible();
  await expect(page.getByLabel("Entry name", { exact: true })).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("revoked-recovery.png"),
    fullPage: false,
  });
});
test("team authority shows loading, no authority, failed read and stale season setup with refresh", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const f = await fixture(page.request, "states");
  await login(page.request, f.userId);
  await page.route("**/api/v1/team-representation", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto("/admin/representatives");
  await expect(
    page.getByText("Loading team-season authority…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No team-season authority is assigned to this account.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/v1/team-representation");
  await page.goto("/admin/entries");
  await expect(
    page.getByText(
      /No entry divisions are available under your current authority/,
    ),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("no-team-authority.png"),
    fullPage: false,
  });
  await page.route("**/api/v1/team-representation", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Controlled local read failure" }),
    }),
  );
  await page.goto("/admin/representatives");
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Team authority could not be loaded.",
  );
  await page.unroute("**/api/v1/team-representation");
  await page
    .getByRole("button", { name: "Retry loading authority", exact: true })
    .click();
  await expect(
    page.getByText("No team-season authority is assigned to this account.", {
      exact: true,
    }),
  ).toBeVisible();
  await login(page.request, "administrator");
  await page.reload();
  await page
    .getByLabel("Division for self-entry", { exact: true })
    .selectOption("prairie-men");
  const current = await (
      await page.request.get("/api/v1/team-representation")
    ).json(),
    division = current.divisions.find(
      (d: { id: string }) => d.id === "prairie-men",
    );
  expect(
    (
      await page.request.post("/api/v1/team-representation", {
        headers: { Origin: base },
        data: {
          action: "configure-season",
          divisionId: "prairie-men",
          season: "2026-27",
          version: division.seasonVersion,
          requestId: randomUUID(),
          reason: "Concurrent staff season setup",
        },
      })
    ).status(),
  ).toBe(200);
  await page
    .getByLabel("Season setup reason", { exact: true })
    .fill("Stale form setup");
  await page
    .getByRole("button", { name: "Save division entry season", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "division season changed",
  );
  await page
    .getByRole("button", { name: "Refresh recorded authority", exact: true })
    .click();
  await expect(
    page.getByText(
      `Current season: 2026-27 · version ${division.seasonVersion + 1}`,
      { exact: true },
    ),
  ).toBeVisible();
});
