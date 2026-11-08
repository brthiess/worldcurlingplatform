import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessFourPlayer,
  type CalculationField,
} from "../src/domain/event-assessments";
const f1 = (): CalculationField => ({
  kind: "tour",
  newEvent: true,
  previousSfm: null,
  singleKnockout: false,
  bronzeGame: false,
  issues: [],
  entries: Array.from({ length: 16 }, (_, i) => ({
    entryId: `e${i + 1}`,
    rank: i + 1,
    points: "100",
    eligibility: "eligible",
    place: i < 2 ? i + 1 : i < 4 ? 3 : i < 8 ? 5 : 9,
    wins: 2,
    qualificationWins: 2,
    qualificationLosses: 0,
    qualified: i < 8,
    firstPlayoffWon: i < 2,
  })),
});
test("F2 eight-team small field and single knockout; F3 prior-edition floor", () => {
  const f = f1();
  f.entries = f.entries
    .slice(0, 8)
    .map((e, i) => ({
      ...e,
      rank: 31 + i,
      qualified: i < 4,
      place: i < 2 ? i + 1 : i < 4 ? 3 : 5,
    }));
  assert.deepEqual(
    assessFourPlayer(f).awards.map((a) => a.points),
    ["27", "99/5", "261/20", "261/20", "27/10", "27/10", "27/10", "27/10"],
  );
  assert.equal(assessFourPlayer({ ...f, singleKnockout: true }).sfm, "27/10");
  assert.equal(
    assessFourPlayer({ ...f, singleKnockout: true }).awards[0].points,
    "81/4",
  );
  const prior = f1();
  prior.entries = prior.entries.map((e, i) => ({ ...e, rank: 51 + i }));
  prior.newEvent = false;
  prior.previousSfm = "6";
  assert.equal(assessFourPlayer(prior).sfm, "24/5");
  assert.equal(assessFourPlayer(prior).awards[0].points, "36");
  assert.equal(assessFourPlayer({ ...prior, previousSfm: "3" }).sfm, "18/5");
});
test("losing qualifiers halve only after first playoff defeat; bronze and split qualifiers calculate", () => {
  const f = f1();
  Object.assign(f.entries[4], {
    qualificationWins: 2,
    qualificationLosses: 3,
    firstPlayoffWon: false,
  });
  assert.equal(assessFourPlayer(f).awards[4].points, "12");
  f.entries[4].firstPlayoffWon = true;
  assert.equal(assessFourPlayer(f).awards[4].points, "24");
  f.bronzeGame = true;
  f.entries[3].place = 4;
  assert.deepEqual(
    assessFourPlayer(f)
      .awards.slice(2, 4)
      .map((a) => a.points),
    ["36", "32"],
  );
  f.entries = f.entries.slice(0, 12);
  f.entries[4].qualificationLosses = 0;
  assert.equal(assessFourPlayer(f).awards[4].points, "12");
});
test("required unknown rank/eligibility/prior inputs block, and rank 200 overlap is never invented", () => {
  for (const patch of [
    { rank: null },
    { points: null },
    { rank: 200 },
    { eligibility: "unknown" as const },
  ]) {
    const f = f1();
    Object.assign(f.entries[1], patch);
    const r = assessFourPlayer(f);
    assert.equal(r.state, "blocked");
    assert.equal(r.sfm, null);
    assert.deepEqual(r.awards, []);
  }
  assert.equal(assessFourPlayer({ ...f1(), newEvent: false }).state, "blocked");
  const f = f1();
  f.entries[0].eligibility = "excluded";
  assert.equal(assessFourPlayer(f).awards[0].points, "0");
});
test("losing qualifier requires a known first playoff result; fixed Worlds strength ignores unused rank inputs", () => {
  const f = f1();
  Object.assign(f.entries[4], {
    qualificationWins: 2,
    qualificationLosses: 3,
    firstPlayoffWon: null,
  });
  assert.equal(assessFourPlayer(f).state, "blocked");
  const worlds = f1();
  worlds.kind = "worlds";
  worlds.entries = worlds.entries.map((e) => ({
    ...e,
    rank: null,
    points: null,
  }));
  const r = assessFourPlayer(worlds);
  assert.equal(r.state, "completed");
  assert.equal(r.sfm, "11");
  assert.equal(r.awards[0].points, "165/2");
});
test("F1 sourced synthetic 16-team tour: full strength, placement and non-playoff wins", () => {
  const r = assessFourPlayer(f1());
  assert.equal(r.state, "completed");
  assert.equal(r.sfm, "8");
  assert.deepEqual(
    r.awards.map((a) => a.points),
    [
      "60",
      "44",
      "34",
      "34",
      "24",
      "24",
      "24",
      "24",
      "6",
      "6",
      "6",
      "6",
      "6",
      "6",
      "6",
      "6",
    ],
  );
  assert.equal(
    r.stages.find((s) => s.stage === "contribution sum")?.value,
    "6",
  );
});
