import { actor, gameResource, permitted } from "@/modules/identity/access";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await actor(request.headers);
  if (!current)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  const resource = await gameResource((await params).id);
  if (!resource || !permitted(current.grants, "read", resource))
    return Response.json(
      { error: "This game is outside your assigned scope" },
      { status: 403 },
    );
  return Response.json(
    {
      canRead: true,
      canScore: permitted(current.grants, "score", resource),
      canManage: permitted(current.grants, "manage", resource),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
