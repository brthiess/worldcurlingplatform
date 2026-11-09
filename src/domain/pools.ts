import type { DrawFixture } from "./draws";
export const POOL_TEMPLATE = "application-pools2x4-v1";
export type PoolGroup = { key: string; seeds: number[] };
/** Adopted bounded application choice; no playoff or automatic qualifiers. */
export function pooledRoundRobin(entries: string[]) {
  if (
    entries.length !== 8 ||
    new Set(entries).size !== 8 ||
    entries.some((e) => !e)
  )
    throw new Error("Choose exactly eight distinct entries in seed order.");
  const groups: PoolGroup[] = [
    { key: "A", seeds: [1, 4, 5, 8] },
    { key: "B", seeds: [2, 3, 6, 7] },
  ];
  const games: (DrawFixture & {
    group: string;
    a: { seed: number };
    b: { seed: number };
  })[] = [];
  for (const group of groups) {
    const rounds = [
      [
        [1, 4],
        [2, 3],
      ],
      [
        [1, 3],
        [4, 2],
      ],
      [
        [1, 2],
        [3, 4],
      ],
    ];
    for (const [r, pairs] of rounds.entries())
      for (const [p, [a, b]] of pairs.entries())
        games.push({
          key: group.key + String(r * 2 + p + 1).padStart(2, "0"),
          round: r + 1,
          group: group.key,
          a: { seed: group.seeds[a - 1] },
          b: { seed: group.seeds[b - 1] },
        });
  }
  return { template: POOL_TEMPLATE, groups, games, byes: [] };
}

export type PoolResult = {
  id: string;
  state: string;
  entryA: string | null;
  entryB: string | null;
  winnerEntryId: string | null;
};
export function poolStandings(
  groups: PoolGroup[],
  seeds: { seed: number; entryId: string; name: string }[],
  fixtures: { id: string; group?: string }[],
  games: PoolResult[],
) {
  return groups.map((group) => {
    const members = seeds.filter((s) => group.seeds.includes(s.seed));
    const groupGames = games.filter((g) =>
      fixtures.some((f) => f.id === g.id && f.group === group.key),
    );
    const unique = [...new Map(groupGames.map((g) => [g.id, g])).values()];
    const rows = members.map((s) => {
      let wins = 0,
        losses = 0,
        ties = 0,
        pending = 0;
      for (const g of unique.filter(
        (g) => g.entryA === s.entryId || g.entryB === s.entryId,
      )) {
        const valid =
          g.entryA !== g.entryB &&
          members.some((m) => m.entryId === g.entryA) &&
          members.some((m) => m.entryId === g.entryB);
        if (!valid || g.state !== "confirmed") {
          pending++;
          continue;
        }
        if (g.winnerEntryId && [g.entryA, g.entryB].includes(g.winnerEntryId))
          g.winnerEntryId === s.entryId ? wins++ : losses++;
        else pending++;
      }
      return {
        ...s,
        wins,
        losses,
        ties,
        played: wins + losses + ties,
        pending,
        tied: false,
      };
    });
    for (const row of rows)
      row.tied = rows.some(
        (other) =>
          other.entryId !== row.entryId &&
          other.wins === row.wins &&
          other.losses === row.losses &&
          other.ties === row.ties,
      );
    rows.sort(
      (a, b) =>
        b.wins - a.wins ||
        b.ties - a.ties ||
        a.losses - b.losses ||
        a.seed - b.seed,
    );
    return { key: group.key, rows };
  });
}
