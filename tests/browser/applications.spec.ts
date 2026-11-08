import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
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
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/admin");
    await page.getByLabel("Demo persona").selectOption("organizer");
    await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("link", { name: "Event applications", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Review ${name}`, exact: true })
      .click();
    await expect(
      page.getByText("Venue not confirmed", { exact: true }),
    ).toBeVisible();
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
  });
}
