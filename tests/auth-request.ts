// Acceptance fixtures preserve the application's actual authentication limits.
// A complete suite can legitimately exceed the per-IP sign-in window.
export async function authRequest(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429 || attempt === 2) return response;
    const seconds = Number(
      response.headers.get("X-Retry-After") ??
        response.headers.get("Retry-After") ??
        60,
    );
    const wait = Math.min(
      60000,
      Math.max(1000, Number.isFinite(seconds) ? seconds * 1000 : 60000),
    );
    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, wait));
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Authentication retry window exhausted.");
}
