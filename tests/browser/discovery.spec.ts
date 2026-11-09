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
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/?event=main-triple-2026");
    await expect(
      page.getByRole("heading", { name: "Main 16-team Triple Knockout 2026" }),
    ).toBeVisible();
    await page
      .getByRole("heading", { name: "Main 16-team Triple Knockout 2026" })
      .getByRole("link")
      .click();
    await page.getByRole("button", { name: "Save event favorite" }).click();
    await page
      .getByRole("link", { name: "Game details →", exact: true })
      .click();
    await page
      .getByRole("rowheader")
      .filter({ hasText: "Fictional T16" })
      .getByRole("link")
      .click();
    await expect(
      page.getByRole("heading", { name: "Regular core", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save team favorite" }).click();
    await expect(
      page.getByRole("heading", { name: "Next known game" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Fictional T16 player 1", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Save player favorite" }).click();
    await expect(
      page.getByRole("heading", { name: "Known teams and event lineups" }),
    ).toBeVisible();
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
    await page.screenshot({
      path: info.outputPath(`${name}-favorites.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.goto(
      "/events?q=Main&discipline=men_four&from=2026-11-09&to=2026-11-10",
    );
    await expect(page.getByLabel("Search events", { exact: true })).toHaveValue(
      "Main",
    );
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
