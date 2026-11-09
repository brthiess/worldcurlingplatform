import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import pg from "pg";
import "dotenv/config";
import { signInApiWithRateWindow } from "./auth-fixture";
test.use({ trace: "off" });
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
test.afterAll(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
async function fixture(request: any) {
  expect(
    (
      await signInApiWithRateWindow(
        request,
        "organizer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
  const edition = randomUUID(),
    division = randomUUID(),
    entry = randomUUID(),
    suffix = randomUUID().slice(0, 8);
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) SELECT $1,series_id,$2,'Demo ice','Demo city','UTC','2027-01-01','2027-01-03','fictional_demo',true,'approved' FROM event_edition LIMIT 1",
    [edition, `Fictional finance ${suffix}`],
  );
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format,entry_season) VALUES($1,$2,'Finance division','men_four','single_knockout','2026-27')",
    [division, edition],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-organizer','organizer',$2)",
    [randomUUID(), edition],
  );
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
    [entry, division, `Fictional fee team ${suffix}`],
  );
  expect(
    (
      await request.post("/api/v1/registration", {
        headers: { Origin: base },
        data: {
          action: "open",
          requestId: randomUUID(),
          divisionId: division,
          version: 0,
          terms: {
            mode: "open",
            capacity: 1,
            requirements: "Four-player lineup",
            feeMinor: 12500,
            currency: "CAD",
            paymentTerms: "Pay during five-minute reservation",
            paymentWindowMinutes: 5,
            format: "single_knockout",
            formatNotes: "Single elimination",
          },
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/v1/registration", {
        headers: { Origin: base },
        data: {
          action: "request",
          requestId: randomUUID(),
          divisionId: division,
          entryId: entry,
          version: 0,
        },
      })
    ).status(),
  ).toBe(200);
  return { edition, division, entry, suffix };
}
for (const [label, width, height] of [
  ["phone", 360, 900],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${label}: staff records a reasoned exception and external receipt with clear amounts/history`, async ({
    page,
  }, info) => {
    const f = await fixture(page.request);
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      network: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.status() >= 500) network.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("/admin/entry-charges");
    const main = page.getByRole("main");
    await main.getByLabel("Division", { exact: true }).selectOption(f.division);
    await expect(
      main.getByRole("heading", { name: "Entry charges & external receipts" }),
    ).toBeVisible();
    await expect(main.getByTestId("amount-due")).toHaveText("CAD 125.00");
    await main.getByLabel("Adjustment type", { exact: true }).focus();
    await expect(
      main.getByLabel("Adjustment type", { exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      main.getByLabel("Amount (CAD)", { exact: true }),
    ).toBeFocused();
    await main.getByLabel("Amount (CAD)", { exact: true }).fill("15.00");
    await main
      .getByLabel("Adjustment reason", { exact: true })
      .fill("Fictional junior team award");
    await page.screenshot({
      path: info.outputPath(`${label}-adjustment.png`),
      fullPage: true,
    });
    await main
      .getByRole("button", { name: "Record adjustment", exact: true })
      .click();
    await expect(main.getByTestId("amount-due")).toHaveText("CAD 110.00");
    await main
      .getByLabel("Adjustment type", { exact: true })
      .selectOption("external_receipt");
    await main.getByLabel("Amount (CAD)", { exact: true }).fill("110.00");
    await main
      .getByLabel("Adjustment reason", { exact: true })
      .fill("Fictional bank transfer verified by organizer");
    await main
      .getByLabel("External receipt reference", { exact: true })
      .fill(`demo-bank-${f.suffix}`);
    await main
      .getByRole("button", { name: "Record adjustment", exact: true })
      .click();
    await expect(main.getByTestId("amount-due")).toHaveText("CAD 0.00");
    await expect(main.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(
      main.getByText("Staff-attested external receipt", { exact: true }),
    ).toBeVisible();
    await expect(
      main.getByText(`demo-bank-${f.suffix}`, { exact: true }),
    ).toBeVisible();
    await expect(main).toContainText("Fictional junior team award");
    await expect(main).toContainText("No online payment is claimed");
    await page.reload();
    await main.getByLabel("Division", { exact: true }).selectOption(f.division);
    await expect(main.getByTestId("amount-due")).toHaveText("CAD 0.00");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include("main").analyze()).violations,
    ).toEqual([]);
    expect(errors).toEqual([]);
    expect(network).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${label}-ledger.png`),
      fullPage: true,
    });
  });
}
test("loading, empty, stale balances and uncertain actor-bound retries remain truthful", async ({
  page,
}) => {
  test.setTimeout(180000);
  const f = await fixture(page.request);
  const main = page.getByRole("main");
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/entry-charges", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/admin/entry-charges");
  await expect(
    main.getByText("Loading entry charges…", { exact: true }),
  ).toBeVisible();
  release();
  await page.unrouteAll({ behavior: "wait" });
  await main.getByLabel("Division", { exact: true }).selectOption(f.division);
  expect(
    (
      await page.request.post("/api/v1/entry-charges", {
        headers: { Origin: base },
        data: {
          action: "discount",
          requestId: randomUUID(),
          divisionId: f.division,
          entryId: f.entry,
          version: 1,
          amountMinor: 500,
          currency: "CAD",
          reason: "Fictional concurrent award",
        },
      })
    ).status(),
  ).toBe(200);
  await main.getByLabel("Amount (CAD)", { exact: true }).fill("10.00");
  await main
    .getByLabel("Adjustment reason", { exact: true })
    .fill("Fictional stale award");
  await main
    .getByRole("button", { name: "Record adjustment", exact: true })
    .click();
  await expect(main.getByText(/The financial version changed/)).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Record adjustment", exact: true }),
  ).toBeDisabled();
  await main
    .getByRole("button", { name: "Refresh ledger", exact: true })
    .click();
  await expect(main.getByTestId("amount-due")).toHaveText("CAD 120.00");
  const requests: string[] = [];
  let lost = false;
  await page.route("**/api/v1/entry-charges", async (route) => {
    if (route.request().method() === "POST") {
      requests.push(route.request().postData()!);
      if (!lost) {
        lost = true;
        await route.fetch();
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  await main
    .getByLabel("Adjustment type", { exact: true })
    .selectOption("external_receipt");
  await main.getByLabel("Amount (CAD)", { exact: true }).fill("20.00");
  await main
    .getByLabel("Adjustment reason", { exact: true })
    .fill("Fictional cash received");
  await main
    .getByLabel("External receipt reference", { exact: true })
    .fill("demo-uncertain-" + f.suffix);
  await main
    .getByRole("button", { name: "Record adjustment", exact: true })
    .click();
  await expect(main.getByText(/command result is not confirmed/)).toBeVisible();
  await page.reload();
  await expect(main.getByText(/Unconfirmed command retained/)).toBeVisible();
  await expect(
    main.getByRole("heading", {
      name: `Fictional fee team ${f.suffix}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(main.getByLabel("Division", { exact: true })).toBeDisabled();
  expect(
    (
      await signInApiWithRateWindow(
        page.request,
        "reviewer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
  await main
    .getByRole("button", { name: "Retry exact financial command", exact: true })
    .click();
  await expect(
    main.getByRole("alert").filter({ hasText: /signed-in account changed/ }),
  ).toBeVisible();
  expect(
    (
      await signInApiWithRateWindow(
        page.request,
        "organizer@demo.invalid",
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
  await main
    .getByRole("button", { name: "Retry exact financial command", exact: true })
    .click();
  await expect(main.getByText(/Financial command recorded/)).toBeVisible();
  await expect(main.getByTestId("amount-due")).toHaveText("CAD 100.00");
  expect(requests).toHaveLength(3);
  expect(new Set(requests).size).toBe(1);
  await page.unrouteAll({ behavior: "wait" });
  await page.context().setOffline(true);
  await main
    .getByRole("button", { name: "Refresh ledger", exact: true })
    .click();
  await expect(
    main
      .getByRole("alert")
      .filter({ hasText: /Current financial view is stale/ }),
  ).toBeVisible();
  await expect(main.getByTestId("amount-due")).toHaveText("CAD 100.00");
  await expect(
    main.getByRole("button", { name: "Record adjustment", exact: true }),
  ).toBeDisabled();
  await page.context().setOffline(false);
  await main
    .getByRole("button", { name: "Refresh ledger", exact: true })
    .click();
  const empty = randomUUID();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Fictional empty finance','men_four','single_knockout')",
    [empty, f.edition],
  );
  await main
    .getByRole("button", { name: "Refresh ledger", exact: true })
    .click();
  await main.getByLabel("Division", { exact: true }).selectOption(empty);
  await expect(
    main.getByText(/No team entries in this division/),
  ).toBeVisible();
  await expect(
    main.getByText(/Fee terms are unknown or not open/),
  ).toBeVisible();
  await page.request.post("/api/auth/sign-out", {
    headers: { Origin: base },
    data: {},
  });
  await page.reload();
  await expect(main.getByRole("alert")).toHaveText(
    "Sign in to view entry charges.",
  );
});

test("fee revisions and full waivers keep prior charges visible; late cleared balances require staff attention", async ({
  page,
}) => {
  test.setTimeout(120000);
  const f = await fixture(page.request),
    main = page.getByRole("main");
  await page.goto("/admin/entry-charges");
  await main.getByLabel("Division", { exact: true }).selectOption(f.division);
  await main.getByText("Revise fees for new charges", { exact: true }).click();
  await main.getByLabel("New fee amount (CAD)", { exact: true }).fill("180.25");
  await main
    .getByLabel("New payment terms", { exact: true })
    .fill("Updated new-charge terms");
  await main
    .getByLabel("Fee revision reason", { exact: true })
    .fill("Fictional ice rental increase");
  await main
    .getByRole("button", { name: "Save new fee version", exact: true })
    .click();
  await expect(main.getByText("CAD 180.25", { exact: true })).toBeVisible();
  await expect(main.getByTestId("amount-due")).toHaveText("CAD 125.00");
  await main
    .getByLabel("Adjustment type", { exact: true })
    .selectOption("waiver");
  await expect(main.getByLabel("Amount (CAD)", { exact: true })).toHaveValue(
    "125.00",
  );
  await main
    .getByLabel("Adjustment reason", { exact: true })
    .fill("Fictional sponsor waiver");
  await pool.query(
    "UPDATE event_entry SET reservation_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",
    [f.entry],
  );
  await main
    .getByRole("button", { name: "Record adjustment", exact: true })
    .click();
  await expect(
    main.getByText("Expired — capacity released", { exact: true }),
  ).toBeVisible();
  await expect(
    main.getByText("Staff attention required.", { exact: true }),
  ).toBeVisible();
  await expect(
    main.getByText("Remaining fee waived", { exact: true }),
  ).toBeVisible();
  await expect(main.getByTestId("amount-due")).toHaveText("CAD 0.00");
  await expect(main.getByText("Accepted", { exact: true })).toHaveCount(0);
});
test("a stale displayed fee cannot silently price a new manual charge", async ({
  page,
}) => {
  const f = await fixture(page.request),
    pending = randomUUID(),
    main = page.getByRole("main");
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
    [pending, f.division, `Fictional unpriced team ${f.suffix}`],
  );
  await page.goto("/admin/entry-charges");
  await main.getByLabel("Division", { exact: true }).selectOption(f.division);
  await main.getByLabel("Team entry", { exact: true }).selectOption(pending);
  await main
    .getByLabel("Adjustment reason", { exact: true })
    .fill("Fictional normal manual fee");
  expect(
    (
      await page.request.post("/api/v1/entry-charges", {
        headers: { Origin: base },
        data: {
          action: "revise_fee",
          requestId: randomUUID(),
          divisionId: f.division,
          version: 1,
          terms: {
            feeMinor: 20000,
            currency: "CAD",
            paymentTerms: "New reviewed fee",
          },
          reason: "Fictional fee revision in another tab",
        },
      })
    ).status(),
  ).toBe(200);
  await main
    .getByRole("button", { name: "Freeze normal charge", exact: true })
    .click();
  await expect(
    main.getByRole("alert").filter({ hasText: /quoted fee version changed/ }),
  ).toBeVisible();
  await expect(main.getByTestId("amount-due")).toHaveCount(0);
  await main
    .getByRole("button", { name: "Refresh ledger", exact: true })
    .click();
  await expect(main.getByText("CAD 200.00", { exact: true })).toBeVisible();
  await main
    .getByRole("button", { name: "Freeze normal charge", exact: true })
    .click();
  await expect(main.getByTestId("amount-due")).toHaveText("CAD 200.00");
  await main.getByLabel("Team entry", { exact: true }).selectOption(f.entry);
  await expect(main.getByTestId("amount-due")).toHaveText("CAD 125.00");
});

test("current team-season payment representatives can read but cannot attest receipts", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const f = await fixture(page.request),
    team = randomUUID(),
    registration = randomUUID(),
    grant = randomUUID();
  await pool.query(
    "INSERT INTO team(id,discipline,core_key) VALUES($1,'men_four',$2)",
    [team, `wcp010-browser:${team}`],
  );
  await pool.query(
    "INSERT INTO season_registration(id,team_id,season,version) VALUES($1,$2,'2026-27',1)",
    [registration, team],
  );
  await pool.query(
    "UPDATE event_entry SET team_id=$2,season_registration_id=$3 WHERE id=$1",
    [f.entry, team, registration],
  );
  await pool.query(
    "INSERT INTO team_representation(id,user_id,registration_id,actions,created_by) VALUES($1,'demo-reviewer',$2,ARRAY['payment'],'demo-administrator')",
    [grant, registration],
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
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/admin/entry-charges");
  const main = page.getByRole("main");
  await main.getByLabel("Division", { exact: true }).selectOption(f.division);
  await expect(main.getByTestId("amount-due")).toHaveText("CAD 125.00");
  await expect(
    main.getByRole("button", { name: "Record adjustment", exact: true }),
  ).toHaveCount(0);
  await expect(
    main.getByText("Revise fees for new charges", { exact: true }),
  ).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include("main").analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("phone-representative-ledger.png"),
    fullPage: true,
  });
  await pool.query(
    "UPDATE team_representation SET revoked_at=clock_timestamp(),revocation_reason='Fictional authority ended' WHERE id=$1",
    [grant],
  );
  await page.reload();
  await expect(
    main.getByRole("heading", {
      name: `Fictional fee team ${f.suffix}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    main.getByRole("option", {
      name: `Fictional fee team ${f.suffix}`,
      exact: true,
    }),
  ).toHaveCount(0);
});
