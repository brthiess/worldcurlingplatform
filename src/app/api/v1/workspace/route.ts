import { actor, permitted } from "@/modules/identity/access";
import { pool } from "@/db";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const current = await actor(request.headers);
  if (!current)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  const result = await pool.query(
    'SELECT g.id,g.sheet,g.state,coalesce(a.display_name,g.slot_a) AS "nameA",coalesce(b.display_name,g.slot_b) AS "nameB",d.event_id AS "eventId",e.name AS "eventName",e.published FROM game g LEFT JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=g.division_id JOIN event_edition e ON e.id=d.event_id LEFT JOIN event_entry a ON a.id=g.entry_a LEFT JOIN event_entry b ON b.id=g.entry_b ORDER BY ds.starts_at,g.id',
  );
  const games = result.rows
    .filter((g) =>
      permitted(current.grants, "read", { eventId: g.eventId, gameId: g.id }),
    )
    .map((g) => ({
      ...g,
      canScore: permitted(current.grants, "score", {
        eventId: g.eventId,
        gameId: g.id,
      }),
      canManage: permitted(current.grants, "manage", {
        eventId: g.eventId,
        gameId: g.id,
      }),
    }));
  return Response.json(
    { name: current.name, grants: current.grants, games },
    { headers: { "Cache-Control": "no-store" } },
  );
}
