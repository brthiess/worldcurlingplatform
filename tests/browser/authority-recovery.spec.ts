import "dotenv/config";
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authApiWithRateWindow } from "./auth-fixture";
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
    await page.reload();
    await expect(
      page.getByLabel("Authority name", { exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Retry exact authority command",
        exact: true,
      })
      .click();
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
