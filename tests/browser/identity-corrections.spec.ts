import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { signInWithRateWindow } from "./auth-fixture";
async function signIn(page: Page) {
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
}
async function fixture(page: Page) {
  const id = randomUUID(),
    ids = Array.from({ length: 3 }, () => randomUUID()),
    name = `Browser identity ${id}`;
  const r = await page.request.post("/api/v1/entries", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      id,
      version: 0,
      requestId: randomUUID(),
      entry: {
        divisionId: "prairie-men",
        name,
        coreKnown: false,
        corePlayerIds: [],
        members: ids.map((playerId) => ({
          playerId,
          role: "substitute",
          position: "",
          participation: "declared",
        })),
        newPlayers: ids.map((id, i) => ({
          id,
          name:
            i === 0
              ? "Wrong browser record"
              : "Disambiguation browser candidate",
          provisional: i === 0,
        })),
      },
    },
  });
  expect(r.status()).toBe(201);
  return { id, ids, name, entry: await r.json() };
}
async function fill(
  page: Page,
  f: Awaited<ReturnType<typeof fixture>>,
  to = f.ids[1],
) {
  await page.getByLabel("Affected entry").selectOption(f.id);
  await page.getByLabel("Mistaken player record").selectOption(f.ids[0]);
  await page.getByLabel("Search replacement players").fill(to);
  await page
    .getByRole("button", {
      name: `Select Disambiguation browser candidate (${to})`,
      exact: true,
    })
    .click();
  await page
    .getByLabel("Factual correction reason")
    .fill("Wrong record selected from same-name candidates");
  await page
    .getByLabel("Source evidence")
    .fill("Original organizer lineup and staff review");
}

for (const width of [360, 768, 1440])
  test(`staff collision review is accessible and persistent at ${width}px`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await signIn(page);
    errors.length = 0;
    const f = await fixture(page);
    await page.goto("/admin/identity-corrections");
    await fill(page, f);
    await page
      .getByLabel("Search replacement players")
      .fill("Disambiguation browser candidate");
    await expect(
      page.getByText(
        "Several possible records. Compare context and explicitly choose one.",
      ),
    ).toBeVisible();
    await page.getByLabel("Source evidence").focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", {
        name: "Record factual correction",
        exact: true,
      }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    const outcome = page.getByRole("region", { name: "Correction outcome" });
    await expect(
      outcome.getByRole("heading", { name: "Unresolved identity issue" }),
    ).toBeVisible();
    await expect(
      outcome.getByText(/No canonical changes applied/),
    ).toBeVisible();
    await expect(page.getByLabel("Affected entry")).toBeEnabled();
    expect(
      (await (await page.request.get(`/api/v1/entries/${f.id}`)).json())
        .version,
    ).toBe(1);
    await page.screenshot({ path: info.outputPath(`collision-${width}.png`) });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Correction and unresolved issue history",
      }),
    ).toBeVisible();
    await expect(
      page
        .locator(".workspace-list")
        .getByRole("listitem")
        .filter({ hasText: f.id })
        .first(),
    ).toBeVisible();
  });

