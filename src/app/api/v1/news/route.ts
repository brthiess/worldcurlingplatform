import { actor } from "@/modules/identity/access";
import { pool } from "@/db";
import { NewsError } from "@/domain/news";
import {
  staffNews,
  manageSource,
  moderateItem,
  enqueueFetch,
} from "@/modules/news/service";
function failure(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof NewsError
          ? e.message
          : "News request could not be confirmed. Refresh status before retrying.",
    },
    {
      status: e instanceof NewsError ? e.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
async function current(request: Request, write = false) {
  if (
    write &&
    request.headers.get("origin") !==
      new URL(process.env.BETTER_AUTH_URL!).origin
  )
    throw new NewsError("Untrusted request origin.", 403);
  const user = await actor(request.headers);
  if (!user) throw new NewsError("Sign in required.", 401);
  return user;
}
export async function GET(request: Request) {
  try {
    return Response.json(await staffNews(pool, (await current(request)).id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await current(request, true);
    const text = await request.text();
    if (text.length > 4096) throw new NewsError("Request is too large.", 413);
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      throw new NewsError("Invalid request JSON.");
    }
    if (!body || Array.isArray(body) || typeof body !== "object")
      throw new NewsError("Invalid request.");
    let result;
    switch (body.action) {
      case "source":
        result = await manageSource(pool, user.id, body);
        break;
      case "item":
        result = await moderateItem(pool, user.id, body);
        break;
      case "fetch":
        result = await enqueueFetch(pool, user.id, body);
        break;
      default:
        throw new NewsError("Unknown news action.");
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return failure(e);
  }
}
