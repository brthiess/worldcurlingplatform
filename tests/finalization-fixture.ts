import type { Pool } from "pg";
/** Own future-dated event: never add divisions to the inherited live-score demo.
 * Immutable game/entry/finalization history stays in the isolated acceptance DB. */
export async function finalizationFixtureEvent(pool: Pool) {
  const id = "finalization-test-2041";
  await pool.query(
    "INSERT INTO event_series(id,name) VALUES('finalization-test','Finalization review fixtures') ON CONFLICT DO NOTHING",
  );
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES($1,'finalization-test','Finalization review 2041','Review ice','Fictional location','UTC','2041-01-01','2041-01-02','fictional_demo',true,'approved') ON CONFLICT DO NOTHING",
    [id],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES('finalization-test-organizer','demo-organizer','organizer',$1,NULL) ON CONFLICT DO NOTHING",
    [id],
  );
  return id;
}
export async function clearFinalizationScoringGrants(pool: Pool) {
  await pool.query(
    "DELETE FROM role_grant r USING game g,draw_session ds,division d WHERE r.game_id=g.id AND g.draw_id=ds.id AND ds.division_id=d.id AND d.event_id='finalization-test-2041' AND r.user_id='demo-scorekeeper' AND r.role='scorekeeper'",
  );
}
