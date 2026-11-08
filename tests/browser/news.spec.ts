import { test, expect } from "@playwright/test";
import { signInWithRateWindow } from "./auth-fixture";
import { mkdir } from "node:fs/promises";
test("news public empty state and administrator source workflow", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.route("**/api/v1/public/news", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [],
        sources: [],
        refreshedAt: "2026-11-08T12:00:00Z",
      }),
    }),
  );
  await page.goto("/news");
  await expect(
    page.getByRole("heading", { name: "Curling news", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No news available yet" }),
  ).toBeVisible();
  await mkdir("docs/verification/assets/WCP-044", { recursive: true });
  await page.screenshot({
    path: "docs/verification/assets/WCP-044/controlled-empty-state.png",
  });
  await page.unroute("**/api/v1/public/news");
  await page.goto("/admin/news");
  await expect(page.getByText("Sign in required.")).toBeVisible();
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
  await page.goto("/admin/news");
  await expect(
    page.getByRole("heading", { name: "News sources", exact: true }),
  ).toBeVisible();
  const publisher = "Browser source " + Date.now();
  await page.getByLabel("Publisher").fill(publisher);
  await page
    .getByLabel("Feed URL")
    .fill("https://publisher.example/browser-" + Date.now());
  await page
    .getByLabel("Approval reason")
    .fill("Controlled browser approval fixture");
  await page.getByRole("button", { name: "Add approved source" }).click();
  const source = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: publisher, exact: true }),
  });
  await expect(source).toBeVisible();
  await expect(
    source.getByText("Never fetched", { exact: false }),
  ).toBeVisible();
  await source
    .getByLabel("Change reason")
    .fill("Suspend browser fixture source");
  await source.getByRole("button", { name: "Suspend source" }).click();
  await expect(source.getByText("Suspended", { exact: true })).toBeVisible();
});
