import { publicRankings } from "@/modules/rankings/publications";
import { EntryError } from "@/domain/entries";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams;
    return Response.json(await publicRankings(Object.fromEntries(q)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof EntryError)
      return Response.json({ error: e.message }, { status: e.status });
    console.error("Publication read failed", e);
    return Response.json(
      { error: "Approved rankings could not be loaded. Try again." },
      { status: 503 },
    );
  }
}
