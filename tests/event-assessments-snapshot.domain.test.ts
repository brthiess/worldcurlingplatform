import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessmentEvidence,
  assessmentPolicy,
  precedingTuesday,
  type AssessmentEvidence,
} from "../src/domain/event-assessment-input";
import {
  prepareEventCalculation,
  type SportingSnapshot,
  type StartingEvidence,
  type PublishedFormat,
} from "../src/domain/event-assessment-snapshot";
import { assessFourPlayer } from "../src/domain/event-assessments";
import { source } from "./ranking-inputs-fixtures";
import { tripleResults } from "./triple-draws-fixture";
function fixture(count = 8) {
  const ids = Array.from({ length: count }, (_, i) => `entry-${i}`),
    players = ids.map((_, i) =>
      Array.from({ length: 4 }, (_, j) => `player-${i}-${j}`),
    );
  const games = ids.map((id, i) => ({
    id: `game-${i}`,
    drawId: `draw-${i}`,
    entryA: id,
    entryB: ids[(i + 1) % count],
    result: {
      winnerEntryId: id,
      outcome: "conceded",
      lineupA: {
        members: players[i].map((playerId) => ({
          playerId,
          identityStatus: "identified",
        })),
      },
      lineupB: {
        members: players[(i + 1) % count].map((playerId) => ({
          playerId,
          identityStatus: "identified",
        })),
      },
    },
  }));
  const snapshot: SportingSnapshot = {
    source: {
      division: {
        id: "division",
        eventId: "event",
        discipline: "men_four",
        startsOn: "2026-11-20",
        endsOn: "2026-11-22",
        format: "Round robin",
      },
      entries: ids.map((id, i) => ({
        id,
        name: id,
        lineup: { registrationId: `registration-${i}`, status: "declared" },
      })),
      draws: [],
      games,
    },
    placements: ids.map((entryId, i) => ({ entryId, place: i + 1 })),
  };
  const roster: StartingEvidence[] = ids.map((entryId, i) => ({
    entryId,
    id: `record-${i}`,
    version: 1,
    currentRosterVersion: 1,
    rankingPlayers: players[i].map((playerId) => ({
      playerId,
      identityStatus: "identified",
    })),
    data: {
      rosterVersion: 1,
      rankingPlayerIds: players[i],
      rosterSourceId: "official",
      sources: [source],
      rulesId: "rules",
      rulesVersion: 1,
      effectiveFrom: "2026-08-01",
      effectiveTo: "2027-08-01",
    },
  }));
  const evidence: AssessmentEvidence = {
    rulesId: "rules",
    rulesVersion: 1,
    policyId: assessmentPolicy.id,
    reviewNote: "Independently sourced fictional assessment review",
    sources: [source],
    preEvent: {
      effectiveDate: "2026-11-17",
      cutoffInstant: "2026-11-17T12:00:00Z",
      sourceId: "official",
      family: "men_four",
      rows: ids.map((entryId) => ({ entryId, rank: 31, points: "100" })),
    },
    event: {
      kind: "tour",
      kindSourceId: "official",
      newEvent: true,
      previous: null,
      registrationDate: "2026-09-01",
      eligibilitySourceId: "official",
      complianceNote: "Fictional complete compliance evidence",
      resultsUrl: "https://example.com/fictional",
      singleKnockout: false,
      formatReview: {
        family: "not_single_knockout",
        sourceId: "official",
        note: "Fictional actual qualification-format source review",
      },
      qualificationGameIds: games.map((g) => g.id),
      playoffGameIds: [],
      bronzeGameId: null,
    },
    entries: ids.map((entryId, i) => ({
      entryId,
      eligibility: "eligible",
      sourceId: "official",
      note: "Fictional observed throughout-play regulars and sourced roster",
      rosterReview: {
        recordId: `record-${i}`,
        version: 1,
        sourceId: "official",
        note: "Explicit event roster review",
      },
      firstPlayoffGameId: null,
      games: games
        .filter((g) => g.entryA === entryId || g.entryB === entryId)
        .map((g) => ({ gameId: g.id, segments: [players[i]] })),
    })),
  };
  return { snapshot, roster, evidence, players };
}
test("event roster/participation is independently complete without starting amounts; current/source/identity failures cannot be waived", () => {
  const f = fixture();
  let r = assessFourPlayer(
    prepareEventCalculation(f.evidence, f.snapshot, f.roster),
  );
  assert.equal(r.state, "completed");
  assert.equal(r.awards[0].points, "27");
  for (const change of [
    (f: ReturnType<typeof fixture>) => {
      f.evidence.entries[0].rosterReview = null;
    },
    (f: ReturnType<typeof fixture>) => {
      f.roster[0].currentRosterVersion = 2;
    },
    (f: ReturnType<typeof fixture>) => {
      f.roster[0].data.rosterSourceId = "";
    },
    (f: ReturnType<typeof fixture>) => {
      f.roster[0].rankingPlayers[0].identityStatus = "provisional";
    },
    (f: ReturnType<typeof fixture>) => {
      f.evidence.entries[0].games[0].segments = [];
    },
  ]) {
    const x = fixture();
    change(x);
    r = assessFourPlayer(
      prepareEventCalculation(x.evidence, x.snapshot, x.roster),
    );
    assert.equal(r.state, "blocked");
    assert.deepEqual(r.awards, []);
  }
  const x = fixture();
  x.evidence.entries[0].eligibility = "excluded";
  x.evidence.entries[0].rosterReview = null;
  x.roster = x.roster.slice(1);
  assert.equal(
    assessFourPlayer(prepareEventCalculation(x.evidence, x.snapshot, x.roster))
      .state,
    "completed",
  );
});
test("four-player three-regular replacement is eligible; five-player outsider is not, independently of platform core", () => {
  const f = fixture(),
    outsider = {
      playerId: "identified-outsider",
      identityStatus: "identified",
    };
  const g = f.snapshot.source.games[0];
  g.result!.lineupA!.members.push(outsider);
  f.evidence.entries[0].games.find((x) => x.gameId === g.id)!.segments = [
    [...f.players[0].slice(0, 3), outsider.playerId],
  ];
  assert.equal(
    assessFourPlayer(prepareEventCalculation(f.evidence, f.snapshot, f.roster))
      .state,
    "completed",
  );
  f.roster[0].data.rankingPlayerIds.push("fifth-regular");
  f.roster[0].rankingPlayers.push({
    playerId: "fifth-regular",
    identityStatus: "identified",
  });
  const r = assessFourPlayer(
    prepareEventCalculation(f.evidence, f.snapshot, f.roster),
  );
  assert.equal(r.state, "blocked");
  assert.match(r.issues.join(" "), /cannot waive/);
});
test("strict preceding Tuesday and exact venue cutoff are checked; fixed Worlds ignores unused ranking source", () => {
  assert.equal(precedingTuesday("2026-11-17"), "2026-11-10");
  assert.equal(precedingTuesday("2026-11-20"), "2026-11-17");
  const f = fixture();
  f.evidence.preEvent.cutoffInstant = "2026-11-18T12:00:00Z";
  assert.equal(
    assessFourPlayer(prepareEventCalculation(f.evidence, f.snapshot, f.roster))
      .state,
    "blocked",
  );
  f.evidence.event.kind = "worlds";
  f.evidence.preEvent.rows = [];
  f.evidence.preEvent.sourceId = "";
  f.evidence.preEvent.cutoffInstant = "";
  assert.equal(
    assessFourPlayer(prepareEventCalculation(f.evidence, f.snapshot, f.roster))
      .sfm,
    "11",
  );
});
test("forfeit, unclassified game, incomplete field, malformed provenance and unsupported policy never fabricate awards", () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => {
      f.snapshot.source.games[0].result!.outcome = "forfeit";
    },
    (f: ReturnType<typeof fixture>) => {
      f.evidence.event.qualificationGameIds.pop();
    },
    (f: ReturnType<typeof fixture>) => {
      f.evidence.entries.pop();
    },
    (f: ReturnType<typeof fixture>) => {
      f.evidence.event.registrationDate = null;
    },
  ]) {
    const f = fixture();
    change(f);
    assert.equal(
      assessFourPlayer(
        prepareEventCalculation(f.evidence, f.snapshot, f.roster),
      ).state,
      "blocked",
    );
  }
  const f = fixture();
  assert.throws(() =>
    assessmentEvidence({ ...f.evidence, policyId: "unsupported" }),
  );
  assert.throws(() =>
    assessmentEvidence({
      ...f.evidence,
      event: { ...f.evidence.event, resultsUrl: "invalid" },
    }),
  );
  assert.throws(() =>
    assessmentEvidence({
      ...f.evidence,
      sources: [{ ...source, sha256: "bad" }],
    }),
  );
  assert.equal(assessmentEvidence(f.evidence).entries.length, 8);
});
test("actual format needs explicit sourced review; free-text display labels do not decide the factor", () => {
  const f = fixture();
  f.snapshot.source.division.format = "Triple knockout";
  f.evidence.event.singleKnockout = true;
  f.evidence.event.playoffGameIds = f.evidence.event.qualificationGameIds;
  f.evidence.event.qualificationGameIds = [];
  assert.equal(
    assessFourPlayer(prepareEventCalculation(f.evidence, f.snapshot, f.roster))
      .state,
    "blocked",
  );
  const x = fixture();
  x.snapshot.source.division.format = "single_knockout";
  x.evidence.event.formatReview.family = "unknown";
  assert.equal(
    assessFourPlayer(prepareEventCalculation(x.evidence, x.snapshot, x.roster))
      .state,
    "blocked",
  );
  x.snapshot.source.division.format = "Triple knockout";
  x.evidence.event.formatReview.family = "not_single_knockout";
  assert.equal(
    assessFourPlayer(prepareEventCalculation(x.evidence, x.snapshot, x.roster))
      .state,
    "completed",
  );
});
test("immutable published profile and exact game/entry associations establish the single-knockout factor", () => {
  const f = fixture(),
    pairs = [
      [0, 7, 0, "Q1"],
      [3, 4, 3, "Q2"],
      [1, 6, 1, "Q3"],
      [2, 5, 2, "Q4"],
      [0, 3, 0, "S1"],
      [1, 2, 1, "S2"],
      [0, 1, 0, "F"],
    ] as const;
  f.snapshot.source.games = pairs.map(([a, b, w, key]) => ({
    id: `knockout-${key}`,
    drawId: null,
    entryA: `entry-${a}`,
    entryB: `entry-${b}`,
    result: {
      winnerEntryId: `entry-${w}`,
      outcome: "conceded",
      lineupA: {
        members: f.players[a].map((playerId) => ({
          playerId,
          identityStatus: "identified",
        })),
      },
      lineupB: {
        members: f.players[b].map((playerId) => ({
          playerId,
          identityStatus: "identified",
        })),
      },
    },
  }));
  f.snapshot.placements = f.snapshot.source.entries.map((e, i) => ({
    entryId: e.id,
    place: [1, 2, 3, 3, 5, 5, 5, 5][i],
  }));
  f.evidence.event.singleKnockout = true;
  f.evidence.event.qualificationGameIds = [];
  f.evidence.event.playoffGameIds = f.snapshot.source.games.map((g) => g.id);
  f.evidence.event.formatReview = { family: "unknown", sourceId: "", note: "" };
  f.evidence.entries.forEach((e, i) => {
    e.games = f.snapshot.source.games
      .filter((g) => g.entryA === e.entryId || g.entryB === e.entryId)
      .map((g) => ({ gameId: g.id, segments: [f.players[i]] }));
    e.firstPlayoffGameId = e.games[0]?.gameId ?? null;
  });
  const profile: PublishedFormat = {
    divisionId: "division",
    revision: 2,
    templateId: "application-single8-seeded-v1",
    templateVersion: 1,
    definition: { family: "single_knockout" },
    graph: { games: pairs.map((p) => ({ id: `knockout-${p[3]}`, key: p[3] })) },
    nodes: pairs.map((p) => ({ gameId: `knockout-${p[3]}`, key: p[3] })),
    seeds: f.snapshot.source.entries.map((e) => ({
      entryId: e.id,
      version: 1,
    })),
  };
  const r = assessFourPlayer(
    prepareEventCalculation(
      f.evidence,
      f.snapshot,
      f.roster,
      [],
      "UTC",
      profile,
    ),
  );
  assert.equal(r.state, "completed");
  assert.equal(r.sfm, "27/10");
  assert.equal(r.awards.find((a) => a.entryId === "entry-0")!.points, "81/4");
  for (const bad of [
    { ...profile, templateId: "unknown-template" },
    { ...profile, divisionId: "different" },
    { ...profile, nodes: profile.nodes.slice(1) },
    { ...profile, seeds: profile.seeds.slice(1) },
  ])
    assert.equal(
      assessFourPlayer(
        prepareEventCalculation(
          f.evidence,
          f.snapshot,
          f.roster,
          [],
          "UTC",
          bad,
        ),
      ).state,
      "blocked",
    );
});

