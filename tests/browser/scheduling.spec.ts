import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import { signInApiWithRateWindow } from "./auth-fixture";
for (const [name, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${name}: organizer revises venue time and fans navigate the persisted schedule`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const login = await signInApiWithRateWindow(
      page.request,
      "organizer@demo.invalid",
      process.env.DEMO_PASSWORD,
    );
    expect(login.status()).toBe(200);
    await page.goto("/admin/schedule");
    await expect(
      page.getByRole("heading", { name: "Draw scheduling", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Venue date and time")).toBeVisible();
    const current = await (
      await page.request.get("/api/v1/events/prairie-2026/schedule")
    ).json();
    await page
      .getByLabel("Draw number")
      .fill(
        String(
          Math.max(
            ...current.draws
              .filter((d: any) => d.divisionId === "prairie-men")
              .map((d: any) => d.number),
          ) + 1,
        ),
      );
    await page.getByLabel("Venue date and time").fill("2026-11-10T09:30");
    await page.getByLabel("UTC offset").fill("-06:00");
    await page.getByLabel("Duration in minutes").fill("90");
    await page
      .getByLabel("Revision reason")
      .first()
      .fill(`Browser ${name} session`);
    await page.getByRole("button", { name: "Save session" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /Saved schedule revision/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-schedule.png`),
      fullPage: true,
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Previous draw", exact: true })
      .click();
    await expect(page.getByLabel("Draw", { exact: true })).toHaveValue(
      "draw-1",
    );
    await page.getByRole("button", { name: "Next draw", exact: true }).click();
    await expect(page.getByLabel("Draw", { exact: true })).toHaveValue(
      "draw-2",
    );
    await page.getByRole("button", { name: "Show schedule" }).click();
    await expect(
      page.getByRole("heading", { name: "Draw schedule", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("America/Regina", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${name}-public-schedule.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
}