test("lost applied response locks correction controls across reload and replays the exact actor-bound command", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 1000 });
  await signIn(page);
  const f = await fixture(page);
  // The candidate belongs to another event-only lineup, not the affected lineup.
  const candidate = randomUUID();
  const r = await page.request.post("/api/v1/entries", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      id: randomUUID(),
      version: 0,
      requestId: randomUUID(),
      entry: {
        divisionId: "prairie-men",
        name: "Independent browser candidate",
        coreKnown: false,
        corePlayerIds: [],
        members: [
          {
            playerId: candidate,
            role: "substitute",
            position: "",
            participation: "declared",
          },
        ],
        newPlayers: [
          {
            id: candidate,
            name: "Disambiguation browser candidate",
            provisional: false,
          },
        ],
      },
    },
  });
  expect(r.status()).toBe(201);
  await page.goto("/admin/identity-corrections");
  await fill(page, f, candidate);
  const bodies: string[] = [];
  let lose = true;
  await page.route("**/api/v1/identity-corrections", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postData()!);
    if (lose) {
      lose = false;
      const accepted = await route.fetch();
      expect(accepted.status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Record factual correction", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Retry exact identity correction command",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Affected entry")).toBeDisabled();
  await expect(page.getByLabel("Source evidence")).toBeDisabled();
  await page.screenshot({ path: info.outputPath("phone-uncertain.png") });
  await page.reload();
  await expect(page.getByLabel("Affected entry")).toBeDisabled();
  const retained = page
    .locator("details")
    .filter({
      has: page.getByText("Review retained command", { exact: true }),
    });
  await retained.locator("summary").click();
  await expect(
    retained.getByText("Correct factual player selection", { exact: true }),
  ).toBeVisible();
  await expect(
    retained.getByRole("link", {
      name: `Open mistaken player record ${f.ids[0]}`,
      exact: true,
    }),
  ).toHaveAttribute("href", `/players/${f.ids[0]}`);
  await expect(
    retained.getByRole("link", {
      name: `Open proposed player record ${candidate}`,
      exact: true,
    }),
  ).toHaveAttribute("href", `/players/${candidate}`);
  await expect(retained.getByText("1", { exact: true })).toBeVisible();
  await expect(
    retained.getByText("demo-administrator", { exact: true }),
  ).toBeVisible();
  await expect(
    retained.getByText("Original organizer lineup and staff review", {
      exact: true,
    }),
  ).toBeVisible();
  await retained.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("phone-retained-review.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await retained
    .getByRole("link", {
      name: `Open mistaken player record ${f.ids[0]}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Wrong browser record", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Affected entry")).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Retry exact identity correction command",
      exact: true,
    })
    .click();
  const outcome = page.getByRole("region", { name: "Correction outcome" });
  await expect(
    outcome.getByRole("heading", { name: "Factual correction recorded" }),
  ).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
  expect(
    (await (await page.request.get(`/api/v1/entries/${f.id}`)).json()).version,
  ).toBe(2);
  await expect(page.getByLabel("Affected entry")).toBeEnabled();
  await page.screenshot({ path: info.outputPath("phone-recovered.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("loading, candidate empty, failed read and stale correction states are truthful", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await signIn(page);
  const f = await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let held = false;
  await page.route("**/api/v1/identity-corrections", async (route) => {
    if (route.request().method() === "GET" && !held) {
      held = true;
      await gate;
    }
    await route.continue();
  });
  await page.goto("/admin/identity-corrections");
  await expect(page.getByText("Loading correction workspace…")).toBeVisible();
  release();
  await expect(page.getByLabel("Affected entry")).toBeVisible();
  await page.unroute("**/api/v1/identity-corrections");
  await fill(page, f);
  await page
    .getByLabel("Search replacement players")
    .fill("No matching identity 000000000");
  await expect(
    page.getByText("No matching records.", { exact: true }),
  ).toBeVisible();
  const corrected = await page.request.post("/api/v1/identity-corrections", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      requestId: randomUUID(),
      entryId: f.id,
      version: 1,
      fromPlayerId: f.ids[0],
      toPlayerId: "demo-player",
      reason: "Concurrent staff correction",
      source: "Signed original entry source",
    },
  });
  expect(corrected.status()).toBe(200);
  await page
    .getByRole("button", { name: "Record factual correction", exact: true })
    .click();
  await expect(
    page
      .locator("main")
      .getByRole("alert")
      .filter({ hasText: "The reviewed entry is stale" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Record factual correction",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reload current entry", exact: true })
    .click();
  await expect(
    page.getByText(new RegExp(`Reviewing ${f.name}, revision 2`)),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("stale-reloaded.png") });
  await page.route("**/api/v1/identity-corrections", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Current correction records are unavailable",
      }),
    }),
  );
  await page.reload();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Current correction records are unavailable",
  );
  await page.unroute("**/api/v1/identity-corrections");
});
