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
