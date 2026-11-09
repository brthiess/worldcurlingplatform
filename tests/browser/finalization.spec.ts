import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { signInApiWithRateWindow } from "./auth-fixture";
import {
  finalizationFixtureEvent,
  clearFinalizationScoringGrants,
} from "../finalization-fixture";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});
let organizer: BrowserContext, scorer: BrowserContext;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(150000);
  organizer = await browser.newContext();
  scorer = await browser.newContext();
  for (const [context, role] of [
    [organizer, "organizer"],
    [scorer, "scorekeeper"],
  ] as const)
    expect(
      (
        await signInApiWithRateWindow(
          context.request,
          `${role}@demo.invalid`,
          process.env.DEMO_PASSWORD,
        )
      ).status(),
    ).toBe(200);
});
test.afterAll(async () => {
  await clearFinalizationScoringGrants(pool);
  await organizer.close();
  await scorer.close();
  await pool.end();
});
async function fixture() {
  const eventId = await finalizationFixtureEvent(pool);
  const divisionId = `final-browser-${randomUUID()}`,
    drawId = randomUUID(),
    gameId = randomUUID(),
    entries = [randomUUID(), randomUUID()];
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Review final division','men_four','Organizer-recorded final')",
    [divisionId, eventId],
  );
  for (const [i, id] of entries.entries()) {
    const players = Array.from({ length: 4 }, () => randomUUID());
    const r = await organizer.request.post("/api/v1/entries", {
      headers: { Origin: process.env.BETTER_AUTH_URL! },
      data: {
        id,
        version: 0,
        requestId: randomUUID(),
        entry: {
          divisionId,
          name: i === 0 ? "Final North" : "Final Lake",
          coreKnown: true,
          corePlayerIds: players,
          members: players.map((playerId) => ({
            playerId,
            role: "core",
            position: "",
            participation: "declared",
          })),
          newPlayers: players.map((id, i) => ({
            id,
            name: `Final player ${i + 1}`,
            provisional: false,
          })),
        },
      },
    });
    expect(r.status()).toBe(201);
  }
  await pool.query(
    "INSERT INTO draw_session VALUES($1,$2,1,'2041-01-01T12:00:00Z','completed')",
    [drawId, divisionId],
  );
  await pool.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,$2,'A','Final','scheduled',$3,$4,'North','Lake')",
    [gameId, drawId, ...entries],
  );
  await pool.query(
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper',$2,$1)",
    [gameId, eventId],
  );
  expect(
    (
      await scorer.request.post(`/api/v1/games/${gameId}/scoring`, {
        headers: { Origin: process.env.BETTER_AUTH_URL! },
        data: {
          requestId: randomUUID(),
          expectedVersion: 0,
          action: "confirm",
          hammer: null,
          outcome: "forfeit",
          winnerEntryId: entries[0],
          reason: "Fixture forfeit",
        },
      })
    ).status(),
  ).toBe(200);
  return { divisionId, gameId, entries };
}
test("finalization reconciliation retains changed409 and wrong-path journals; whitelist and trim equivalent original confirms without any POST", async ({
  page,
}, info) => {
  await page.context().addCookies(await organizer.cookies());
  const f = await fixture(),
    path = "/api/v1/division-finalizations",
    url = `${path}?division=${f.divisionId}`;
  const review = await (await page.request.get(url)).json();
  const body = {
    divisionId: f.divisionId,
    version: 0,
    requestId: randomUUID(),
    sourceDigest: review.sourceDigest,
    placements: f.entries.map((entryId, i) => ({ entryId, place: i + 1 })),
    note: "  Original canonical recovery note  ",
    rulesReference: "  Fictional finalization rules  ",
    ignored: "outside server whitelist",
  };
  const saved = await page.request.post(path, {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: body,
  });
  expect(saved.status()).toBe(200);
  const original = await saved.json(),
    conflict = { ...body, note: "Different retained command" };
  expect(
    (
      await page.request.post(path, {
        headers: { Origin: process.env.BETTER_AUTH_URL! },
        data: conflict,
      })
    ).status(),
  ).toBe(409);
  const key = `wcp027-finalization:${review.actorId}:${f.divisionId}`;
  const pending = (value: unknown, target = path) => ({
    actorId: review.actorId,
    path: target,
    body: JSON.stringify(value),
    message: "Finalization 1 saved.",
    acknowledged: false,
  });
  await page.goto(`/admin/finalizations?division=${f.divisionId}`);
  await expect(page.getByLabel("Division", { exact: true })).toBeEnabled();
  const seed = async (value: unknown) => {
    await page.evaluate(
      ({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)),
      { key, value },
    );
    await page.reload();
  };
  await seed(pending(conflict));
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  const reconcile = () =>
    page
      .getByRole("button", {
        name: "Reconcile recorded finalization command",
        exact: true,
      })
      .click();
  const success = page.getByText(
    "The original command was reconciled with recorded history. Review its current status below.",
    { exact: true },
  );
  await reconcile();
  await expect
    .poll(
      async () =>
        (await success.isVisible()) ||
        (await page.getByRole("main").getByRole("alert").isVisible()),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("finalization-conflict-settled.png"),
  });
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).not.toBeNull();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Recorded state could not confirm",
  );
  await expect(success).not.toBeVisible();
  await seed(pending(body, "/api/v1/entry-charges"));
  await reconcile();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Recorded state could not confirm",
  );
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).not.toBeNull();
  const equivalent = Object.fromEntries(
    Object.entries({
      ...body,
      note: body.note.trim(),
      rulesReference: body.rulesReference.trim(),
      ignored: "ignored property may change",
    }).reverse(),
  );
  await seed(pending(equivalent));
  await reconcile();
  await expect(success).toBeVisible();
  expect(
    await page.evaluate((key) => sessionStorage.getItem(key), key),
  ).toBeNull();
  expect(posts).toEqual([]);
  const after = await (await page.request.get(url)).json();
  expect(after.history).toHaveLength(1);
  expect(after.selected.digest).toBe(original.digest);
});