test("the exact published triple profile keeps qualification plus playoffs outside the single-knockout reduction", () => {
  const f = fixture(16);
  f.snapshot.source.games = tripleResults.map((row) => ({
    id: row.key,
    drawId: null,
    entryA: `entry-${row.a - 1}`,
    entryB: `entry-${row.b - 1}`,
    result: {
      winnerEntryId: `entry-${row.winner - 1}`,
      outcome: "conceded",
      lineupA: {
        members: f.players[row.a - 1].map((playerId) => ({
          playerId,
          identityStatus: "identified",
        })),
      },
      lineupB: {
        members: f.players[row.b - 1].map((playerId) => ({
          playerId,
          identityStatus: "identified",
        })),
      },
    },
  }));
  // The eight qualification exits share ninth in this explicit finalization fixture;
  // no unique ninth-through-sixteenth ordering is inferred from the draw.
  const places = [2, 5, 3, 5, 3, 9, 9, 5, 9, 9, 9, 9, 5, 9, 9, 1];
  f.snapshot.placements = f.snapshot.source.entries.map((e, i) => ({
    entryId: e.id,
    place: places[i],
  }));
  f.evidence.event.formatReview = { family: "unknown", sourceId: "", note: "" };
  f.evidence.event.qualificationGameIds = tripleResults
    .filter((g) => !g.key.startsWith("P"))
    .map((g) => g.key);
  f.evidence.event.playoffGameIds = tripleResults
    .filter((g) => g.key.startsWith("P"))
    .map((g) => g.key);
  f.evidence.entries.forEach((e, i) => {
    e.games = f.snapshot.source.games
      .filter((g) => [g.entryA, g.entryB].includes(e.entryId))
      .map((g) => ({ gameId: g.id, segments: [f.players[i]] }));
    e.firstPlayoffGameId =
      tripleResults.find(
        (g) => g.key.startsWith("P") && [g.a, g.b].includes(i + 1),
      )?.key ?? null;
  });
  const profile: PublishedFormat = {
    divisionId: "division",
    revision: 2,
    templateId: "application-tko16-q8-233-v1",
    templateVersion: 1,
    definition: { family: "triple_knockout" },
    graph: { games: tripleResults.map((g) => ({ id: g.key, key: g.key })) },
    nodes: tripleResults.map((g) => ({ gameId: g.key, key: g.key })),
    seeds: f.snapshot.source.entries.map((e) => ({
      entryId: e.id,
      version: 1,
    })),
  };
  const prepare = (p = profile) =>
    prepareEventCalculation(f.evidence, f.snapshot, f.roster, [], "UTC", p);
  const result = assessFourPlayer(prepare());
  assert.equal(result.state, "completed", result.issues.join(" "));
  // 16 * 1/5 * (24/16) * ((16+16)/32) = 24/5; champion * 15/2 = 36.
  assert.equal(result.sfm, "24/5");
  assert.equal(
    result.awards.find((a) => a.entryId === "entry-15")!.points,
    "36",
  );
  assert.equal(
    result.stages.some((s) => s.stage === "single knockout reduction"),
    false,
  );
  for (const bad of [
    { ...profile, templateId: "unreviewed-triple" },
    { ...profile, templateVersion: 2 },
    { ...profile, definition: { family: "single_knockout" } },
    { ...profile, nodes: profile.nodes.slice(1) },
    { ...profile, divisionId: "different" },
  ])
    assert.equal(assessFourPlayer(prepare(bad)).state, "blocked");
  f.evidence.event.singleKnockout = true;
  assert.match(assessFourPlayer(prepare()).issues.join(" "), /format\/stages/);
});

