import { sql } from "drizzle-orm";
import { db } from "@/db";
import { selectDraws, type Score } from "@/domain/scores";
export type PublicGame = {
  id: string;
  drawId: string;
  sheet: string;
  phase: string;
  state: string;
  nameA: string;
  nameB: string;
  totalA: number | null;
  totalB: number | null;
  hammer: string | null;
  updatedAt: string;
  endsA: Score[];
  endsB: Score[];
};
export type PublicEvent = {
  event: {
    id: string;
    name: string;
    venue: string;
    location: string;
    timezone: string;
    startsOn: string;
    endsOn: string;
    origin: string;
    division: string;
    format: string;
  };
  draws: { id: string; number: number; startsAt: string; state: string }[];
  games: PublicGame[];
  selection: ReturnType<typeof selectDraws>;
};
export async function publicEvent(id: string): Promise<PublicEvent | null> {
  const result = await db.execute(
    sql`SELECT e.id,e.name,e.venue,e.location,e.timezone,e.starts_on::text AS "startsOn",e.ends_on::text AS "endsOn",e.origin,d.name AS division,d.format,d.id AS "divisionId" FROM event_edition e JOIN division d ON d.event_id=e.id WHERE e.id=${id} AND e.published=true ORDER BY d.id LIMIT 1`,
  );
  if (!result.rows.length) return null;
  const row = result.rows[0] as PublicEvent["event"] & { divisionId: string };
  const drawsResult = await db.execute(
    sql`SELECT id,number,starts_at AS "startsAt",state FROM draw_session WHERE division_id=${row.divisionId} ORDER BY starts_at,number`,
  );
  const draws = drawsResult.rows.map((d) => ({
    id: String(d.id),
    number: Number(d.number),
    startsAt: new Date(d.startsAt as string).toISOString(),
    state: String(d.state),
  }));
  const gamesResult = await db.execute(
    sql`SELECT g.id,g.draw_id AS "drawId",g.sheet,g.phase,g.state,coalesce(a.display_name,g.slot_a) AS "nameA",coalesce(b.display_name,g.slot_b) AS "nameB",g.total_a AS "totalA",g.total_b AS "totalB",g.hammer,g.updated_at AS "updatedAt" FROM game g JOIN draw_session ds ON ds.id=g.draw_id LEFT JOIN event_entry a ON a.id=g.entry_a LEFT JOIN event_entry b ON b.id=g.entry_b WHERE ds.division_id=${row.divisionId} ORDER BY ds.starts_at,g.sheet,g.id`,
  );
  const endsResult = await db.execute(
    sql`SELECT s.game_id,s.side,s.state,s.points FROM game_end_score s JOIN game g ON g.id=s.game_id JOIN draw_session ds ON ds.id=g.draw_id WHERE ds.division_id=${row.divisionId} ORDER BY s.end_number`,
  );
  const games = gamesResult.rows.map((g) => ({
    ...g,
    updatedAt: new Date(g.updatedAt as string).toISOString(),
    endsA: endsResult.rows
      .filter((e) => e.game_id === g.id && e.side === "a")
      .map((e) => ({
        state: String(e.state),
        points: e.points === null ? null : Number(e.points),
      })),
    endsB: endsResult.rows
      .filter((e) => e.game_id === g.id && e.side === "b")
      .map((e) => ({
        state: String(e.state),
        points: e.points === null ? null : Number(e.points),
      })),
  })) as PublicGame[];
  const { divisionId: _, ...event } = row;
  return { event, draws, games, selection: selectDraws(draws) };
}
