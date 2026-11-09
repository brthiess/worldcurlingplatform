import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { drawFixtureEvent } from "../draws-fixture";
import { signInApiWithRateWindow } from "./auth-fixture";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let event: Awaited<ReturnType<typeof drawFixtureEvent>>;
test.beforeAll(async () => {
  event = await drawFixtureEvent(pool);
  await pool.query(
    "UPDATE event_edition SET name='Pool acceptance fixture' WHERE id=$1",
    [event.id],
  );
});
test.afterAll(async () => {
  if (event) await event.cleanup();
  await pool.end();
});
for (const [device, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${device}: organizer publishes pools and fans keep selected group through score refresh and browser back`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const id = "bpool-" + randomUUID(),
      entries: string[] = [],
      errors: string[] = [],
      network: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 500) network.push(r.url());
    });
    await pool.query(
      "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Two pools browser','men_four','round_robin')",
      [id, event.id],
    );
    for (let n = 1; n <= 8; n++) {
      const entry = id + "-" + n;
      entries.push(entry);
      await pool.query(
        "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
        [entry, id, `Fictional T${n}`],
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
      .selectOption("application-pools2x4-v1");
    for (let n = 1; n <= 8; n++)
      await page
        .getByLabel(`Seed ${n}`, { exact: true })
        .selectOption(entries[n - 1]);
    await page
      .getByLabel("Revision reason", { exact: true })
      .fill("Review two pools of four");
    await page
      .getByRole("button", { name: "Save preview", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved preview revision 1.",
    );
    await expect(
      page.getByRole("region", { name: "Saved draw preview" }),
    ).toContainText("Round 3");
    await page
      .getByLabel("Publication reason")
      .fill("Publish reviewed pool fixtures");
    await page
      .getByRole("button", { name: "Publish reviewed draw", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Saved published revision 2.",
    );
    await page
      .getByRole("link", { name: "Open public pools and standings →" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Pools and standings", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Pool A", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Pool B", exact: true }),
    ).toBeFocused();
    await expect(
      page.getByRole("tabpanel", { name: "Pool B", exact: true }),
    ).toContainText("3 pending");
    const data = await (
      await page.request.get(`/api/v1/public/divisions/${id}/draw`)
    ).json();
    const g = data.games.find((g: any) => g.key === "B01");
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
        end: { state: "played", a: 2, b: 0 },
      },
      {
        requestId: randomUUID(),
        expectedVersion: g.version + 2,
        action: "confirm",
        hammer: null,
        outcome: "conceded",
        winnerEntryId: entries[1],
        reason: "Visible refresh fixture",
      },
    ]) {
      const r = await page.request.post(`/api/v1/games/${g.id}/scoring`, {
        headers: {
          Origin: process.env.BETTER_AUTH_URL!,
          "X-WCP-Actor": "demo-organizer",
        },
        data: body,
      });
      expect(r.status(), await r.text()).toBe(200);
    }
    await expect(page.getByRole("row", { name: /Fictional T2/ })).toContainText(
      "2 pending",
      { timeout: 15000 },
    );
    await expect(
      page.getByRole("tab", { name: "Pool B", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("tab", { name: "Pool B", exact: true }),
    ).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("link", { name: "Open B01 game →", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/games/${g.id}`));
    await page.goBack();
    await expect(
      page.getByRole("tab", { name: "Pool B", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.screenshot({
      path: `docs/verification/assets/WCP-022-${device}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(network).toEqual([]);
    await info.attach("pool-screen", {
      path: `docs/verification/assets/WCP-022-${device}.png`,
      contentType: "image/png",
    });
  });
}

test("pool recovery retains exact preview after lost response and preserves public group through loading, stale, error and empty states", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 360, height: 800 });
  const id = "recovery-pool-" + randomUUID(),
    entries: string[] = [];
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Recovery pools','men_four','round_robin')",
    [id, event.id],
  );
  for (let n = 1; n <= 8; n++) {
    const entry = id + "-" + n;
    entries.push(entry);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [entry, id, `Recovery T${n}`],
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
  const path = `/api/v1/divisions/${id}/draw`;
  await page.goto("/admin/draws?division=" + id);
  await page
    .getByLabel("Competition profile", { exact: true })
    .selectOption("application-pools2x4-v1");
  for (let n = 1; n <= 8; n++)
    await page
      .getByLabel(`Seed ${n}`, { exact: true })
      .selectOption(entries[n - 1]);
  await page
    .getByLabel("Revision reason", { exact: true })
    .fill("Retained pool preview recovery");
  let lost = false;
  await page.route("**" + path, async (route) => {
    if (route.request().method() === "POST" && !lost) {
      lost = true;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save preview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same request", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Competition profile", { exact: true }),
  ).toHaveValue("application-pools2x4-v1");
  await expect(
    page.getByRole("button", { name: "Save preview", exact: true }),
  ).toBeDisabled();
  await page.unroute("**" + path);
  await page
    .getByRole("button", { name: "Retry same request", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved preview revision 1.",
  );
  const receipt = await (await page.request.get(path)).json();
  expect(receipt.version).toBe(1);
  expect(receipt.history).toHaveLength(1);
  await page
    .getByLabel("Publication reason")
    .fill("Publish recovered exact preview");
  await page
    .getByRole("button", { name: "Publish reviewed draw", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText(
    "Saved published revision 2.",
  );
  const publicPath = `/api/v1/public/divisions/${id}/draw`;
  let release!: () => void, started!: () => void;
  const held = new Promise<void>((resolve) => {
      release = resolve;
    }),
    entered = new Promise<void>((resolve) => {
      started = resolve;
    });
  await page.route("**" + publicPath, async (route) => {
    started();
    await held;
    await route.continue();
  });
  const goto = page.goto(`/events/${event.id}/bracket?division=${id}&pool=B`);
  await entered;
  await expect(page.getByRole("status")).toContainText(
    "Loading stored competition draw",
  );
  release();
  await goto;
  await expect(
    page.getByRole("tab", { name: "Pool B", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.unroute("**" + publicPath);
  await page.route("**" + publicPath, (route) => route.abort("failed"));
  await expect(page.getByRole("status")).toContainText(
    "Connection interrupted",
    { timeout: 15000 },
  );
  await expect(
    page.getByRole("tab", { name: "Pool B", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("row", { name: /Recovery T2/ })).toBeVisible();
  await page.screenshot({
    path: "docs/verification/assets/WCP-022-stale.png",
    fullPage: true,
  });
  await page.unroute("**" + publicPath);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("Connection interrupted", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Pool B", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const empty = "empty-pool-" + randomUUID();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'No published pool','men_four','round_robin')",
    [empty, event.id],
  );
  await page.goto(`/events/${event.id}/bracket?division=${empty}`);
  await expect(page.getByRole("status")).toContainText(
    "No published competition draw",
  );
  expect(
    (
      await signInApiWithRateWindow(
        page.request,
        "reviewer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
  await page.goto("/admin/draws?division=" + id);
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "This division is outside your editable scope.",
  );
  await info.attach("stale-state", {
    path: "docs/verification/assets/WCP-022-stale.png",
    contentType: "image/png",
  });
});
