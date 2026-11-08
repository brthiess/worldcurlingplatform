import { publicPlayers } from "@/modules/identity/profiles";
export async function GET() {
  return Response.json(await publicPlayers(), {
    headers: { "Cache-Control": "no-store" },
  });
}