test("organizer reviews, finalizes and replaces changed results on a phone with immutable public history", async ({
  page,
}, info) => {
  const pageErrors: string[] = [],
    consoleErrors: string[] = [],
    serverErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 500) serverErrors.push(r.url());
  });
  await page.context().addCookies(await organizer.cookies());
  const f = await fixture();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`/admin/finalizations?division=${f.divisionId}`);
  await expect(
    page.getByRole("heading", { name: "Finalize division results" }),
  ).toBeVisible();
  await page.getByLabel("Final place for Final North").fill("1");
  await page.getByLabel("Final place for Final Lake").fill("2");
  await page
    .getByLabel("Competition rules reference")
    .fill("Fictional competition rules · reviewed edition 1");
  await page
    .getByLabel("Public review note")
    .fill("Organizer reviewed the completed division");
  await page
    .getByRole("button", { name: "Finalize division", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText("Finalization 1 saved.", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await scorer.request.post(`/api/v1/games/${f.gameId}/scoring`, {
        headers: { Origin: process.env.BETTER_AUTH_URL! },
        data: {
          requestId: randomUUID(),
          expectedVersion: 1,
          action: "correct",
          hammer: null,
          outcome: "forfeit",
          winnerEntryId: f.entries[1],
          reason: "Ordinary correction, no administrator approval",
          ends: [],
        },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Reload current division" }).click();
  await expect(page.getByText(/Changed since finalization/)).toBeVisible();
  await page.getByLabel("Final place for Final North").fill("2");
  await page.getByLabel("Final place for Final Lake").fill("1");
  await page
    .getByLabel("Public review note")
    .fill("Direct replacement after the corrected winner");
  await page
    .getByRole("button", { name: "Finalize replacement", exact: true })
    .click();
  await expect(
    page.getByText("Finalization 2 saved.", { exact: true }),
  ).toBeVisible();
  for (const [name, width, height] of [
    ["phone", 360, 800],
    ["tablet", 768, 1024],
    ["desktop", 1440, 1000],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${name}-review.png`),
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: "Public final results" }).click();
  await expect(
    page.getByRole("heading", { name: "Final results" }),
  ).toBeVisible();
  await expect(
    page.getByText("Revision 2 · replaces revision 1"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Revision 1", exact: true }).click();
  await expect(
    page.getByText("Original finalization · revision 1"),
  ).toBeVisible();
  await expect(
    page.getByText("Organizer reviewed the completed division", {
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByText("Frozen event lineups", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Final player 1", exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("phone-public-original.png"),
    fullPage: true,
  });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(serverErrors).toEqual([]);
});
test("loading, failed read, stale review and lost acknowledgement recover without duplicate finalizations; empty and denied views stay honest", async ({
  page,
}, info) => {
  const f = await fixture();
  await page.context().addCookies(await organizer.cookies());
  await page.setViewportSize({ width: 360, height: 800 });
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/v1/division-finalizations?division=${f.divisionId}`,
    async (route) => {
      const r = await route.fetch();
      await gate;
      await route.fulfill({ response: r });
    },
    { times: 1 },
  );
  await page.goto(`/admin/finalizations?division=${f.divisionId}`);
  await expect(
    page.getByText("Loading division review…", { exact: true }),
  ).toBeVisible();
  release();
  await expect(page.getByLabel("Final place for Final North")).toBeEnabled();
  await page.route(
    `**/api/v1/division-finalizations?division=${f.divisionId}`,
    (route) => route.abort("failed"),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Reload current division" }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Reload current division" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  const fill = async () => {
    await page.getByLabel("Final place for Final North").fill("1");
    await page.getByLabel("Final place for Final Lake").fill("2");
    await page
      .getByLabel("Competition rules reference")
      .fill("Event terms edition 1");
    await page
      .getByLabel("Public review note")
      .fill("Reviewed completed sporting field");
  };
  await fill();
  expect(
    (
      await scorer.request.post(`/api/v1/games/${f.gameId}/scoring`, {
        headers: { Origin: process.env.BETTER_AUTH_URL! },
        data: {
          requestId: randomUUID(),
          expectedVersion: 1,
          action: "correct",
          hammer: null,
          outcome: "forfeit",
          winnerEntryId: f.entries[0],
          reason: "Corrected recorded reason",
          ends: [],
        },
      })
    ).status(),
  ).toBe(200);
  await page
    .getByRole("button", { name: "Finalize division", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Division results changed",
  );
  await page.getByRole("button", { name: "Reload current division" }).click();
  await fill();
  let committed = false;
  await page.route(
    "**/api/v1/division-finalizations",
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const r = await route.fetch();
      expect(r.status()).toBe(200);
      committed = true;
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Finalize division", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry exact finalization command" }),
  ).toBeVisible();
  await expect.poll(() => committed).toBe(true);
  await expect(
    page.getByRole("button", { name: "Retry exact finalization command" }),
  ).toBeEnabled();
  await expect(page.getByLabel("Public review note")).toBeDisabled();
  await expect(page.getByLabel("Division", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reload current division" }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry exact finalization command" }),
  ).toBeVisible();
  await expect(page.getByLabel("Public review note")).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry exact finalization command" })
    .click();
  await expect(
    page.getByText("Finalization 1 saved.", { exact: true }),
  ).toBeVisible();
  const accepted = await (
    await organizer.request.get(
      `/api/v1/division-finalizations?division=${f.divisionId}`,
    )
  ).json();
  expect(accepted.history.length).toBe(1);
  await page
    .getByRole("button", { name: "Review revision 1", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Original finalization · revision 1" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("phone-recovered.png"),
    fullPage: true,
  });
  const empty = `final-empty-${randomUUID()}`;
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Empty review','men_four','Manual review')",
    [empty, await finalizationFixtureEvent(pool)],
  );
  await page.goto(`/admin/finalizations?division=${empty}`);
  await expect(
    page.getByText("No games have been recorded.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finalize division", exact: true }),
  ).toBeDisabled();
  await page.goto(`/divisions/${empty}/results`);
  await expect(
    page.getByText(/No finalization has been recorded/),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.context().addCookies(await scorer.cookies());
  await page.goto("/admin/finalizations");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Organizer authority",
  );
  await expect(page.getByLabel("Public review note")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
