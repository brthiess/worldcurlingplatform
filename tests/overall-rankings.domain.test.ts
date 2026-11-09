import { test } from "node:test";
import assert from "node:assert/strict";
import {
  overallContribution,
  orderOverall,
  continuityStarting,
  transferEntitlement,
} from "../src/domain/overall-rankings";
import { wctrs2026 } from "../src/domain/wctrs-2026";
import {
  calculateOverall,
  type OverallSource,
} from "../src/domain/overall-calculation";
import { overallEvidence } from "../src/domain/overall-ranking-input";
import { seasonInput } from "../src/domain/ranking-inputs";
import { source as documentary } from "./ranking-inputs-fixtures";

test("F4 inclusive overall checkpoints count best awards and retain exact dated carryover", () => {
  const expected = [
    ["2026-09-14", "200", 1, "160"],
    ["2026-09-15", "190", 2, "120"],
    ["2026-10-05", "190", 2, "120"],
    ["2026-10-06", "190", 3, "100"],
    ["2026-10-27", "170", 3, "80"],
    ["2026-11-17", "150", 3, "60"],
    ["2026-12-08", "130", 3, "40"],
    ["2026-12-29", "110", 3, "20"],
    ["2027-01-19", "90", 3, "0"],
  ] as const;
  for (const [date, total, count, carryover] of expected) {
    const r = overallContribution(wctrs2026(), date, "160", [
      { id: "a", date: "2026-09-01", points: "40" },
      { id: "b", date: "2026-09-02", points: "30" },
      { id: "c", date: "2026-09-03", points: "20" },
    ]);
    assert.equal(r.total, total);
    assert.equal(r.counted.length, count);
    assert.equal(r.carryover, carryover);
  }
});

test("F6 fewer actual events then repeated smallest-result removal order exact ties; exhausted vectors remain unresolved", () => {
  const row = (id: string, points: string[], carry = "0") => ({
    id,
    ...overallContribution(
      wctrs2026(),
      "2027-01-19",
      carry,
      points.map((points, i) => ({
        id: String(i),
        date: "2026-09-01",
        points,
      })),
    ),
  });
  assert.deepEqual(
    orderOverall([
      row("B", ["35", "25", "20", "10"]),
      row("A", ["40", "30", "20"]),
    ]).rows.map((x) => x.id),
    ["A", "B"],
  );
  assert.deepEqual(
    orderOverall([
      row("C", ["40", "30", "20"]),
      row("D", ["45", "30", "15"]),
    ]).rows.map((x) => x.id),
    ["D", "C"],
  );
  assert.deepEqual(
    orderOverall([
      row("F", ["45", "30", "15"]),
      row("E", ["50", "25", "15"]),
    ]).rows.map((x) => x.id),
    ["E", "F"],
  );
  const tie = orderOverall([
    row("Z", ["40", "30", "20"]),
    row("A", ["40", "30", "20"]),
  ]);
  assert.equal(tie.unresolved.length, 1);
  assert.equal(tie.rows[0].rank, null);
  assert.equal(tie.rows[1].rank, null);
});

test("F7 continuity uses exact prior rights and retained roster evidence independently of identity", () => {
  const prior = {
    total: "200",
    members: ["a", "b", "c", "d"].map((playerId) => ({
      playerId,
      share: "1/4",
    })),
  };
  assert.equal(
    continuityStarting(
      [
        { playerId: "a", amount: "50" },
        { playerId: "b", amount: "50" },
        { playerId: "c", amount: "50" },
        { playerId: "x", amount: "80" },
      ],
      prior,
    ).starting,
    "230",
  );
  assert.equal(
    continuityStarting(
      [
        { playerId: "a", amount: "50" },
        { playerId: "b", amount: "50" },
        { playerId: "c", amount: "50" },
        { playerId: "x", amount: "30" },
      ],
      prior,
    ).starting,
    "200",
  );
  assert.throws(
    () =>
      continuityStarting(
        [
          { playerId: "a", amount: "51" },
          { playerId: "b", amount: "50" },
          { playerId: "c", amount: "50" },
          { playerId: "x", amount: "80" },
        ],
        prior,
      ),
    /retained/i,
  );
  assert.throws(
    () =>
      continuityStarting(
        [
          { playerId: "a", amount: "50" },
          { playerId: "b", amount: "50" },
          { playerId: "x", amount: "50" },
          { playerId: "y", amount: "80" },
        ],
        prior,
      ),
    /three of four|four of five/,
  );
  assert.equal(
    continuityStarting(
      ["20", "24", "28", "32", "36"].map((amount, i) => ({
        playerId: String(i),
        amount,
      })),
      null,
    ).starting,
    "140",
  );
  assert.equal(transferEntitlement("pre-post", "80", "120", null, null), "30");
  assert.equal(
    transferEntitlement("post-post", "80", "120", "200", null),
    "40",
  );
  assert.equal(transferEntitlement("pre-none", "80", "0", null, null), "20");
  assert.equal(transferEntitlement("pre-pre", "0", "0", null, "200"), "50");
  assert.equal(transferEntitlement("post-none", "0", "0", "200", null), "40");
});

