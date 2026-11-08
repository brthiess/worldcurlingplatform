import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAllocation,
  exact,
  rulesInput,
  checkpointAt,
  seasonInput,
  readiness,
  type ReviewContext,
} from "../src/domain/ranking-inputs";
import { wctrs2026 } from "../src/domain/wctrs-2026";

test("front rotation retains equal one-sixth rights exactly without normalizing the published rounded percentages", () => {
  const members = ["a", "b", "c", "d", "e"];
  const shares = ["1/4", "1/4", "1/6", "1/6", "1/6"];
  assert.doesNotThrow(() =>
    validateAllocation(
      members,
      members.map((playerId, i) => ({ playerId, share: shares[i] })),
      "front-rotation",
    ),
  );
  assert.equal(exact.multiply("300", "1/6"), "50");
  assert.throws(
    () =>
      validateAllocation(
        members,
        members.map((playerId, i) => ({
          playerId,
          share: ["1/4", "1/4", "1667/10000", "1667/10000", "1667/10000"][i],
        })),
        "front-rotation",
      ),
    /exactly one/,
  );
});

test("canonical exact values remain valid arithmetic inputs even when decimal conversion expands the numerator", () => {
  const canonical = exact.value("1000.123456789013");
  assert.equal(canonical, "1000123456789013/1000000000000");
  assert.equal(exact.value(canonical), canonical);
  assert.equal(exact.add("0", canonical), canonical);
  assert.equal(
    exact.add(canonical, canonical),
    "1000123456789013/500000000000",
  );
});

test("five sourced regulars own one fifth each; a designated ranking alternate has no share and prior-team arithmetic remains checked", () => {
  const players = ["a", "b", "c", "d", "e"],
    base = rulesInput(wctrs2026());
  const input = seasonInput({
    registrationId: "registration",
    rosterVersion: 1,
    rulesId: "rules",
    rulesVersion: 1,
    effectiveFrom: "2026-08-01",
    effectiveTo: "2027-08-01",
    rankingPlayerIds: players,
    rankingAlternateIds: ["alternate"],
    rosterSourceId: "official",
    allocationOption: "five-equal",
    allocations: players.map((playerId) => ({ playerId, share: "1/5" })),
    sources: [source],
    contributions: players.map((playerId) => ({
      playerId,
      amount: "40",
      basis: "prior-team-share",
      priorTotal: "200",
      priorShare: "1/5",
      sourceId: "official",
      ownershipSourceId: "official",
      eligibilitySourceId: "official",
      note: "Independently evidenced prior ownership and current eligibility.",
    })),
    reviewNote: "Five regular rights reviewed.",
    biographyMissing: false,
  });
  const c: ReviewContext = {
    discipline: "men_four",
    season: "2026-27",
    rosterVersion: 1,
    members: [...players, "alternate"].map((playerId) => ({
      playerId,
      role: playerId === "alternate" ? "alternate" : "core",
      identityStatus: "identified",
    })),
    rules: base,
    rulesReviewed: true,
  };
  assert.equal(readiness(input, c).startingInput, "200");
  assert.equal(exact.multiply("200", "1/5"), "40");
  assert.throws(
    () =>
      seasonInput({
        ...input,
        allocations: [
          ...input.allocations.slice(0, 4),
          { playerId: "alternate", share: "1/5" },
        ],
      }),
    /registered regular/,
  );
  assert.throws(
    () => seasonInput({ ...input, rankingAlternateIds: ["a"] }),
    /once/,
  );
  const wrong = seasonInput({
    ...input,
    contributions: input.contributions.map((v, i) =>
      i === 0 ? { ...v, amount: "50" } : v,
    ),
  });
  assert(readiness(wrong, c).issues.some((i) => i.code === "prior-share-a"));
  assert.equal(
    readiness(input, {
      ...c,
      members: c.members.map((m) =>
        m.playerId === "b" ? { ...m, identityStatus: "provisional" } : m,
      ),
    }).complete,
    false,
  );
  const front = seasonInput({
    ...input,
    allocationOption: "front-rotation",
    allocations: players.map((playerId, i) => ({
      playerId,
      share: i < 2 ? "1/4" : "1/6",
    })),
  });
  assert.equal(
    readiness(front, { ...c, rules: { ...base, interpretations: [] } })
      .complete,
    false,
  );
});

