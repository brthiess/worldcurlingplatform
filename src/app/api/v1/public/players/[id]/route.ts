import { publicPlayers } from "@/modules/identity/profiles";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const player = await publicPlayers(id);
  return Response.json(player ?? { error: "Player not found." }, {
    status: player ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}
