import { signInWithRateWindow } from "./auth-fixture";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { pool } from "../../src/db";
import "dotenv/config";
async function mail(email: string, kind: string) {
  const files = (await readdir(".runtime/mail")).sort().reverse();
  for (const file of files) {
    const message = JSON.parse(await readFile(".runtime/mail/" + file, "utf8"));
    if (message.to === email && message.kind === kind)
      return message.url as string;
  }
  throw new Error("Expected private local email");
}
test("visitor verifies an account, receives staff approval, edits a persistent profile and recovers access", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const key = crypto.randomUUID(),
    playerId = "browser-player-" + key,
    email = "browser-" + key + "@example.invalid",
    password = "Browser-" + crypto.randomUUID(),
    name = "Taylor Demo " + key.slice(0, 6);
  await pool.query(
    "INSERT INTO player(id,name,origin) VALUES($1,$2,'fictional_demo')",
    [playerId, name],
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const failures: number[] = [];
  page.on("response", (r) => {
    if (r.status() >= 500) failures.push(r.status());
  });
  await page.goto("/account");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Account display name").fill("Local browser claimant");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("verification email");
  await page.goto(await mail(email, "verification"));
  await expect(page.getByRole("status")).toContainText("Email verified");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }).last(),
  );
  await expect(
    page.getByRole("heading", { name: "Claims and profile", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No claims to show.")).toBeVisible();
  await page.getByLabel("Player", { exact: true }).selectOption(playerId);
  await page
    .getByLabel("Your connection to this player")
    .fill("Local browser evidence " + key);
  await page.getByRole("button", { name: "Request player link" }).click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toHaveCount(0);
  const admin = await browser.newContext();
  const review = await admin.newPage();
  await review.goto(process.env.BETTER_AUTH_URL! + "/admin");
  await review.getByLabel("Demo persona").selectOption("administrator");
  await review.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    review,
    review.getByRole("button", { name: "Sign in", exact: true }),
  );
  await expect(review.getByText("Signed in as")).toBeVisible();
  await review.goto(process.env.BETTER_AUTH_URL! + "/account/profile");
  const card = review
    .getByRole("listitem")
    .filter({ hasText: "Local browser evidence " + key });
  await card
    .getByLabel("Review reason")
    .fill("Identity reviewed for this fictional local demonstration.");
  await card.getByRole("button", { name: "Approve claim" }).click();
  await expect(card.getByText("Approved", { exact: true })).toBeVisible();
  await admin.close();
  await page.getByRole("button", { name: "Refresh current status" }).click();
  await expect(page.getByLabel("Short biography")).toBeVisible();
  await page
    .getByLabel("Short biography")
    .fill("A fictional profile used to verify player-controlled text.");
  await page.getByLabel("Handedness", { exact: true }).selectOption("right");
  await page.route(
    "**/api/v1/players/" + playerId + "/profile",
    (route) => route.abort(),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Save could not be confirmed",
  );
  await expect(page.getByLabel("Short biography")).toHaveValue(
    "A fictional profile used to verify player-controlled text.",
  );
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved and published");
  await page.reload();
  await expect(page.getByLabel("Short biography")).toHaveValue(
    "A fictional profile used to verify player-controlled text.",
  );
  await page.getByRole("link", { name: "View public profile" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Right", { exact: true })).toBeVisible();
  await mkdir("docs/verification/assets/WCP-012", { recursive: true });
  for (const [label, width, height] of [
    ["phone", 360, 800],
    ["tablet", 768, 1024],
    ["desktop", 1440, 1000],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `docs/verification/assets/WCP-012/${label}-public-player.png`,
      fullPage: true,
    });
  }
  await page.goto("/account");
  await page.getByRole("button", { name: "Forgot password" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("status")).toContainText("link has been sent");
  await page.goto(await mail(email, "recovery"));
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/account\/reset$/);
  const nextPassword = "Recovered-" + crypto.randomUUID();
  await page.getByLabel("New password", { exact: true }).fill(nextPassword);
  await page.getByLabel("Repeat new password").fill(nextPassword);
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  await page.goto("/account/profile");
  await expect(page.getByText("to request a player link.")).toBeVisible();
  await page.goto("/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(nextPassword);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }).last(),
  );
  await expect(page.getByLabel("Short biography")).toHaveValue(
    "A fictional profile used to verify player-controlled text.",
  );
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
});
test("account forms have keyboard access and mobile layouts; failed reads offer recovery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/account");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/verification/assets/WCP-012/phone-registration.png",
    fullPage: true,
  });
  await page.route("**/api/v1/public/players/demo-player", (route) =>
    route.abort(),
  );
  await page.goto("/players/demo-player");
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.unroute("**/api/v1/public/players/demo-player");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Alex Demo", exact: true }),
  ).toBeVisible();
});
test.afterAll(async () => {
  await pool.end();
});
