import { test, expect, type APIRequestContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import "dotenv/config";
const base = process.env.BETTER_AUTH_URL!;
async function login(request: APIRequestContext, role: string) {
  const send = () =>
    request.post("/api/auth/sign-in/email", {
      headers: { Origin: base },
      data: {
        email: `${role}@demo.invalid`,
        password: process.env.DEMO_PASSWORD,
      },
    });
  let r = await send();
  if (r.status() === 429) {
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(
          60000,
          Math.max(1000, Number(r.headers()["x-retry-after"] ?? 60) * 1000),
        ) + 250,
      ),
    );
    r = await send();
  }
  expect(r.status()).toBe(200);
}
for (const [label, width, height] of [
  ["phone", 360, 800],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const) {
  test(`${label}: WC scopes, reviewer responsibility and organizer scoring assignments`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      networkErrors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 500) networkErrors.push(`${r.status()} ${r.url()}`);
    });
    await login(page.request, "administrator");
    await page.goto("/admin/authority");
    const category = `browser_${label}_${randomUUID().slice(0, 8)}`;
    const authorityName = `Browser Canada ${label} ${randomUUID().slice(0, 8)}`;
    await page
      .getByLabel("Authority name", { exact: true })
      .fill(authorityName);
    await page
      .getByLabel("Assigned reviewer", { exact: true })
      .selectOption("demo-reviewer");
    await page.getByLabel("Countries", { exact: true }).fill("Canada");
    await page
      .getByLabel("Organizing organization identifiers", { exact: true })
      .fill("prairie-club");
    await page.getByLabel("Disciplines", { exact: true }).fill("men_four");
    await page.getByLabel("Event categories", { exact: true }).fill(category);
    await page
      .getByLabel("Delegation reason", { exact: true })
      .fill("National federation review duty");
    await page
      .getByRole("button", { name: "Grant approval delegation", exact: true })
      .click();
    await expect(
      page.getByText("Approval delegation recorded.", { exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${label}-delegations.png`),
      fullPage: true,
    });
    const id = randomUUID();
    const application = {
      organizationId: "prairie-club",
      seriesId: "prairie",
      name: `Scoped ${label} Open ${id.slice(0, 8)}`,
      startsOn: "2027-11-08",
      endsOn: "2027-11-10",
      city: "Regina",
      country: "Canada",
      venue: "",
      timezone: "America/Regina",
      category: category,
      divisions: [{ id: randomUUID(), name: "Men", discipline: "men_four" }],
    };
    await page.request.post("/api/auth/sign-out", {
      headers: { Origin: base },
      data: {},
    });
    await login(page.request, "organizer");
    let r = await page.request.post("/api/v1/applications", {
      headers: { Origin: base },
      data: { id, requestId: randomUUID(), action: "create", application },
    });
    expect(r.status()).toBe(201);
    let app = await r.json();
    expect(app.authorityName).toBe(authorityName);
    r = await page.request.post(`/api/v1/applications/${id}`, {
      headers: { Origin: base },
      data: { requestId: randomUUID(), action: "submit", version: app.version },
    });
    expect(r.status()).toBe(200);
    await page.goto("/admin/authority");
    await expect(
      page.getByText(
        "Only World Curling administrators may grant, revoke or reassign approval authority.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Event", { exact: true })).not.toContainText(
      "Northern Open",
    );
    await page
      .getByLabel("Event", { exact: true })
      .selectOption("prairie-2026");
    await page.getByLabel("Game", { exact: true }).selectOption("game-3");
    await page
      .getByLabel("Scorekeeper account email", { exact: true })
      .fill("ungranted@demo.invalid");
    await page
      .getByLabel("Assignment reason", { exact: true })
      .fill("Browser volunteer shift");
    await page
      .getByRole("button", { name: "Assign scoring access", exact: true })
      .click();
    await expect(
      page.getByText("Scoring assignment saved.", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`${label}-staff.png`),
      fullPage: true,
    });
    await page.request.post("/api/auth/sign-out", {
      headers: { Origin: base },
      data: {},
    });
    await login(page.request, "reviewer");
    await page.goto("/admin/applications");
    await page
      .getByRole("button", { name: `Review ${application.name}`, exact: true })
      .click();
    await expect(
      page.getByText(
        `Responsible authority: ${authorityName} · Demo reviewer`,
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save changes", exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Review note / rejection reason")
      .fill("Scope and event verified");
    await page
      .getByRole("button", { name: "Approve onto calendar", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Edition admitted to the public calendar.", {
        exact: true,
      }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`${label}-responsibility.png`),
      fullPage: true,
    });
    await page.request.post("/api/auth/sign-out", {
      headers: { Origin: base },
      data: {},
    });
    await login(page.request, "administrator");
    const delegations = await (
      await page.request.get("/api/v1/approval-delegations")
    ).json();
    const grant = delegations.delegations.find(
      (d: { authorityName: string }) => d.authorityName === authorityName,
    );
    expect(
      (
        await page.request.post("/api/v1/approval-delegations", {
          headers: { Origin: base },
          data: {
            action: "revoke",
            id: grant.id,
            reason: "Browser acceptance complete",
          },
        })
      ).status(),
    ).toBe(200);
    const staff = await (await page.request.get("/api/v1/role-grants")).json();
    const assignment = staff.grants.find(
      (g: { userId: string; gameId: string }) =>
        g.userId === "demo-ungranted" && g.gameId === "game-3",
    );
    expect(
      (
        await page.request.post("/api/v1/role-grants", {
          headers: { Origin: base },
          data: {
            action: "revoke",
            id: assignment.id,
            reason: "Browser shift complete",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(networkErrors).toEqual([]);
  });
}
test("unassigned account has server-scoped empty and denied views", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await login(page.request, "ungranted");
  await page.goto("/admin/authority");
  await expect(
    page.getByText("No approval delegations are assigned to this account."),
  ).toBeVisible();
  await expect(
    page.getByText("No events are assigned for staff management."),
  ).toBeVisible();
  await page.goto("/admin/applications");
  await expect(page.getByText("No applications in this view.")).toBeVisible();
  await page.goto("/admin/games/other-game");
  await expect(
    page.getByRole("alert", { name: "Score entry error" }),
  ).toContainText("outside your assigned");
  await page.screenshot({
    path: info.outputPath("denied-scoring.png"),
    fullPage: true,
  });
});