test("the researched 2026-27 edition selects every independent dated checkpoint boundary without computing a ranking list", () => {
  const rules = rulesInput(wctrs2026());
  const expected = [
    ["2026-08-01", 1, "1"],
    ["2026-09-15", 2, "3/4"],
    ["2026-10-06", 3, "5/8"],
    ["2026-10-27", 4, "1/2"],
    ["2026-11-17", 5, "3/8"],
    ["2026-12-08", 6, "1/4"],
    ["2026-12-29", 7, "1/8"],
    ["2027-01-19", 8, "0"],
  ] as const;
  for (const [date, count, weight] of expected) {
    const c = checkpointAt(rules, "four_overall", date);
    assert.equal(c?.maxEvents, count);
    assert.equal(c?.priorWeight, weight);
  }
  assert.equal(checkpointAt(rules, "four_overall", "2026-09-14")?.maxEvents, 1);
  assert.equal(checkpointAt(rules, "four_series", "2027-01-01")?.maxEvents, 5);
  assert.equal(
    checkpointAt(rules, "four_series", "2027-01-01")?.priorWeight,
    "0",
  );
  assert.equal(
    checkpointAt(rules, "mixed_doubles", "2027-02-01")?.maxEvents,
    6,
  );
  assert.throws(
    () =>
      rulesInput({
        ...rules,
        sources: [{ ...source, url: "javascript:alert(1)" }],
      }),
    /HTTPS/,
  );
  assert.throws(
    () => rulesInput({ ...rules, effectiveFrom: "2026-02-30" }),
    /calendar/,
  );
});

test("an old aggregate and unresolved eligibility remain blockers; a missing biography is informational and cannot waive them", () => {
  const players = ["a", "b", "c", "d"];
  const input = seasonInput({
    registrationId: "registration",
    rosterVersion: 1,
    rulesId: "rules",
    rulesVersion: 1,
    effectiveFrom: "2026-08-01",
    effectiveTo: "2027-08-01",
    rankingPlayerIds: players,
    rankingAlternateIds: [],
    rosterSourceId: "official",
    allocationOption: "four-equal",
    allocations: players.map((playerId) => ({ playerId, share: "1/4" })),
    sources: [source],
    contributions: players.map((playerId) => ({
      playerId,
      amount: "50",
      basis: "historical-aggregate",
      sourceId: "official",
      ownershipSourceId: "",
      eligibilitySourceId: "",
      note: "Old team total 200 only.",
    })),
    reviewNote: "Checked",
    biographyMissing: true,
  });
  const context: ReviewContext = {
    discipline: "men_four",
    season: "2026-27",
    rosterVersion: 1,
    members: players.map((playerId) => ({
      playerId,
      role: "core",
      identityStatus: "identified",
    })),
    rules: rulesInput({
      ...rulesFixture(),
      checkpoints: [
        {
          family: "four_overall",
          from: "2026-08-01",
          maxEvents: 1,
          priorWeight: "1",
          sourceId: "official",
        },
      ],
    }),
    rulesReviewed: true,
  };
  const result = readiness(input, context);
  assert.equal(result.complete, false);
  assert(
    result.issues.some(
      (i) => i.code === "ownership-a" && i.severity === "blocker",
    ),
  );
  assert(
    result.issues.some(
      (i) => i.code === "eligibility-a" && i.severity === "blocker",
    ),
  );
  assert(
    result.issues.some(
      (i) => i.code === "biography" && i.severity === "informational",
    ),
  );
  const complete = seasonInput({
    ...input,
    contributions: input.contributions.map((c) => ({
      ...c,
      basis: "documented-individual",
      ownershipSourceId: "official",
      eligibilitySourceId: "official",
    })),
  });
  assert.equal(readiness(complete, context).startingInput, "200");
  assert.equal(readiness(complete, context).complete, true);
  const independentlyRegistered = seasonInput({
    ...complete,
    rankingAlternateIds: ["c"],
    rosterSourceId: "official",
    rankingPlayerIds: ["a", "b", "d", "z"],
    allocations: ["a", "b", "d", "z"].map((playerId) => ({
      playerId,
      share: "1/4",
    })),
    contributions: ["a", "b", "d", "z"].map((playerId) => ({
      ...complete.contributions[0],
      playerId,
    })),
  });
  assert.equal(
    readiness(independentlyRegistered, {
      ...context,
      members: [
        ...context.members,
        { playerId: "z", role: "alternate", identityStatus: "identified" },
      ],
    }).complete,
    true,
    "sourced official roster is independent of platform core/alternate roles",
  );
  assert.equal(
    readiness(complete, { ...context, rulesReviewed: false }).complete,
    false,
  );
  assert.equal(
    readiness(complete, { ...context, rosterVersion: 2 }).complete,
    false,
  );
  assert.equal(
    readiness(complete, { ...context, discipline: "mixed_doubles" }).complete,
    false,
  );
  assert.equal(
    readiness(complete, { ...context, rules: rulesInput(rulesFixture()) })
      .complete,
    false,
  );
  assert.throws(
    () =>
      seasonInput({
        ...input,
        allocations: [
          ...input.allocations.slice(0, 3),
          { playerId: "alternate", share: "1/4" },
        ],
      }),
    /registered regular/,
  );
});

