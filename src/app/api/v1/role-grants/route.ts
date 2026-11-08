import { randomUUID } from "node:crypto";
import { actor } from "@/modules/identity/access";
import { pool } from "@/db";
export async function POST(request: Request) {
  if (
    request.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL!).origin
  )
    return Response.json(
      { error: "Untrusted request origin" },
      { status: 403 },
    );
  const current = await actor(request.headers);
  if (!current)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  if (
    !current.grants.some(
      (g) =>
        g.role === "administrator" && g.eventId === null && g.gameId === null,
    )
  )
    return Response.json(
      { error: "Administrator authority required" },
      { status: 403 },
    );
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !input ||
    typeof input !== "object" ||
    !["reviewer", "organizer", "scorekeeper"].includes(input.role) ||
    typeof input.id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(input.id) ||
    typeof input.userId !== "string" ||
    typeof input.eventId !== "string" ||
    (input.role === "scorekeeper"
      ? typeof input.gameId !== "string"
      : input.gameId !== null)
  )
    return Response.json(
      { error: "Provide an id, user, role and matching event/game scope" },
      { status: 400 },
    );
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const authority = await client.query(
      "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
      [current.id],
    );
    if (!authority.rowCount) {
      await client.query("ROLLBACK");
      return Response.json(
        { error: "Authority changed; sign in again" },
        { status: 403 },
      );
    }
    const scope = await client.query(
      "SELECT e.id FROM event_edition e JOIN auth_user u ON u.id=$2 WHERE e.id=$1 AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM game g JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=ds.division_id WHERE g.id=$3 AND d.event_id=e.id))",
      [input.eventId, input.userId, input.gameId],
    );
    if (!scope.rowCount) {
      await client.query("ROLLBACK");
      return Response.json(
        { error: "User or resource scope not found" },
        { status: 400 },
      );
    }
    const saved = await client.query(
      "INSERT INTO role_grant VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id",
      [input.id, input.userId, input.role, input.eventId, input.gameId],
    );
    if (!saved.rowCount) {
      const same = await client.query(
        "SELECT id FROM role_grant WHERE id=$1 AND user_id=$2 AND role=$3 AND event_id=$4 AND game_id IS NOT DISTINCT FROM $5",
        [input.id, input.userId, input.role, input.eventId, input.gameId],
      );
      if (!same.rowCount) {
        await client.query("ROLLBACK");
        return Response.json(
          { error: "Request identifier already used for another grant" },
          { status: 409 },
        );
      }
    } else
      await client.query(
        "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
        [randomUUID(), current.id, "role_granted", input.id],
      );
    await client.query("COMMIT");
    return Response.json({ id: input.id }, { status: 201 });
  } catch {
    await client.query("ROLLBACK");
    return Response.json(
      { error: "Role grant could not be saved" },
      { status: 503 },
    );
  } finally {
    client.release();
  }
}
