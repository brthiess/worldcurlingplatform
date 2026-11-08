import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import pg from "pg";
import "dotenv/config";
import { signInApiWithRateWindow } from "./auth-fixture";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
test.afterAll(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
async function login(request: APIRequestContext, role = "organizer") {
  expect(
    (
      await signInApiWithRateWindow(
        request,
        `${role}@demo.invalid`,
        process.env.DEMO_PASSWORD,
      )
    ).status(),
  ).toBe(200);
}
async function fixture() {
  const edition = randomUUID(),
    division = randomUUID(),
    entries = [randomUUID(), randomUUID()],
    suffix = randomUUID().slice(0, 8);
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) SELECT $1,series_id,$2,'Demo ice','Demo city','UTC','2027-01-01','2027-01-03','fictional_demo',true,'approved' FROM event_edition LIMIT 1",
    [edition, `Fictional registration ${suffix}`],
  );
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format,entry_season) VALUES($1,$2,'Registration division','men_four','single_knockout','2026-27')",
    [division, edition],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-organizer','organizer',$2)",
    [randomUUID(), edition],
  );
  for (const [i, id] of entries.entries())
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [id, division, `Fictional team ${i + 1} ${suffix}`],
    );
  return { edition, division, entries, suffix };
}
async function open(
  request: APIRequestContext,
  divisionId: string,
  mode = "open",
  feeMinor = 0,
) {
  const r = await request.post("/api/v1/registration", {
    headers: { Origin: base },
    data: {
      action: "open",
      requestId: randomUUID(),
      divisionId,
      version: 0,
      terms: {
        mode,
        capacity: 1,
        requirements:
          "Four-player event lineup; provisional records remain visible",
        feeMinor,
        currency: "CAD",
        paymentTerms: feeMinor
          ? "Pay within one minute of acceptance"
          : "No entry fee",
        paymentWindowMinutes: 1,
        format: "single_knockout",
        formatNotes: "Single elimination with no consolation",
      },
    },
  });
  expect(r.status()).toBe(200);
}
for (const [label, width, height] of [
  ["phone", 360, 900],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${label}: open complete terms, accept zero-fee place and show full waitlist honestly`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
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
    const f = await fixture();
    await login(page.request);
    await page.goto("/admin/registration");
    await page.getByLabel("Division", { exact: true }).selectOption(f.division);
    await expect(
      page.getByRole("heading", { name: "Registration not open" }),
    ).toBeVisible();
    await page.getByLabel("Capacity", { exact: true }).fill("1");
    await page
      .getByLabel("Entry requirements", { exact: true })
      .fill("Four-player lineup; provisional identities remain visible");
    await page
      .getByLabel("Payment terms", { exact: true })
      .fill("No entry fee");
    await page
      .getByLabel("Format configuration", { exact: true })
      .fill("Single elimination with no consolation");
    await page.getByLabel("Entry mode", { exact: true }).focus();
    await expect(page.getByLabel("Entry mode", { exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Capacity", { exact: true })).toBeFocused();
    await page
      .getByRole("button", { name: "Open entries with these terms" })
      .click();
    await expect(
      page.getByText("1 of 1 places remaining", { exact: true }),
    ).toBeVisible();
    const first = page.getByRole("listitem").filter({
      has: page.getByRole("heading", {
        name: `Fictional team 1 ${f.suffix}`,
      }),
    });
    await first.getByRole("button", { name: "Request entry place" }).click();
    await expect(first.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(
      page.getByText("0 of 1 places remaining", { exact: true }),
    ).toBeVisible();
    const second = page.getByRole("listitem").filter({
      has: page.getByRole("heading", {
        name: `Fictional team 2 ${f.suffix}`,
      }),
    });
    await second.getByRole("button", { name: "Request entry place" }).click();
    await expect(
      second.getByText("Waitlisted — no reserved place", { exact: true }),
    ).toBeVisible();
    await expect(first).toContainText("Payment: not required");
    await expect(first).toContainText(
      "Ranking eligibility: separate assessment",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(network).toEqual([]);
    await page.screenshot({
      path: `docs/verification/assets/WCP-009/${label}-registration.png`,
      fullPage: true,
    });
    await page.goto(`/events/${f.edition}`);
    await expect(page.getByText(/Admission: accepted/)).toBeVisible();
    await expect(page.getByText(/Admission: waitlisted/)).toBeVisible();
  });
}
test("reviewed fee holds expire, and invitation-only representatives can request only an explicit invitation", async ({
  page,
}) => {
  test.setTimeout(120000);
  const reviewed = await fixture();
  await login(page.request);
  await open(page.request, reviewed.division, "reviewed", 25000);
  await page.goto("/admin/registration");
  await page
    .getByLabel("Division", { exact: true })
    .selectOption(reviewed.division);
  const first = page.getByRole("listitem").filter({
    has: page.getByRole("heading", {
      name: `Fictional team 1 ${reviewed.suffix}`,
    }),
  });
  await first.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.getByText("1 of 1 places remaining", { exact: true }),
  ).toBeVisible();
  await first.getByRole("button", { name: "Accept entry" }).click();
  await expect(
    first.getByText("Held — awaiting payment", { exact: true }),
  ).toBeVisible();
  await expect(first).toContainText("Payment: unpaid");
  await expect(first).toContainText("Payment deadline:");
  await pool.query(
    "UPDATE event_entry SET reservation_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",
    [reviewed.entries[0]],
  );
  await page
    .getByRole("button", { name: "Refresh capacity", exact: true })
    .click();
  await expect(
    first.getByText("Expired — capacity released", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 of 1 places remaining", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Release expired holds" }).click();
  await expect(
    first.getByText("Expired — capacity released", { exact: true }),
  ).toBeVisible();
  const invited = await fixture();
  await open(page.request, invited.division, "invited");
  const team = randomUUID(),
    registration = randomUUID(),
    grant = randomUUID();
  await pool.query(
    "INSERT INTO team(id,discipline,core_key) VALUES($1,'men_four',$2)",
    [team, `browser-invited:${team}`],
  );
  await pool.query(
    "INSERT INTO season_registration VALUES($1,$2,'2026-27',1)",
    [registration, team],
  );
  await pool.query(
    "INSERT INTO season_roster_version(registration_id,version,display_name,actor_id) VALUES($1,1,'Fictional invited roster','demo-organizer')",
    [registration],
  );
  await pool.query(
    "UPDATE event_entry SET team_id=$2,season_registration_id=$3,entry_admission='submitted_pending' WHERE id=$1",
    [invited.entries[0], team, registration],
  );
  await pool.query(
    "INSERT INTO team_representation(id,user_id,registration_id,actions,created_by) VALUES($1,'demo-reviewer',$2,ARRAY['submit'],'demo-administrator')",
    [grant, registration],
  );
  await page
    .getByRole("button", { name: "Refresh capacity", exact: true })
    .click();
  await page
    .getByLabel("Division", { exact: true })
    .selectOption(invited.division);
  const row = page.getByRole("listitem").filter({
    has: page.getByRole("heading", {
      name: `Fictional team 1 ${invited.suffix}`,
    }),
  });
  await row.getByRole("button", { name: "Invite entry" }).click();
  await expect(
    row.getByText("Invited — place not reserved", { exact: true }),
  ).toBeVisible();
  await login(page.request, "reviewer");
  await page.reload();
  await page
    .getByLabel("Division", { exact: true })
    .selectOption(invited.division);
  await expect(page.getByRole("button", { name: "Invite entry" })).toHaveCount(
    0,
  );
  await row.getByRole("button", { name: "Request entry place" }).click();
  await expect(row.getByText("Accepted", { exact: true })).toBeVisible();
});
test("loading, empty, denied, stale and uncertain exact retry remain truthful", async ({
  page,
}) => {
  test.setTimeout(120000);
  const f = await fixture();
  await login(page.request);
  await open(page.request, f.division);
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/v1/registration", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/admin/registration");
  await expect(
    page.getByText("Loading entry terms and capacity…", { exact: true }),
  ).toBeVisible();
  release();
  await page.unrouteAll({ behavior: "wait" });
  await page.getByLabel("Division", { exact: true }).selectOption(f.division);
  // Another command changes this admission after this tab read version zero.
  expect(
    (
      await page.request.post("/api/v1/registration", {
        headers: { Origin: base },
        data: {
          action: "request",
          requestId: randomUUID(),
          divisionId: f.division,
          entryId: f.entries[0],
          version: 0,
        },
      })
    ).status(),
  ).toBe(200);
  const first = page.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: `Fictional team 1 ${f.suffix}` }),
  });
  await first.getByRole("button", { name: "Request entry place" }).click();
  await expect(
    page.getByText(/Admission changed in another tab/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Refresh capacity", exact: true })
    .click();
  await expect(first.getByText("Accepted", { exact: true })).toBeVisible();
  const pending = await fixture();
  await open(page.request, pending.division);
  await page
    .getByRole("button", { name: "Refresh capacity", exact: true })
    .click();
  await page
    .getByLabel("Division", { exact: true })
    .selectOption(pending.division);
  const requests: string[] = [];
  let lost = false;
  await page.route("**/api/v1/registration", async (route) => {
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
  await page
    .getByRole("button", { name: "Request entry place" })
    .first()
    .click();
  await expect(page.getByText(/command result is not confirmed/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Unconfirmed command retained/)).toBeVisible();
  await page
    .getByRole("button", {
      name: "Retry exact registration command",
      exact: true,
    })
    .click();
  await expect(page.getByText(/Registration command recorded/)).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  await page.unrouteAll({ behavior: "wait" });
  await page.context().setOffline(true);
  await page
    .getByRole("button", { name: "Refresh capacity", exact: true })
    .click();
  await expect(page.getByText(/Current capacity is stale/)).toBeVisible();
  await page.context().setOffline(false);
  await page
    .getByRole("button", { name: "Refresh capacity", exact: true })
    .click();
  const empty = await fixture();
  await pool.query("DELETE FROM event_entry WHERE division_id=$1", [
    empty.division,
  ]);
  await page
    .getByRole("button", { name: "Refresh capacity", exact: true })
    .click();
  await page
    .getByLabel("Division", { exact: true })
    .selectOption(empty.division);
  await expect(
    page.getByText(/No team entries in this division/),
  ).toBeVisible();
  await page.request.post("/api/auth/sign-out", {
    headers: { Origin: base },
    data: {},
  });
  await page.reload();
  await expect(
    page.getByText("Sign in to manage or request an entry place.", {
      exact: true,
    }),
  ).toBeVisible();
});
