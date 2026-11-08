import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { signInWithRateWindow } from "./auth-fixture";
async function organizerSignIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption("organizer");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
}
for (const [label, width] of [
  ["phone", 360],
  ["tablet", 768],
  ["desktop", 1440],
] as const) {
  test(`organizer assembles a core, uses a temporary substitute, and follows truthful public summaries at ${label}`, async ({
    page,
  }, info) => {
    test.setTimeout(100000);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const networkErrors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 500) networkErrors.push(`${r.status()} ${r.url()}`);
    });
    page.on("requestfailed", (r) => {
      if (r.failure()?.errorText !== "net::ERR_ABORTED")
        networkErrors.push(r.failure()?.errorText ?? r.url());
    });
    await organizerSignIn(page);
    await page
      .getByRole("link", { name: "Manual team entries", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Manual entries", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Division", { exact: true })
      .selectOption("prairie-men");
    const name = `Browser ${label} ${Date.now()}`;
    await page.getByLabel("Entry name", { exact: true }).fill(name);
    for (let i = 1; i <= 4; i++) {
      await page
        .getByLabel("New player name", { exact: true })
        .fill(`${name} Player ${i}`);
      await page
        .getByRole("button", { name: "Add new player", exact: true })
        .click();
    }
    await page.getByLabel("Regular core membership is complete").check();
    await page.getByLabel("Also register this season roster").check();
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expect(
      page.getByText("Saved to the database.", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${label}-manual-entry.png`),
      fullPage: true,
    });
    await page.getByLabel(`At this event: ${name} Player 4`).uncheck();
    await page
      .getByLabel("New player name", { exact: true })
      .fill(`${name} Guest`);
    await page.getByLabel("New player is provisional").check();
    await page.getByLabel("New player role").selectOption("substitute");
    await page
      .getByRole("button", { name: "Add new player", exact: true })
      .click();
    await page.getByRole("button", { name: "Save entry", exact: true }).click();
    await expect(
      page.getByText("Saved to the database.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "View public entry", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("provisional", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("substitute", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Season roster · 2026-27 · version 1", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Event lineup · version 2", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${label}-public-entry.png`),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "View core-composition team", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Regular core", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name, exact: true }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${label}-public-team.png`),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Prairie Open 2026", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/division=prairie-men/);
    await page.getByRole("link", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: `${name} Guest`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `${name} Guest`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Provisional player identity. Relationship to possible existing records remains unresolved.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
}

test("existing-team and player selection, loading, empty search, keyboard, uncertain retry and stale recovery persist honestly", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 900 });
  await organizerSignIn(page);
  const name = `Returning browser ${Date.now()}`,
    ids = Array.from({ length: 4 }, () => randomUUID());
  const entry = {
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
      name: `${name} Player ${i}`,
      provisional: false,
    })),
    registerSeason: { season: "2026-27", version: 0 },
  };
  const setup = await page.request.post("/api/v1/entries", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: { id: randomUUID(), version: 0, requestId: randomUUID(), entry },
  });
  expect(setup.status()).toBe(201);
  const source = await setup.json();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/v1/entries", async (route) => {
    if (route.request().method() === "GET") await gate;
    await route.continue();
  });
  await page.goto("/admin/entries");
  await expect(
    page.getByText("Loading entries and player search…"),
  ).toBeVisible();
  release();
  await page
    .getByLabel("Division", { exact: true })
    .selectOption("prairie-men");
  await page
    .getByLabel("Search teams or core players", { exact: true })
    .fill(name);
  await page
    .getByRole("button", { name: `Select ${name}`, exact: true })
    .click();
  await expect(
    page.getByLabel(`Roster evidence: ${name} Player 0`),
  ).toHaveValue("defaulted");
  await page.getByLabel("Entry name", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Search teams or core players", { exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Search existing players", { exact: true })
    .fill("No real player could match this 0000000");
  await expect(
    page.getByText(
      "No unselected players match. Add a new sport record if needed.",
    ),
  ).toBeVisible();
  await page.getByLabel("New player role").selectOption("alternate");
  await page
    .getByLabel("Search existing players", { exact: true })
    .fill("Alex Demo");
  await page
    .getByRole("button", { name: "Add Alex Demo (demo-player)", exact: true })
    .click();
  await page.getByLabel("Entry name", { exact: true }).fill(`${name} return`);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry last save", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await page
    .getByRole("button", { name: "Retry last save", exact: true })
    .click();
  await expect(
    page.getByText("Saved to the database.", { exact: true }),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "View public entry", exact: true })
    .getAttribute("href");
  const id = href!.split("/").pop();
  const current = await (
    await page.request.get(`/api/v1/entries/${id}`)
  ).json();
  expect(current.teamId).toBe(source.teamId);
  expect(current.registration.version).toBe(1);
  expect(current.lineup.members.at(-1).role).toBe("alternate");
  expect(current.lineup.members[0].participation).toBe("defaulted");
  const revised = {
    ...entry,
    name: "Concurrent saved name",
    newPlayers: [],
    registerSeason: undefined,
    teamId: source.teamId,
    registrationId: source.registration.id,
    members: current.lineup.members.map(
      ({
        playerId,
        role,
        position,
        participation,
      }: {
        playerId: string;
        role: string;
        position: string;
        participation: string;
      }) => ({ playerId, role, position, participation }),
    ),
  };
  expect(
    (
      await page.request.post(`/api/v1/entries/${id}`, {
        headers: { Origin: process.env.BETTER_AUTH_URL! },
        data: {
          version: current.version,
          requestId: randomUUID(),
          entry: revised,
        },
      })
    ).status(),
  ).toBe(200);
  await page.getByLabel("Entry name", { exact: true }).fill("Stale form name");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(page.getByText(/This entry changed/)).toBeVisible();
  await page
    .getByRole("button", { name: "Reload current version", exact: true })
    .click();
  await expect(page.getByLabel("Entry name", { exact: true })).toHaveValue(
    "Concurrent saved name",
  );
  let loseResponse = true;
  await page.route(`**/api/v1/entries/${id}`, async (route) => {
    if (route.request().method() === "POST" && loseResponse) {
      loseResponse = false;
      const accepted = await route.fetch();
      expect(accepted.status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByLabel("Entry name", { exact: true })
    .fill("Accepted response lost");
  await page.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry last save", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Entry name", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry last save", exact: true })
    .click();
  await expect(
    page.getByText("Saved to the database.", { exact: true }),
  ).toBeVisible();
  const retried = await (
    await page.request.get(`/api/v1/entries/${id}`)
  ).json();
  expect(retried.version).toBe(3);
  expect(retried.registration.version).toBe(1);
  expect(retried.name).toBe("Accepted response lost");
  await page.screenshot({
    path: info.outputPath("phone-existing-team-recovered.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  let failRead = true;
  await page.route("**/api/v1/public/teams", async (route) => {
    if (failRead) {
      failRead = false;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.goto("/teams");
  await expect(
    page.getByRole("heading", { name: "Roster unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry roster", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Teams", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Search teams or core players", { exact: true })
    .fill("No possible team identity here 0000000");
  await expect(
    page.getByText("No teams match this search.", { exact: true }),
  ).toBeVisible();
});
