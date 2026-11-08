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
} from "../src/domain/event-assessment-snapshot";
import { assessFourPlayer } from "../src/domain/event-assessments";
import { source } from "./ranking-inputs-fixtures";
function fixture() {
  const ids = Array.from({ length: 8 }, (_, i) => `entry-${i}`),
    players = ids.map((_, i) =>
      Array.from({ length: 4 }, (_, j) => `player-${i}-${j}`),
    );
  const games = ids.map((id, i) => ({
    id: `game-${i}`,
    drawId: `draw-${i}`,
    entryA: id,
    entryB: ids[(i + 1) % 8],
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
        members: players[(i + 1) % 8].map((playerId) => ({
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
test("single knockout reduction cannot be selected for a triple format or omitted for an explicit single format", () => {
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
  assert.equal(
    assessFourPlayer(prepareEventCalculation(x.evidence, x.snapshot, x.roster))
      .state,
    "blocked",
  );
  x.snapshot.source.division.format = "Triple knockout";
  assert.equal(
    assessFourPlayer(prepareEventCalculation(x.evidence, x.snapshot, x.roster))
      .state,
    "completed",
  );
});
