export const SINGLE_TEMPLATE = "application-single8-seeded-v1";
export type DrawSource = { seed: number } | { winner: string };
export type DrawFixture = {
  key: string;
  round: number;
  a: DrawSource;
  b: DrawSource;
};
export function assignmentDecision(
  state: string,
  actual: string | null,
  expected: string,
) {
  return actual === expected
    ? "unchanged"
    : state === "scheduled"
      ? "assign"
      : "attention";
}
export function selectedDrawPath(
  graph: { games: DrawFixture[] },
  seed: number | undefined,
  entryId: string,
  games: {
    key: string;
    entryA: string | null;
    entryB: string | null;
    winnerEntryId: string | null;
  }[],
) {
  if (!entryId) return [];
  const path = new Set<string>();
  for (const node of graph.games) {
    const actual = games.find((g) => g.key === node.key);
    if (
      (actual && (actual.entryA === entryId || actual.entryB === entryId)) ||
      [node.a, node.b].some((source) => {
        if ("seed" in source) return source.seed === seed;
        const upstream = games.find((g) => g.key === source.winner);
        return (
          path.has(source.winner) &&
          (!upstream?.winnerEntryId || upstream.winnerEntryId === entryId)
        );
      })
    )
      path.add(node.key);
  }
  return [...path];
}
export function singleKnockout(entries: string[]) {
  if (
    ![6, 8].includes(entries.length) ||
    new Set(entries).size !== entries.length ||
    entries.some((e) => !e)
  )
    throw new Error("Choose six or eight distinct entries in seed order.");
  const graph = {
    template: SINGLE_TEMPLATE,
    games: [
      { key: "Q1", round: 1, a: { seed: 1 }, b: { seed: 8 } },
      { key: "Q2", round: 1, a: { seed: 4 }, b: { seed: 5 } },
      { key: "Q3", round: 1, a: { seed: 2 }, b: { seed: 7 } },
      { key: "Q4", round: 1, a: { seed: 3 }, b: { seed: 6 } },
      { key: "S1", round: 2, a: { winner: "Q1" }, b: { winner: "Q2" } },
      { key: "S2", round: 2, a: { winner: "Q3" }, b: { winner: "Q4" } },
      { key: "F", round: 3, a: { winner: "S1" }, b: { winner: "S2" } },
    ] as DrawFixture[],
    byes: [] as {
      seed: number;
      omittedGame: string;
      destination: string;
      side: "a" | "b";
    }[],
  };
  if (entries.length === 6) {
    graph.games = graph.games
      .filter((g) => g.key !== "Q1" && g.key !== "Q3")
      .map((g) =>
        g.key === "S1"
          ? { ...g, a: { seed: 1 } }
          : g.key === "S2"
            ? { ...g, a: { seed: 2 } }
            : g,
      );
    graph.byes = [
      { seed: 1, omittedGame: "Q1", destination: "S1", side: "a" },
      { seed: 2, omittedGame: "Q3", destination: "S2", side: "a" },
    ];
  }
  return graph;
}
