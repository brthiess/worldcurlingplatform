import { test, expect } from "@playwright/test";
import { signInWithRateWindow } from "./auth-fixture";
import AxeBuilder from "@axe-core/playwright";
import pg from "pg";
import {
  overallFixture,
  overallReviewEvidence,
} from "../overall-rankings-fixture";
import { source } from "../ranking-inputs-fixtures";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
test.afterAll(() => db.end());
test.use({ actionTimeout: 10000 });
test("overall review loads and shows honest empty/input state", async ({
  page,
}) => {
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption("administrator");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  await page.goto("/admin/overall-rankings");
  await expect(
    page.getByRole("heading", { name: "Four-player overall drafts" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Effective date", { exact: true }),
  ).toBeVisible();
});

test("staff review ordinary sources and full ownership, inspect exact persistent awards at three widths, keyboard and axe", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption("administrator");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  const send = async (path: string, body?: unknown) => {
    const r = body
      ? await page.request.post(path, {
          headers: { Origin: process.env.BETTER_AUTH_URL! },
          data: body,
        })
      : await page.request.get(path);
    return { status: r.status(), json: () => r.json(), text: () => r.text() };
  };
  const f = await overallFixture(db, send),
    issues: string[] = [];
  page.on("pageerror", (e) => issues.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") issues.push(m.text());
  });
  page.on("requestfailed", (r) => issues.push(`${r.method()} ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 500) issues.push(`HTTP${r.status()} ${r.url()}`);
  });
  await page.goto("/admin/overall-rankings");
  await page
    .getByRole("combobox", { name: /^Discipline$/ })
    .selectOption(f.discipline);
  await page
    .getByRole("combobox", { name: /^Rule-source edition$/ })
    .selectOption(f.rulesId);
  await page
    .getByRole("button", { name: "Load current review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sources and coverage" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start new evidence review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Calculate overall draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Blocked overall draft/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add evidence source", exact: true })
    .click();
  const group = page.getByRole("group", { name: "Source 1", exact: true });
  for (const [label, value] of [
    ["Source identifier", source.id],
    ["Source title", source.title],
    ["Source HTTPS URL", source.url],
    ["Inspected edition", source.edition],
    ["Actual retrieval timestamp", source.retrievedAt],
    ["Retrieved SHA-256", source.sha256],
  ])
    await group.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("Overall review rationale", { exact: true })
    .fill(
      "Fictional ordinary-control full-universe review; source metadata is synthetic, no official endorsement.",
    );
  const review = await (
    await page.request.get(
      `/api/v1/overall-rankings?discipline=${f.discipline}&date=2026-11-23&rules=${f.rulesId}`,
    )
  ).json();
  const eventGroups = page
    .getByRole("group")
    .filter({ has: page.getByRole("combobox", { name: /^Event coverage$/ }) });
  for (let i = 0; i < review.review.events.length; i++) {
    const g = eventGroups.nth(i);
    await g
      .getByRole("combobox", { name: /^Event coverage$/ })
      .selectOption(
        review.review.events[i].divisionId === f.divisionId
          ? "assessed"
          : "excluded",
      );
    await g
      .getByRole("combobox", { name: /^Event coverage source$/ })
      .selectOption("official");
    await g
      .getByLabel("Event coverage rationale", { exact: true })
      .fill(
        "Fictional reviewed actual assessment or independent event exclusion.",
      );
  }
  for (const s of review.review.subjects) {
    await page
      .getByRole("combobox", { name: /^Season subject$/ })
      .selectOption(s.registrationId);
    await page
      .getByRole("combobox", { name: /^Subject eligibility$/ })
      .selectOption(
        f.seasonIds.includes(s.registrationId) ? "eligible" : "excluded",
      );
    await page
      .getByRole("combobox", { name: /^Subject eligibility source$/ })
      .selectOption("official");
    await page
      .getByLabel("Subject eligibility rationale", { exact: true })
      .fill("Fictional current individual ownership and eligibility decision.");
    await page
      .getByRole("combobox", { name: /^Continuity decision$/ })
      .selectOption("none");
    await page
      .getByRole("combobox", { name: /^Continuity source$/ })
      .selectOption("official");
    await page
      .getByLabel("Continuity rationale", { exact: true })
      .fill(
        "No applicable prior roster continuity floor; individually reviewed rights.",
      );
    await page
      .getByRole("combobox", { name: /^Ordinary adjustments$/ })
      .selectOption("none");
    await page
      .getByRole("combobox", { name: /^Adjustment applicability source$/ })
      .selectOption("official");
    await page
      .getByLabel("Adjustment applicability rationale", { exact: true })
      .fill(
        "No outstanding ordinary ownership changes, penalties or exemptions.",
      );
  }
  await page
    .getByRole("button", { name: "Calculate overall draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Ready overall draft/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect Fictional team 1", exact: true })
    .click();
  const contribution = page.getByRole("region", {
    name: "Subject contributions",
  });
  await expect(contribution).toContainText("weighted carryover 75");
  await expect(contribution).toContainText("2026-11-22 · 27");
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1100],
    ["phone", 360, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page
      .getByRole("heading", { name: /Ready overall draft/ })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `docs/verification/assets/WCP-034/${name}-overall-draft.png`,
      fullPage: true,
    });
    await page.screenshot({
      path: `docs/verification/assets/WCP-034/${name}-draft-viewport.png`,
    });
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.locator("body").evaluate((e) => e.clientWidth),
    );
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations).toEqual([]);
    await info.attach(`${name}-axe`, {
      body: JSON.stringify(axe),
      contentType: "application/json",
    });
  }
  await page
    .getByRole("button", { name: "Replay frozen draft", exact: true })
    .focus();
  await expect(
    page.getByRole("button", { name: "Replay frozen draft", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(
      "Frozen replay matched the original contributions and result digest.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("combobox", { name: /^Discipline$/ })
    .selectOption(f.discipline);
  await page
    .getByRole("combobox", { name: /^Rule-source edition$/ })
    .selectOption(f.rulesId);
  await page
    .getByRole("button", { name: "Load current review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Ready overall draft/ }),
  ).toBeVisible();
  expect(issues).toEqual([]);
});

test("loading, failed reads, stale review, denied access and committed lost acknowledgement retain truthful state", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption("administrator");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  const send = async (path: string, body?: unknown) => {
    const r = body
      ? await page.request.post(path, {
          headers: { Origin: process.env.BETTER_AUTH_URL! },
          data: body,
        })
      : await page.request.get(path);
    return { status: r.status(), json: () => r.json(), text: () => r.text() };
  };
  const f = await overallFixture(db, send),
    url = `/api/v1/overall-rankings?discipline=${f.discipline}&date=2026-11-23&rules=${f.rulesId}`,
    w = await (await page.request.get(url)).json(),
    evidence = overallReviewEvidence(w.review, f);
  const saved = await page.request.post("/api/v1/overall-rankings", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      action: "calculate",
      discipline: f.discipline,
      effectiveDate: "2026-11-23",
      rulesId: f.rulesId,
      version: w.version,
      sourceDigest: w.review.sourceDigest,
      requestId: crypto.randomUUID(),
      evidence,
    },
  });
  expect(saved.status()).toBe(200);
  expect((await saved.json()).result.state).toBe("ready");
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let finished!: () => void;
  const held = new Promise<void>((r) => (finished = r));
  await page.route("**/api/v1/overall-rankings", async (route) => {
    await gate;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Controlled review connection failure" }),
    });
    finished();
  });
  await page.goto("/admin/overall-rankings");
  await expect(
    page.getByText("Loading overall review…", { exact: true }),
  ).toBeVisible();
  release();
  await held;
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Controlled review connection failure",
  );
  await page.unroute("**/api/v1/overall-rankings");
  await page
    .getByRole("button", { name: "Retry review loading", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: /^Discipline$/ })
    .selectOption(f.discipline);
  await page
    .getByRole("combobox", { name: /^Rule-source edition$/ })
    .selectOption(f.rulesId);
  await page
    .getByRole("button", { name: "Load current review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Ready overall draft/ }),
  ).toBeVisible();
  const badRead = "**/api/v1/overall-rankings?*";
  await page.route(badRead, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Controlled stale-source read failure" }),
    }),
  );
  await page
    .getByRole("button", { name: "Load current review", exact: true })
    .click();
  await expect(
    page.getByText(/Stale review. Last successful data remains visible/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Ready overall draft/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Calculate overall draft", exact: true }),
  ).toBeDisabled();
  await page.unroute(badRead);
  await page
    .getByRole("button", { name: "Load current review", exact: true })
    .click();
  let intercepted = false;
  await page.route("**/api/v1/overall-rankings", async (route) => {
    if (route.request().method() === "POST" && !intercepted) {
      intercepted = true;
      const actual = await route.fetch();
      expect(actual.status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Calculate overall draft", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "not confirmed",
  );
  await expect(
    page.getByRole("combobox", { name: /^Discipline$/ }),
  ).toBeDisabled();
  await page.unroute("**/api/v1/overall-rankings");
  await page.reload();
  await expect(
    page.getByText(/Unconfirmed command retained for this signed-in account/),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/verification/assets/WCP-034/retained-command-reload.png",
  });
  await page
    .getByRole("button", {
      name: "Retry exact overall ranking command",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Overall draft and immutable contributions saved.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Ready overall draft/ }),
  ).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("Demo persona").selectOption("organizer");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  await page.goto("/admin/overall-rankings");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "administrator authority",
  );
});

test("ordinary sourced award exclusion, retained roster and historical ownership check persist without rewriting original draft", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption("administrator");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  const send = async (path: string, body?: unknown) => {
    const r = body
      ? await page.request.post(path, {
          headers: { Origin: process.env.BETTER_AUTH_URL! },
          data: body,
        })
      : await page.request.get(path);
    return { status: r.status(), json: () => r.json(), text: () => r.text() };
  };
  const f = await overallFixture(db, send),
    url = `/api/v1/overall-rankings?discipline=${f.discipline}&date=2026-11-23&rules=${f.rulesId}`,
    w = await (await page.request.get(url)).json(),
    evidence = overallReviewEvidence(w.review, f);
  const old = await page.request.post("/api/v1/overall-rankings", {
    headers: { Origin: process.env.BETTER_AUTH_URL! },
    data: {
      action: "calculate",
      discipline: f.discipline,
      effectiveDate: "2026-11-23",
      rulesId: f.rulesId,
      version: w.version,
      sourceDigest: w.review.sourceDigest,
      requestId: crypto.randomUUID(),
      evidence,
    },
  });
  expect(old.status()).toBe(200);
  const original = await old.json();
  await page.goto("/admin/overall-rankings");
  await page
    .getByRole("combobox", { name: "Discipline", exact: true })
    .selectOption(f.discipline);
  await page
    .getByRole("combobox", { name: "Rule-source edition", exact: true })
    .selectOption(f.rulesId);
  await page
    .getByRole("button", { name: "Load current review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Ready overall draft/ }),
  ).toBeVisible();
  await page
    .getByLabel("Season subject", { exact: true })
    .selectOption(f.seasonIds[0]);
  await page
    .getByLabel("Continuity decision", { exact: true })
    .selectOption("retained");
  await page.getByLabel("Prior final team total", { exact: true }).fill("200");
  await page
    .getByLabel("Prior player 4", { exact: true })
    .fill(f.playerLists[1][0]);
  await page
    .getByRole("button", { name: "Add award ownership decision", exact: true })
    .click();
  await page
    .getByLabel("Frozen award", { exact: true })
    .selectOption(
      `${w.review.events.find((e: any) => e.divisionId === f.divisionId).assessment.id}:${f.entries[0]}`,
    );
  await page
    .getByLabel("Award decision", { exact: true })
    .selectOption("exclude");
  await page
    .getByLabel("Award decision source", { exact: true })
    .selectOption("official");
  await page
    .getByLabel("Award decision rationale", { exact: true })
    .fill(
      "Fictional ordinary sourced event exclusion preserves the original frozen27-point award.",
    );
  await page
    .getByRole("button", {
      name: "Add historical ownership check",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Transfer owner", { exact: true })
    .selectOption(f.playerLists[0][0]);
  await page
    .getByLabel("Prior-season departure date", { exact: true })
    .fill("2025-10-01");
  await page
    .getByLabel("Historical old played subtotal", { exact: true })
    .fill("200");
  await page
    .getByLabel("Historical amount source", { exact: true })
    .selectOption("official");
  await page
    .getByLabel("Prior-season applicability source", { exact: true })
    .selectOption("official");
  await page
    .getByLabel("Historical transfer applicability rationale", { exact: true })
    .fill(
      "Synthetic applicable prior-season decision200×1/4=50. This is documentary starting ownership only, not a current event award or retroactive official rule claim.",
    );
  await page
    .getByRole("button", { name: "Calculate overall draft", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Ready overall draft/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect Fictional team 1", exact: true })
    .click();
  const contribution = page.getByRole("region", {
    name: "Subject contributions",
  });
  await expect(contribution).toContainText("continuity floor 200");
  await expect(contribution).toContainText("2026-11-22 · 27");
  await expect(contribution).toContainText(
    "Fictional ordinary sourced event exclusion",
  );
  await page
    .getByLabel("Draft revision", { exact: true })
    .selectOption(original.id);
  await expect(
    page.getByRole("heading", {
      name: `Ready overall draft · revision ${original.version}`,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect Fictional team 1", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Subject contributions" }),
  ).toContainText("No excluded awards.");
  const unchanged = await (
    await page.request.get(`/api/v1/overall-rankings?id=${original.id}`)
  ).json();
  expect(unchanged.resultDigest).toBe(original.resultDigest);
  expect(
    unchanged.result.rows.find((r: any) => r.id === f.seasonIds[0]).total,
  ).toBe("102");
});
