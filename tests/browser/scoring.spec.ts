import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
test("phone scorekeeper corrects an end and public refresh retains selected draw", async ({
  page,
  context,
}, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/admin");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Enter live scores →" }).click();
  await expect(
    page.getByRole("heading", { name: "Team North vs Team Prairie" }),
  ).toBeVisible();
  await expect(page.getByLabel("Team North points")).toHaveValue("0");
  await expect(page.getByLabel("Team Prairie points")).toHaveValue("1");
  await page.getByLabel("End", { exact: true }).selectOption("5");
  await page.getByLabel("Team North points").fill("3");
  await page.getByLabel("Team Prairie points").fill("0");
  await expect(page.getByText("Unsent edit", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Save end", exact: true }).click();
  await expect(page.getByText(/Saved · version/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("phone-scoring-saved.png"),
    fullPage: true,
  });
  const fan = await context.newPage();
  await fan.goto("/?draw=draw-2");
  await expect(
    fan
      .getByRole("table")
      .first()
      .getByRole("cell", { name: "End 5: 3 points", exact: true }),
  ).toBeVisible();
  await fan
    .getByRole("button", { name: "Refresh scores", exact: true })
    .click();
  await expect(fan.getByLabel("Draw", { exact: true })).toHaveValue("draw-2");
  await fan.goto("/games/game-2");
  await expect(
    fan.getByRole("cell", { name: "End 5: 3 points", exact: true }),
  ).toBeVisible();
});