test("all inclusive schedule boundaries, season bounds, eight-event cap, exact thirds and source schedule mismatch", () => {
  const rules = wctrs2026(),
    events = ["9", "8", "7", "6", "5", "4", "3", "2", "1"].map((points, i) => ({
      id: String(i),
      points,
      date: "2026-08-01",
    }));
  for (const [date, limit, weight] of [
    ["2026-08-01", 1, "1"],
    ["2026-09-14", 1, "1"],
    ["2026-09-15", 2, "3/4"],
    ["2026-10-05", 2, "3/4"],
    ["2026-10-06", 3, "5/8"],
    ["2026-10-26", 3, "5/8"],
    ["2026-10-27", 4, "1/2"],
    ["2026-11-16", 4, "1/2"],
    ["2026-11-17", 5, "3/8"],
    ["2026-12-07", 5, "3/8"],
    ["2026-12-08", 6, "1/4"],
    ["2026-12-28", 6, "1/4"],
    ["2026-12-29", 7, "1/8"],
    ["2027-01-18", 7, "1/8"],
    ["2027-01-19", 8, "0"],
    ["2027-07-31", 8, "0"],
  ] as const) {
    const r = overallContribution(rules, date, "160", events);
    assert.equal(r.counted.length, limit);
    assert.equal(r.checkpoint.priorWeight, weight);
  }
  const r = overallContribution(rules, "2027-07-31", "160", events);
  assert.equal(r.total, "44");
  assert.equal(r.excluded[0].points, "1");
  assert.throws(
    () => overallContribution(rules, "2026-07-31", "1", []),
    /checkpoint/,
  );
  assert.throws(
    () => overallContribution(rules, "2027-08-01", "1", []),
    /checkpoint/,
  );
  const q = overallContribution(rules, "2026-09-15", "1/3", [
    { id: "x", date: "2026-09-15", points: "1/3" },
    { id: "y", date: "2026-09-16", points: "100" },
    {
      id: "z",
      date: "2026-09-01",
      points: "2/3",
      excluded: "Sourced ordinary event exclusion",
    },
  ]);
  assert.equal(q.total, "7/12");
  assert.equal(q.counted.length, 1);
  assert.equal(q.excluded.length, 2);
  rules.checkpoints[0].maxEvents = 8;
  assert.throws(
    () => overallContribution(rules, "2026-08-01", "0", events),
    /modified schedules/,
  );
});

