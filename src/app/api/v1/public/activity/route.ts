import { publicActivity } from "@/modules/public/discovery";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams,
    kind = params.get("kind"),
    id = params.get("id");
  if (
    (kind !== "team" && kind !== "player") ||
    !id ||
    !/^[a-zA-Z0-9-]{1,120}$/.test(id)
  )
    return Response.json(
      { error: "Choose a team or player identity." },
      { status: 400 },
    );
  try {
    const data = await publicActivity(kind, id);
    return data
      ? Response.json(data, { headers: { "Cache-Control": "no-store" } })
      : Response.json({ error: "Public record not found." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "Public activity is temporarily unavailable." },
      { status: 503 },
    );
  }
}
