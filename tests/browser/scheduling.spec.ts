import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import { signInApiWithRateWindow } from "./auth-fixture";
import { randomUUID } from "node:crypto";
import pg from "pg";
test.use({ timezoneId: "Asia/Tokyo" });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());
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
    await page.goto("/admin/schedule?event=prairie-2026");
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

test("organizer recovery, keyboard assignment/conflicts, empty state and accepted-save retry", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 360, height: 800 });
  const eventId = randomUUID(),
    divisionId = randomUUID(),
    drawId = randomUUID(),
    gameId = randomUUID(),
    otherGame = randomUUID();
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES($1,'prairie','Browser scheduling','Acceptance venue','Regina','America/Regina','2026-11-08','2026-11-10','fictional_demo',true,'approved')",
    [eventId],
  );
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Browser four-player','men_four','Existing games')",
    [divisionId, eventId],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-organizer','organizer',$2)",
    [randomUUID(), eventId],
  );
  expect(
    (
      await signInApiWithRateWindow(
        page.request,
        "organizer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/api/v1/events/${eventId}/schedule`, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`/admin/schedule?event=${eventId}`);
  await expect(page.getByText("Loading stored schedule…")).toBeVisible();
  release();
  await expect(page.getByText("No sessions scheduled yet.")).toBeVisible();
  await expect(
    page.getByText(
      "No existing games in this edition. Games are prepared separately.",
    ),
  ).toBeVisible();
  await page.unroute(`**/api/v1/events/${eventId}/schedule`);
  await pool.query(
    "INSERT INTO draw_session(id,division_id,number,starts_at,state) VALUES($1,$2,1,'2026-11-08T15:00:00Z','scheduled')",
    [drawId, divisionId],
  );
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,slot_a,slot_b) VALUES($1,$3,'A','Browser assignment','scheduled','Phone side A','Phone side B'),($2,$3,'B','Browser conflict','scheduled','Other side A','Other side B')",
    [gameId, otherGame, drawId],
  );
  await page.getByRole("button", { name: "Reload accepted schedule" }).click();
  await expect(page.getByLabel("Game", { exact: true })).toBeVisible();
  await page.getByLabel("Game", { exact: true }).selectOption(gameId);
  await page.getByLabel("Sheet", { exact: true }).fill("B");
  await page.locator("#assignment-reason").fill("Phone reassignment");
  await expect(page.getByRole("status")).toHaveText("Unsaved schedule edit.");
  await page.getByRole("button", { name: "Save game assignment" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(
    "Saved schedule revision 1",
  );
  await expect(page.getByRole("status")).toContainText("1 known conflict");
  await expect(page.getByText("Sheet B", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("phone-known-conflict.png"),
    fullPage: true,
  });
  await page.getByLabel("Draw number").fill("2");
  await page.getByLabel("Venue date and time").fill("2026-11-09T09:00");
  await page.getByLabel("UTC offset").fill("-06:00");
  await page.locator("#session-reason").fill("Lost acknowledgement");
  // Genuine server acceptance with lost response: retry must replay the same receipt.
  let dropped = false;
  await page.route(`**/api/v1/events/${eventId}/schedule`, async (route) => {
    if (route.request().method() === "POST" && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByRole("button", { name: "Retry same save" }),
  ).toBeVisible();
  await expect(page.getByLabel("Draw number")).toBeDisabled();
  await page.getByRole("button", { name: "Retry same save" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Saved schedule revision 2",
  );
  await page.unroute(`**/api/v1/events/${eventId}/schedule`);
  const accepted = await (
    await page.request.get(`/api/v1/events/${eventId}/schedule`)
  ).json();
  expect(accepted.history).toHaveLength(2);
  // A separate operator wins before this form submits: this form must show a real 409.
  const external = await page.request.post(
    `/api/v1/events/${eventId}/schedule`,
    {
      headers: { Origin: process.env.BETTER_AUTH_URL! },
      data: {
        requestId: randomUUID(),
        expectedVersion: 2,
        reason: "Other organizer",
        action: "assign",
        gameId,
        drawId,
        sheet: "C",
      },
    },
  );
  expect(external.status()).toBe(200);
  await page.getByLabel("Draw number").fill("3");
  await page.getByLabel("Venue date and time").fill("2026-11-09T12:00");
  await page.getByLabel("UTC offset").fill("-06:00");
  await page.locator("#session-reason").fill("Stale edit");
  await page.getByRole("button", { name: "Save session" }).click();
  await expect(
    page.getByText(
      "Your edit was not applied. Reload the accepted schedule before editing.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Draw number")).toBeDisabled();
  await page.getByRole("button", { name: "Reload accepted schedule" }).click();
  await expect(page.getByLabel("Draw number")).toBeEnabled();
  await page.route(`**/api/v1/events/${eventId}/schedule`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Acceptance outage" }),
    }),
  );
  await page.getByRole("button", { name: "Reload accepted schedule" }).click();
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "Showing the last accepted schedule.",
  );
  await page.screenshot({
    path: testInfo.outputPath("phone-stale-schedule.png"),
    fullPage: true,
  });
  await page.unroute(`**/api/v1/events/${eventId}/schedule`);
  await page.getByRole("button", { name: "Reload accepted schedule" }).click();
  await expect(page.locator('.error[role="alert"]')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
