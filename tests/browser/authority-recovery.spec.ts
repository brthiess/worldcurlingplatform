import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authApiWithRateWindow } from "./auth-fixture";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import AxeBuilder from "@axe-core/playwright";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});
const users: string[] = [];
test.afterAll(async () => {
  await pool.query("DELETE FROM auth_user WHERE id=ANY($1::text[])", [users]);
  await pool.end();
});
const base = process.env.BETTER_AUTH_URL!;
test.describe.configure({ timeout: 180000 });
async function login(page: Page, role = "administrator") {
  const response = await authApiWithRateWindow(() =>
    page.request.post("/api/auth/sign-in/email", {
      headers: { Origin: base },
      data: {
        email: `${role}@demo.invalid`,
        password: process.env.DEMO_PASSWORD,
      },
    }),
  );
  expect(response.status()).toBe(200);
}
test("committed grant acknowledgement loss freezes editing, survives reload and retries identical bytes with one authority and routing", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  const name = `Recovery authority ${randomUUID().slice(0, 8)}`,
    category = `recovery_${randomUUID().slice(0, 8)}`;
  const attempts: string[] = [];
  try {
    await page.goto("/admin/authority");
    await page.getByLabel("Authority name", { exact: true }).fill(name);
    await page
      .getByLabel("Assigned reviewer", { exact: true })
      .selectOption("demo-reviewer");
    await page.getByLabel("Countries", { exact: true }).fill("Canada");
    await page
      .getByLabel("Organizing organizations", { exact: true })
      .selectOption("prairie-club");
    await page
      .getByLabel("Disciplines", { exact: true })
      .selectOption("men_four");
    await page.getByLabel("Event categories", { exact: true }).fill(category);
    await page
      .getByLabel("Delegation reason", { exact: true })
      .fill("Committed acknowledgement recovery");
    await page.route("**/api/v1/approval-delegations", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts.push(route.request().postData()!);
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      if (attempts.length === 1) return route.abort("failed");
      await route.fulfill({ response });
    });
    await page
      .getByRole("button", { name: "Grant approval delegation", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "not confirmed",
    );
    await expect(
      page.getByLabel("Authority name", { exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel("Event", { exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Grant approval delegation",
        exact: true,
      }),
    ).toBeDisabled();
    await page.getByText("Review retained command", { exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("status")
      .filter({ hasText: "Unconfirmed command retained" })
      .screenshot({ path: info.outputPath("retained-grant-command.png") });
    await page.reload();
    await expect(
      page.getByLabel("Authority name", { exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Retry exact authority command",
        exact: true,
      })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Approval delegation recorded.", { exact: true }),
    ).toBeVisible();
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toBe(attempts[0]);
    const id = JSON.parse(attempts[0]).id;
    const workspace = await (
      await page.request.get("/api/v1/approval-delegations")
    ).json();
    expect(
      workspace.delegations.filter(
        (g: { authorityName: string; revokedAt: string | null }) =>
          g.authorityName === name && !g.revokedAt,
      ),
    ).toHaveLength(1);
    expect(
      workspace.history.filter(
        (h: { resourceId: string; kind: string }) =>
          h.resourceId === id && h.kind === "approval_grant",
      ),
    ).toHaveLength(1);
    const appId = randomUUID();
    const response = await page.request.post("/api/v1/applications", {
      headers: { Origin: base },
      data: {
        id: appId,
        requestId: randomUUID(),
        action: "create",
        application: {
          organizationId: "prairie-club",
          seriesId: "prairie",
          name: "Recovered scoped application",
          startsOn: "2027-11-08",
          endsOn: "2027-11-10",
          city: "Regina",
          country: "Canada",
          venue: "",
          timezone: "America/Regina",
          category,
          divisions: [
            { id: randomUUID(), name: "Men", discipline: "men_four" },
          ],
        },
      },
    });
    expect(response.status()).toBe(201);
    const app = await response.json();
    expect(app.reviewerId).toBe("demo-reviewer");
    expect(app.delegationId).toBe(id);
    expect(app.authorityName).toBe(name);
    await page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .screenshot({ path: info.outputPath("recovered-single-authority.png") });
  } finally {
    await page.unroute("**/api/v1/approval-delegations");
    const workspace = await (
      await page.request.get("/api/v1/approval-delegations")
    ).json();
    for (const grant of workspace.delegations.filter(
      (g: { authorityName: string; revokedAt: string | null }) =>
        g.authorityName === name && !g.revokedAt,
    ))
      expect(
        (
          await page.request.post("/api/v1/approval-delegations", {
            headers: { Origin: base },
            data: {
              action: "revoke",
              id: grant.id,
              reason: "Recovery fixture complete",
            },
          })
        ).status(),
      ).toBe(200);
  }
});
async function loseOnce(page: Page, path: string, status: number) {
  const attempts: string[] = [];
  await page.route("**" + path, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts.push(route.request().postData()!);
    const result = await route.fetch();
    expect(result.status()).toBe(status);
    if (attempts.length === 1) return route.abort("failed");
    await route.fulfill({ response: result });
  });
  return attempts;
}
test("scoring assignment and revocation acknowledgement loss recover exact receipts with current scope", async ({
  page,
  browser,
}) => {
  const userId = `recovery-${randomUUID()}`,
    name = "Recovery volunteer " + randomUUID().slice(0, 8);
  users.push(userId);
  await pool.query(
    "INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,$2,$3,true)",
    [userId, name, `${userId}@demo.invalid`],
  );
  await pool.query(
    "INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now())",
    [randomUUID(), userId, await hashPassword(process.env.DEMO_PASSWORD!)],
  );
  await login(page, "organizer");
  try {
    await page.goto("/admin/authority");
    await page
      .getByLabel("Event", { exact: true })
      .selectOption("prairie-2026");
    await page.getByLabel("Game", { exact: true }).selectOption("game-3");
    await page
      .getByLabel("Scorekeeper account email", { exact: true })
      .fill(`${userId}@demo.invalid`);
    await page
      .getByLabel("Assignment reason", { exact: true })
      .fill("Recovery scoring duty");
    const grantAttempts = await loseOnce(page, "/api/v1/role-grants", 201);
    await page
      .getByRole("button", { name: "Assign scoring access", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "not confirmed",
    );
    for (const label of [
      "Event",
      "Game",
      "Scorekeeper account email",
      "Assignment reason",
    ])
      await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Retry exact authority command",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Scoring assignment saved.", { exact: true }),
    ).toBeVisible();
    expect(grantAttempts).toHaveLength(2);
    expect(grantAttempts[1]).toBe(grantAttempts[0]);
    const id = JSON.parse(grantAttempts[0]).id;
    let workspace = await (
      await page.request.get("/api/v1/role-grants")
    ).json();
    expect(
      workspace.grants.filter((g: { id: string }) => g.id === id),
    ).toHaveLength(1);
    await page.unroute("**/api/v1/role-grants");
    await page
      .getByLabel(`Reason to end ${name}’s assignment`, { exact: true })
      .fill("Recovered shift finished");
    const revokeAttempts = await loseOnce(page, "/api/v1/role-grants", 200);
    await page
      .getByRole("button", {
        name: `Revoke scoring for ${name} · game-3`,
        exact: true,
      })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "not confirmed",
    );
    await page.reload();
    await expect(page.getByLabel("Event", { exact: true })).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Retry exact authority command",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Scoring assignment revoked.", { exact: true }),
    ).toBeVisible();
    expect(revokeAttempts).toHaveLength(2);
    expect(revokeAttempts[1]).toBe(revokeAttempts[0]);
    workspace = await (await page.request.get("/api/v1/role-grants")).json();
    expect(workspace.grants.some((g: { id: string }) => g.id === id)).toBe(
      false,
    );
    const history = (
      await (await page.request.get("/api/v1/approval-delegations")).json()
    ).history.filter((h: { resourceId: string }) => h.resourceId === id);
    expect(history).toHaveLength(2);
    expect(history.map((h: { kind: string }) => h.kind).sort()).toEqual([
      "role_granted",
      "staff_revoked",
    ]);
    const denied = await browser.newContext();
    try {
      const r = await authApiWithRateWindow(() =>
        denied.request.post("/api/auth/sign-in/email", {
          headers: { Origin: base },
          data: {
            email: `${userId}@demo.invalid`,
            password: process.env.DEMO_PASSWORD,
          },
        }),
      );
      expect(r.status()).toBe(200);
      expect(
        (await denied.request.get("/api/v1/games/game-3/scoring")).status(),
      ).toBe(403);
    } finally {
      await denied.close();
    }
  } finally {
    await page.unroute("**/api/v1/role-grants");
    const current = await (
      await page.request.get("/api/v1/role-grants")
    ).json();
    for (const g of current.grants.filter(
      (g: { userId: string }) => g.userId === userId,
    ))
      await page.request.post("/api/v1/role-grants", {
        headers: { Origin: base },
        data: {
          action: "revoke",
          id: g.id,
          reason: "Recovery fixture cleanup",
        },
      });
  }
});
test("reassignment and decided override loss retry the original version/body; saved refresh loss reconciles without a second mutation", async ({
  page,
}) => {
  await login(page);
  const id = randomUUID(),
    grantId = randomUUID(),
    name = "Recovery responsibility " + randomUUID().slice(0, 8),
    category = "recover_responsibility_" + randomUUID().slice(0, 8);
  let response = await page.request.post("/api/v1/applications", {
    headers: { Origin: base },
    data: {
      id,
      requestId: randomUUID(),
      action: "create",
      application: {
        organizationId: "prairie-club",
        seriesId: "prairie",
        name,
        startsOn: "2027-11-08",
        endsOn: "2027-11-10",
        city: "Regina",
        country: "Canada",
        venue: "",
        timezone: "America/Regina",
        category,
        divisions: [{ id: randomUUID(), name: "Men", discipline: "men_four" }],
      },
    },
  });
  expect(response.status()).toBe(201);
  let app = await response.json();
  response = await page.request.post(`/api/v1/applications/${id}`, {
    headers: { Origin: base },
    data: { requestId: randomUUID(), action: "submit", version: app.version },
  });
  expect(response.status()).toBe(200);
  expect(
    (
      await page.request.post("/api/v1/approval-delegations", {
        headers: { Origin: base },
        data: {
          action: "grant",
          id: grantId,
          authorityName: name,
          reviewerId: "demo-reviewer",
          scope: {
            countries: ["Canada"],
            organizationIds: ["prairie-club"],
            disciplines: ["men_four"],
            categories: [category],
            includeEventIds: [],
            excludeEventIds: [],
          },
          reason: "Recovery reviewer responsibility",
        },
      })
    ).status(),
  ).toBe(200);
  async function open() {
    await page.goto("/admin/applications");
    await page
      .getByRole("button", { name: `Review ${name}`, exact: true })
      .click();
    await page
      .getByText("World Curling responsibility & override", { exact: true })
      .click();
  }
  const path = `/api/v1/applications/${id}`;
  try {
    await open();
    for (const [action, button, version] of [
      ["reassign", "Reassign responsibility", 3],
      ["override_approve", "World Curling override: admit", 4],
      ["override_reject", "World Curling override: return", 5],
    ] as const) {
      if (action === "reassign")
        await page
          .getByLabel("Responsible authority and reviewer", { exact: true })
          .selectOption(grantId);
      await page
        .getByLabel("Reassignment / override reason", { exact: true })
        .fill(`Recover ${action} exactly once`);
      const attempts = await loseOnce(page, path, 200);
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(page.locator("main").getByRole("alert")).toContainText(
        "not confirmed",
      );
      for (const label of [
        "Edition name",
        "Responsible authority and reviewer",
        "Reassignment / override reason",
      ])
        await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Save changes", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "New edition", exact: true }),
      ).toBeDisabled();
      if (action === "reassign") await open();
      await page
        .getByRole("button", {
          name: "Retry exact responsibility command",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("Responsibility command recorded.", { exact: true }),
      ).toBeVisible();
      expect(attempts).toHaveLength(2);
      expect(attempts[1]).toBe(attempts[0]);
      app = await (await page.request.get(path)).json();
      expect(app.version).toBe(version);
      expect(app.history).toHaveLength(version);
      expect(
        app.history.filter(
          (h: { requestId: string }) =>
            h.requestId === JSON.parse(attempts[0]).requestId,
        ),
      ).toHaveLength(1);
      await page.unroute("**" + path);
    }
    let posts = 0,
      loseRead = false;
    await page.route("**" + path, async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        const result = await route.fetch();
        expect(result.status()).toBe(200);
        loseRead = true;
        return route.fulfill({ response: result });
      }
      if (loseRead) {
        loseRead = false;
        return route.abort("failed");
      }
      return route.continue();
    });
    await page
      .getByLabel("Responsible authority and reviewer", { exact: true })
      .selectOption("wc:demo-administrator");
    await page
      .getByLabel("Reassignment / override reason", { exact: true })
      .fill("WC retains responsibility after correction");
    await page
      .getByRole("button", { name: "Reassign responsibility", exact: true })
      .click();
    await expect(
      page.locator("main").getByRole("alert").filter({ hasText: "was saved" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Edition name", { exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Reconcile recorded responsibility command",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        "The original command was reconciled with recorded history. Review its current status below.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(posts).toBe(1);
    app = await (await page.request.get(path)).json();
    expect(app.version).toBe(6);
    expect(app.history).toHaveLength(6);
    expect(app.reviewerId).toBe("demo-administrator");
  } finally {
    await page.unroute("**" + path);
    expect(
      (
        await page.request.post("/api/v1/approval-delegations", {
          headers: { Origin: base },
          data: {
            action: "revoke",
            id: grantId,
            reason: "Responsibility recovery fixture complete",
          },
        })
      ).status(),
    ).toBe(200);
  }
});
test("a definitive validation rejection unlocks correction without replaying a rejected grant identity", async ({
  page,
}) => {
  await login(page);
  const name = "Corrected recovery " + randomUUID().slice(0, 8),
    category = "validation_" + randomUUID().slice(0, 8),
    attempts: string[] = [];
  try {
    await page.goto("/admin/authority");
    await page.getByLabel("Authority name", { exact: true }).fill(" ");
    await page
      .getByLabel("Assigned reviewer", { exact: true })
      .selectOption("demo-reviewer");
    await page.getByLabel("Event categories", { exact: true }).fill(category);
    await page
      .getByLabel("Delegation reason", { exact: true })
      .fill("Known rejected fields can be corrected");
    await page.route("**/api/v1/approval-delegations", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      attempts.push(route.request().postData()!);
      const result = await route.fetch();
      expect(result.status()).toBe(attempts.length === 1 ? 400 : 200);
      await route.fulfill({ response: result });
    });
    await page
      .getByRole("button", { name: "Grant approval delegation", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Provide an authority",
    );
    await expect(
      page.getByLabel("Authority name", { exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", {
        name: "Retry exact authority command",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.getByLabel("Authority name", { exact: true }).fill(name);
    await page
      .getByRole("button", { name: "Grant approval delegation", exact: true })
      .click();
    await expect(
      page.getByText("Approval delegation recorded.", { exact: true }),
    ).toBeVisible();
    expect(attempts).toHaveLength(2);
    expect(JSON.parse(attempts[1]).id).not.toBe(JSON.parse(attempts[0]).id);
    const workspace = await (
      await page.request.get("/api/v1/approval-delegations")
    ).json();
    expect(
      workspace.history.some(
        (h: { resourceId: string }) =>
          h.resourceId === JSON.parse(attempts[0]).id,
      ),
    ).toBe(false);
    expect(
      workspace.delegations.filter(
        (d: { authorityName: string }) => d.authorityName === name,
      ),
    ).toHaveLength(1);
  } finally {
    await page.unroute("**/api/v1/approval-delegations");
    const workspace = await (
      await page.request.get("/api/v1/approval-delegations")
    ).json();
    for (const g of workspace.delegations.filter(
      (d: { authorityName: string; revokedAt: string | null }) =>
        d.authorityName === name && !d.revokedAt,
    ))
      await page.request.post("/api/v1/approval-delegations", {
        headers: { Origin: base },
        data: {
          action: "revoke",
          id: g.id,
          reason: "Validation fixture complete",
        },
      });
  }
});
