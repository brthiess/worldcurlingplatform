import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { wctrs2026 } from "../src/domain/wctrs-2026";
import {
  assessmentPolicy,
  type AssessmentEvidence,
} from "../src/domain/event-assessment-input";
import { source } from "./ranking-inputs-fixtures";
type Send = (
  path: string,
  body?: unknown,
) => Promise<{ status: number; json(): Promise<any>; text(): Promise<string> }>;
async function accepted(send: Send, path: string, body: unknown, status = 200) {
  const r = await send(path, body);
  if (r.status !== status)
    throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
/** Complete fictional event; real public commands create entries, inputs, results and finalization. Pool lifetime belongs to caller. */
export async function assessmentFixture(
  db: Pool,
  send: Send,
  options: {
    discipline?: "men_four" | "women_four";
    unscheduled?: boolean;
  } = {},
) {
  const eventId = randomUUID(),
    divisionId = randomUUID(),
    rulesId = randomUUID();
  await db.query(
    "INSERT INTO event_series(id,name) VALUES('assessment-fixtures','Fictional assessment fixtures') ON CONFLICT DO NOTHING",
  );
  await db.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES($1,'assessment-fixtures','Fictional four-player review','Review ice','Fictional location','UTC','2026-11-20','2026-11-22','fictional_demo',true,'approved')",
    [eventId],
  );
  await db.query(
    "INSERT INTO division(id,event_id,name,discipline,format,ranking_status) VALUES($1,$2,'Eight-team review',$3,'Round robin and playoffs','eligible')",
    [divisionId, eventId, options.discipline ?? "men_four"],
  );
  const rules = wctrs2026();
  rules.reviewNote =
    "Fictional assessment fixture adopting sourced 2026-27 rules and explicit application event policy, not an official endorsement.";
  await accepted(send, "/api/v1/ranking-inputs", {
    id: rulesId,
    kind: "rules",
    version: 0,
    requestId: randomUUID(),
    state: "reviewed",
    data: rules,
  });
  const entries: string[] = [],
    playerLists: string[][] = [],
    seasonIds: string[] = [],
    reviewIds: string[] = [];
  for (let i = 0; i < 8; i++) {
    const id = randomUUID(),
      players = Array.from({ length: 4 }, () => randomUUID());
    entries.push(id);
    playerLists.push(players);
    const created = await accepted(
      send,
      "/api/v1/entries",
      {
        id,
        version: 0,
        requestId: randomUUID(),
        entry: {
          divisionId,
          name: `Fictional team ${i + 1}`,
          coreKnown: true,
          corePlayerIds: players,
          members: players.map((playerId) => ({
            playerId,
            role: "core",
            position: "",
            participation: "declared",
          })),
          newPlayers: players.map((id, j) => ({
            id,
            name: `Fixture ${i + 1} player ${j + 1}`,
            provisional: false,
          })),
          registerSeason: { season: "2026-27", version: 0 },
        },
      },
      201,
    );
    const reviewId = randomUUID();
    reviewIds.push(reviewId);
    seasonIds.push(created.registration.id);
    await accepted(send, "/api/v1/ranking-inputs", {
      id: reviewId,
      kind: "season",
      version: 0,
      requestId: randomUUID(),
      state: "reviewed",
      data: {
        registrationId: created.registration.id,
        rosterVersion: 1,
        rulesId,
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
          basis: "documented-individual",
          sourceId: "official",
          ownershipSourceId: "official",
          eligibilitySourceId: "official",
          note: "Fictional individually sourced entitlement and eligibility",
          priorTotal: null,
          priorShare: null,
        })),
        reviewNote: "Fictional complete source review",
        biographyMissing: true,
      },
    });
  }
  const games: {
    id: string;
    a: number;
    b: number;
    winner: number;
    playoff: boolean;
  }[] = [];
  for (let i = 0; i < 8; i++)
    games.push({
      id: randomUUID(),
      a: i,
      b: (i + 1) % 8,
      winner: i,
      playoff: false,
    });
  games.push(
    { id: randomUUID(), a: 0, b: 3, winner: 0, playoff: true },
    { id: randomUUID(), a: 1, b: 2, winner: 1, playoff: true },
    { id: randomUUID(), a: 0, b: 1, winner: 0, playoff: true },
  );
  for (const [i, g] of games.entries()) {
    const drawId = randomUUID();
    if (!options.unscheduled)
      await db.query(
        "INSERT INTO draw_session(id,division_id,number,starts_at,state) VALUES($1,$2,$3,$4,'completed')",
        [
          drawId,
          divisionId,
          i + 1,
          `2026-11-${i < 8 ? "20" : "21"}T${String(1 + i).padStart(2, "0")}:00:00Z`,
        ],
      );
    await db.query(
      "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b,division_id) VALUES($1,$2,'A',$3,'scheduled',$4,$5,'A','B',$6)",
      [
        g.id,
        options.unscheduled ? null : drawId,
        g.playoff ? "Playoff" : "Qualification",
        entries[g.a],
        entries[g.b],
        divisionId,
      ],
    );
    await accepted(send, `/api/v1/games/${g.id}/scoring`, {
      requestId: randomUUID(),
      expectedVersion: 0,
      action: "start",
      hammer: null,
    });
    await accepted(send, `/api/v1/games/${g.id}/scoring`, {
      requestId: randomUUID(),
      expectedVersion: 1,
      action: "confirm",
      hammer: null,
      outcome: "conceded",
      winnerEntryId: entries[g.winner],
      reason: "Fictional conceded result",
    });
  }
  const sporting = await (
    await send(`/api/v1/division-finalizations?division=${divisionId}`)
  ).json();
  await accepted(send, "/api/v1/division-finalizations", {
    divisionId,
    version: 0,
    requestId: randomUUID(),
    sourceDigest: sporting.sourceDigest,
    placements: entries.map((entryId, i) => ({
      entryId,
      place: [1, 2, 3, 3, 5, 5, 5, 5][i],
    })),
    rulesReference: "Fictional sporting terms with shared semifinal places",
    note: "Fictional finished event; shared semifinal places",
  });
  const evidence: AssessmentEvidence = {
    rulesId,
    rulesVersion: 1,
    policyId: assessmentPolicy.id,
    reviewNote:
      "Fictional complete event assessment, supported F2 strength and ordinary awards. Source URLs are fixture evidence, not official endorsement.",
    sources: [source],
    preEvent: {
      effectiveDate: "2026-11-17",
      cutoffInstant: "2026-11-17T12:00:00Z",
      sourceId: "official",
      family: options.discipline ?? "men_four",
      rows: entries.map((entryId, i) => ({
        entryId,
        rank: 31 + i,
        points: "100",
      })),
    },
    event: {
      kind: "tour",
      kindSourceId: "official",
      newEvent: true,
      previous: null,
      registrationDate: "2026-09-01",
      eligibilitySourceId: "official",
      complianceNote:
        "Fictional timely registered compliant event; published roster/draw/end-score evidence reviewed.",
      resultsUrl: "https://example.com/wcp033-fictional-results",
      singleKnockout: false,
      qualificationGameIds: games.filter((g) => !g.playoff).map((g) => g.id),
      playoffGameIds: games.filter((g) => g.playoff).map((g) => g.id),
      bronzeGameId: null,
    },
    entries: entries.map((entryId, i) => ({
      entryId,
      eligibility: "eligible",
      sourceId: "official",
      note: "Fictional source confirms these four regulars throughout every segment of play.",
      rosterReview: {
        recordId: reviewIds[i],
        version: 1,
        sourceId: "official",
        note: "Explicit event-scoped review of sourced current official regulars; not carryover approval.",
      },
      firstPlayoffGameId:
        games.find((g) => g.playoff && (g.a === i || g.b === i))?.id ?? null,
      games: games
        .filter((g) => g.a === i || g.b === i)
        .map((g) => ({ gameId: g.id, segments: [playerLists[i]] })),
    })),
  };
  return {
    eventId,
    divisionId,
    rulesId,
    entries,
    playerLists,
    seasonIds,
    reviewIds,
    games,
    evidence,
  };
}
