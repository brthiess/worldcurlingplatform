import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEnd } from "../src/domain/scoring";
import {
  lsdObservation,
  drawShotChallenge,
  nextPlacementDecider,
  placementHammer,
  validatePlacements,
  participationEvidence,
} from "../src/domain/disciplines";
import { validateResult } from "../src/domain/results";
import {
  reviewLsdDistribution,
  dscFromStones,
} from "../src/domain/disciplines";
test("C8 distribution distinguishes World Curling MD balanced rotations from the four-player minimum table", () => {
  const five = Array.from({ length: 5 }, (_, i) => [
    { playerId: i % 2 ? "q" : "p", rotation: "cw" },
    { playerId: i % 2 ? "p" : "q", rotation: "ccw" },
  ]);
  assert.deepEqual(
    reviewLsdDistribution("mixed_doubles", ["p", "q"], five).issues,
    [],
  );
  assert.match(
    reviewLsdDistribution(
      "mixed_doubles",
      ["p", "q"],
      Array.from({ length: 5 }, () => [
        { playerId: "p", rotation: "cw" },
        { playerId: "q", rotation: "ccw" },
      ]),
    ).issues.join(" "),
    /balanced/,
  );
  const expected = [
    [3, 1, null],
    [4, 2, 1],
    [6, 2, 1],
    [7, 3, 1],
    [8, 3, 1],
    [9, 4, 2],
    [11, 4, 2],
    [12, 5, 2],
    [13, 6, 3],
  ];
  for (const [games, minimum, rotation] of expected) {
    const r = reviewLsdDistribution(
      "men_four",
      ["p", "q", "r", "s"],
      Array.from({ length: games! }, () => []),
    );
    assert.equal(r.minimumPerPlayer, minimum);
    assert.equal(r.minimumPerRotation, rotation);
    assert(r.issues.length);
  }
  assert.equal(dscFromStones([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]).valueCm, 5.5);
  assert.equal(
    dscFromStones([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).valueCm,
    5.5,
  );
  assert.match(
    reviewLsdDistribution(
      "men_four",
      ["p", "q", "r", "s"],
      [
        [
          { playerId: "p", rotation: "cw" },
          { playerId: "q", rotation: "ccw" },
        ],
        [
          { playerId: "p", rotation: "cw" },
          { playerId: "r", rotation: "ccw" },
        ],
        [
          { playerId: "p", rotation: "cw" },
          { playerId: "s", rotation: "ccw" },
        ],
      ],
    ).issues.join(" "),
    /four required/,
  );
});
test("mixed doubles extra ends follow ties and cease at the first decisive extra end", () => {
  const tied = Array.from({ length: 8 }, () => ({
    state: "played" as const,
    a: 0,
    b: 0,
  }));
  const input = {
    outcome: "normal" as const,
    winnerEntryId: "red",
    reason: "",
    ends: [...tied, { state: "played" as const, a: 1, b: 0 }],
  };
  assert.equal(
    validateResult("live", "confirm", ["red", "yellow"], input, "mixed_doubles")
      .totalA,
    1,
  );
  assert.throws(
    () =>
      validateResult(
        "live",
        "confirm",
        ["red", "yellow"],
        { ...input, ends: [...input.ends, { state: "played", a: 0, b: 0 }] },
        "mixed_doubles",
      ),
    /decisive/,
  );
  assert.throws(
    () =>
      validateResult(
        "live",
        "confirm",
        ["red", "yellow"],
        { ...input, ends: [{ state: "played", a: 1, b: 0 }, ...tied] },
        "mixed_doubles",
      ),
    /tied/,
  );
});
test("World Curling 2026 R17: five delivered plus positioned stone permits six, never seven", () => {
  assert.deepEqual(
    validateEnd({ state: "played", a: 6, b: 0 }, "mixed_doubles"),
    { state: "played", a: 6, b: 0 },
  );
  assert.throws(
    () => validateEnd({ state: "played", a: 7, b: 0 }, "mixed_doubles"),
    /0 to 6/,
  );
  assert.deepEqual(validateEnd({ state: "played", a: 8, b: 0 }, "women_four"), {
    state: "played",
    a: 8,
    b: 0,
  });
});
test("C8 units retain measured zero, edge radius, unknown and assigned maxima as different evidence", () => {
  const base = {
    playerId: "p",
    rotation: "cw",
    source: "Independent synthetic C8 fixture",
  };
  assert.equal(
    lsdObservation({ ...base, kind: "measured-edge", value: 10, unit: "mm" })
      .centreCm,
    15.2,
  );
  assert.equal(
    lsdObservation({
      ...base,
      kind: "measured-centre",
      value: 15.2,
      unit: "cm",
    }).centreCm,
    15.2,
  );
  assert.equal(
    lsdObservation({ ...base, kind: "measured-centre", value: 0, unit: "cm" })
      .centreCm,
    0,
  );
  assert.equal(lsdObservation({ kind: "unknown" }).centreCm, null);
  assert.equal(
    lsdObservation({
      ...base,
      kind: "assigned-maximum",
      reason: "Outside house",
    }).centreCm,
    199.6,
  );
  for (const extra of [
    { kind: "measured-centre", value: -1, unit: "cm" },
    { kind: "measured-edge", value: 190, unit: "cm" },
    { kind: "measured-centre", value: 5, unit: "inch" },
    { kind: "assigned-maximum" },
  ])
    assert.throws(() => lsdObservation({ ...base, ...extra }));
});
test("C9 DSC uses individual stones, threshold eleven, and first equal-game coverage without hiding unknowns", () => {
  assert.equal(
    drawShotChallenge(
      [
        [10, 20],
        [30, 40],
        [50, 60],
      ],
      3,
    ).valueCm,
    30,
  );
  assert.equal(
    drawShotChallenge(
      [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
        [9, 10],
        [180, 190],
      ],
      5,
    ).valueCm,
    5,
  );
  assert.equal(
    drawShotChallenge(
      [
        [1, 2],
        [3, 4],
        [5, 6],
        [7, 8],
        [9, 10],
        [11, 12],
      ],
      6,
    ).valueCm,
    5.5,
  );
  assert.equal(
    drawShotChallenge(
      [
        [10, null],
        [30, 40],
      ],
      2,
    ).valueCm,
    null,
  );
  assert.throws(() => drawShotChallenge([[10, 20]], 2), /coverage/);
});
test("R17 placement decider is distinct from hammer and blank reason matters", () => {
  const previous = {
    decider: "a" as const,
    choice: "B" as const,
    powerPlay: false,
    blankReason: "ordinary" as const,
  };
  assert.equal(placementHammer(previous), "a");
  assert.equal(
    nextPlacementDecider({ state: "played", a: 0, b: 0 }, "a", previous),
    "b",
  );
  assert.equal(
    nextPlacementDecider({ state: "played", a: 0, b: 0 }, "a", {
      ...previous,
      blankReason: "equal-measure",
    }),
    "a",
  );
  assert.equal(
    nextPlacementDecider({ state: "played", a: 0, b: 0 }, "a", {
      ...previous,
      blankReason: "unknown",
    }),
    null,
  );
  assert.equal(
    nextPlacementDecider({ state: "played", a: 2, b: 0 }, "a", previous),
    "b",
  );
  assert.equal(placementHammer({ ...previous, choice: null }), null);
  assert.throws(
    () =>
      validatePlacements(
        Array.from({ length: 9 }, (_, i) =>
          i === 8 ? { ...previous, powerPlay: true } : null,
        ),
        8,
      ),
    /extra/,
  );
  assert.throws(
    () =>
      validatePlacements(
        [
          { ...previous, powerPlay: true },
          { ...previous, powerPlay: true },
        ],
        8,
      ),
    /once/,
  );
});
test("Observed game participation is separate from defaulted lineups; MD cannot record a fifth or alternate player", () => {
  assert.deepEqual(
    participationEvidence({ kind: "unknown" }, "mixed_doubles"),
    { kind: "unknown", playerIds: [], source: "" },
  );
  assert.equal(
    participationEvidence(
      {
        kind: "observed",
        playerIds: ["p", "q"],
        source: "Scorekeeper observation",
      },
      "mixed_doubles",
    ).playerIds.length,
    2,
  );
  assert.throws(
    () =>
      participationEvidence(
        { kind: "observed", playerIds: ["p", "q", "r"], source: "Observed" },
        "mixed_doubles",
      ),
    /two/,
  );
  assert.throws(
    () =>
      participationEvidence(
        {
          kind: "observed",
          playerIds: ["p", "q", "r", "s", "t"],
          source: "Observed",
        },
        "men_four",
      ),
    /four/,
  );
});
