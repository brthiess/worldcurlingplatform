import { sql } from "drizzle-orm";
import { db } from "@/db";
import { selectDraws, type Score } from "@/domain/scores";
import { drawEvidenceState } from "@/domain/scheduling";
export type PublicGame = {
  lineupA: import("@/modules/scoring/lineups").GameLineup | null;
  lineupB: import("@/modules/scoring/lineups").GameLineup | null;
  results: {
    version: number;
    confirmedBy: string;
    createdAt: string;
    result: {
      endHammer?: (string | null)[];
      correction?: boolean;
      legacyBefore?: {
        nameA: string;
        nameB: string;
        totalA: number | null;
        totalB: number | null;
        attribution: string;
        ends: import("@/domain/scoring").End[];
      };
      outcome: string;
      winnerEntryId: string;
      entryA: string;
      entryB: string;
      nameA: string;
      nameB: string;
      reason: string;
      totalA: number | null;
      totalB: number | null;
      lineupA: import("@/modules/scoring/lineups").GameLineup;
      lineupB: import("@/modules/scoring/lineups").GameLineup;
      ends: import("@/domain/scoring").End[];
    };
  }[];
  attention: { downstreamGameId: string; resultVersion: number }[];
  id: string;
  drawId: string | null;
  sheet: string;
  phase: string;
  state: string;
  nameA: string;
  nameB: string;
  totalA: number | null;
  totalB: number | null;
  hammer: string | null;
  hammerEnd: number | null;
  endHammer: (string | null)[];
  updatedAt: string;
  endsA: Score[];
  endsB: Score[];
};
export type PublicEvent = {
  divisions: {
    id: string;
    name: string;
    discipline: string;
    format: string;
    rankingStatus: string;
    hasPublishedDraw: boolean;
  }[];
  selectedDivisionId: string | null;
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
    registrationStatus: string;
  };
  draws: { id: string; number: number; startsAt: string; durationMinutes: number; state: string }[];
  games: PublicGame[];
  selection: ReturnType<typeof selectDraws>;
};
export async function publicEvent(
  id: string,
  divisionId?: string,
): Promise<PublicEvent | null> {
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`,
    );
    return projectEvent(transaction, id, divisionId);
  });
}
async function projectEvent(
  connection: Pick<typeof db, "execute">,
  id: string,
  divisionId?: string,
): Promise<PublicEvent | null> {
  const result = await connection.execute(
    sql`SELECT e.id,e.name,e.venue,e.location,e.timezone,e.starts_on::text AS "startsOn",e.ends_on::text AS "endsOn",e.origin,e.registration_status AS "registrationStatus" FROM event_edition e WHERE e.id=${id} AND e.published=true AND e.admission_status='approved'`,
  );
  if (!result.rows.length) return null;
  const divisionResult = await connection.execute(
    sql`SELECT d.id,d.name,d.discipline,d.format,d.ranking_status AS "rankingStatus",EXISTS(SELECT 1 FROM competition_draw cd WHERE cd.division_id=d.id AND cd.state='published') AS "hasPublishedDraw" FROM division d WHERE d.event_id=${id} ORDER BY d.name,d.id`,
  );
  const divisions = divisionResult.rows as PublicEvent["divisions"];
  if (divisionId && !divisions.some((d) => d.id === divisionId)) return null;
  const selected = divisionId
    ? divisions.find((d) => d.id === divisionId)
    : divisions.length === 1
      ? divisions[0]
      : undefined;
  const row = {
    ...result.rows[0],
    divisionId: selected?.id ?? null,
    division: selected?.name ?? "All divisions",
    format: selected?.format ?? "Select a division for competition details",
  } as PublicEvent["event"] & { divisionId: string | null };
  const drawsResult = await connection.execute(
    sql`SELECT id,number,starts_at AS "startsAt",duration_minutes AS "durationMinutes",state FROM draw_session WHERE division_id=${row.divisionId} ORDER BY starts_at,number,id`,
  );
  const draws = drawsResult.rows.map((d) => ({
    id: String(d.id),
    number: Number(d.number),
    startsAt: new Date(d.startsAt as string).toISOString(),
    durationMinutes: Number(d.durationMinutes),
    state: String(d.state),
  }));
  const gamesResult = await connection.execute(
    sql`SELECT g.id,g.draw_id AS "drawId",g.sheet,g.phase,g.state,g.entry_a AS "entryA",g.entry_b AS "entryB",coalesce(a.display_name,g.slot_a) AS "nameA",coalesce(b.display_name,g.slot_b) AS "nameB",g.total_a AS "totalA",g.total_b AS "totalB",g.hammer,g.hammer_end AS "hammerEnd",g.updated_at AS "updatedAt" FROM game g LEFT JOIN draw_session ds ON ds.id=g.draw_id LEFT JOIN event_entry a ON a.id=g.entry_a LEFT JOIN event_entry b ON b.id=g.entry_b WHERE g.division_id=${row.divisionId} ORDER BY ds.starts_at,g.sheet,g.id`,
  );
  const endsResult = await connection.execute(
    sql`SELECT s.game_id,s.side,s.end_number,s.state,s.points FROM game_end_score s JOIN game g ON g.id=s.game_id WHERE g.division_id=${row.divisionId} ORDER BY s.end_number`,
  );
  function ends(id: unknown, side: string, gameState: string): Score[] {
    const gameRows = endsResult.rows.filter((e) => e.game_id === id);
    const rows = gameRows.filter((e) => e.side === side);
    const length = Math.max(8, ...gameRows.map((e) => Number(e.end_number)));
    const last = gameRows
      .filter((e) => e.state === "played" || e.state === "unknown")
      .reduce((n, e) => Math.max(n, Number(e.end_number)), 0);
    return Array.from({ length }, (_, i) => {
      const e = rows.find((e) => Number(e.end_number) === i + 1);
      return {
        state:
          (!e || e.state === "upcoming") &&
          (i + 1 <= last || gameState === "confirmed")
            ? "unknown"
            : e
              ? String(e.state)
              : "upcoming",
        points:
          e?.points === undefined || e.points === null
            ? null
            : Number(e.points),
      };
    });
  }
  const games = gamesResult.rows.map((g) => ({
    ...g,
    updatedAt: new Date(g.updatedAt as string).toISOString(),
    endHammer: [] as (string | null)[],
    results: [],
    attention: [],
    lineupA: null,
    lineupB: null,
    endsA: ends(g.id, "a", String(g.state)),
    endsB: ends(g.id, "b", String(g.state)),
  })) as unknown as PublicGame[];
  const results = await connection.execute(
    sql`SELECT r.game_id,r.version,r.confirmed_by AS "confirmedBy",r.created_at AS "createdAt",r.result FROM game_result_version r JOIN game g ON g.id=r.game_id WHERE g.division_id=${row.divisionId} ORDER BY r.version DESC`,
  );
  const lineups = await connection.execute(
    sql`SELECT DISTINCT ON(l.game_id,l.side) l.game_id,l.side,l.entry_id AS "entryId",l.event_lineup_version AS "eventLineupVersion",l.mode,l.members FROM game_lineup_version l JOIN game g ON g.id=l.game_id WHERE g.division_id=${row.divisionId} AND l.entry_id=CASE l.side WHEN 'a' THEN g.entry_a ELSE g.entry_b END ORDER BY l.game_id,l.side,l.version DESC`,
  );
  const attention = await connection.execute(
    sql`SELECT a.upstream_game_id,a.downstream_game_id AS "downstreamGameId",a.result_version AS "resultVersion" FROM game_assignment_attention a JOIN game g ON g.id=a.upstream_game_id WHERE g.division_id=${row.divisionId}`,
  );
  for (const game of games) {
    game.lineupA =
      (lineups.rows.find(
        (l) => l.game_id === game.id && l.side === "a",
      ) as PublicGame["lineupA"]) ?? null;
    game.lineupB =
      (lineups.rows.find(
        (l) => l.game_id === game.id && l.side === "b",
      ) as PublicGame["lineupB"]) ?? null;
    game.results = results.rows
      .filter((r) => r.game_id === game.id)
      .map(({ game_id: _, ...r }) => ({
        ...r,
        createdAt: new Date(r.createdAt as string).toISOString(),
      })) as PublicGame["results"];
    game.attention = attention.rows
      .filter(
        (a) => a.upstream_game_id === game.id || a.downstreamGameId === game.id,
      )
      .map((a) => ({
        downstreamGameId: String(a.downstreamGameId),
        resultVersion: Number(a.resultVersion),
      }));
  }
  for (const game of games)
    if (
      game.state === "live" &&
      [...game.endsA, ...game.endsB].some((e) => e.state === "unknown")
    ) {
      game.totalA = null;
      game.totalB = null;
    }
  const hammers = await connection.execute(
    sql`SELECT h.game_id,h.end_number,h.hammer FROM game_end_hammer h JOIN game g ON g.id=h.game_id WHERE g.division_id=${row.divisionId}`,
  );
  for (const game of games)
    game.endHammer = Array.from(
      { length: Math.max(game.endsA.length, game.endsB.length) },
      (_, i) => {
        const h = hammers.rows.find(
          (h) => h.game_id === game.id && h.end_number === i + 1,
        );
        return h?.hammer ? String(h.hammer) : null;
      },
    );
  const { divisionId: _, ...event } = row;
  for (const draw of draws) draw.state = drawEvidenceState(games.filter(g=>g.drawId===draw.id).map(g=>g.state));
  return {
    event,
    divisions,
    selectedDivisionId: row.divisionId,
    draws,
    games,
    selection: selectDraws(draws),
  };
}
