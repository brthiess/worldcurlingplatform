import { publicFinalization } from "@/modules/competition/finalization";
import { FinalizationError } from "@/domain/finalization";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const v = new URL(request.url).searchParams.get("version");
    if (
      v !== null &&
      (!/^[1-9][0-9]*$/.test(v) || !Number.isSafeInteger(Number(v)))
    )
      throw new FinalizationError("Choose a positive finalization version.");
    return Response.json(
      await publicFinalization(
        (await params).id,
        v === null ? undefined : Number(v),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof FinalizationError
            ? e.message
            : "Final results could not be loaded.",
      },
      { status: e instanceof FinalizationError ? e.status : 503 },
    );
  }
}
