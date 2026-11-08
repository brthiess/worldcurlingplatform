import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
const base = process.env.BETTER_AUTH_URL!;
async function post(path: string, body: unknown, cookie = "") {
  return fetch(base + path, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}
export async function emailMessage(email: string, kind: string) {
  const files = await readdir(".runtime/mail");
  for (const file of files.reverse()) {
    const msg = JSON.parse(await readFile(".runtime/mail/" + file, "utf8"));
    if (msg.to === email && msg.kind === kind) return msg;
  }
  throw new Error("Expected private local email was not delivered");
}
test("registration requires real verification mail and recovery revokes sessions without public tokens", async () => {
  const email = "account-" + crypto.randomUUID() + "@example.invalid",
    password = "Local-test-" + crypto.randomUUID();
  const signup = await post("/api/auth/sign-up/email", {
    email,
    password,
    name: "Private local claimant",
    callbackURL: base + "/account",
  });
  assert.equal(signup.status, 200);
  const signed = await signup.json();
  assert.equal(signed.user.emailVerified, false);
  assert.equal(signed.token, null);
  assert.equal(
    (await post("/api/auth/sign-in/email", { email, password })).status,
    403,
  );
  const message = await emailMessage(email, "verification");
  assert.equal(new URL(message.url).origin, base);
  const verified = await fetch(message.url, { redirect: "manual" });
  assert.equal(verified.status, 302);
  const login = await post("/api/auth/sign-in/email", { email, password });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  const claims = await (
    await fetch(base + "/api/v1/player-claims", { headers: { cookie } })
  ).json();
  assert.equal(claims.canReview, false);
  assert.deepEqual(claims.owned, []);
  const recovery = await post("/api/auth/request-password-reset", {
    email,
    redirectTo: base + "/account/reset",
  });
  assert.equal(recovery.status, 200);
  assert.doesNotMatch(await recovery.text(), /token|url/i);
  const reset = await emailMessage(email, "recovery");
  const redirect = await fetch(reset.url, { redirect: "manual" });
  assert.equal(redirect.status, 302);
  const token = new URL(
    redirect.headers.get("location")!,
    base,
  ).searchParams.get("token");
  assert.ok(token);
  const nextPassword = "Replacement-" + crypto.randomUUID();
  assert.equal(
    (
      await post("/api/auth/reset-password", {
        token,
        newPassword: nextPassword,
      })
    ).status,
    200,
  );
  assert.equal(
    (await fetch(base + "/api/v1/player-claims", { headers: { cookie } }))
      .status,
    401,
  );
  assert.equal(
    (
      await post("/api/auth/reset-password", {
        token,
        newPassword: nextPassword,
      })
    ).status,
    400,
  );
  assert.equal(
    (await post("/api/auth/sign-in/email", { email, password })).status,
    401,
  );
  assert.equal(
    (await post("/api/auth/sign-in/email", { email, password: nextPassword }))
      .status,
    200,
  );
  assert.equal((await fetch(base + "/.runtime/mail")).status, 404);
  assert.equal((await fetch(base + "/api/v1/mail")).status, 404);
});
