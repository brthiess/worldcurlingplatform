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
