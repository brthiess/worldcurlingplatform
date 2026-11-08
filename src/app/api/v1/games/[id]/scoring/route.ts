import { actor } from "@/modules/identity/access";
import {
  scoringGame,
  saveScoring,
  ScoringError,
} from "@/modules/scoring/commands";
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
      return Response.json(
        { error: "Untrusted request origin" },
        { status: 403 },
      );
    const current = await actor(request.headers);
    if (!current)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    let input;
    if (write)
      try {
        input = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }
    return Response.json(
      write
        ? await saveScoring(current.id, id, input)
        : { ...(await scoringGame(current.id, id)), actorId: current.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof ScoringError
            ? e.message
            : "Scores could not be confirmed. Retry the same request safely.",
      },
      { status: e instanceof ScoringError ? e.status : 503 },
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