export const source = {
  id: "official",
  title: "World Curling calculation edition",
  url: "https://worldcurling.org/teamrankings/ranking-calculations-mixed-doubles/",
  edition: "2026-27 retrieved 2026-11-08",
  retrievedAt: "2026-11-08T12:00:00Z",
  sha256: "a".repeat(64),
};
export const rulesFixture = () => ({
  title: "2026-27 staff interpretation",
  season: "2026-27",
  effectiveFrom: "2026-08-01",
  effectiveTo: "2027-08-01",
  sources: [source],
  checkpoints: [
    {
      family: "mixed_doubles",
      from: "2026-08-01",
      maxEvents: 1,
      priorWeight: "1",
      sourceId: "official",
    },
    {
      family: "mixed_doubles",
      from: "2026-10-01",
      maxEvents: 2,
      priorWeight: "4/5",
      sourceId: "official",
    },
    {
      family: "mixed_doubles",
      from: "2027-02-01",
      maxEvents: 6,
      priorWeight: "0",
      sourceId: "official",
    },
  ],
  interpretations: [
    {
      code: "md-six",
      state: "supported",
      sourceIds: ["official"],
      note: "Use dated six-event schedule; introductory eight remains contradictory.",
    },
  ],
  reviewNote: "Checked primary edition; no official clarification claimed.",
});

test("rules require retrieved source editions and ordered inclusive calendar checkpoints without assuming cutoff instants", () => {
  const r = rulesInput(rulesFixture());
  assert.equal(checkpointAt(r, "mixed_doubles", "2026-09-30")?.maxEvents, 1);
  assert.equal(
    checkpointAt(r, "mixed_doubles", "2026-10-01")?.priorWeight,
    "4/5",
  );
  assert.equal(checkpointAt(r, "mixed_doubles", "2027-02-01")?.maxEvents, 6);
  assert.equal(checkpointAt(r, "mixed_doubles", "2027-08-01"), null);
  assert.throws(
    () =>
      rulesInput({ ...rulesFixture(), sources: [{ ...source, sha256: "" }] }),
    /SHA-256/,
  );
  assert.throws(
    () => rulesInput({ ...rulesFixture(), effectiveTo: "2026-08-01" }),
    /interval/,
  );
  assert.throws(
    () =>
      rulesInput({
        ...rulesFixture(),
        checkpoints: [
          ...rulesFixture().checkpoints,
          rulesFixture().checkpoints[0],
        ],
      }),
    /unique|order/,
  );
  assert.throws(
    () =>
      rulesInput({
        ...rulesFixture(),
        checkpoints: [
          { ...rulesFixture().checkpoints[0], sourceId: "missing" },
        ],
      }),
    /source/,
  );
});
