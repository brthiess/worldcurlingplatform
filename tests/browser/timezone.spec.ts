import { test, expect } from "@playwright/test";
test.use({ timezoneId: "Asia/Tokyo" });
test("last successful refresh uses the explicit venue clock even in a Tokyo browser", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-08T19:00:00Z"));
  await page.goto("/");
  await expect(page.getByText(/^Updated /)).toContainText(
    "Nov 8, 1:00 p.m. CST",
  );
});
