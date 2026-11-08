import "dotenv/config";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import { pool } from "../../src/db";
test("player photo upload, review comparison, rejection and exact-image publication work across responsive layouts", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const key = crypto.randomUUID(),
    playerId = "browser-photo-" + key,
    userId = "photo-owner-" + key,
    email = userId + "@example.invalid";
  await pool.query(
    "INSERT INTO player(id,name,origin) VALUES($1,'Geometric fixture · synthetic demo','fictional_demo')",
    [playerId],
  );
  await pool.query(
    "INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,'Synthetic photo owner',$2,true)",
    [userId, email],
  );
  await pool.query(
    "INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now())",
    [
      crypto.randomUUID(),
      userId,
      await hashPassword(process.env.DEMO_PASSWORD!),
    ],
  );
  await pool.query(
    "INSERT INTO player_account_link(player_id,user_id) VALUES($1,$2)",
    [playerId, userId],
  );
  const errors: string[] = [],
    failures: number[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 500) failures.push(r.status());
  });
  await page.goto("/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("Replacement photo")).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByLabel("Replacement photo").focus();
  await expect(page.getByLabel("Replacement photo")).toBeFocused();
  const cyan = await sharp({
    create: { width: 256, height: 256, channels: 3, background: "#008c99" },
  })
    .png()
    .toBuffer();
  const orange = await sharp({
    create: { width: 256, height: 192, channels: 3, background: "#f5af36" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Replacement photo")
    .setInputFiles({
      name: "synthetic-cyan.png",
      mimeType: "image/png",
      buffer: cyan,
    });
  await expect(page.getByAltText("Selected replacement photo")).toBeVisible();
  await page.route(
    "**/api/v1/players/" + playerId + "/photos",
    (route) => route.abort(),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Submit photo for review" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "could not be confirmed",
  );
  await page.getByRole("button", { name: "Submit photo for review" }).click();
  await expect(
    page.getByText("Photo submitted privately. Awaiting review."),
  ).toBeVisible();
  await expect(page.getByLabel("Replacement photo")).toBeDisabled();
  const adminContext = await browser.newContext();
  const review = await adminContext.newPage();
  review.on("pageerror", (e) => errors.push(e.message));
  await review.goto(process.env.BETTER_AUTH_URL! + "/admin");
  await review.getByLabel("Demo persona").selectOption("administrator");
  await review.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await review.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(review.getByText("Signed in as")).toBeVisible();
  await review.goto(process.env.BETTER_AUTH_URL! + "/account/profile");
  const pending = () =>
    review
      .locator(".photo-card")
      .filter({ hasText: "Geometric fixture · synthetic demo" })
      .filter({ hasText: "Pending" });
  await pending()
    .getByLabel("Photo review reason")
    .fill("Synthetic geometric fixture approved for local browser acceptance.");
  await pending()
    .getByRole("button", { name: "Record photo decision" })
    .click();
  await expect(pending()).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh photo status" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(process.env.BETTER_AUTH_URL! + "/players/" + playerId);
  const publicPhoto = publicPage.getByAltText(
    "Approved photo of Geometric fixture · synthetic demo",
  );
  await expect(publicPhoto).toBeVisible();
  const initial = await publicPhoto.getAttribute("src");
  await page
    .getByLabel("Replacement photo")
    .setInputFiles({
      name: "synthetic-orange.png",
      mimeType: "image/png",
      buffer: orange,
    });
  await page.getByRole("button", { name: "Submit photo for review" }).click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await publicPage.reload();
  await expect(publicPhoto).toHaveAttribute("src", initial!);
  await review.getByRole("button", { name: "Refresh photo status" }).click();
  await pending()
    .getByLabel("Photo review reason")
    .fill("Please submit a different synthetic geometric fixture.");
  await pending().getByLabel("Photo decision").selectOption("rejected");
  await pending()
    .getByRole("button", { name: "Record photo decision" })
    .click();
  await expect(pending()).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh photo status" }).click();
  await expect(
    page.getByText("Please submit a different synthetic geometric fixture."),
  ).toBeVisible();
  await publicPage.reload();
  await expect(publicPhoto).toHaveAttribute("src", initial!);
  await page
    .getByLabel("Replacement photo")
    .setInputFiles({
      name: "synthetic-orange-v2.png",
      mimeType: "image/png",
      buffer: orange,
    });
  await page.getByRole("button", { name: "Submit photo for review" }).click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();
  await review.getByRole("button", { name: "Refresh photo status" }).click();
  await mkdir("docs/verification/assets/WCP-013", { recursive: true });
  for (const [label, width, height] of [
    ["phone", 360, 800],
    ["tablet", 768, 1024],
    ["desktop", 1440, 1000],
  ] as const) {
    await review.setViewportSize({ width, height });
    await pending().scrollIntoViewIfNeeded();
    expect(
      await review.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page: review }).analyze()).violations,
    ).toEqual([]);
    await pending().screenshot({
      path: `docs/verification/assets/WCP-013/${label}-synthetic-comparison.png`,
    });
  }
  await pending()
    .getByLabel("Photo review reason")
    .fill("Exact processed synthetic orange image reviewed and approved.");
  await pending()
    .getByRole("button", { name: "Record photo decision" })
    .click();
  await expect(pending()).toHaveCount(0);
  await publicPage.reload();
  await expect(publicPhoto).not.toHaveAttribute("src", initial!);
  for (const [label, width, height] of [
    ["phone", 360, 800],
    ["tablet", 768, 1024],
    ["desktop", 1440, 1000],
  ] as const) {
    await publicPage.setViewportSize({ width, height });
    expect(
      (await new AxeBuilder({ page: publicPage }).analyze()).violations,
    ).toEqual([]);
    await publicPage.screenshot({
      path: `docs/verification/assets/WCP-013/${label}-synthetic-public.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  await adminContext.close();
  await publicContext.close();
});
test.afterAll(async () => {
  await pool.end();
});
