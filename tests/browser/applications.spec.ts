import { signInWithRateWindow } from "./auth-fixture";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import { randomUUID } from "node:crypto";
// Two real authentication retry windows can exceed the default 30-second test budget.
test.setTimeout(180000);
for (const [label, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${label}: organizer application, responsible review and public multi-division calendar`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    const networkErrors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (response) => {
      if (response.status() >= 500)
        networkErrors.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText !== "net::ERR_ABORTED")
        networkErrors.push(request.failure()?.errorText ?? request.url());
    });
    await page.goto("/admin");
    await page.getByLabel("Demo persona").selectOption("organizer");
    await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
    await signInWithRateWindow(
      page,
      page.getByRole("button", { name: "Sign in", exact: true }),
    );
    await page
      .getByRole("link", { name: "Event applications", exact: true })
      .click();
    await page
      .getByRole("button", { name: "New edition", exact: true })
      .click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByText("Enter an edition name (1–160 characters)."),
    ).toBeVisible();
    const name = `Browser ${label} Open ${Date.now()}`;
    await page.getByLabel("Edition name", { exact: true }).fill(name);
    await page.getByLabel("Start date", { exact: true }).fill("2027-11-08");
    await page.getByLabel("End date", { exact: true }).fill("2027-11-10");
    await page.getByLabel("City", { exact: true }).fill("Regina");
    await page.getByLabel("Country", { exact: true }).fill("Canada");
    await page.getByLabel("Division 1 name").fill("Men");
    await page
      .getByRole("button", { name: "Add division", exact: true })
      .click();
    await page.getByLabel("Division 2 name").fill("Women");
    await page.getByLabel("Division 2 discipline").selectOption("women_four");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(
      page.getByText("Saved to the database.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Submit for review", exact: true })
      .click();
    await expect(
      page.getByText("Application submitted.", { exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${label}-submitted.png`),
      fullPage: true,
    });
    await page.goto("/admin");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByLabel("Demo persona").selectOption("administrator");
    await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
    await signInWithRateWindow(
      page,
      page.getByRole("button", { name: "Sign in", exact: true }),
    );
    await page
      .getByRole("link", { name: "Event applications", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Review ${name}`, exact: true })
      .click();
    await expect(
      page.getByText("Venue not confirmed", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${label}-review.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Approve onto calendar", exact: true })
      .click();
    await expect(
      page.getByText("Edition admitted to the public calendar.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Registration: closed", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "View public edition", exact: true })
      .click();
    await expect(
      page.getByText("Newly operated event.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Fictional demonstration.", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Divisions", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${label}-edition.png`),
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "Women · scores", exact: true })
      .click();
    await expect(
      page.getByText("Women", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Events", exact: true }).click();
    await page.getByLabel("Search events").fill(name);
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    await page.getByLabel("Discipline").selectOption("women_four");
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${label}-calendar.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
}
test("next-year copy, loading, unsent save retry, stale version recovery and calendar empty states", async ({
  page,
  context,
}, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption("organizer");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/v1/applications", async (route) => {
    if (route.request().method() === "GET") await gate;
    await route.continue();
  });
  await page.goto("/admin/applications");
  await expect(page.getByText("Loading event applications…")).toBeVisible();
  release();
  await page
    .getByRole("button", { name: "Review Prairie Open 2026", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create next year's edition", exact: true })
    .click();
  await expect(page.getByLabel("Start date", { exact: true })).toHaveValue(
    "2027-11-08",
  );
  const name = `Copied next edition ${Date.now()}`;
  await page.getByLabel("Edition name", { exact: true }).fill(name);
  await page.getByLabel("Edition name", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Start date", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Saved to the database.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("City", { exact: true }).fill("Moose Jaw");
  await expect(
    page.getByRole("button", { name: "Submit for review", exact: true }),
  ).toBeDisabled();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry last save", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await page
    .getByRole("button", { name: "Retry last save", exact: true })
    .click();
  await expect(
    page.getByText("Saved to the database.", { exact: true }),
  ).toBeVisible();
  const workspace = await (
    await page.request.get("/api/v1/applications")
  ).json();
  const id = workspace.applications.find(
    (a: { name: string }) => a.name === name,
  ).id;
  const detail = await (
    await page.request.get(`/api/v1/applications/${id}`)
  ).json();
  const otherSave = await page.request.post(`/api/v1/applications/${id}`, {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      requestId: randomUUID(),
      action: "edit",
      version: detail.version,
      application: { ...detail, city: "Yorkton" },
    },
  });
  expect(otherSave.status()).toBe(200);
  await page.getByLabel("City", { exact: true }).fill("Stale city");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText(/This application changed/)).toBeVisible();
  await page
    .getByRole("button", { name: "Reload current version", exact: true })
    .click();
  await expect(page.getByLabel("City", { exact: true })).toHaveValue("Yorkton");
  await page.screenshot({
    path: info.outputPath("phone-next-edition-history.png"),
    fullPage: true,
  });
  const original = await (
    await page.request.get("/api/v1/public/events/prairie-2026")
  ).json();
  expect(original.event.startsOn).toBe("2026-11-08");
  expect(original.event.location).toBe("Regina, Canada");
  await page.goto("/events");
  await page
    .getByLabel("Search events")
    .fill("No event could have this unique name 00000000");
  await expect(
    page.getByText("No admitted editions match these filters."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Prairie Open 2026", exact: true }),
  ).toBeVisible();
  await page.getByLabel("From date").fill("2028-12-31");
  await page.getByLabel("Through date").fill("2027-01-01");
  await expect(
    page.getByText("Through date must be on or after the from date."),
  ).toBeVisible();
});
