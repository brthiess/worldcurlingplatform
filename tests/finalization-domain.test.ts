import { test } from "node:test";
import assert from "node:assert/strict";
import {
  finalizationPrerequisites,
  validatePlacements,
  freezeContents,
  finalizationState,
} from "../src/domain/finalization";
test("sporting completion requires explicit confirmed outcomes, not an inferred legacy winner", () => {
  assert.deepEqual(
    finalizationPrerequisites([{ state: "confirmed", result: null }]),
    [
      "Every game needs an explicitly confirmed outcome; legacy totals alone are insufficient.",
    ],
  );
  assert.deepEqual(
    finalizationPrerequisites([{ state: "live", result: null }]),
    [
      "Every game must be confirmed.",
      "Every game needs an explicitly confirmed outcome; legacy totals alone are insufficient.",
    ],
  );
  assert.deepEqual(
    finalizationPrerequisites([
      {
        state: "confirmed",
        result: { winnerEntryId: "a", outcome: "forfeit" },
      },
    ]),
    [],
  );
  assert.deepEqual(finalizationPrerequisites([]), [
    "Record at least one game before finalizing.",
  ]);
});
test("frozen bytes use canonical key order and revisions compare current source without changing history", () => {
  const frozen = freezeContents({ b: 2, a: 1 });
  assert.deepEqual(frozen, {
    contents: '{"a":1,"b":2}',
    digest: "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
  });
  assert.deepEqual(freezeContents({ a: 1, b: 2 }), frozen);
  assert.deepEqual(finalizationState(null, "new"), {
    version: 0,
    dirty: false,
  });
  assert.deepEqual(
    finalizationState(
      { version: 1, sourceDigest: frozen.digest },
      frozen.digest,
    ),
    { version: 1, dirty: false },
  );
  assert.deepEqual(
    finalizationState({ version: 1, sourceDigest: frozen.digest }, "changed"),
    { version: 1, dirty: true },
  );
  assert.equal(frozen.contents, '{"a":1,"b":2}');
});
test("placements cover each entry exactly once and explicitly preserve ties without inventing a tiebreak", () => {
  const entries = ["a", "b", "c", "d"];
  assert.deepEqual(
    validatePlacements(
      entries,
      [
        { entryId: "d", place: 4 },
        { entryId: "b", place: 2 },
        { entryId: "a", place: 1 },
        { entryId: "c", place: 2 },
      ],
      "Shared second place",
    ),
    [
      { entryId: "a", place: 1 },
      { entryId: "b", place: 2 },
      { entryId: "c", place: 2 },
      { entryId: "d", place: 4 },
    ],
  );
  for (const placements of [
    [{ entryId: "a", place: 1 }],
    [
      { entryId: "a", place: 1 },
      { entryId: "a", place: 2 },
      { entryId: "c", place: 3 },
      { entryId: "d", place: 4 },
    ],
    [
      { entryId: "a", place: 1 },
      { entryId: "b", place: 2 },
      { entryId: "c", place: 2 },
      { entryId: "d", place: 3 },
    ],
  ])
    assert.throws(() => validatePlacements(entries, placements, "Recorded"));
  assert.throws(
    () =>
      validatePlacements(
        entries,
        [
          { entryId: "a", place: 1 },
          { entryId: "b", place: 2 },
          { entryId: "c", place: 2 },
          { entryId: "d", place: 4 },
        ],
        "",
      ),
    /tie/i,
  );
});
