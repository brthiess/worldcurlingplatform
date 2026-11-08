import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateResult,
  lineupDifference,
  defaultLineup,
} from "../src/domain/results";
test("normal results require the participating winner and a complete decisive line score; concessions and forfeits preserve distinct evidence", () => {
  const ends = [
    { state: "played", a: 2, b: 0 },
    { state: "played", a: 0, b: 1 },
    { state: "played", a: 0, b: 0 },
    { state: "played", a: 0, b: 0 },
    { state: "played", a: 0, b: 0 },
    { state: "played", a: 0, b: 0 },
    { state: "played", a: 0, b: 0 },
    { state: "played", a: 0, b: 0 },
  ] as const;
  assert.deepEqual(
    validateResult("live", "confirm", ["north", "prairie"], {
      outcome: "normal",
      winnerEntryId: "north",
      ends: [...ends],
      reason: "",
    }),
    {
      outcome: "normal",
      winnerEntryId: "north",
      ends: [...ends],
      totalA: 2,
      totalB: 1,
      reason: "",
    },
  );
  assert.throws(
    () =>
      validateResult("live", "confirm", ["north", "prairie"], {
        outcome: "normal",
        winnerEntryId: "prairie",
        ends: [...ends],
        reason: "",
      }),
    /winner/i,
  );
  assert.throws(
    () =>
      validateResult("live", "confirm", ["north", "prairie"], {
        outcome: "normal",
        winnerEntryId: "other",
        ends: [...ends],
        reason: "",
      }),
    /participant/i,
  );
  assert.throws(
    () =>
      validateResult("confirmed", "confirm", ["north", "prairie"], {
        outcome: "normal",
        winnerEntryId: "north",
        ends: [...ends],
        reason: "",
      }),
    /correct/i,
  );
  assert.throws(
    () =>
      validateResult("confirmed", "correct", ["north", "prairie"], {
        outcome: "normal",
        winnerEntryId: "north",
        ends: [...ends],
        reason: "",
      }),
    /reason/i,
  );
  assert.throws(
    () =>
      validateResult("live", "confirm", ["north", "prairie"], {
        outcome: "normal",
        winnerEntryId: "north",
        ends: [{ state: "unknown", a: null, b: null }],
        reason: "",
      }),
    /complete/i,
  );
  assert.equal(
    validateResult("live", "confirm", ["north", "prairie"], {
      outcome: "conceded",
      winnerEntryId: "prairie",
      ends: [...ends],
      reason: "North conceded",
    }).outcome,
    "conceded",
  );
  const forfeit = validateResult("scheduled", "confirm", ["north", "prairie"], {
    outcome: "forfeit",
    winnerEntryId: "north",
    ends: [],
    reason: "Prairie absent",
  });
  assert.equal(forfeit.totalA, null);
  assert.equal(forfeit.totalB, null);
});
test("a game default keeps its event version and labels defaulted evidence; differences declare players without changing the event", () => {
  const event = {
    entryId: "north",
    version: 7,
    members: [
      {
        playerId: "p1",
        position: "Skip",
        name: "One",
        identityStatus: "identified",
        participation: "declared",
      },
    ],
  };
  assert.deepEqual(defaultLineup("north", event), {
    entryId: "north",
    eventLineupVersion: 7,
    mode: "defaulted",
    members: [{ ...event.members[0], participation: "defaulted" }],
  });
  assert.deepEqual(defaultLineup("legacy", null), {
    entryId: "legacy",
    eventLineupVersion: null,
    mode: "defaulted",
    members: [],
  });
  assert.deepEqual(lineupDifference([{ playerId: "p2", position: "Skip" }]), [
    { playerId: "p2", position: "Skip" },
  ]);
  assert.throws(
    () =>
      lineupDifference([
        { playerId: "p2", position: "" },
        { playerId: "p2", position: "" },
      ]),
    /distinct/,
  );
  assert.throws(
    () => lineupDifference([{ playerId: "p2", position: "<script>" }]),
    /plain-text/,
  );
  assert.equal(event.members[0].playerId, "p1");
});
test("normal completion uses the eight-end four-player profile; an early stop is recorded as a concession", () => {
  assert.throws(
    () =>
      validateResult("live", "confirm", ["north", "prairie"], {
        outcome: "normal",
        winnerEntryId: "north",
        reason: "",
        ends: [{ state: "played", a: 2, b: 0 }],
      }),
    /eight/,
  );
});
