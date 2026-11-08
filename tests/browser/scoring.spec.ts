import {
  test,
  expect,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { scoringFixtureDraw } from "../scoring-fixture";
import { signInApiWithRateWindow } from "./auth-fixture";
import "dotenv/config";
test.describe.configure({ timeout: 180000 });
// Each browser suite owns its fixture connection lifecycle. Other files may
// close the application module's pool in the same Playwright worker.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let session: BrowserContext;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(150000);
  session = await browser.newContext();
  const r = await signInApiWithRateWindow(
    session.request,
    "scorekeeper@demo.invalid",
    process.env.DEMO_PASSWORD,
  );
  expect(r.status()).toBe(200);
  await restore(session.request);
});
test.beforeEach(async ({ context }) =>
  context.addCookies(await session.cookies()),
);
test.afterEach(async () => restore(session.request));
test.afterAll(async () => {
  await session.close();
  await pool.end();
});
async function game(request: APIRequestContext) {
  const r = await request.get("/api/v1/games/game-2/scoring");
  expect(r.status()).toBe(200);
  return r.json();
}
async function write(
  request: APIRequestContext,
  points: number | null,
  hammer: "a" | "b" | null = "b",
) {
  const g = await game(request);
  const r = await request.post("/api/v1/games/game-2/scoring", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      requestId: randomUUID(),
      expectedVersion: g.version,
      action: "end",
      endNumber: 5,
      end: {
        state: points === null ? "upcoming" : "played",
        a: points,
        b: points === null ? null : 0,
      },
      hammer,
    },
  });
  expect(r.status()).toBe(200);
}
async function restore(request: APIRequestContext) {
  await write(request, null);
}
for (const [name, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${name}: accepted values, keyboard controls and accessible score entry`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height });
    await page.goto("/admin/games/game-2");
    await expect(
      page.getByRole("heading", { name: "Team North vs Team Prairie" }),
    ).toBeVisible();
    await expect(page.getByLabel("End", { exact: true })).toHaveValue("1");
    await expect(page.getByLabel("Team North points")).toHaveValue("0");
    await expect(page.getByLabel("Team Prairie points")).toHaveValue("1");
    await page.getByLabel("End", { exact: true }).focus();
    await expect(page.getByLabel("End", { exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("End state")).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const label of ["Team North points", "Team Prairie points"])
      expect(
        (await page.getByLabel(label).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    const earlier = page.getByText(/Earlier \d+ accepted changes/, {
      exact: true,
    });
    if (await earlier.count()) {
      await earlier.focus();
      await page.keyboard.press("Enter");
      await expect(earlier.locator("..")).toHaveAttribute("open", "");
      await page.keyboard.press("Enter");
      await expect(earlier.locator("..")).not.toHaveAttribute("open", "");
    }
    expect(errors).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${name}-scoring.png`),
      fullPage: true,
    });
  });
}
test("phone save updates already-open public scores by polling and retains draw and focus", async ({
  page,
  context,
}, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/admin");
  await page.getByRole("link", { name: "Enter live scores →" }).click();
  const fan = await context.newPage();
  await fan.goto("/?draw=draw-1");
  await expect(fan.getByRole("table")).toHaveCount(1);
  await fan.getByLabel("Draw", { exact: true }).focus();
  await page.getByLabel("End", { exact: true }).selectOption("5");
  await page.getByLabel("Team North points").fill("3");
  await page.getByLabel("Team Prairie points").fill("0");
  await expect(page.getByText(/Unsent edit/)).toBeVisible();
  await page.getByRole("button", { name: "Save end", exact: true }).click();
  await expect(page.getByText(/Saved · version/)).toBeVisible();
  await fan
    .getByRole("button", { name: "Refresh scores", exact: true })
    .click();
  await expect(fan.getByLabel("Draw", { exact: true })).toHaveValue("draw-1");
  await expect(fan.getByRole("table")).toHaveCount(1);
  await expect(
    fan.getByRole("button", { name: "Refresh scores", exact: true }),
  ).toBeFocused();
  await fan.getByLabel("Draw", { exact: true }).selectOption("draw-2");
  await expect(
    fan.getByRole("cell", { name: "End 5: 3 points", exact: true }),
  ).toBeVisible();
  await write(session.request, 4);
  await expect(
    fan.getByRole("cell", { name: "End 5: 4 points", exact: true }),
  ).toBeVisible({ timeout: 12000 });
  await expect(fan.getByLabel("Draw", { exact: true })).toHaveValue("draw-2");
  await expect(fan.getByRole("table")).toHaveCount(2);
  await fan.screenshot({
    path: info.outputPath("public-updated-scores.png"),
    fullPage: true,
  });
  await fan.goto("/games/game-2");
  await expect(
    fan.getByRole("cell", { name: "End 5: 4 points", exact: true }),
  ).toBeVisible();
});
test("offline edit, unfinished draft and uncertain exact retry survive interruption", async ({
  page,
  context,
}, info) => {
  await page.goto("/admin/games/game-2");
  await page.getByLabel("End", { exact: true }).selectOption("5");
  await page.getByLabel("Team North points").fill("2");
  await page.reload();
  await expect(page.getByLabel("Team North points")).toHaveValue("2");
  await expect(page.getByText(/Unsent edit/)).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/Connection interrupted/)).toBeVisible();
  await page.getByRole("button", { name: "Save end", exact: true }).click();
  await expect(page.getByText(/Uncertain · request/)).toBeVisible();
  await expect(page.getByLabel("Team North points")).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("uncertain-offline-edit.png"),
    fullPage: true,
  });
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText(/Uncertain · request/)).toBeVisible();
  await expect(page.getByLabel("Team North points")).toHaveValue("2");
  await page.getByRole("button", { name: "Retry same request" }).click();
  await expect(page.getByText(/Saved · version/)).toBeVisible();
  expect((await game(session.request)).ends[4]).toEqual({
    state: "played",
    a: 2,
    b: 0,
  });
});
test("lost acknowledgement retries the exact accepted command once; delayed save never says saved early", async ({
  page,
}, info) => {
  await page.goto("/admin/games/game-2");
  await page.getByLabel("End", { exact: true }).selectOption("5");
  await page.getByLabel("Team North points").fill("2");
  let sent: string | undefined;
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  const before = await game(session.request);
  await page.route("**/api/v1/games/game-2/scoring", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    sent = route.request().postData()!;
    await gate;
    const r = await route.fetch();
    expect(r.status()).toBe(200);
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Save end", exact: true }).click();
  await expect(page.getByText(/Saving · waiting/)).toBeVisible();
  await expect(page.getByText(/Saved · version/)).toHaveCount(0);
  release();
  await expect(page.getByText(/Uncertain · request/)).toBeVisible();
  const accepted = await game(session.request);
  expect(accepted.version).toBe(before.version + 1);
  await page.screenshot({
    path: info.outputPath("accepted-response-lost.png"),
    fullPage: true,
  });
  await page.unroute("**/api/v1/games/game-2/scoring");
  const retry = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/scoring"),
  );
  await page.getByRole("button", { name: "Retry same request" }).click();
  expect((await retry).postData()).toBe(sent);
  await expect(page.getByText(/Saved · version/)).toBeVisible();
  const final = await game(session.request);
  expect(final.version).toBe(accepted.version);
  expect(final.history.length).toBe(accepted.history.length);
});
test("stale edit keeps entered values and requires accepted-version review; validation labels errors", async ({
  page,
}) => {
  await page.goto("/admin/games/game-2");
  await page.getByLabel("End", { exact: true }).selectOption("5");
  await page.getByLabel("Team North points").fill("1");
  await page.getByLabel("Team Prairie points").fill("1");
  await page.getByRole("button", { name: "Save end", exact: true }).click();
  await expect(
    page.getByRole("alert", { name: "Score entry error" }),
  ).toContainText("only one team");
  await page.getByLabel("Team Prairie points").fill("0");
  await write(session.request, 4);
  await page.getByRole("button", { name: "Save end", exact: true }).click();
  await expect(
    page.getByRole("alert", { name: "Score entry error" }),
  ).toContainText("Scores changed");
  await expect(page.getByLabel("Team North points")).toHaveValue("1");
  await page.getByRole("button", { name: "Reload accepted version" }).click();
  await expect(page.getByText(/Accepted total: 7 – 2/)).toBeVisible();
  await expect(page.getByLabel("Team North points")).toHaveValue("1");
  await expect(page.getByText(/Unsent edit/)).toBeVisible();
  await page.getByRole("button", { name: "Save end", exact: true }).click();
  await expect(page.getByText(/Saved · version/)).toBeVisible();
  expect((await game(session.request)).ends[4]).toEqual({
    state: "played",
    a: 1,
    b: 0,
  });
  await page.goto("/admin/games/other-game");
  await expect(
    page.getByRole("alert", { name: "Score entry error" }),
  ).toContainText("outside your assigned");
  await expect(
    page.getByRole("button", { name: "Save end", exact: true }),
  ).toHaveCount(0);
});
test("assigned scorekeeper starts an actual scheduled fixture with end-one hammer", async ({
  page,
}) => {
  const id = `wcp002-browser-${randomUUID()}`;
  await scoringFixtureDraw(pool);
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,'scoring-test-draw','T','Browser start','scheduled','entry-1','entry-3','Team North','Team Prairie')",
    [id],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$2)",
    [id, id],
  );
  try {
    await page.goto(`/admin/games/${id}`);
    await page.getByLabel("Known hammer (selected end)").selectOption("a");
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(page.getByText(/Saved · version 1/)).toBeVisible();
    await expect(page.getByText(/Draw 999 · Sheet T · live/)).toBeVisible();
    await expect(page.getByLabel("Known hammer (selected end)")).toHaveValue(
      "a",
    );
    const r = await session.request.get(`/api/v1/public/games/${id}`);
    const published = await r.json();
    expect(published.games[0].state).toBe("live");
    expect(published.games[0].hammer).toBe("a");
    expect(published.games[0].hammerEnd).toBe(1);
  } finally {
    await pool.query("DELETE FROM role_grant WHERE game_id=$1", [id]);
    // Immutable evidence and its audit stay in this noncurrent fixture draw.
  }
});
test("normal mobile fixture can record end nine and its hammer without pre-existing extra-end rows", async ({
  page,
}, info) => {
  const id = `wcp002-extra-${randomUUID()}`;
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b,total_a,total_b) VALUES($1,'draw-2','T','Extra end review','live','entry-1','entry-3','Team North','Team Prairie',3,2)",
    [id],
  );
  await pool.query(
    "INSERT INTO game_end_score SELECT $1,side,end_number,state,points FROM game_end_score WHERE game_id='game-2' AND end_number<=8",
    [id],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$2)",
    [id, id],
  );
  try {
    const before = await (
      await session.request.get(`/api/v1/games/${id}/scoring`)
    ).json();
    expect(before.ends).toHaveLength(8);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/admin/games/${id}`);
    await page.getByLabel("End", { exact: true }).selectOption("9");
    await page.getByLabel("Team North points").fill("0");
    await page.getByLabel("Team Prairie points").fill("2");
    await page.getByLabel("Known hammer (selected end)").selectOption("a");
    await page.getByRole("button", { name: "Save end", exact: true }).click();
    await expect(page.getByText(/Saved · version 1/)).toBeVisible();
    const stored = await (
      await session.request.get(`/api/v1/games/${id}/scoring`)
    ).json();
    expect(stored.ends[8]).toEqual({ state: "played", a: 0, b: 2 });
    expect(stored.endHammer[8]).toBe("a");
    expect(stored.ends[4]).toEqual({ state: "unknown", a: null, b: null });
    expect(stored.totalA).toBe(null);
    expect(stored.totalB).toBe(null);
    await page.reload();
    await page.getByLabel("End", { exact: true }).selectOption("9");
    await expect(page.getByLabel("Team Prairie points")).toHaveValue("2");
    await expect(page.getByLabel("Known hammer (selected end)")).toHaveValue(
      "a",
    );
    await page.goto(`/games/${id}`);
    await expect(
      page.getByRole("cell", { name: "End 9: 2 points", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(/Recorded hammer:.*End 9: Team North/),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Total unknown", exact: true }),
    ).toHaveCount(2);
    await page.screenshot({
      path: info.outputPath("phone-extra-end-nine.png"),
      fullPage: true,
    });
  } finally {
    await pool.query("DELETE FROM scoring_command WHERE game_id=$1", [id]);
    await pool.query("DELETE FROM audit_record WHERE resource_id=$1", [id]);
    await pool.query("DELETE FROM role_grant WHERE game_id=$1", [id]);
    await pool.query("DELETE FROM game WHERE id=$1", [id]);
  }
});
