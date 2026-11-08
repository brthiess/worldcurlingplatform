import { actor } from "@/modules/identity/access";
import { claimWorkspace, requestClaim } from "@/modules/identity/profiles";
import { profileCommand } from "@/modules/identity/profile-http";
export async function GET(request: Request) {
  const current = await actor(request.headers);
  if (!current)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  return Response.json(await claimWorkspace(current.id), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: Request) {
  return profileCommand(request, requestClaim, 201);
}
