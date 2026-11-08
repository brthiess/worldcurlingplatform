import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { signInApiWithRateWindow } from "./auth-fixture";
import {
  registrationDrawFixture,
  configuredDrawTerms,
} from "../registration-draw-fixture";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});
const fixtures: Awaited<ReturnType<typeof registrationDrawFixture>>[] = [];
test.afterAll(async () => {
  for (const f of fixtures) await f.cleanup();
  await pool.end();
});
const base = process.env.BETTER_AUTH_URL!;
async function fixture(
  request: APIRequestContext,
  count = 6,
  format = "single_knockout",
) {
  expect(
    (
      await signInApiWithRateWindow(
        request,
        "organizer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
  const f = await registrationDrawFixture(pool, count);
  fixtures.push(f);
  expect(
    (
      await request.post("/api/v1/registration", {
        headers: { Origin: base },
        data: {
          action: "open",
          divisionId: f.id,
          version: 0,
          requestId: randomUUID(),
          terms: {
            ...configuredDrawTerms,
            format,
            ...(format === "triple_knockout"
              ? {
                  formatNotes:
                    "Triple-knockout qualification followed by fixed playoffs",
                }
              : {}),
          },
        },
      })
    ).status(),
  ).toBe(200);
  for (const entryId of f.entries)
    expect(
      (
        await request.post("/api/v1/registration", {
          headers: { Origin: base },
          data: {
            action: "request",
            divisionId: f.id,
            entryId,
            version: 0,
            requestId: randomUUID(),
          },
        })
      ).status(),
    ).toBe(200);
  return f;
}
async function select(page: Page, ids: string[]) {
  await page
    .getByLabel("Field size", { exact: true })
    .selectOption(String(ids.length));
  for (const [i, id] of ids.entries())
    await page.getByLabel(`Seed ${i + 1}`, { exact: true }).selectOption(id);
  await page
    .getByLabel("Revision reason", { exact: true })
    .fill("Review complete configured accepted field");
}
for (const [device, width, height, count] of [
  ["phone", 360, 900, 6],
  ["tablet", 768, 1024, 6],
  ["desktop", 1440, 1000, 8],
] as const) {
  test(`${device}: complete accepted ${count}-entry field publishes below capacity16`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const f = await fixture(page.request, count);
    const rejected = randomUUID();
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name,entry_admission) VALUES($1,$2,'Pending place is excluded','organizer_recorded')",
      [rejected, f.id],
    );
    const errors: string[] = [],
      network: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 500) network.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(`/admin/draws?division=${f.id}`);
    await expect(page.getByLabel("Seed 1", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("Seed 1", { exact: true }).getByRole("option", {
        name: "Pending place is excluded",
        exact: true,
      }),
    ).toHaveCount(0);
    await select(page, f.entries);
    await page.getByLabel("Seed 1", { exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Seed 2", { exact: true })).toBeFocused();
    await page
      .getByRole("button", { name: "Save preview", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved preview revision 1.",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByLabel("Publication reason", { exact: true })
      .fill("Publish complete accepted registration field");
    await page
      .getByRole("button", { name: "Publish reviewed draw", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved published revision 2.",
    );
    await page
      .getByRole("link", {
        name: "Open public bracket and game list →",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Single knockout bracket",
        exact: true,
      }),
    ).toBeVisible();
    if (device === "phone") {
      await page
        .getByRole("button", { name: "Game list", exact: true })
        .click();
      await expect(page.getByRole("article")).toHaveCount(5);
    }
    await page.screenshot({
      path: `docs/verification/assets/WCP-009/${device}-configured-draw.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
    expect(network).toEqual([]);
  });
}
test("configured omitted peers and incompatible registered family produce actionable preparation errors", async ({
  page,
}) => {
  test.setTimeout(120000);
  const f = await fixture(page.request, 8);
  await page.goto(`/admin/draws?division=${f.id}`);
  await select(page, f.entries.slice(0, 6));
  await page.getByRole("button", { name: "Save preview", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "complete current accepted field",
  );
  await select(page, f.entries);
  await page.getByRole("button", { name: "Save preview", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved preview revision 1.",
  );
  const mismatch = await fixture(page.request, 6, "triple_knockout");
  await page.goto(`/admin/draws?division=${mismatch.id}`);
  await select(page, mismatch.entries);
  await page.getByRole("button", { name: "Save preview", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "registered format family",
  );
  await expect(page.getByText(/Revision 0 · empty/)).toBeVisible();
});
test("publication rechecks admission-only changes and a newly accepted peer without rewriting the preview", async ({
  page,
}) => {
  test.setTimeout(120000);
  const f = await fixture(page.request);
  await page.goto(`/admin/draws?division=${f.id}`);
  await select(page, f.entries);
  await page.getByRole("button", { name: "Save preview", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved preview revision 1.",
  );
  await pool.query(
    "UPDATE event_entry SET admission_state='pending',admission_version=admission_version+1 WHERE id=$1",
    [f.entries[0]],
  );
  await page
    .getByLabel("Publication reason", { exact: true })
    .fill("Stale admission publication must fail");
  await page
    .getByRole("button", { name: "Publish reviewed draw", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "field admission changed",
  );
  await expect(
    page.getByText(/^Revision 1 · preview\. Template/),
  ).toBeVisible();
  await pool.query(
    "UPDATE event_entry SET admission_state='accepted',admission_version=admission_version+1 WHERE id=$1",
    [f.entries[0]],
  );
  await page
    .getByRole("button", { name: "Reload accepted draw", exact: true })
    .click();
  const extra = randomUUID();
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,'Newly accepted after preview')",
    [extra, f.id],
  );
  expect(
    (
      await page.request.post("/api/v1/registration", {
        headers: { Origin: base },
        data: {
          action: "request",
          divisionId: f.id,
          entryId: extra,
          version: 0,
          requestId: randomUUID(),
        },
      })
    ).status(),
  ).toBe(200);
  await page
    .getByLabel("Publication reason", { exact: true })
    .fill("New accepted peer must not be omitted");
  await page
    .getByRole("button", { name: "Publish reviewed draw", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "complete current accepted field",
  );
  await expect(
    page.getByText(/^Revision 1 · preview\. Template/),
  ).toBeVisible();
});
