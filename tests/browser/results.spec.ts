import {
  test,
  expect,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { randomUUID } from "node:crypto";
import "dotenv/config";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let session: BrowserContext;
test.beforeAll(async ({ browser }) => {
  session = await browser.newContext();
  const r = await session.request.post("/api/auth/sign-in/email", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      email: "scorekeeper@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    },
  });
  expect(r.status()).toBe(200);
});
test.beforeEach(async ({ context }) =>
  context.addCookies(await session.cookies()),
);
test.afterAll(async () => {
  await session.close();
  await pool.end();
});
async function fixture(request: APIRequestContext) {
  const id = `browser-result-${randomUUID()}`;
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,'draw-2','R','Result browser','scheduled','entry-1','entry-3','North','Prairie')",
    [id],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$1)",
    [id],
  );
  for (const [expectedVersion, action, extra] of [
    [0, "start", {}],
    [1, "end", { endNumber: 1, end: { state: "played", a: 2, b: 0 } }],
  ] as const) {
    const r = await request.post(`/api/v1/games/${id}/scoring`, {
      headers: { Origin: process.env.BETTER_AUTH_URL! },
      data: {
        requestId: randomUUID(),
        expectedVersion,
        action,
        hammer: null,
        ...extra,
      },
    });
    expect(r.status()).toBe(200);
  }
  return id;
}
for (const [name, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const)
  test(`${name}: confirm and correct persists without a second approver`, async ({
    page,
  }, info) => {
    const id = await fixture(session.request);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/admin/games/${id}`);
    await expect(
      page.getByRole("button", { name: "Confirm result", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Result winner").selectOption("entry-1");
    await page
      .getByRole("button", { name: "Confirm result", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Final · normal", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Correct confirmed result" })
      .click();
    await page.getByLabel("Result outcome").selectOption("conceded");
    await page.getByLabel("Result winner").selectOption("entry-3");
    await page
      .getByLabel("Result reason")
      .fill("North conceded; winner corrected");
    await page
      .getByRole("button", { name: "Save correction", exact: true })
      .click();
    await expect(
      page.getByText("Corrected final · conceded", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${name}-corrected.png`),
      fullPage: true,
    });
    await page.goto(`/games/${id}`);
    await expect(
      page.getByText("North conceded; winner corrected", { exact: false }),
    ).toBeVisible();
    await page.getByText("Earlier result versions").click();
    await expect(page.getByText(/Version 3 · normal/)).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${name}-public-history.png`),
      fullPage: true,
    });
  });
