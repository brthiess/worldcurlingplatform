import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { signInApiWithRateWindow } from "./auth-fixture";
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
  await organizer.close();
  await scorer.close();
  await pool.end();
});
async function fixture() {
  const divisionId = `final-browser-${randomUUID()}`,
    drawId = randomUUID(),
    gameId = randomUUID(),
    entries = [randomUUID(), randomUUID()];
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,'prairie-2026','Review final division','men_four','Organizer-recorded final')",
    [divisionId],
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
    "INSERT INTO role_grant VALUES($1,'demo-scorekeeper','scorekeeper','prairie-2026',$1)",
    [gameId],
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
test("organizer reviews, finalizes and replaces changed results on a phone with immutable public history", async ({
  page,
}, info) => {
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
  await page.screenshot({
    path: info.outputPath("phone-public-original.png"),
    fullPage: true,
  });
});
