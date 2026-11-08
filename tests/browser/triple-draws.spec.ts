import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { drawFixtureEvent } from "../draws-fixture";
import { configuredDrawTerms } from "../registration-draw-fixture";
import { tripleResults } from "../triple-draws-fixture";
import { signInApiWithRateWindow } from "./auth-fixture";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let event: Awaited<ReturnType<typeof drawFixtureEvent>>;
test.beforeAll(async () => {
  event = await drawFixtureEvent(pool);
});
test.afterAll(async () => {
  if (event) await event.cleanup();
  await pool.end();
});
test.use({ timezoneId: "Asia/Tokyo" });
for (const [device, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${device}: publish main profile and follow T16 from A through B and C to champion`, async ({
    page,
  }, info) => {
    test.setTimeout(240000);
    page.setDefaultTimeout(15000);
    await page.setViewportSize({ width, height });
    const id = "btko-" + randomUUID(),
      entries: string[] = [],
      errors: string[] = [],
      consoleErrors: string[] = [],
      networkErrors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 500) networkErrors.push(r.status() + " " + r.url());
    });
    await pool.query(
      "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Main triple browser','men_four','triple knockout')",
      [id, event.id],
    );
    for (let n = 1; n <= 16; n++) {
      const entry = id + "-" + n;
      entries.push(entry);
      await pool.query(
        "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
        [entry, id, "Fictional T" + String(n).padStart(2, "0")],
      );
    }
    expect(
      (
        await signInApiWithRateWindow(
          page.request,
          "organizer@demo.invalid",
          process.env.DEMO_PASSWORD,
        )
      ).status(),
    ).toBe(200);
    await page.goto("/admin/draws?division=" + id);
    await page
      .getByLabel("Competition profile", { exact: true })
      .selectOption("application-tko16-q8-233-v1");
    for (let n = 1; n <= 16; n++)
      await page
        .getByLabel("Seed " + n, { exact: true })
        .selectOption(entries[n - 1]);
    await page
      .getByLabel("Revision reason", { exact: true })
      .fill("Review the adopted sixteen-team profile");
    await page
      .getByRole("button", { name: "Save preview", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved preview revision 1.",
    );
    await expect(
      page.getByRole("region", { name: "Saved draw preview" }),
    ).toContainText("QC2");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByLabel("Publication reason")
      .fill("Publish exact reviewed routes");
    await page
      .getByRole("button", { name: "Publish reviewed draw", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved published revision 2.",
    );
    await page
      .getByRole("link", { name: "Open public bracket and game list →" })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Triple knockout bracket",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByLabel("Follow a team").selectOption(entries[15]);
    await expect(
      page.getByRole("link", { name: /Next known assignment: A01/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Game list", exact: true }).click();
    const read = async () =>
      await (
        await page.request.get("/api/v1/public/divisions/" + id + "/draw")
      ).json();
    for (const row of tripleResults) {
      const g = (await read()).games.find((g: any) => g.key === row.key),
        scorePath = "/api/v1/games/" + g.id + "/scoring";
      for (const body of [
        {
          requestId: randomUUID(),
          expectedVersion: g.version,
          action: "start",
          hammer: null,
        },
        {
          requestId: randomUUID(),
          expectedVersion: g.version + 1,
          action: "end",
          hammer: null,
          endNumber: 1,
          end: {
            state: "played",
            a: row.winner === row.a ? 2 : 0,
            b: row.winner === row.b ? 2 : 0,
          },
        },
        {
          requestId: randomUUID(),
          expectedVersion: g.version + 2,
          action: "confirm",
          hammer: null,
          outcome: "conceded",
          winnerEntryId: entries[row.winner - 1],
          reason: "Fictional browser result fixture",
        },
      ]) {
        const r = await page.request.post(scorePath, {
          headers: { Origin: process.env.BETTER_AUTH_URL! },
          data: body,
        });
        expect(r.status(), await r.text()).toBe(200);
      }
      const next =
        row.key === "A01"
          ? "B01"
          : row.key === "B05"
            ? "C04"
            : row.key === "C07"
              ? "P03"
              : null;
      if (next) {
        await page.reload();
        await expect(
          page.getByRole("link", {
            name: new RegExp("Next known assignment: " + next),
          }),
        ).toBeVisible();
        await page.screenshot({
          path: info.outputPath(device + "-" + next + "-path.png"),
          fullPage: true,
        });
      }
    }
    await page.reload();
    await expect(
      page.getByRole("status", { name: "Selected team progress" }),
    ).toContainText("QC2");
    await expect(
      page.getByRole("status", { name: "Selected team progress" }),
    ).toContainText("Champion · Place 1");
    for (const key of ["A01", "B01", "B05", "C04", "C07", "P03", "P06", "P07"])
      await expect(
        page.getByRole("article", {
          name: key + " · selected team",
          exact: true,
        }),
      ).toBeVisible();
    await expect(
      page.getByRole("article", { name: "A09", exact: true }),
    ).not.toHaveClass(/path-game/);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(device + "-complete-list.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Only selected path", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: "A09", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/path=team/);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Show all games", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: info.outputPath(device + "-selected-list.png"),
      fullPage: true,
    });
    expect(
      await page
        .locator('a[href^="#draw-node-"]')
        .evaluateAll((links) =>
          links.every(
            (link) =>
              document.getElementById(
                (link as HTMLAnchorElement).hash.slice(1),
              ) !== null,
          ),
        ),
    ).toBe(true);
    await page.getByRole("button", { name: "Bracket", exact: true }).click();
    await page.getByRole("region", { name: /Knockout bracket/ }).focus();
    await expect(
      page.getByRole("region", { name: /Knockout bracket/ }),
    ).toBeFocused();
    await page.screenshot({
      path: info.outputPath(device + "-complete-bracket.png"),
      fullPage: true,
    });
    await page.screenshot({
      path: info.outputPath(device + "-bracket-viewport.png"),
    });
    await page
      .getByRole("link", { name: "Next known assignment", exact: false })
      .count()
      .then((count) => expect(count).toBe(0));
    await page
      .getByRole("article", { name: "P07 · selected team", exact: true })
      .getByRole("link", { name: "Open P07 game →" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Game details", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toContainText("Fictional T16");
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
}
test("homepage main scenario retains event/draw across polling and back; actual known next assignment matches bracket and score sources", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 360, height: 800 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Demonstration event").selectOption("main-triple-2026");
  await page
    .getByRole("button", { name: "Show event scores", exact: true })
    .click();
  await expect(page).toHaveURL(/event=main-triple-2026/);
  await expect(
    page.getByRole("heading", {
      name: "Main 16-team Triple Knockout 2026",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Draw", { exact: true })).toHaveValue(
    "main-triple-b-opening",
  );
  await expect(page.getByRole("table")).toContainText("Fictional T16");
  await expect(page.locator(".next-draw")).toContainText("5:00");
  await expect(page.locator(".next-draw a")).toHaveAttribute(
    "href",
    /event=main-triple-2026/,
  );
  const data = await (
    await page.request.get("/api/v1/public/divisions/main-triple-sixteen/draw")
  ).json();
  const b05 = data.games.find((g: any) => g.key === "B05");
  expect([b05.entryA, b05.entryB]).toEqual([
    "main-triple-entry-16",
    "main-triple-entry-5",
  ]);
  expect(b05.startsAt).toBe("2026-11-08T23:00:00.000Z");
  await page
    .getByRole("button", { name: "Previous draw", exact: true })
    .click();
  await expect(page.getByLabel("Draw", { exact: true })).toHaveValue(
    "main-triple-opening",
  );
  await page.waitForTimeout(8500);
  await expect(page.getByLabel("Draw", { exact: true })).toHaveValue(
    "main-triple-opening",
  );
  await expect(page.getByLabel("Demonstration event")).toHaveValue(
    "main-triple-2026",
  );
  await page
    .getByRole("link", { name: "Competition bracket / game list" })
    .click();
  await page.getByLabel("Follow a team").selectOption("main-triple-entry-16");
  await expect(
    page.getByRole("link", { name: /Next known assignment: B05/ }),
  ).toContainText("Fictional T16 vs Fictional T05");
  await page.getByRole("button", { name: "Game list", exact: true }).click();
  await page
    .getByRole("button", { name: "Only selected path", exact: true })
    .click();
  await page.screenshot({
    path: info.outputPath("phone-main-next-assignment.png"),
  });
  await page.getByRole("link", { name: /Next known assignment: B05/ }).click();
  await expect(page.getByRole("table")).toContainText("Fictional T05");
  await page.goBack();
  await expect(page).toHaveURL(
    /entry=main-triple-entry-16.*view=list.*path=team/,
  );
  await expect(
    page.getByRole("link", { name: /Next known assignment: B05/ }),
  ).toBeVisible();
  await page.route(
    "**/api/v1/public/divisions/main-triple-sixteen/draw",
    async (route) => route.abort("failed"),
  );
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Showing the last successful draw" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("link", { name: /Next known assignment: B05/ }),
  ).toBeVisible();
  await page.unroute("**/api/v1/public/divisions/main-triple-sixteen/draw");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("Connection interrupted.", { exact: false }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("configured triple16 organizer publishes only the admitted mixed-origin field belowcapacity20", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 360, height: 800 });
  const id = "ctko-" + randomUUID(),
    entries: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Configured triple browser','men_four','triple knockout')",
    [id, event.id],
  );
  for (let n = 1; n <= 17; n++) {
    const entry = id + "-" + n;
    entries.push(entry);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name,entry_admission) VALUES($1,$2,$3,$4)",
      [
        entry,
        id,
        n === 17
          ? "Pending configured peer"
          : "Configured T" + String(n).padStart(2, "0"),
        n % 2 ? "submitted_pending" : "organizer_recorded",
      ],
    );
  }
  expect(
    (
      await signInApiWithRateWindow(
        page.request,
        "organizer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
  const command = async (data: object) => {
    const r = await page.request.post("/api/v1/registration", {
      headers: {
        Origin: process.env.BETTER_AUTH_URL!,
        "X-WCP-Actor": "demo-organizer",
      },
      data: { requestId: randomUUID(), divisionId: id, ...data },
    });
    expect(r.status(), await r.text()).toBe(200);
  };
  await command({
    action: "open",
    version: 0,
    terms: {
      ...configuredDrawTerms,
      format: "triple_knockout",
      capacity: 20,
      formatNotes: "Exact application16 2/3/3 profile",
    },
  });
  for (const entryId of entries.slice(0, 16))
    await command({ action: "request", entryId, version: 0 });
  await page.goto("/admin/draws?division=" + id);
  await page
    .getByLabel("Competition profile", { exact: true })
    .selectOption("application-tko16-q8-233-v1");
  await expect(
    page
      .getByLabel("Seed 1", { exact: true })
      .getByRole("option", { name: "Pending configured peer", exact: true }),
  ).toHaveCount(0);
  for (let n = 1; n <= 16; n++)
    await page
      .getByLabel("Seed " + n, { exact: true })
      .selectOption(entries[n - 1]);
  await page
    .getByLabel("Revision reason", { exact: true })
    .fill("Review complete accepted configured triple field");
  await page.getByRole("button", { name: "Save preview", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved preview revision 1.",
  );
  await page
    .getByLabel("Publication reason")
    .fill("Publish compatible configured profile");
  await page
    .getByRole("button", { name: "Publish reviewed draw", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved published revision 2.",
  );
  await page
    .getByRole("link", { name: "Open public bracket and game list →" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Triple knockout bracket", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Game list", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("phone-configured-triple.png"),
  });
  expect(errors).toEqual([]);
});
