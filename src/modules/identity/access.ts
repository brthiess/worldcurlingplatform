import { auth } from "@/auth";
import { pool } from "@/db";
import { permitted, type Grant, type Resource } from "@/domain/permissions";
export async function actor(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const result = await pool.query<Grant>(
    'SELECT role,event_id AS "eventId",game_id AS "gameId" FROM role_grant WHERE user_id=$1 ORDER BY role,event_id,game_id',
    [session.user.id],
  );
  return { id: session.user.id, name: session.user.name, grants: result.rows };
}
export async function gameResource(id: string): Promise<Resource | null> {
  const result = await pool.query<Resource>(
    'SELECT g.id AS "gameId",d.event_id AS "eventId" FROM game g JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=ds.division_id WHERE g.id=$1',
    [id],
  );
  return result.rows[0] ?? null;
}
export { permitted };
