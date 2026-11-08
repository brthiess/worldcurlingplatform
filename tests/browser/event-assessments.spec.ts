import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import { assessmentFixture } from "../event-assessments-fixture";
import { source } from "../ranking-inputs-fixtures";
import { signInWithRateWindow } from "./auth-fixture";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
test.afterAll(() => db.end());
async function signIn(page: Page, role = "administrator") {
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption(role);
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
}
async function createFixture(page: Page) {
  return assessmentFixture(db, async (path, body) => {
    const r = body
      ? await page.request.post(path, {
          headers: { Origin: process.env.BETTER_AUTH_URL! },
          data: body,
        })
      : await page.request.get(path);
    return { status: r.status(), json: () => r.json(), text: () => r.text() };
  });
}
async function choose(page: Page, f: { divisionId: string; rulesId: string }) {
  await page.goto("/admin/event-assessments");
  await page.getByLabel("Division", { exact: true }).selectOption(f.divisionId);
  await page
    .getByLabel("Rule-source edition", { exact: true })
    .selectOption(f.rulesId);
  await expect(
    page.getByRole("heading", { name: "Reviewed inputs" }),
  ).toBeVisible();
}
test("staff complete ordinary sourced controls, queue real awards and review responsive exact breakdown/history", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await signIn(page);
  const f = await createFixture(page);
  const errors: string[] = [],
    server: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 500)
      server.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  await choose(page, f);
  await expect(
    page.getByText("No assessment has been queued for this division."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add evidence source" }).click();
  const sourceGroup = page.getByRole("group", {
    name: "Source 1",
    exact: true,
  });
  for (const [label, value] of [
    ["Source title", source.title],
    ["Source HTTPS URL", source.url],
    ["Inspected edition", source.edition],
    ["Actual retrieval timestamp", source.retrievedAt],
    ["Retrieved SHA-256", source.sha256],
  ])
    await sourceGroup
      .getByRole("textbox", { name: label, exact: true })
      .fill(value);
  for (const name of [
    "Category designation source",
    "Event eligibility and compliance source",
    "Exact pre-event ranking snapshot source",
  ])
    await page
      .getByRole("combobox", { name: new RegExp(`^${name}`) })
      .selectOption({ label: source.title });
  await page
    .getByRole("combobox", { name: /^Tour edition status/ })
    .selectOption("true");
  await page
    .getByLabel("WCTRS registration date", { exact: true })
    .fill("2026-09-01");
  await page
    .getByRole("textbox", {
      name: "Event rules and publication compliance evidence",
      exact: true,
    })
    .fill(f.evidence.event.complianceNote);
  await page
    .getByRole("textbox", {
      name: "Published roster, draw and end-score evidence URL",
      exact: true,
    })
    .fill(f.evidence.event.resultsUrl);
  await page
    .getByLabel("Pre-event ranking effective date", { exact: true })
    .fill("2026-11-17");
  await page
    .getByRole("textbox", {
      name: "Exact cutoff instant with offset",
      exact: true,
    })
    .fill("2026-11-17T12:00:00Z");
  await page
    .getByRole("textbox", { name: "Assessment review rationale", exact: true })
    .fill(f.evidence.reviewNote);
  const stages = page.getByRole("combobox", { name: /^Stage for game / });
  for (let i = 0; i < (await stages.count()); i++) {
    const label = await stages
      .nth(i)
      .locator("..")
      .evaluate((el) =>
        Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join(""),
      );
    await stages
      .nth(i)
      .selectOption(
        label?.includes("Qualification") ? "qualification" : "playoff",
      );
  }
  for (let i = 0; i < 8; i++) {
    const entry = page.getByRole("group", {
      name: `Fictional team ${i + 1}`,
      exact: true,
    });
    await entry
      .getByRole("combobox", { name: /^Ranking eligibility/ })
      .selectOption("eligible");
    await entry
      .getByRole("spinbutton", { name: "Exact pre-event rank", exact: true })
      .fill(String(31 + i));
    await entry
      .getByRole("textbox", { name: "Exact pre-event points", exact: true })
      .fill("100");
    await entry
      .getByRole("combobox", {
        name: /^Entry eligibility and participation source/,
      })
      .selectOption({ label: source.title });
    await entry
      .getByRole("textbox", {
        name: "Entry eligibility, throughout-play and first-game rationale",
        exact: true,
      })
      .fill(f.evidence.entries[i].note);
    await entry
      .getByText("Record throughout-play participation", { exact: true })
      .click();
    const games = entry.getByRole("group", { name: /^Participation game / });
    for (let j = 0; j < (await games.count()); j++) {
      const game = games.nth(j);
      await game
        .getByRole("button", {
          name: "Add observed participation segment",
          exact: true,
        })
        .click();
      const segment = game.getByRole("group", {
        name: "Observed segment 1",
        exact: true,
      });
      for (const checkbox of await segment.getByRole("checkbox").all())
        await checkbox.check();
    }
    await entry
      .getByText("Record throughout-play participation", { exact: true })
      .click();
    await entry
      .getByRole("button", {
        name: "Review this sourced roster for this event",
        exact: true,
      })
      .click();
    await expect(
      entry.getByText("Event roster review: recorded for revision 1", {
        exact: true,
      }),
    ).toBeVisible();
  }
  const queued = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/event-assessments") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Queue assessment", exact: true })
    .click();
  expect((await queued).status()).toBe(200);
  for (let i = 0; i < 30; i++) {
    await page
      .getByRole("button", { name: "Refresh job status", exact: true })
      .click();
    if (await page.getByRole("heading", { name: /Field strength 3.6/ }).count())
      break;
    await page.waitForTimeout(200);
  }
  await expect(
    page.getByRole("heading", { name: /Field strength 3.6/ }),
  ).toBeVisible();
  await expect(
    page.getByText("27 points · Placement award · multiplier 7.5 (15/2)", {
      exact: true,
    }),
  ).toBeVisible();
  for (const [name, width, height] of [
    ["phone", 360, 800],
    ["tablet", 768, 1024],
    ["desktop", 1440, 1000],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole("heading", { name: /Field strength 3.6/ })
      .scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${name}-event-awards.png`),
    });
    await page
      .getByRole("heading", { name: "Reviewed inputs", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`${name}-sourced-inputs.png`),
    });
  }
  await page.getByLabel("Assessment revision", { exact: true }).focus();
  await expect(
    page.getByLabel("Assessment revision", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Refresh job status", exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
  expect(server).toEqual([]);
});
test("assessment workspace shows loading/error and denies organizer access", async ({
  page,
}) => {
  await signIn(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/event-assessments", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/admin/event-assessments");
  await expect(
    page.getByText("Loading assessment review…", { exact: true }),
  ).toBeVisible();
  release();
  await expect(page.getByLabel("Division", { exact: true })).toBeVisible();
  await page.unroute("**/api/v1/event-assessments");
  await page.route("**/api/v1/event-assessments", (route) => route.abort());
  await page.reload();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.unroute("**/api/v1/event-assessments");
  await page
    .getByRole("button", { name: "Retry assessment workspace" })
    .click();
  await expect(page.getByLabel("Division", { exact: true })).toBeVisible();
  await page.context().clearCookies();
  await signIn(page, "organizer");
  await page.goto("/admin/event-assessments");
  await expect(page.getByRole("alert")).toContainText(
    "administrator authority",
  );
  await expect(page.getByLabel("Division", { exact: true })).toHaveCount(0);
});
test("lost committed acknowledgement survives reload, retries exact bytes, then stale source blocks a new command", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await signIn(page);
  const f = await createFixture(page);
  await choose(page, f);
  await page
    .getByText("Import or inspect sourced event evidence", { exact: true })
    .click();
  await page
    .getByLabel("Sourced event evidence JSON", { exact: true })
    .fill(JSON.stringify(f.evidence));
  await page
    .getByRole("button", { name: "Apply sourced evidence", exact: true })
    .click();
  const bodies: string[] = [];
  let lose = true;
  await page.route("**/api/v1/event-assessments", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    bodies.push(route.request().postData()!);
    if (lose) {
      lose = false;
      const real = await route.fetch();
      expect(real.status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Queue assessment", exact: true })
    .click();
  await expect(page.getByText(/Unconfirmed command retained/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Retry exact assessment command",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reviewed inputs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Queue revised assessment", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("retained-command-reload.png"),
  });
  await page
    .getByRole("button", {
      name: "Retry exact assessment command",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Event assessment queued. Refresh job status to review the worker result.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toBe(bodies[0]);
  await page.unroute("**/api/v1/event-assessments");
  await expect(
    page.getByLabel("Assessment revision", { exact: true }).locator("option"),
  ).toHaveCount(1);
  await db.query(
    "UPDATE division SET ranking_status='ineligible' WHERE id=$1",
    [f.divisionId],
  );
  await page
    .getByRole("button", { name: "Queue revised assessment", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Source evidence changed",
  );
  await expect(
    page.getByRole("button", { name: "Queue revised assessment", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Reload current review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Queue revised assessment", exact: true })
    .click();
  for (let i = 0; i < 30; i++) {
    await page
      .getByRole("button", { name: "Refresh job status", exact: true })
      .click();
    if (
      await page
        .getByRole("heading", {
          name: "Required issues block this assessment",
          exact: true,
        })
        .count()
    )
      break;
    await page.waitForTimeout(200);
  }
  await expect(
    page.getByRole("heading", {
      name: "Required issues block this assessment",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Current division ranking eligibility is unresolved or ineligible.",
      { exact: true },
    ),
  ).toBeVisible();
});
