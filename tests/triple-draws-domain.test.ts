import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tripleKnockout,
  selectedDrawPath,
  sourceLabel,
} from "../src/domain/draws";
import { expectedTripleSources, tripleResults } from "./triple-draws-fixture";
const entries = Array.from({ length: 16 }, (_, n) => `T${n + 1}`);
test("the adopted sixteen-team profile exposes every literal source and all eight qualifier destinations", () => {
  const graph = tripleKnockout(entries);
  assert.equal(graph.template, "application-tko16-q8-233-v1");
  assert.deepEqual(graph.byes, []);
  assert.equal(graph.games.length, 40);
  assert.equal(
    graph.games
      .map(
        (g) => `${g.key} ${sourceLabel(g.a, true)} ${sourceLabel(g.b, true)}`,
      )
      .join("\n"),
    expectedTripleSources,
  );
  assert.deepEqual(
    graph.games
      .filter((g) => g.terminals?.winner?.kind === "qualified")
      .map((g) => [g.key, g.terminals!.winner!.label]),
    [
      ["A13", "QA1"],
      ["A14", "QA2"],
      ["B09", "QB1"],
      ["B10", "QB2"],
      ["B11", "QB3"],
      ["C06", "QC1"],
      ["C07", "QC2"],
      ["C08", "QC3"],
    ],
  );
});
test("selected team follows stored A/B/C and playoff branches including a two-loss champion", () => {
  const graph = tripleKnockout(entries);
  const actual = tripleResults.map((r) => ({
    key: r.key,
    entryA: `T${r.a}`,
    entryB: `T${r.b}`,
    winnerEntryId: `T${r.winner}`,
  }));
  assert.deepEqual(selectedDrawPath(graph, 16, "T16", actual), [
    "A01",
    "B01",
    "B05",
    "C04",
    "C07",
    "P03",
    "P06",
    "P07",
  ]);
  assert.deepEqual(selectedDrawPath(graph, 11, "T11", actual), [
    "A08",
    "B04",
    "C02",
  ]);
  assert.deepEqual(selectedDrawPath(graph, 1, "T1", actual), [
    "A01",
    "A09",
    "A13",
    "P01",
    "P05",
    "P07",
  ]);
});
test("a first A loss exposes its stored B route before an assignment is returned", () => {
  const path = selectedDrawPath(tripleKnockout(entries), 16, "T16", [
    { key: "A01", entryA: "T1", entryB: "T16", winnerEntryId: "T1" },
  ]);
  assert.ok(path.includes("B01"));
  assert.ok(path.includes("C04"));
  assert.ok(!path.includes("A09"));
});
test("every reviewed game resolves to the literal participants and all outcomes have one continuation or explicit terminal", () => {
  const graph = tripleKnockout(entries),
    resolved = new Map<string, { winner: string; loser: string }>();
  const source = (s: any) =>
    "seed" in s
      ? entries[s.seed - 1]
      : resolved.get(s.winner ?? s.loser)!["winner" in s ? "winner" : "loser"];
  for (const row of tripleResults) {
    const node = graph.games.find((g) => g.key === row.key)!;
    assert.deepEqual(
      [source(node.a), source(node.b)],
      [`T${row.a}`, `T${row.b}`],
      row.key,
    );
    resolved.set(row.key, {
      winner: `T${row.winner}`,
      loser: `T${row.winner === row.a ? row.b : row.a}`,
    });
    for (const route of ["winner", "loser"] as const) {
      const consumers = graph.games.filter((g) =>
        [g.a, g.b].some((s) => route in s && (s as any)[route] === node.key),
      );
      // A qualification terminal also feeds one fixed playoff destination.
      assert.equal(
        consumers.length +
          (node.terminals?.[route]?.kind === "qualified"
            ? 0
            : node.terminals?.[route]
              ? 1
              : 0),
        1,
        node.key + " " + route,
      );
    }
  }
  assert.deepEqual(
    graph.games
      .filter((g) => g.terminals?.loser?.kind === "eliminated")
      .map((g) => g.key),
    ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08"],
  );
  assert.deepEqual(
    graph.games
      .filter((g) => g.terminals?.loser?.kind === "placed")
      .map((g) => [g.key, g.terminals!.loser!.place]),
    [
      ["P01", 5],
      ["P02", 5],
      ["P03", 5],
      ["P04", 5],
      ["P05", 3],
      ["P06", 3],
      ["P07", 2],
    ],
  );
  assert.deepEqual(
    graph.games.find((g) => g.key === "P07")!.terminals!.winner,
    { kind: "placed", label: "Champion", place: 1 },
  );
});
test("the alternate reviewed A-final loser follows B qualifier loss to C qualification; known actual assignments remain visible after correction", () => {
  const actual = tripleResults
    .slice(0, 33)
    .map((r) => ({
      key: r.key,
      entryA: `T${r.a}`,
      entryB: `T${r.b}`,
      winnerEntryId: `T${r.winner}`,
    }));
  actual.find((g) => g.key === "B09")!.winnerEntryId = "T6";
  Object.assign(actual.find((g) => g.key === "C08")!, {
    entryB: "T4",
    winnerEntryId: "T4",
  });
  assert.deepEqual(selectedDrawPath(tripleKnockout(entries), 4, "T4", actual), [
    "A03",
    "A10",
    "A13",
    "B09",
    "C08",
    "P01",
    "P05",
    "P07",
  ]);
  assert.equal(sourceLabel({ loser: "B09" }), "Loser of B09");
  assert.equal(
    sourceLabel({ winner: "C08", qualifier: "QC3" }),
    "QC3 · Winner of C08",
  );
});
test("the exact main profile rejects incomplete, overfull, duplicate and empty fields", () => {
  for (const invalid of [
    entries.slice(0, 15),
    [...entries, "T17"],
    [...entries.slice(0, 15), "T1"],
    [...entries.slice(0, 15), ""],
  ])
    assert.throws(() => tripleKnockout(invalid), /exactly sixteen distinct/);
});
