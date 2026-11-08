import type { Pool } from "pg";
/** Immutable score evidence stays in the isolated acceptance DB. An older,
 * noncurrent draw keeps those fictional fixtures out of live score assertions. */
export async function scoringFixtureDraw(pool: Pool) {
  await pool.query(
    "INSERT INTO draw_session(id,division_id,number,starts_at,state) VALUES('scoring-test-draw','prairie-men',999,'2000-01-01T12:00:00Z','scheduled') ON CONFLICT DO NOTHING",
  );
  return "scoring-test-draw";
}
