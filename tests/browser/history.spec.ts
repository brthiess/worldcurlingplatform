import { test, expect } from "@playwright/test";
test("back from a selected draw restores the default draw without waiting for refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Draw", { exact: true })).toHaveValue("draw-2");
  await page.getByLabel("Draw", { exact: true }).selectOption("draw-1");
  await page.goBack();
  await expect(page.getByLabel("Draw", { exact: true })).toHaveValue("draw-2", {
    timeout: 1500,
  });
});
test("upcoming draw link retains division context when opened separately", async ({
  page,
  context,
}) => {
  await page.goto("/events/prairie-2026?division=prairie-men");
  const upcoming = page.getByRole("link", { name: "View upcoming games →" });
  await expect(upcoming).toHaveAttribute(
    "href",
    "?division=prairie-men&draw=draw-3",
  );
  const separateOpened = context.waitForEvent("page");
  await upcoming.click({ modifiers: ["Control"] });
  const separate = await separateOpened;
  await expect(separate.getByLabel("Draw", { exact: true })).toHaveValue(
    "draw-3",
  );
  await expect(
    separate.getByRole("link", {
      name: "Men’s four-player · scores",
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    separate.getByText("Winner of game 2", { exact: true }),
  ).toBeVisible();
  await upcoming.click();
  await expect(page).toHaveURL(/division=prairie-men&draw=draw-3$/);
  await expect(page.getByLabel("Draw", { exact: true })).toHaveValue("draw-3");
});
