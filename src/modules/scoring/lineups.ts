import type { PoolClient } from "pg";
import { readEventLineup } from "@/modules/entries/entries";
import { defaultLineup } from "@/domain/results";
export type GameLineup = {
  entryId: string;
  eventLineupVersion: number | null;
  mode: "defaulted" | "difference";
  members: {
    playerId: string;
    name: string;
    position: string;
    participation: "defaulted" | "declared";
    identityStatus: string;
    role?: string;
  }[];
};
export async function gameLineup(
  c: PoolClient,
  id: string,
  side: string,
  entryId: string,
): Promise<GameLineup> {
  const stored = await c.query(
    'SELECT entry_id AS "entryId",event_lineup_version AS "eventLineupVersion",mode,members FROM game_lineup_version WHERE game_id=$1 AND side=$2 ORDER BY version DESC LIMIT 1',
    [id, side],
  );
  if (stored.rowCount && stored.rows[0].entryId === entryId)
    return stored.rows[0];
  const event = await readEventLineup(c, entryId);
  return defaultLineup(entryId, event);
}
export async function freezeLineups(
  c: PoolClient,
  id: string,
  version: number,
  before: {
    entryA: string | null;
    entryB: string | null;
    lineupA: GameLineup | null;
    lineupB: GameLineup | null;
  },
  exclude?: string,
) {
  for (const side of ["a", "b"] as const) {
    if (side === exclude) continue;
    const lineup = side === "a" ? before.lineupA : before.lineupB;
    if (!lineup) continue;
    const existing = await c.query(
      "SELECT 1 FROM game_lineup_version WHERE game_id=$1 AND side=$2 AND entry_id=$3",
      [id, side, lineup.entryId],
    );
    if (!existing.rowCount)
      await c.query(
        "INSERT INTO game_lineup_version(game_id,version,side,entry_id,event_lineup_version,mode,members) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          version,
          side,
          lineup.entryId,
          lineup.eventLineupVersion,
          lineup.mode,
          JSON.stringify(lineup.members),
        ],
      );
  }
}
