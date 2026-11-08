import type {
  Locator,
  Page,
  APIResponse,
  APIRequestContext,
} from "@playwright/test";
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
