import { test } from "node:test";
import assert from "node:assert/strict";
import {
  singleKnockout,
  assignmentDecision,
  selectedDrawPath,
} from "../src/domain/draws";

test("eight seeded entries follow the independently specified quarterfinal and winner routes", () => {
  const graph = singleKnockout([
    "T1",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
    "T8",
  ]);
  assert.deepEqual(
    graph.games.map((g) => [g.key, g.a, g.b]),
    [
      ["Q1", { seed: 1 }, { seed: 8 }],
      ["Q2", { seed: 4 }, { seed: 5 }],
      ["Q3", { seed: 2 }, { seed: 7 }],
      ["Q4", { seed: 3 }, { seed: 6 }],
      ["S1", { winner: "Q1" }, { winner: "Q2" }],
      ["S2", { winner: "Q3" }, { winner: "Q4" }],
      ["F", { winner: "S1" }, { winner: "S2" }],
    ],
  );
  assert.deepEqual(graph.byes, []);
});

test("team path follows literal winner routes, ends at elimination and retains actual played assignments", () => {
  const full = singleKnockout(["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]);
  assert.deepEqual(selectedDrawPath(full, 1, "T1", []), ["Q1", "S1", "F"]);
  assert.deepEqual(
    selectedDrawPath(
      singleKnockout(["T1", "T2", "T3", "T4", "T5", "T6"]),
      1,
      "T1",
      [],
    ),
    ["S1", "F"],
  );
  const outcomes = [
    { key: "Q2", entryA: "T4", entryB: "T5", winnerEntryId: "T4" },
    { key: "S1", entryA: "T1", entryB: "T4", winnerEntryId: "T1" },
  ];
  assert.deepEqual(selectedDrawPath(full, 4, "T4", outcomes), ["Q2", "S1"]);
  assert.deepEqual(
    selectedDrawPath(full, 4, "T4", [
      ...outcomes,
      { key: "F", entryA: "T4", entryB: "T2", winnerEntryId: "T2" },
    ]),
    ["Q2", "S1", "F"],
  );
});

test("unsupported fields, duplicate seeds and empty entries are rejected", () => {
  for (const field of [
    [],
    ["A"],
    ["A", "B", "C", "D", "E", "F", "G"],
    ["A", "B", "C", "D", "E", "E"],
    ["A", "B", "C", "D", "E", ""],
  ])
    assert.throws(() => singleKnockout(field), /six or eight distinct/);
});

test("advancement assigns an unstarted slot but preserves actual downstream participants", () => {
  assert.equal(assignmentDecision("scheduled", null, "T4"), "assign");
  assert.equal(assignmentDecision("scheduled", "T4", "T5"), "assign");
  assert.equal(assignmentDecision("live", "T4", "T5"), "attention");
  assert.equal(assignmentDecision("confirmed", "T4", "T5"), "attention");
  assert.equal(assignmentDecision("confirmed", "T4", "T4"), "unchanged");
});

test("six entries have two structural byes and exactly five real games", () => {
  const graph = singleKnockout(["T1", "T2", "T3", "T4", "T5", "T6"]);
  assert.deepEqual(
    graph.games.map((g) => [g.key, g.a, g.b]),
    [
      ["Q2", { seed: 4 }, { seed: 5 }],
      ["Q4", { seed: 3 }, { seed: 6 }],
      ["S1", { seed: 1 }, { winner: "Q2" }],
      ["S2", { seed: 2 }, { winner: "Q4" }],
      ["F", { winner: "S1" }, { winner: "S2" }],
    ],
  );
  assert.deepEqual(graph.byes, [
    { seed: 1, omittedGame: "Q1", destination: "S1", side: "a" },
    { seed: 2, omittedGame: "Q3", destination: "S2", side: "a" },
  ]);
});
