import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { signInApiWithRateWindow } from "./auth-fixture";
import "dotenv/config";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(() => pool.end());
test.beforeEach(async ({ page }) => {
  expect(
    (
      await signInApiWithRateWindow(
        page.request,
        "organizer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
});
async function fixture(request: APIRequestContext) {
  const id = "md-browser-" + randomUUID(),
    division = id + "-d",
    draw = id + "-draw",
    entries: string[] = [],
    people: string[][] = [];
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,'prairie-2026',$2,'mixed_doubles','manual')",
    [division, id],
  );
  await pool.query(
    "INSERT INTO draw_session(id,division_id,number,starts_at,state) VALUES($1,$2,999,'2000-01-01T12:00:00Z','scheduled')",
    [draw, division],
  );
  for (const side of ["Red", "Yellow"]) {
    const entryId = id + "-" + side,
      ids = [randomUUID(), randomUUID()];
    const r = await request.post("/api/v1/entries", {
      headers: { Origin: process.env.BETTER_AUTH_URL! },
      data: {
        id: entryId,
        requestId: randomUUID(),
        version: 0,
        entry: {
          divisionId: division,
          name: "MD " + side,
          coreKnown: true,
          corePlayerIds: ids,
          members: ids.map((playerId) => ({
            playerId,
            role: "core",
            position: "",
            participation: "declared",
          })),
          newPlayers: ids.map((id, i) => ({
            id,
            name: `${side} MD player ${i + 1}`,
            provisional: false,
          })),
        },
      },
    });
    expect(r.status(), await r.text()).toBe(201);
    entries.push(entryId);
    people.push(ids);
  }
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,$2,'M','Mixed doubles','scheduled',$3,$4,'Red','Yellow')",
    [id, draw, ...entries],
  );
  return { id, division, entries, people };
}
for (const [name, width, height] of [
  ["phone", 360, 900],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${name}: mixed doubles entry, six-point score, measurements, public view and ordinary correction`, async ({
    page,
    context,
  }, info) => {
    test.setTimeout(120000);
    const f = await fixture(page.request),
      errors: string[] = [],
      badRequests: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 500) badRequests.push(r.url());
    });
    await page.setViewportSize({ width, height });
    await page.goto("/admin/entries");
    await page.getByLabel("Division", { exact: true }).selectOption(f.division);
    await expect(page.getByLabel("New player role")).not.toContainText(
      "Designated alternate",
    );
    await page.screenshot({
      path: info.outputPath(`${name}-md-entry.png`),
      fullPage: true,
    });
    await page.goto("/admin/games/" + f.id);
    await expect(
      page.getByText("Mixed doubles · two players · up to 6 points per end", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(
      page.getByText("Saved · version 1", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("End", { exact: true }).selectOption("1");
    await page.getByLabel("MD Red points", { exact: true }).fill("6");
    await page.getByLabel("MD Yellow points", { exact: true }).fill("0");
    await expect(
      page.getByLabel("MD Red points", { exact: true }),
    ).toHaveAttribute("max", "6");
    await page.getByRole("button", { name: "Save end", exact: true }).click();
    await expect(
      page.getByText("Saved · version 2", { exact: true }),
    ).toBeVisible();
    await page
      .getByText("Measurements, placement and observed participation", {
        exact: true,
      })
      .click();
    await page
      .getByLabel("Competition stage / measurement source context")
      .fill("Browser round robin");
    await page
      .getByRole("combobox", { name: "Observation A 1", exact: true })
      .selectOption("measured-edge");
    await page
      .getByRole("combobox", { name: "LSD player A 1", exact: true })
      .selectOption(f.people[0][0]);
    await page.getByLabel("Raw distance A 1", { exact: true }).fill("10");
    await page
      .getByRole("combobox", { name: "Distance unit A 1", exact: true })
      .selectOption("mm");
    await page
      .getByLabel("LSD source A 1", { exact: true })
      .fill("Synthetic ten mm edge observation");
    await page
      .getByLabel("Competition stage / measurement source context")
      .focus();
    await expect(
      page.getByLabel("Competition stage / measurement source context"),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await page
      .getByRole("button", { name: "Save sporting evidence", exact: true })
      .click();
    await expect(
      page.getByText("Sporting evidence saved.", { exact: true }),
    ).toBeVisible();
    const section = page.getByRole("region", {
      name: "Record sporting evidence",
      exact: true,
    });
    await expect(section.getByText(/15.2 cm to centre/)).toBeVisible();
    await expect(
      section.getByText("Actual participation: unknown", { exact: true }),
    ).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${name}-md-scoring.png`),
      fullPage: true,
    });
    const fan = await context.newPage();
    await fan.setViewportSize({ width, height });
    await fan.goto("/games/" + f.id);
    await expect(
      fan.getByRole("cell", { name: "End 1: 6 points", exact: true }),
    ).toBeVisible();
    await expect(fan.getByText(/15.2 cm to centre/)).toBeVisible();
    expect(
      await fan.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page: fan }).analyze()).violations).toEqual(
      [],
    );
    await fan.screenshot({
      path: info.outputPath(`${name}-md-public.png`),
      fullPage: true,
    });
    await fan.close();
    await page
      .getByLabel("Result outcome", { exact: true })
      .selectOption("conceded");
    await page
      .getByLabel("Result winner", { exact: true })
      .selectOption(f.entries[0]);
    await page
      .getByLabel("Result reason", { exact: true })
      .fill("Recorded concession");
    await page
      .getByRole("button", { name: "Confirm result", exact: true })
      .click();
    await expect(
      page.getByText("Final · conceded", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Raw distance A 1", { exact: true }).fill("20");
    await page
      .getByLabel("Sporting correction reason")
      .fill("Correct edge transcription");
    await page
      .getByRole("button", { name: "Save sporting correction", exact: true })
      .click();
    await expect(section.getByText(/16.2 cm to centre/)).toBeVisible();
    await expect(
      page.getByText("Corrected final · conceded", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(badRequests).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${name}-md-corrected.png`),
      fullPage: true,
    });
  });
}
test("lost sporting response retains exact actor/path/body; changed body and wrong path stay locked; original reconciles with zero POSTs", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const f = await fixture(page.request),
    path = `/api/v1/games/${f.id}/scoring`,
    key = `wcp-sporting:demo-organizer:${f.id}`;
  await page.goto("/admin/games/" + f.id);
  await page
    .getByText("Measurements, placement and observed participation", {
      exact: true,
    })
    .click();
  await page
    .getByLabel("Competition stage / measurement source context")
    .fill("Exact recovery stage");
  await page.route("**" + path, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Save sporting evidence", exact: true })
    .click();
  await expect(
    page.getByText(/The command result is not confirmed/),
  ).toBeVisible();
  await page.unroute("**" + path);
  const original = await page.evaluate(
    (key) => sessionStorage.getItem(key)!,
    key,
  );
  expect(JSON.parse(original).path).toBe(path);
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/scoring")) posts++;
  });
  const replace = async (value: string) => {
    await page.evaluate(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key, value },
    );
    await page.reload();
    await page
      .getByText("Measurements, placement and observed participation", {
        exact: true,
      })
      .click();
  };
  const modified = JSON.parse(original),
    body = JSON.parse(modified.body);
  body.sporting.stage = "Changed bytes";
  modified.body = JSON.stringify(body);
  await replace(JSON.stringify(modified));
  await page
    .getByRole("button", {
      name: "Reconcile recorded sporting evidence command",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/Recorded state could not confirm/),
  ).toBeVisible();
  await expect(
    page.getByLabel("Competition stage / measurement source context"),
  ).toBeDisabled();
  const wrong = JSON.parse(original);
  wrong.path = "/api/v1/games/wrong-game/scoring";
  await replace(JSON.stringify(wrong));
  await page
    .getByRole("button", {
      name: "Reconcile recorded sporting evidence command",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/Recorded state could not confirm/),
  ).toBeVisible();
  const equivalent = JSON.parse(original);
  equivalent.body = JSON.stringify(
    Object.fromEntries(Object.entries(JSON.parse(equivalent.body)).reverse()),
  );
  await replace(JSON.stringify(equivalent));
  await page
    .getByRole("button", {
      name: "Reconcile recorded sporting evidence command",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(/The original command was reconciled/),
  ).toBeVisible();
  await expect(
    page.getByLabel("Competition stage / measurement source context"),
  ).toBeEnabled();
  expect(posts).toBe(0);
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
  await page.screenshot({
    path: info.outputPath("md-exact-recovery.png"),
    fullPage: true,
  });
});
test("loading, player read failure/retry, missing observations and stale evidence remain truthful", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const f = await fixture(page.request),
    path = `/api/v1/games/${f.id}/scoring`;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**" + path, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/admin/games/" + f.id);
  await expect(
    page.getByText("Loading assigned game…", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("md-loading.png"),
    fullPage: true,
  });
  release();
  await expect(
    page.getByRole("heading", { name: "MD Red vs MD Yellow", exact: true }),
  ).toBeVisible();
  await page.unroute("**" + path);
  await page.route("**/api/v1/public/players", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic read outage" }),
    }),
  );
  const summary = page.getByText(
    "Measurements, placement and observed participation",
    { exact: true },
  );
  await summary.click();
  await expect(
    page.getByText("Measurements and observed participation not recorded.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Players could not be loaded/)).toBeVisible();
  await page.screenshot({
    path: info.outputPath("md-player-error.png"),
    fullPage: true,
  });
  await summary.click();
  await page.unroute("**/api/v1/public/players");
  await summary.click();
  await expect(page.getByText(/Players could not be loaded/)).toHaveCount(0);
  await page
    .getByLabel("Competition stage / measurement source context")
    .fill("Retained stale draft");
  const start = await page.request.post(path, {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: "start",
      hammer: null,
    },
  });
  expect(start.status()).toBe(200);
  await page
    .getByRole("button", { name: "Save sporting evidence", exact: true })
    .click();
  await expect(
    page.getByText(
      "Scores changed. Reload the accepted game before applying your edit",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Competition stage / measurement source context"),
  ).toHaveValue("Retained stale draft");
  await page.screenshot({
    path: info.outputPath("md-stale.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Reload accepted sporting version",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Accepted total: 0 – 0 · version 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save sporting evidence", exact: true })
    .click();
  await expect(
    page.getByText("Sporting evidence saved.", { exact: true }),
  ).toBeVisible();
  const r = await page.request.get(path),
    g = await r.json();
  expect(g.version).toBe(2);
  expect(g.sporting.stage).toBe("Retained stale draft");
  expect(
    g.sporting.lsd.a.every(
      (p: { centreCm: number | null }) => p.centreCm === null,
    ),
  ).toBe(true);
});
