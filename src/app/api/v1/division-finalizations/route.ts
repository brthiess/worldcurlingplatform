import { actor } from "@/modules/identity/access";
import {
  finalizationWorkspace,
  saveFinalization,
} from "@/modules/competition/finalization";
import { FinalizationError } from "@/domain/finalization";
async function run(request: Request, write: boolean) {
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
    if (
      write &&
      request.headers.has("X-WCP-Actor") &&
      request.headers.get("X-WCP-Actor") !== current.id
    )
      return Response.json(
        {
          error:
            "The signed-in account changed. Recover this command with its original account.",
        },
        { status: 403 },
      );
    const q = new URL(request.url).searchParams,
      v = q.get("version");
    if (
      v !== null &&
      (!/^[1-9][0-9]*$/.test(v) || !Number.isSafeInteger(Number(v)))
    )
      throw new FinalizationError("Choose a positive finalization version.");
    return Response.json(
      write
        ? await saveFinalization(current.id, await request.json())
        : {
            ...(await finalizationWorkspace(
              current.id,
              q.get("division") ?? undefined,
              v === null ? undefined : Number(v),
            )),
            actorId: current.id,
          },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (!(e instanceof FinalizationError) && !(e instanceof SyntaxError))
      console.error("Finalization failed", e);
    return Response.json(
      {
        error:
          e instanceof FinalizationError
            ? e.message
            : e instanceof SyntaxError
              ? "Invalid JSON"
              : "Results could not be confirmed. Retry the same request safely.",
      },
      {
        status:
          e instanceof FinalizationError
            ? e.status
            : e instanceof SyntaxError
              ? 400
              : 503,
      },
    );
  }
}
export const GET = (request: Request) => run(request, false);
export const POST = (request: Request) => run(request, true);
