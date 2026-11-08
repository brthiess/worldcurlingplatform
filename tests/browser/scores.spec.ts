import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
for (const [name, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${name}: persisted scores, keyboard navigation and complete scorecard`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Prairie Open 2026" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "End 1: 0 points", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "End 1: Score unknown", exact: true }),
    ).toHaveCount(2);
    await expect(
      page.getByText("America/Regina", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByLabel("Draw", { exact: true }).selectOption("draw-1");
    await expect(
      page.getByText("Confirmed result", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "End 7: End not played", exact: true }),
    ).toHaveCount(2);
    await page
      .getByRole("button", { name: "Refresh scores", exact: true })
      .click();
    await expect(page.getByLabel("Draw", { exact: true })).toHaveValue(
      "draw-1",
    );
    await page
      .getByRole("link", { name: "Game details →", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Game details", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("Draw", { exact: true })).toHaveValue(
      "draw-1",
    );
    await page.getByLabel("Draw", { exact: true }).selectOption("draw-2");
    await expect(page.getByRole("table")).toHaveCount(2);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-scores.png`),
      fullPage: true,
    });
    await page.getByLabel("Draw", { exact: true }).selectOption("draw-4");
    await expect(
      page.getByText("No games are scheduled for this draw yet."),
    ).toBeVisible();
    await page.getByLabel("Draw", { exact: true }).selectOption("draw-3");
    await expect(
      page.getByRole("cell", { name: "Upcoming total", exact: true }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("rowheader", {
        name: "Opponent to be assigned",
        exact: true,
      }),
    ).toBeVisible();
  });
}
test("loading, lost connection, recovery and missing event remain honest", async ({
  page,
  context,
}, testInfo) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/v1/public/events/prairie-2026", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByText("Loading stored scores…")).toBeVisible();
  release();
  await expect(page.getByRole("table")).toHaveCount(2);
  await page.unroute("**/api/v1/public/events/prairie-2026");
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Refresh scores", exact: true })
    .click();
  await expect(page.getByText(/Connection interrupted/)).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("stale-scores.png"),
    fullPage: true,
  });
  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText(/Connection interrupted/)).toHaveCount(0);
  await page.goto("/events/no-such-event");
  await expect(
    page.getByText(/This event or game is not available/),
  ).toBeVisible();
});
test("scorekeeper signs in, sees only assigned game, signs out", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/admin");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open game details →" }),
  ).toHaveCount(1);
  await expect(
    page.getByText("Assigned scoring scope", { exact: false }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("phone-scorekeeper.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Demo sign-in" }),
  ).toBeVisible();
});
