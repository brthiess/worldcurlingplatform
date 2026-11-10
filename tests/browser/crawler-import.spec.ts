import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInWithRateWindow, signInApiWithRateWindow } from "./auth-fixture";
import { randomUUID } from "node:crypto";
import pg from "pg";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
test.afterAll(async () => {
  await db.end();
});
async function signIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Demo persona").selectOption("administrator");
  await page.getByLabel("Demo password").fill(process.env.DEMO_PASSWORD!);
  await signInWithRateWindow(
    page,
    page.getByRole("button", { name: "Sign in", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Your workspace" }),
  ).toBeVisible();
}
test("fresh database shows honest empty staging history", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/imports");
  await expect(
    page.getByText("No imports have been staged.", { exact: true }),
  ).toBeVisible();
});
for (const width of [360, 768, 1440])
  test(`staff stages and inspects a real immutable historical batch at ${width}px`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    const failures: string[] = [];
    page.on("requestfailed", (r) => failures.push(r.url()));
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await signIn(page);
    errors.length = 0;
    await page.goto("/admin/imports");
    await expect(
      page.getByRole("heading", { name: "Historical import staging" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Stage configured export",
        exact: true,
      }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Stage configured export", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    const review = page.getByRole("region", { name: "Import batch review" });
    await expect(
      review.getByText("Frozen for review · private staging", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      review.getByText(
        "4 unique games · 44 source records · 50 evidence records",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      review.getByText(
        "113 retained quality issues. Evidence counts are not unique game counts.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      review.getByText("Final score only", { exact: true }),
    ).toBeVisible();
    await expect(
      review.getByText("Score unavailable", { exact: true }),
    ).toBeVisible();
    await expect(
      review.getByText(/Reported first-end hammer: Marco Hoesli/),
    ).toBeVisible();
    await expect(
      review.getByText("First-end hammer unknown", { exact: true }),
    ).toHaveCount(3);
    await expect(review.getByText("7–3", { exact: true })).toBeVisible();
    await review
      .getByRole("button", {
        name: "Inspect source src:cz:game:9473:13:391274",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("region", { name: "Frozen source record" }),
    ).toContainText("partial_score_evidence");
    await page.screenshot({
      path: info.outputPath(`imports-${width}.png`),
      fullPage: true,
    });
    await review
      .locator("article")
      .filter({ hasText: "Reported first-end hammer: Marco Hoesli" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath(`imports-${width}-known-hammer.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
    const batchId = await review.getAttribute("data-job-id");
    await page.reload();
    await page.getByText(/^Browse staging history \(/).click();
    await page
      .getByRole("button", { name: `Review batch ${batchId}`, exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Import batch review" })
        .getByText("Frozen for review · private staging", { exact: true }),
    ).toBeVisible();
  });
test("actual worker progress is visible, and lost acknowledgement retains the exact actor-bound command across reload", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await signIn(page);
  await page.goto("/admin/imports");
  await expect(
    page.getByRole("button", { name: "Stage configured export", exact: true }),
  ).toBeEnabled();
  const lock = await db.connect(),
    key = 140014;
  const barrierPid = (await lock.query("SELECT pg_backend_pid() AS id")).rows[0]
    .id;
  await lock.query("SELECT pg_advisory_lock($1)", [key]);
  let id = "",
    name = "",
    aborted = false;
  await page.route("**/api/v1/imports", async (route) => {
    if (route.request().method() !== "POST" || aborted) {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON();
    id = body.id;
    name = "wcp014_browser_" + id.replaceAll("-", "");
    await db.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.job_id='${id}' AND NEW.kind='game' THEN PERFORM pg_advisory_xact_lock(${key}); END IF; RETURN NEW; END $$; CREATE TRIGGER ${name} BEFORE INSERT ON import_record FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    );
    await route.fetch();
    aborted = true;
    await route.abort("failed");
  });
  try {
    await page
      .getByRole("button", { name: "Stage configured export", exact: true })
      .click();
    await expect(
      page.getByText(/The command result is not confirmed/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Stage configured export",
        exact: true,
      }),
    ).toBeDisabled();
    await page.reload();
    await expect(page.getByText(/Unconfirmed command retained/)).toBeVisible();
    await expect
      .poll(
        async () =>
          !!(
            await db.query(
              "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND $1::integer=ANY(pg_blocking_pids(pid))",
              [barrierPid],
            )
          ).rowCount,
      )
      .toBe(true);
    await page
      .getByRole("button", { name: "Retry exact import command", exact: true })
      .click();
    const review = page.getByRole("region", { name: "Import batch review" });
    await expect(
      review.getByText(
        "Reading and validating export · contents are not yet frozen",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 10000 });
    await expect(review).toBeFocused();
    await page.screenshot({
      path: info.outputPath("actual-running-progress.png"),
    });
    await lock.query("SELECT pg_advisory_unlock($1)", [key]);
    await expect(
      review.getByText("Frozen for review · private staging", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    expect(
      (await db.query("SELECT attempts FROM import_job WHERE id=$1", [id]))
        .rows[0].attempts,
    ).toBe(1);
  } finally {
    await lock.query("SELECT pg_advisory_unlock_all()");
    lock.release();
    await page.unroute("**/api/v1/imports");
    if (name)
      await db.query(
        `DROP TRIGGER IF EXISTS ${name} ON import_record; DROP FUNCTION IF EXISTS ${name}()`,
      );
  }
});
test("failed worker state can be retried and a failed refresh retains the last frozen preview", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await signIn(page);
  await page.goto("/admin/imports");
  await expect(
    page.getByRole("button", { name: "Stage configured export", exact: true }),
  ).toBeEnabled();
  let id = "",
    name = "";
  await page.route("**/api/v1/imports", async (route) => {
    if (route.request().method() !== "POST" || name) {
      await route.continue();
      return;
    }
    id = route.request().postDataJSON().id;
    name = "wcp014_browser_fail_" + id.replaceAll("-", "");
    await db.query(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.job_id='${id}' AND NEW.kind='game' THEN RAISE EXCEPTION 'WCP014 controlled browser worker failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${name} BEFORE INSERT ON import_record FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    );
    await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Stage configured export", exact: true })
      .click();
    const review = page.getByRole("region", { name: "Import batch review" });
    await expect(
      review.getByText("Staging failed · no batch contents committed", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 30000 });
    await page.screenshot({
      path: info.outputPath("actual-worker-failure.png"),
    });
  } finally {
    await page.unroute("**/api/v1/imports");
    if (name)
      await db.query(
        `DROP TRIGGER IF EXISTS ${name} ON import_record; DROP FUNCTION IF EXISTS ${name}()`,
      );
  }
  await page
    .getByRole("button", { name: "Retry this staging job", exact: true })
    .click();
  const review = page.getByRole("region", { name: "Import batch review" });
  await expect(
    review.getByText("Frozen for review · private staging", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.route("**/api/v1/imports**", (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "Refresh import state", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(
    review.getByText(
      "4 unique games · 44 source records · 50 evidence records",
      { exact: true },
    ),
  ).toBeVisible();
  await page.unroute("**/api/v1/imports**");
  await page
    .getByRole("button", { name: "Refresh import state", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("read-only reconciliation requires the full original import command and current original account", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await signIn(page);
  await page.goto("/admin/imports");
  await expect(
    page.getByRole("button", { name: "Stage configured export", exact: true }),
  ).toBeEnabled();
  const actorId = (await (await page.request.get("/api/v1/imports")).json())
      .actorId,
    key = `wcp-import:${actorId}`,
    grant = randomUUID();
  let intercepted = false,
    writes = 0,
    allPosts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST") {
      allPosts++;
      if (new URL(r.url()).pathname.startsWith("/api/v1/")) writes++;
    }
  });
  await page.route("**/api/v1/imports", async (route) => {
    if (route.request().method() !== "POST" || intercepted) {
      await route.continue();
      return;
    }
    await route.fetch();
    intercepted = true;
    await route.abort("failed");
  });
  try {
    await page
      .getByRole("button", { name: "Stage configured export", exact: true })
      .click();
    await expect(
      page.getByText(/The command result is not confirmed/),
    ).toBeVisible();
    const original = await page.evaluate(
      (key) => sessionStorage.getItem(key)!,
      key,
    );
    for (const variant of ["action", "path", "body"]) {
      const changed = JSON.parse(original);
      if (variant === "action") {
        const body = JSON.parse(changed.body);
        body.action = "retry";
        changed.body = JSON.stringify(body);
      } else if (variant === "path") changed.path = "/api/v1/overall-rankings";
      else {
        const body = JSON.parse(changed.body);
        body.unrecorded = "changed content";
        changed.body = JSON.stringify(body);
      }
      const bytes = JSON.stringify(changed);
      await page.evaluate(
        ([key, value]) => sessionStorage.setItem(key, value),
        [key, bytes],
      );
      await page.reload();
      await expect(
        page.getByText(/Unconfirmed command retained/),
      ).toBeVisible();
      await page
        .getByRole("button", {
          name: "Reconcile recorded import command",
          exact: true,
        })
        .click();
      await expect(page.locator("main").getByRole("alert")).toContainText(
        "Recorded state could not confirm the original command",
      );
      await expect(
        page.getByRole("button", {
          name: "Stage configured export",
          exact: true,
        }),
      ).toBeDisabled();
      expect(
        await page.evaluate((key) => sessionStorage.getItem(key), key),
      ).toBe(bytes);
      await page.evaluate(
        ([key, value]) => sessionStorage.setItem(key, value),
        [key, original],
      );
      await page.reload();
      await expect(
        page.getByText(/Unconfirmed command retained/),
      ).toBeVisible();
    }
    await db.query(
      "INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES($1,'demo-reviewer','administrator',NULL,NULL)",
      [grant],
    );
    expect(
      (
        await page.request.post("/api/auth/sign-out", {
          headers: { Origin: process.env.BETTER_AUTH_URL! },
          data: {},
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await signInApiWithRateWindow(
          page.request,
          "reviewer@demo.invalid",
          process.env.DEMO_PASSWORD,
        )
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button", {
        name: "Reconcile recorded import command",
        exact: true,
      })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Recorded state could not confirm the original command",
    );
    expect(await page.evaluate((key) => sessionStorage.getItem(key), key)).toBe(
      original,
    );
    expect(
      (
        await page.request.post("/api/auth/sign-out", {
          headers: { Origin: process.env.BETTER_AUTH_URL! },
          data: {},
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await signInApiWithRateWindow(
          page.request,
          "administrator@demo.invalid",
          process.env.DEMO_PASSWORD,
        )
      ).status(),
    ).toBe(200);
    const equivalent = JSON.parse(original),
      body = JSON.parse(equivalent.body);
    equivalent.body = JSON.stringify({
      sourceDigest: body.sourceDigest,
      id: body.id,
      action: body.action,
    });
    await page.evaluate(
      ([key, value]) => sessionStorage.setItem(key, value),
      [key, JSON.stringify(equivalent)],
    );
    await page.reload();
    await expect(page.getByText(/Unconfirmed command retained/)).toBeVisible();
    const postsBeforeRecovery = allPosts;
    await page
      .getByRole("button", {
        name: "Reconcile recorded import command",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        "The original command was reconciled with recorded history. Review its current status below.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Stage configured export",
        exact: true,
      }),
    ).toBeEnabled();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), key)).toBe(
      null,
    );
    expect(writes).toBe(1);
    expect(allPosts).toBe(postsBeforeRecovery);
    await page.screenshot({
      path: info.outputPath("reconciled-exact-original-through-reads.png"),
    });
  } finally {
    await page.unroute("**/api/v1/imports");
    await db.query("DELETE FROM role_grant WHERE id=$1", [grant]);
  }
});
