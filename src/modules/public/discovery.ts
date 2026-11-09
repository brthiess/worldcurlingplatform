import { pool } from "@/db";
export async function publicActivity(kind: "team" | "player", id: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const exists = await c.query(
      kind === "team"
        ? "SELECT id FROM team WHERE id=$1"
        : "SELECT id FROM player WHERE id=$1",
      [id],
    );
    if (!exists.rowCount) {
      await c.query("COMMIT");
      return null;
    }
    const entries = await c.query(
      `SELECT en.id,en.display_name AS name,en.team_id AS "teamId",d.id AS "divisionId",d.name AS "divisionName",d.discipline,e.id AS "eventId",e.name AS "eventName",e.starts_on::text AS "startsOn",e.ends_on::text AS "endsOn",e.origin,CASE WHEN $2='player' THEN 'Declared event lineup' ELSE 'Canonical team entry' END AS evidence FROM event_entry en JOIN division d ON d.id=en.division_id JOIN event_edition e ON e.id=d.event_id WHERE e.published AND e.admission_status='approved' AND (CASE WHEN $2='team' THEN en.team_id=$1 ELSE EXISTS(SELECT 1 FROM event_lineup_member m WHERE m.entry_id=en.id AND m.version=en.version AND m.player_id=$1) END) ORDER BY e.starts_on DESC,en.id`,
      [id, kind],
    );
    if (kind === "player") {
      const teams = await c.query(
        `SELECT t.id,t.discipline,coalesce((SELECT v.display_name FROM season_registration r JOIN season_roster_version v ON v.registration_id=r.id AND v.version=r.version WHERE r.team_id=t.id ORDER BY r.season DESC,r.id LIMIT 1),(SELECT en.display_name FROM event_entry en JOIN division d ON d.id=en.division_id JOIN event_edition e ON e.id=d.event_id WHERE en.team_id=t.id AND e.published AND e.admission_status='approved' ORDER BY e.starts_on DESC,en.id LIMIT 1),'Team') AS name FROM team_core_member m JOIN team t ON t.id=m.team_id WHERE m.player_id=$1 ORDER BY t.id`,
        [id],
      );
      await c.query("COMMIT");
      return { teams: teams.rows, entries: entries.rows };
    }
    const games = await c.query(
      `SELECT g.id,g.state,g.phase,g.sheet,CASE WHEN g.state='live' AND EXISTS(SELECT 1 FROM game_end_score s WHERE s.game_id=g.id AND s.state='unknown') THEN null ELSE g.total_a END AS "totalA",CASE WHEN g.state='live' AND EXISTS(SELECT 1 FROM game_end_score s WHERE s.game_id=g.id AND s.state='unknown') THEN null ELSE g.total_b END AS "totalB",g.entry_a AS "entryA",g.entry_b AS "entryB",a.team_id AS "teamA",b.team_id AS "teamB",coalesce(a.display_name,g.slot_a) AS "nameA",coalesce(b.display_name,g.slot_b) AS "nameB",g.updated_at AS "updatedAt",ds.starts_at AS "startsAt",d.id AS "divisionId",d.name AS "divisionName",e.id AS "eventId",e.name AS "eventName",e.timezone,e.origin FROM game g LEFT JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=g.division_id JOIN event_edition e ON e.id=d.event_id LEFT JOIN event_entry a ON a.id=g.entry_a LEFT JOIN event_entry b ON b.id=g.entry_b WHERE e.published AND e.admission_status='approved' AND (a.team_id=$1 OR b.team_id=$1) ORDER BY ds.starts_at NULLS LAST,g.id`,
      [id],
    );
    await c.query("COMMIT");
    return {
      entries: entries.rows,
      games: games.rows,
      nextGame:
        games.rows.find(
          (g) => g.state === "scheduled" && g.startsAt !== null,
        ) ?? null,
    };
  } catch (error) {
    await c.query("ROLLBACK");
    throw error;
  } finally {
    c.release();
  }
}