function complete() {
  const rules = wctrs2026(),
    players = ["a", "b", "c", "d"];
  const data = seasonInput({
    registrationId: "subject",
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
    sources: [documentary],
    contributions: players.map((playerId) => ({
      playerId,
      amount: "50",
      basis: "documented-individual",
      sourceId: "official",
      ownershipSourceId: "official",
      eligibilitySourceId: "official",
      note: "Independently evidenced rights",
    })),
    reviewNote: "Complete fictional review",
    biographyMissing: true,
  });
  const source: OverallSource = {
    discipline: "men_four",
    effectiveDate: "2026-11-23",
    rules: { id: "rules", version: 1, state: "reviewed", data: rules },
    subjects: [
      {
        registrationId: "subject",
        teamId: "core",
        name: "Subject",
        rosterVersion: 1,
        starting: {
          id: "starting",
          version: 1,
          state: "reviewed",
          data,
          currentReadiness: {
            complete: true,
            startingInput: "200",
            issues: [
              {
                severity: "informational",
                message: "Optional biography missing",
              },
            ],
          },
        },
      },
    ],
    events: [
      {
        divisionId: "division",
        name: "Fictional",
        date: "2026-11-22",
        finalizationVersion: 1,
        currentSportingDigest: "x",
        finalizationSourceDigest: "x",
        currentSportingDirty: false,
        assessment: {
          id: "assessment",
          state: "completed",
          digest: "input",
          inputDigest: "input",
          resultDigest: "result",
          contents: JSON.stringify({
            source: {
              finalization: { version: 1 },
              current: {
                entries: [
                  { id: "entry", lineup: { registrationId: "subject" } },
                ],
              },
              starting: [
                {
                  entryId: "entry",
                  evidence: { data: { rankingPlayerIds: players } },
                },
              ],
            },
            calculation: {
              entries: [{ entryId: "entry", eligibility: "eligible" }],
            },
          }),
          resultContents: JSON.stringify({
            result: {
              state: "completed",
              awards: [{ entryId: "entry", points: "27" }],
            },
          }),
        },
      },
    ],
  };
  const evidence = overallEvidence({
    policyId: "wcp.four-overall-policy.2026-27.v1",
    sources: [documentary],
    reviewNote: "Complete fictional review",
    events: [
      {
        divisionId: "division",
        state: "assessed",
        sourceId: "official",
        note: "Entire event coverage",
      },
    ],
    subjects: [
      {
        registrationId: "subject",
        eligibility: "eligible",
        sourceId: "official",
        note: "Current eligible owner",
        continuity: {
          state: "none",
          sourceId: "official",
          note: "No unrecorded continuity right",
          prior: null,
        },
        adjustments: {
          state: "none",
          sourceId: "official",
          note: "No outstanding ordinary changes",
          exclusions: [],
        },
      },
    ],
  });
  return { source, evidence };
}
test("full current ownership is required despite completed awards; nonmaterial warnings never become blockers", () => {
  const f = complete(),
    r = calculateOverall(f.source, f.evidence);
  assert.equal(r.state, "ready");
  assert.equal(r.rows[0].total, "102");
  assert.equal(r.warnings.length, 1);
  f.source.subjects[0].starting!.state = "draft";
  assert.equal(calculateOverall(f.source, f.evidence).state, "blocked");
  f.source.subjects[0].starting!.state = "reviewed";
  f.source.subjects[0].starting!.currentReadiness.complete = false;
  assert.equal(calculateOverall(f.source, f.evidence).state, "blocked");
  const missing = complete();
  missing.evidence.subjects[0].continuity.state = "unknown";
  assert.match(
    calculateOverall(missing.source, missing.evidence).issues.join(" "),
    /continuity/,
  );
  const adjustments = complete();
  adjustments.evidence.subjects[0].adjustments.state = "unknown";
  assert.match(
    calculateOverall(adjustments.source, adjustments.evidence).issues.join(" "),
    /adjustment/,
  );
});
test("sourced ordinary award exclusion and changed official roster retain/exclude decisions preserve original event values", () => {
  const f = complete();
  f.source.subjects[0].starting!.data.rankingPlayerIds[3] = "x";
  assert.match(
    calculateOverall(f.source, f.evidence).issues.join(" "),
    /roster changed/,
  );
  f.evidence.subjects[0].adjustments = {
    state: "reviewed",
    sourceId: "official",
    note: "Sourced changed roster decision",
    exclusions: [],
    rosterChanges: [
      {
        awardId: "assessment:entry",
        decision: "exclude",
        sourceId: "official",
        note: "Ordinary sourced ownership exclusion",
      },
    ],
  };
  const excluded = calculateOverall(f.source, f.evidence);
  assert.equal(excluded.state, "ready");
  assert.equal(excluded.rows[0].total, "75");
  assert.equal(excluded.rows[0].excluded[0].points, "27");
  f.evidence.subjects[0].adjustments.rosterChanges![0].decision = "retain";
  assert.equal(calculateOverall(f.source, f.evidence).rows[0].total, "102");
  f.evidence.subjects[0].adjustments.rosterChanges![0].awardId =
    "another:entry";
  assert.equal(calculateOverall(f.source, f.evidence).state, "blocked");
});
test("historical ordinary transfer proof must match reviewed individual rights and independently sourced applicability", () => {
  const f = complete();
  f.source.subjects[0].starting!.data.contributions[0].amount = "30";
  f.evidence.subjects[0].adjustments = {
    state: "reviewed",
    sourceId: "official",
    note: "Historical ownership verification only",
    exclusions: [],
    historicalTransfers: [
      {
        playerId: "a",
        season: "2025-26",
        branch: "pre-post",
        leftOn: "2025-10-01",
        joinedOn: "2025-11-01",
        oldPlayed: "80",
        newPlayed: "120",
        oldFinal: null,
        newFinal: null,
        sourceId: "official",
        applicabilitySourceId: "official",
        note: "Fictional actual prior-season decision evidence, no implied retroactive publication",
      },
    ],
  };
  const r = calculateOverall(f.source, f.evidence);
  assert.equal(r.state, "ready");
  assert.equal(r.rows[0].total, "189/2");
  f.evidence.subjects[0].adjustments.historicalTransfers![0].applicabilitySourceId =
    "";
  assert.equal(calculateOverall(f.source, f.evidence).state, "blocked");
  f.evidence.subjects[0].adjustments.historicalTransfers![0].applicabilitySourceId =
    "official";
  f.evidence.subjects[0].adjustments.historicalTransfers![0].leftOn =
    "2025-10-31";
  assert.match(
    calculateOverall(f.source, f.evidence).issues.join(" "),
    /October31/,
  );
});

