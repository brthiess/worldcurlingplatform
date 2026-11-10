import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const [name, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${name}: connected discovery, identity favorites and refresh/back context`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    async function inspect(label: string) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        label,
      ).toBe(true);
      expect(
        (await new AxeBuilder({ page }).analyze()).violations,
        label,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${name}-${label}.png`),
        fullPage: true,
      });
    }
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    page.on("requestfailed", (r) => {
      if (!r.failure()?.errorText.includes("ERR_ABORTED"))
        errors.push(`${r.failure()?.errorText} ${r.url()}`);
    });
    await page.goto("/?event=main-triple-2026");
    await expect(
      page.getByRole("heading", { name: "Main 16-team Triple Knockout 2026" }),
    ).toBeVisible();
    await inspect("home");
    await page
      .getByRole("heading", { name: "Main 16-team Triple Knockout 2026" })
      .getByRole("link")
      .click();
    await page.getByRole("button", { name: "Save event favorite" }).click();
    await inspect("event");
    await page
      .getByRole("link", { name: "Game details →", exact: true })
      .click();
    await inspect("game");
    await page
      .getByRole("rowheader")
      .filter({ hasText: "Fictional T16" })
      .getByRole("link")
      .click();
    await expect(
      page.getByRole("heading", { name: "Regular core", exact: true }),
    ).toBeVisible();
    const teamId = new URL(page.url()).pathname.split("/").pop();
    await page.getByRole("button", { name: "Save team favorite" }).click();
    await expect(
      page.getByRole("heading", { name: "Next known game" }),
    ).toBeVisible();
    await inspect("team");
    await page
      .getByRole("link", { name: "Fictional T16 player 1", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Save player favorite" }).click();
    const playerId = new URL(page.url()).pathname.split("/").pop();
    await expect(
      page.getByRole("heading", { name: "Known teams and event lineups" }),
    ).toBeVisible();
    await inspect("player");
    await page
      .getByRole("link", { name: "Search & favorites", exact: true })
      .click();
    await page.getByLabel("Favorites only").check();
    await expect(
      page.getByRole("link", { name: "Fictional T16", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("link", { name: "Fictional T16 player 1", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("wcp.favorites.v1")!),
      ),
    ).toEqual({
      version: 1,
      items: [
        { kind: "event", id: "main-triple-2026" },
        { kind: "team", id: teamId },
        { kind: "player", id: playerId },
      ],
    });
    await inspect("favorites");
    await page.goto(
      "/events?q=Main&discipline=men_four&from=2026-11-09&to=2026-11-10",
    );
    await expect(page.getByLabel("Search events", { exact: true })).toHaveValue(
      "Main",
    );
    await inspect("calendar");
    await page
      .getByRole("heading", { name: "Main 16-team Triple Knockout 2026" })
      .getByRole("link")
      .click();
    await page
      .getByRole("button", { name: "Refresh scores", exact: true })
      .click();
    await page.reload();
    await expect(page.getByLabel("Draw", { exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("Search events", { exact: true })).toHaveValue(
      "Main",
    );
    await page
      .getByLabel("Search events", { exact: true })
      .fill("no such edition");
    await expect(
      page.getByText("No admitted editions match these filters."),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("favorites handle corrupt, unavailable and blocked browser storage without claiming a save", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("wcp.favorites.v1", "{broken"),
  );
  await page.goto("/search?favorites=1");
  await expect(
    page.getByText("No saved favorites match this search."),
  ).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem(
      "wcp.favorites.v1",
      '{"version":1,"items":[{"kind":"team","id":"missing-core"}]}',
    );
    window.dispatchEvent(new Event("storage"));
  });
  await expect(
    page.getByText(/Saved team record unavailable · missing-core/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove unavailable favorite" })
    .click();
  await expect(page.getByText(/Saved team record unavailable/)).toHaveCount(0);
  await page.goto("/events/main-triple-2026");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Fixture quota", "QuotaExceededError");
    };
  });
  const save = page.getByRole("button", { name: "Save event favorite" });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText(/Browser storage is unavailable/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save event favorite" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("blocked storage reads leave public pages usable", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Fixture denied", "SecurityError");
    };
  });
  await page.goto("/events/main-triple-2026");
  await expect(
    page.getByRole("heading", { name: "Main 16-team Triple Knockout 2026" }),
  ).toBeVisible();
  await expect(page.getByText(/Browser storage is unavailable/)).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});

