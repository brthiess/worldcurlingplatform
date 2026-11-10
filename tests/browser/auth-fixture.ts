import type {
  Locator,
  Page,
  APIResponse,
  APIRequestContext,
} from "@playwright/test";
import { test } from "@playwright/test";
export async function authApiWithRateWindow(send: () => Promise<APIResponse>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await send();
    if (response.status() !== 429 || attempt === 2) return response;
    const seconds = Number(
      response.headers()["x-retry-after"] ??
        response.headers()["retry-after"] ??
        60,
    );
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(
          60000,
          Math.max(1000, Number.isFinite(seconds) ? seconds * 1000 : 60000),
        ),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Authentication retry window exhausted.");
}
export async function signInWithRateWindow(page: Page, button: Locator) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/auth/sign-in/email") &&
        r.request().method() === "POST",
    );
    await button.click();
    const response = await result;
    if (response.status() !== 429 || attempt === 2) return;
    const seconds = Number(
      response.headers()["x-retry-after"] ??
        response.headers()["retry-after"] ??
        60,
    );
    const waitMs =
      Math.min(
        60000,
        Math.max(1000, Number.isFinite(seconds) ? seconds * 1000 : 60000),
      ) + 250;
    const info = test.info(),
      priorTestBudgetMs = info.timeout;
    // Charge only the real bounded authentication backoff separately. Product
    // assertions and the original application-work budget remain unchanged.
    if (priorTestBudgetMs > 0) info.setTimeout(priorTestBudgetMs + waitMs);
    const started = Date.now();
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    await info.attach("bounded-authentication-rate-wait", {
      body: JSON.stringify({
        status: 429,
        serverRetryAfterSeconds: seconds,
        waitMs,
        elapsedMs: Date.now() - started,
        priorTestBudgetMs,
        adjustedTestBudgetMs: info.timeout,
      }),
      contentType: "application/json",
    });
  }
}
export function signInApiWithRateWindow(
  request: APIRequestContext,
  email: string,
  password: string | undefined,
) {
  return authApiWithRateWindow(() =>
    request.post("/api/auth/sign-in/email", {
      headers: { Origin: process.env.BETTER_AUTH_URL! },
      data: { email, password },
    }),
  );
}