test("simultaneously included positive individual starting rights cannot be duplicated across subjects", () => {
  const f = complete(),
    second = structuredClone(f.source.subjects[0]);
  second.registrationId = "second";
  second.teamId = "different-core";
  second.name = "Second";
  second.starting!.data.registrationId = "second";
  second.starting!.id = "second-start";
  f.source.subjects.push(second);
  f.evidence.subjects.push({
    ...structuredClone(f.evidence.subjects[0]),
    registrationId: "second",
  });
  const result = calculateOverall(f.source, f.evidence);
  assert.equal(result.state, "blocked");
  assert.match(
    result.issues.join(" "),
    /positive starting ownership overlaps/i,
  );
  assert.equal(
    result.rows.find((r) => r.id === "subject")!.counted[0].points,
    "27",
    "Ambiguous rights do not erase a genuine historical event award",
  );
});
test("separately sourced nonoverlapping temporal registration rights do not create an overlap blocker or erase original award bytes", () => {
  const f = complete(),
    oldBytes = f.source.events[0].assessment!.resultContents,
    second = structuredClone(f.source.subjects[0]);
  second.registrationId = "second";
  second.teamId = "different-core";
  second.name = "Second";
  second.starting!.data.registrationId = "second";
  second.starting!.data.effectiveFrom = "2026-10-01";
  second.starting!.id = "second-start";
  f.source.subjects[0].starting!.data.effectiveTo = "2026-10-01";
  f.source.subjects.push(second);
  f.evidence.subjects[0].eligibility = "excluded";
  f.evidence.subjects[0].note =
    "Sourced former registration exclusion effective2026-10-01; actual historical awards remain frozen";
  f.evidence.subjects.push({
    ...structuredClone(f.evidence.subjects[0]),
    registrationId: "second",
    eligibility: "eligible",
    note: "Sourced new current registration starting ownership after2026-10-01",
  });
  const result = calculateOverall(f.source, f.evidence);
  assert.equal(result.state, "ready");
  assert.equal(result.rows[0].total, "75");
  assert.equal(
    result.issues.some((i) => /overlaps/i.test(i)),
    false,
  );
  assert.equal(f.source.events[0].assessment!.resultContents, oldBytes);
});
test("continuity rejects a fabricated four-player allocation and supports exact four-of-five default continuity", () => {
  assert.throws(
    () =>
      continuityStarting(
        [
          { playerId: "a", amount: "0" },
          { playerId: "b", amount: "0" },
          { playerId: "c", amount: "0" },
          { playerId: "x", amount: "0" },
        ],
        {
          total: "200",
          members: [
            { playerId: "a", share: "0" },
            { playerId: "b", share: "0" },
            { playerId: "c", share: "0" },
            { playerId: "d", share: "1" },
          ],
        },
      ),
    /allocation|shares|four/i,
  );
  const prior = {
      total: "200",
      members: ["a", "b", "c", "d", "e"].map((playerId) => ({
        playerId,
        share: "1/5",
      })),
    },
    current = ["a", "b", "c", "d"].map((playerId) => ({
      playerId,
      amount: "40",
    }));
  assert.equal(
    continuityStarting([...current, { playerId: "x", amount: "60" }], prior)
      .starting,
    "220",
  );
  assert.equal(
    continuityStarting([...current, { playerId: "x", amount: "20" }], prior)
      .starting,
    "200",
  );
});
