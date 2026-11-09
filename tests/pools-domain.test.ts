import { test } from "node:test";
import assert from "node:assert/strict";
import { pooledRoundRobin, poolStandings } from "../src/domain/pools";

test("the adopted two pools contain every pair once in three rounds without cross-pool games", () => {
  const graph = pooledRoundRobin(["1", "2", "3", "4", "5", "6", "7", "8"]);
  assert.deepEqual(graph.groups, [
    { key: "A", seeds: [1, 4, 5, 8] },
    { key: "B", seeds: [2, 3, 6, 7] },
  ]);
  assert.deepEqual(
    graph.games.map((g) => [
      g.key,
      g.round,
      g.group,
      "seed" in g.a && g.a.seed,
      "seed" in g.b && g.b.seed,
    ]),
    [
      ["A01", 1, "A", 1, 8],
      ["A02", 1, "A", 4, 5],
      ["A03", 2, "A", 1, 5],
      ["A04", 2, "A", 8, 4],
      ["A05", 3, "A", 1, 4],
      ["A06", 3, "A", 5, 8],
      ["B01", 1, "B", 2, 7],
      ["B02", 1, "B", 3, 6],
      ["B03", 2, "B", 2, 6],
      ["B04", 2, "B", 7, 3],
      ["B05", 3, "B", 2, 3],
      ["B06", 3, "B", 6, 7],
    ],
  );
  assert.equal(
    new Set(graph.games.map((g) => [g.a.seed, g.b.seed].sort().join("-"))).size,
    12,
  );
  assert.throws(() => pooledRoundRobin(["1", "2"]), /eight distinct/);
  assert.throws(() => pooledRoundRobin(Array(8).fill("1")), /eight distinct/);
});

test("independent pool outcomes produce scoped records, ignore repeated rows and keep equal records unresolved", () => {
  const graph = pooledRoundRobin(["1", "2", "3", "4", "5", "6", "7", "8"]);
  const seeds = Array.from({ length: 8 }, (_, i) => ({
    seed: i + 1,
    entryId: String(i + 1),
    name: `T${i + 1}`,
  }));
  const fixtures = graph.games.map((g) => ({ ...g, id: g.key }));
  const games = [
    ["A01", "1", "8", "1"],
    ["A02", "4", "5", "4"],
    ["A03", "1", "5", "1"],
    ["A04", "8", "4", "4"],
    ["A05", "1", "4", "1"],
    ["A06", "5", "8", "5"],
    ["B01", "2", "7", "2"],
    ["B02", "3", "6", "3"],
    ["B03", "2", "6", "2"],
    ["B04", "7", "3", "3"],
    ["B05", "2", "3", "2"],
    ["B06", "6", "7", "6"],
  ].map(([id, entryA, entryB, winnerEntryId]) => ({
    id,
    entryA,
    entryB,
    winnerEntryId,
    state: "confirmed",
  }));
  const records = poolStandings(graph.groups, seeds, fixtures, [
    ...games,
    games[0],
  ]);
  assert.deepEqual(
    records.map((g) =>
      g.rows.map((r) => [
        r.name,
        r.wins,
        r.losses,
        r.played,
        r.pending,
        r.tied,
      ]),
    ),
    [
      [
        ["T1", 3, 0, 3, 0, false],
        ["T4", 2, 1, 3, 0, false],
        ["T5", 1, 2, 3, 0, false],
        ["T8", 0, 3, 3, 0, false],
      ],
      [
        ["T2", 3, 0, 3, 0, false],
        ["T3", 2, 1, 3, 0, false],
        ["T6", 1, 2, 3, 0, false],
        ["T7", 0, 3, 3, 0, false],
      ],
    ],
  );
  const pending = poolStandings(graph.groups, seeds, fixtures, [
    { ...games[0], winnerEntryId: null },
    { ...games[1], state: "live" },
  ]);
  assert.ok(
    pending.flatMap((g) => g.rows).every((r) => r.played === 0 && r.ties === 0),
  );
  const tied = poolStandings(graph.groups, seeds, fixtures, [
    games[0],
    games[1],
  ]);
  assert.deepEqual(
    tied[0].rows.map((r) => [r.name, r.wins, r.losses, r.tied]),
    [
      ["T1", 1, 0, true],
      ["T4", 1, 0, true],
      ["T5", 0, 1, true],
      ["T8", 0, 1, true],
    ],
  );
});

test("pool standings return public fields without forwarding private entry properties", () => {
  const entries = [
    {
      seed: 1,
      entryId: "one",
      name: "One",
      privateNote: "Confidential participant note",
    },
    { seed: 4, entryId: "four", name: "Four", privateNote: "Do not publish" },
  ];
  const result = poolStandings([{ key: "A", seeds: [1, 4] }], entries, [], []);
  assert.equal("privateNote" in result[0].rows[0], false);
  assert.equal("privateNote" in result[0].rows[1], false);
});
