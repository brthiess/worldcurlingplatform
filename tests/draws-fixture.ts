import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
/** Each acceptance file owns its pool and removes only this mutable fixture grant. */
export async function drawFixtureEvent(pool: Pool) {
  const id = "ko-event-" + randomUUID(),
    grant = "ko-grant-" + randomUUID();
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES($1,'single-knockout-demo','Knockout acceptance fixture','Review ice','Regina, Canada','America/Regina','2026-11-08','2026-11-10','fictional_demo',true,'approved')",
    [id],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-organizer','organizer',$2)",
    [grant, id],
  );
  return {
    id,
    cleanup: () => pool.query("DELETE FROM role_grant WHERE id=$1", [grant]),
  };
}
