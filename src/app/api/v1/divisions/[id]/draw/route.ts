import { actor } from "@/modules/identity/access";
import { DrawError, drawWorkspace, saveDraw } from "@/modules/draws/draws";
async function run(
  request: Request,
  params: Promise<{ id: string }>,
  write: boolean,
) {
  try {
    if (
      write &&
      request.headers.get("origin") !==
        new URL(process.env.BETTER_AUTH_URL!).origin
    )
      throw new DrawError("Untrusted request origin", 403);
    const current = await actor(request.headers);
    if (!current) throw new DrawError("Sign in required", 401);
    const { id } = await params;
    return Response.json(
      write
        ? await saveDraw(current.id, id, await request.json())
        : await drawWorkspace(current.id, id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (!(e instanceof DrawError) && !(e instanceof SyntaxError))
      console.error("Draw command failed", e);
    return Response.json(
      {
        error:
          e instanceof DrawError
            ? e.message
            : e instanceof SyntaxError
              ? "Invalid JSON"
              : "Draw save could not be confirmed. Retry the same request safely.",
      },
      {
        status:
          e instanceof DrawError
            ? e.status
            : e instanceof SyntaxError
              ? 400
              : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(request, params, false);
}
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return run(request, params, true);
}
