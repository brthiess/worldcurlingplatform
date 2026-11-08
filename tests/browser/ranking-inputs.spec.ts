import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { signInWithRateWindow } from "./auth-fixture";
async function signIn(page: Page, role = "administrator") {
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption(role);
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
}

test("staff inspect sources/checkpoints and five regulars versus an alternate, resolve exact ownership, recover an uncertain review and inspect immutable history at three widths", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await signIn(page);
  const ids = Array.from({ length: 6 }, () => randomUUID()),
    names = [
      "Avery Fixture",
      "Blair Fixture",
      "Casey Fixture",
      "Drew Fixture",
      "Emery Fixture",
      "Finley Alternate",
    ];
  const entry = await page.request.post("/api/v1/entries", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      id: randomUUID(),
      requestId: randomUUID(),
      version: 0,
      entry: {
        divisionId: "prairie-men",
        name: `WCP032 browser ${randomUUID().slice(0, 8)}`,
        coreKnown: true,
        corePlayerIds: ids.slice(0, 5),
        members: ids.map((playerId, i) => ({
          playerId,
          role: i < 5 ? "core" : "alternate",
          position: "",
          participation: "declared",
        })),
        newPlayers: ids.map((id, i) => ({
          id,
          name: names[i],
          provisional: false,
        })),
        registerSeason: { season: "2026-27", version: 0 },
      },
    },
  });
  expect(entry.status()).toBe(201);
  const created = await entry.json();
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto("/admin/ranking-inputs");
  await page
    .getByRole("button", { name: "Rule editions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start 2026-27 source edition" })
    .click();
  const title = `WCP032 browser source ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Edition title", { exact: true }).fill(title);
  await page.getByText("Effective checkpoints (19)", { exact: true }).click();
  await expect(
    page
      .getByRole("group", {
        name: "Checkpoint 19 · mixed_doubles",
        exact: true,
      })
      .getByLabel("Maximum events"),
  ).toHaveValue("6");
  await page.getByText("Effective checkpoints (19)", { exact: true }).click();
  await page
    .locator("summary")
    .filter({ hasText: "front-rotation · supported" })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Interpretation rationale",
      exact: true,
    }),
  ).toHaveValue(/one-sixth/);
  await page
    .locator("summary")
    .filter({ hasText: "front-rotation · supported" })
    .click();
  await page
    .getByLabel("Rule review rationale")
    .fill(
      "Primary source editions inspected. Explicit exact-share and six-event interpretations reviewed; rounding/MD ownership remain unresolved. Synthetic browser exercise.",
    );
  await page
    .getByRole("button", { name: "Record staff review", exact: true })
    .click();
  await expect(
    page.getByText(
      "Reviewed evidence saved. This is not a ranking publication.",
      { exact: true },
    ),
  ).toBeVisible();
  const ruleId = await page
    .getByRole("combobox", { name: "Rule edition", exact: true })
    .inputValue();
  await page
    .getByRole("button", { name: "Team-season review", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Team-season", exact: true })
    .selectOption(created.registration.id);
  await expect(
    page.getByText("Finley Alternate", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", {
      name: "Finley Alternate official ranking role",
      exact: true,
    }),
  ).toHaveValue("alternate");
  await page
    .getByRole("combobox", { name: "Rule/source version", exact: true })
    .selectOption(`${ruleId}:1`);
  await page
    .getByRole("button", { name: "Save draft evidence", exact: true })
    .click();
  await expect(
    page.getByText(
      "Required evidence is unresolved. Publication must remain blocked.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "No sources recorded. Required starting amounts remain unresolved.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Record staff review", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Required evidence remains unresolved",
  );
  await page
    .getByRole("combobox", { name: "Declared allocation option", exact: true })
    .selectOption("front-rotation");
  for (const [i, name] of names.slice(0, 5).entries())
    await page
      .getByLabel(`${name} exact share`, { exact: true })
      .fill(i < 2 ? "1/4" : "1/6");
  await page
    .getByRole("button", { name: "Add source edition", exact: true })
    .click();
  const evidence = page
    .locator("details")
    .filter({ has: page.getByLabel("Source 1 id", { exact: true }) });
  await evidence.locator("summary").click();
  for (const [label, value] of [
    ["id", "entitlement"],
    ["title", "Fictional starting entitlement fixture"],
    ["url", "https://example.com/wcp032-browser-evidence"],
    ["edition", "Synthetic reviewed input fixture 1"],
    ["SHA-256", "b".repeat(64)],
  ] as const)
    await page.getByLabel(`Source 1 ${label}`, { exact: true }).fill(value);
  await evidence.locator("summary").click();
  await page
    .getByRole("combobox", {
      name: "Ranking roster declaration source",
      exact: true,
    })
    .selectOption("entitlement");
  for (const [i, name] of names.slice(0, 5).entries()) {
    const row = page
      .locator("details")
      .filter({ has: page.locator("summary").filter({ hasText: name }) })
      .last();
    await row.locator("summary").click();
    await row
      .getByRole("combobox", { name: "Evidence basis", exact: true })
      .selectOption("documented-individual");
    await row
      .getByLabel("Exact sourced amount", { exact: true })
      .fill(i < 2 ? "75" : "50");
    for (const label of [
      "Amount source",
      "Ownership source",
      "Eligibility / decision source",
    ])
      await row
        .getByRole("combobox", { name: label, exact: true })
        .selectOption("entitlement");
    await row
      .getByLabel("Ownership / eligibility applicability notes", {
        exact: true,
      })
      .fill(
        "Synthetic individually documented entitlement and season eligibility; no historical aggregate inference.",
      );
    await row.locator("summary").click();
  }
  await page
    .getByLabel("Input review rationale", { exact: true })
    .fill(
      "Five exact regular rights and individually sourced starting amounts checked. Finley remains a designated alternate. Fictional test evidence.",
    );
  await page
    .getByLabel("Optional biography missing (informational)", { exact: true })
    .check();
  const commands: string[] = [];
  let reviewId = "";
  await page.route("**/api/v1/ranking-inputs", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    commands.push(route.request().postData()!);
    if (commands.length === 1) {
      const accepted = await route.fetch();
      expect(accepted.status()).toBe(200);
      const saved = await accepted.json();
      expect(saved.version).toBe(2);
      reviewId = saved.id;
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Record staff review", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry original save", exact: true }),
  ).toBeVisible();
  for (const control of await page
    .locator(
      ".ranking-navigation input,.ranking-navigation select,.ranking-navigation button,.ranking-form input,.ranking-form select,.ranking-form textarea,.ranking-form button",
    )
    .all())
    await expect(control).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry original save", exact: true })
    .click();
  await expect(
    page.getByText("Required starting evidence is complete.", { exact: true }),
  ).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[0]).toBe(commands[1]);
  await expect(
    page.getByText("Sum of sourced starting inputs:", { exact: false }),
  ).toContainText("300");
  await expect(
    page.getByText("Informational: Optional biography is missing.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/v1/ranking-inputs");
  const saved = await (
    await page.request.get(`/api/v1/ranking-inputs?id=${reviewId}`)
  ).json();
  expect(saved.version).toBe(2);
  expect(saved.currentReadiness.startingInput).toBe("300");
  expect(
    saved.rosterSnapshot.filter((m: { role: string }) => m.role === "core"),
  ).toHaveLength(5);
  await page
    .getByRole("button", { name: "Open v1 · draft", exact: true })
    .click();
  await expect(
    page.getByText(
      "Historical revision. Open v2 to amend the latest evidence.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save draft evidence", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Open v2 · reviewed", exact: true })
    .click();
  for (const [width, label] of [
    [360, "phone"],
    [768, "tablet"],
    [1440, "desktop"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${label}-season-review.png`),
      fullPage: true,
    });
  }
  await page
    .getByRole("combobox", { name: "Team-season", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Open v2 · reviewed", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath("phone-review-top.png") });
  await page
    .getByRole("heading", { name: "Starting-input readiness", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("phone-readiness.png") });
  await page.route("**/api/v1/ranking-inputs?*", (route) =>
    route.abort("failed"),
  );
  await page
    .getByRole("button", { name: "Open v1 · draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry evidence read", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/ranking-inputs?*");
  await page
    .getByRole("button", { name: "Retry evidence read", exact: true })
    .click();
  await expect(
    page.getByText(
      "Historical revision. Open v2 to amend the latest evidence.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open v2 · reviewed", exact: true })
    .click();
  const amendment = await page.request.post("/api/v1/entries", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      id: randomUUID(),
      requestId: randomUUID(),
      version: 0,
      entry: {
        divisionId: "prairie-men",
        name: created.name,
        teamId: created.teamId,
        registrationId: created.registration.id,
        coreKnown: true,
        corePlayerIds: ids.slice(0, 5),
        members: ids.map((playerId, i) => ({
          playerId,
          role: i < 5 ? "core" : "alternate",
          position: "Revised staff roster note",
          participation: "declared",
        })),
        newPlayers: [],
        registerSeason: { season: "2026-27", version: 1 },
      },
    },
  });
  expect(amendment.status()).toBe(201);
  await page
    .getByRole("button", {
      name: "Refresh registrations and rule editions",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Reload latest evidence", exact: true })
    .click();
  await expect(
    page.getByText(
      "Blocker: The season roster has changed since this input was reviewed.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Use current platform season snapshot v2 and recheck evidence",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save draft evidence", exact: true })
    .click();
  await expect(
    page.getByText("Required starting evidence is complete.", { exact: true }),
  ).toBeVisible();
  const latest = await (
    await page.request.get(`/api/v1/ranking-inputs?id=${reviewId}`)
  ).json();
  expect(latest.version).toBe(3);
  expect(latest.data.rosterVersion).toBe(2);
  expect(latest.data.rankingPlayerIds).toHaveLength(5);
  const oldReview = await (
    await page.request.get(`/api/v1/ranking-inputs?id=${reviewId}&version=2`)
  ).json();
  expect(oldReview.savedReadiness.complete).toBe(true);
  expect(oldReview.data.rosterVersion).toBe(1);
  expect(pageErrors).toEqual([]);
});

test("staff review has honest loading and recoverable read failure; organizers see a denied state", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await signIn(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/v1/ranking-inputs", async (route) => {
    await gate;
    await route.abort("failed");
  });
  await page.goto("/admin/ranking-inputs");
  await expect(
    page.getByText("Loading rule editions and team-seasons…", { exact: true }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("button", { name: "Retry loading review", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/ranking-inputs");
  await page
    .getByRole("button", { name: "Retry loading review", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Team-season", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page
    .getByRole("button", { name: "Rule editions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start 2026-27 source edition" })
    .click();
  for (const [width, label] of [
    [360, "phone"],
    [1440, "desktop"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${label}-rule-edition.png`),
      fullPage: true,
    });
  }
  await page.context().clearCookies();
  await signIn(page, "organizer");
  await page.goto("/admin/ranking-inputs");
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "World Curling staff authority is required.",
  );
  await expect(
    page.getByRole("combobox", { name: "Team-season", exact: true }),
  ).toHaveCount(0);
});