test("search shows loading, failed request, retry and retained stale records", async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let fail = true;
  await page.route("**/api/v1/public/calendar", async (route) => {
    await gate;
    if (fail)
      await route.fulfill({
        status: 503,
        body: '{"error":"Fixture unavailable"}',
        contentType: "application/json",
      });
    else await route.continue();
  });
  await page.goto("/search?q=Main&kind=event");
  await expect(page.getByText("Loading public records…")).toBeVisible();
  release();
  await expect(
    page.getByText(/Search records could not be refreshed/),
  ).toBeVisible();
  await expect(
    page.getByText("No public records match this search."),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry search" }).click();
  await expect(
    page.getByRole("link", {
      name: "Main 16-team Triple Knockout 2026",
      exact: true,
    }),
  ).toBeVisible();
  fail = true;
  await page.getByRole("button", { name: "Refresh search" }).click();
  await expect(page.getByText(/Showing last loaded records/)).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Main 16-team Triple Knockout 2026",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Search events, teams and players")).toHaveValue(
    "Main",
  );
  fail = false;
  await page.getByRole("button", { name: "Retry search" }).click();
  await expect(page.getByText(/Showing last loaded records/)).toHaveCount(0);
  await page.unroute("**/api/v1/public/calendar");
});

test("calendar polling retains focused filters and stale data; date errors remain explicit", async ({
  page,
}) => {
  test.setTimeout(45000);
  let fail = false,
    requests = 0;
  await page.route("**/api/v1/public/calendar", async (route) => {
    requests++;
    if (fail)
      await route.fulfill({
        status: 503,
        body: "{}",
        contentType: "application/json",
      });
    else await route.continue();
  });
  await page.goto(
    "/events?q=Main&division=main-triple-sixteen&discipline=men_four&location=Regina%2C+Canada&from=2026-11-09&to=2026-11-10",
  );
  await expect(
    page.getByRole("heading", { name: "Main 16-team Triple Knockout 2026" }),
  ).toBeVisible();
  const query = page.getByLabel("Search events", { exact: true });
  await query.focus();
  const before = requests;
  await expect.poll(() => requests, { timeout: 12000 }).toBeGreaterThan(before);
  await expect(query).toBeFocused();
  await expect(query).toHaveValue("Main");
  await expect(page.getByLabel("Division", { exact: true })).toHaveValue(
    "main-triple-sixteen",
  );
  fail = true;
  await page.getByRole("button", { name: "Refresh calendar" }).click();
  await expect(page.getByText("Stale calendar", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Main 16-team Triple Knockout 2026" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Stale calendar", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Through date").fill("2026-11-01");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Through date must be on or after the from date.",
  );
  await page.unroute("**/api/v1/public/calendar");
});

test("activity distinguishes loading, failure, retry and last loaded history", async ({
  page,
  request,
}) => {
  test.setTimeout(45000);
  const entry = await (
    await request.get("/api/v1/public/entries/main-triple-entry-16")
  ).json();
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let fail = true;
  await page.route("**/api/v1/public/activity?**", async (route) => {
    await gate;
    if (fail)
      await route.fulfill({
        status: 503,
        body: "{}",
        contentType: "application/json",
      });
    else await route.continue();
  });
  await page.goto(`/teams/${entry.teamId}`);
  await expect(page.getByText("Loading known activity…")).toBeVisible();
  release();
  await expect(
    page.getByText(/Known activity could not be refreshed/),
  ).toBeVisible();
  await expect(
    page.getByText("No public games recorded for this core identity."),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry activity" }).click();
  await expect(
    page.getByRole("heading", { name: "Next known game" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fictional T16 vs Fictional T05" }).first(),
  ).toBeVisible();
  fail = true;
  await expect(page.getByText(/Showing last loaded activity/)).toBeVisible({
    timeout: 12000,
  });
  await expect(
    page.getByRole("link", { name: "Fictional T16 vs Fictional T05" }).first(),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry activity" }).click();
  await expect(page.getByText(/Showing last loaded activity/)).toHaveCount(0);
  await page.unroute("**/api/v1/public/activity?**");
});

test("a full favorite list explains why another identity cannot be saved", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "wcp.favorites.v1",
      JSON.stringify({
        version: 1,
        items: Array.from({ length: 500 }, (_, i) => ({
          kind: "team",
          id: `saved-core-${i}`,
        })),
      }),
    );
  });
  await page.goto("/events/main-triple-2026");
  await page.getByRole("button", { name: "Save event favorite" }).click();
  await expect(
    page.getByText(
      "This browser already has 500 favorites. Remove one before saving another.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save event favorite" }),
  ).toHaveAttribute("aria-pressed", "false");
});
