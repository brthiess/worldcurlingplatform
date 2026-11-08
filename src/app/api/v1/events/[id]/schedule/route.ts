import { actor } from "@/modules/identity/access";
import { ScheduleError } from "@/domain/scheduling";
import { readSchedule, saveSchedule } from "@/modules/scheduling/schedule";
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
      throw new ScheduleError("Untrusted request origin", 403);
    const current = await actor(request.headers);
    if (!current) throw new ScheduleError("Sign in required", 401);
    const { id } = await params;
    return Response.json(
      write
        ? await saveSchedule(current.id, id, await request.json())
        : await readSchedule(current.id, id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (!(e instanceof ScheduleError) && !(e instanceof SyntaxError))
      console.error("Schedule command failed", e);
    return Response.json(
      {
        error:
          e instanceof ScheduleError
            ? e.message
            : e instanceof SyntaxError
              ? "Invalid JSON"
              : "Schedule save could not be confirmed. Retry the same request safely.",
      },
      {
        status:
          e instanceof ScheduleError
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
