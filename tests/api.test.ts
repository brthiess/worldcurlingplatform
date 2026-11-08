import { authRequest } from "./auth-request";
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
const base = process.env.BETTER_AUTH_URL!;
async function signIn(role: string) {
  const response = await authRequest(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      email: `${role}@demo.invalid`,
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(response.status, 200);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
test("public score projection includes persisted participants and truthful states without private records", async () => {
  const response = await fetch(`${base}/api/v1/public/events/prairie-2026`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.event.name, "Prairie Open 2026");
  assert.equal(data.selection.selected, "draw-2");
  assert.equal(
    data.games.find((g: { id: string }) => g.id === "game-2").nameA,
    "Team North",
  );
  assert.equal(
    data.games.find((g: { id: string }) => g.id === "game-3").totalA,
    null,
  );
  assert.doesNotMatch(
    JSON.stringify(data),
    /password|email|token|account|ipAddress|userAgent/i,
  );
  assert.equal(
    (await fetch(`${base}/api/v1/public/events/other-2026`)).status,
    404,
  );
});
test("real database sessions expose only assigned games and deny other event access", async () => {
  assert.equal((await fetch(`${base}/api/v1/workspace`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/api/v1/workspace`, {
        headers: { cookie: "better-auth.session_token=forged" },
      })
    ).status,
    401,
  );
  const cookie = await signIn("scorekeeper");
  const response = await fetch(`${base}/api/v1/workspace`, {
    headers: { cookie },
  });
  assert.equal(response.status, 200);
  const workspace = await response.json();
  assert.deepEqual(
    workspace.games
      .filter((g: { id: string }) => /^game-[1-4]$|^other-game$/.test(g.id))
      .map((g: { id: string }) => g.id),
    ["game-2"],
  );
  assert.equal(
    (
      await fetch(`${base}/api/v1/games/other-game/access`, {
        headers: { cookie },
      })
    ).status,
    403,
  );
  assert.equal(
    (await fetch(`${base}/api/v1/games/game-3/access`, { headers: { cookie } }))
      .status,
    403,
  );
  assert.equal(
    (await fetch(`${base}/api/v1/games/game-2/access`, { headers: { cookie } }))
      .status,
    200,
  );
  const signedOut = await fetch(`${base}/api/auth/sign-out`, {
    method: "POST",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(signedOut.status, 200);
  assert.equal(
    (await fetch(`${base}/api/v1/workspace`, { headers: { cookie } })).status,
    401,
  );
});
test("all demo personas get server-derived scope and nonadministrators cannot grant roles", async () => {
  for (const [role, count] of [
    ["administrator", 5],
    ["organizer", 4],
    ["reviewer", 4],
  ] as const) {
    const cookie = await signIn(role);
    const workspace = await (
      await fetch(`${base}/api/v1/workspace`, { headers: { cookie } })
    ).json();
    // Other suites retain immutable fictional scoring history. These assertions
    // concern the five seeded scope fixtures, including the unrelated event.
    assert.equal(
      workspace.games.filter((g: { id: string }) =>
        /^game-[1-4]$|^other-game$/.test(g.id),
      ).length,
      count,
    );
    assert.equal(workspace.games[0].canScore, role !== "reviewer");
    const response = await fetch(`${base}/api/v1/role-grants`, {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "test-read-grant",
        userId: "demo-ungranted",
        role: "reviewer",
        eventId: "other-2026",
        gameId: null,
      }),
    });
    assert.equal(response.status, role === "administrator" ? 201 : 403);
  }
  const cookie = await signIn("administrator");
  const crossOrigin = await fetch(`${base}/api/v1/role-grants`, {
    method: "POST",
    headers: {
      cookie,
      Origin: "https://untrusted.invalid",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(crossOrigin.status, 403);
});