test("the exact pool profile has no single reduction or inferred playoff qualification; evidence and association gates remain", () => {
  const f = fixture();
  const literal = [
    ["A01", 1, 8, 1],
    ["A02", 4, 5, 4],
    ["A03", 1, 5, 1],
    ["A04", 8, 4, 4],
    ["A05", 1, 4, 1],
    ["A06", 5, 8, 5],
    ["B01", 2, 7, 2],
    ["B02", 3, 6, 3],
    ["B03", 2, 6, 2],
    ["B04", 7, 3, 3],
    ["B05", 2, 3, 2],
    ["B06", 6, 7, 6],
  ] as const;
  f.snapshot.source.games = literal.map(([id, a, b, w]) => ({
    id,
    drawId: null,
    entryA: `entry-${a - 1}`,
    entryB: `entry-${b - 1}`,
    result: {
      winnerEntryId: `entry-${w - 1}`,
      outcome: "conceded",
      lineupA: {
        members: f.players[a - 1].map((playerId) => ({
          playerId,
          identityStatus: "identified",
        })),
      },
      lineupB: {
        members: f.players[b - 1].map((playerId) => ({
          playerId,
          identityStatus: "identified",
        })),
      },
    },
  }));
  f.evidence.event.qualificationGameIds = literal.map((g) => g[0]);
  f.evidence.entries.forEach((e, i) => {
    e.games = f.snapshot.source.games
      .filter((g) => [g.entryA, g.entryB].includes(e.entryId))
      .map((g) => ({ gameId: g.id, segments: [f.players[i]] }));
  });
  const profile: PublishedFormat = {
    divisionId: "division",
    revision: 2,
    templateId: "application-pools2x4-v1",
    templateVersion: 1,
    definition: { family: "round_robin" },
    graph: {
      games: f.snapshot.source.games.map((g) => ({ id: g.id, key: g.id })),
    },
    nodes: f.snapshot.source.games.map((g) => ({ gameId: g.id, key: g.id })),
    seeds: f.snapshot.source.entries.map((e) => ({
      entryId: e.id,
      version: 1,
    })),
  };
  const prepare = (p = profile) =>
    prepareEventCalculation(f.evidence, f.snapshot, f.roster, [], "UTC", p);
  const value = prepare();
  assert.equal(value.singleKnockout, false);
  assert.ok(
    value.entries.every((e) => !e.qualified && e.firstPlayoffWon === null),
  );
  assert.ok(!value.issues.some((i) => i.includes("format mapping")));
  for (const bad of [
    { ...profile, templateVersion: 2 },
    { ...profile, definition: { family: "single_knockout" } },
    { ...profile, nodes: profile.nodes.slice(1) },
    { ...profile, seeds: profile.seeds.slice(1) },
    { ...profile, divisionId: "other" },
  ])
    assert.equal(assessFourPlayer(prepare(bad)).state, "blocked");
  f.evidence.entries[0].eligibility = "unknown";
  assert.equal(assessFourPlayer(prepare()).state, "blocked");
  f.evidence.entries[0].eligibility = "eligible";
  f.evidence.event.qualificationGameIds = [];
  assert.equal(assessFourPlayer(prepare()).state, "blocked");
});
