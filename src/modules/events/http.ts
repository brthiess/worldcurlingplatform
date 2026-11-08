import { actor } from "@/modules/identity/access";
import { ApplicationError } from "./applications";
export async function applicationHttp(
  request: Request,
  write: boolean,
  run: (userId: string) => Promise<unknown>,
  status = 200,
) {
  try {
    if (
      write &&
      request.headers.get("origin") !==
        new URL(process.env.BETTER_AUTH_URL!).origin
    )
      return Response.json(
        { error: "Untrusted request origin" },
        { status: 403 },
      );
    const current = await actor(request.headers);
    if (!current)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    return Response.json(await run(current.id), {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApplicationError)
      return Response.json(
        { error: error.message, fields: error.fields },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof SyntaxError)
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    console.error("Application request failed", error);
    return Response.json(
      {
        error:
          "Applications are temporarily unavailable. Your save could not be confirmed. Retry the same request.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
