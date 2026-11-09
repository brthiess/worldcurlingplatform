import { publicPlayerCandidates } from "@/modules/identity/profiles";
export async function GET() {
  return Response.json(await publicPlayerCandidates(), {
    headers: { "Cache-Control": "no-store" },
  });
}
