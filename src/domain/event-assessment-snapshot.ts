import {
  assessmentPolicy,
  precedingTuesday,
  type AssessmentEvidence,
} from "./event-assessment-input";
import type { CalculationField } from "./event-assessments";
export type SportingSnapshot = {
  source: {
    division: {
      id: string;
      eventId: string;
      discipline: string;
      startsOn: string;
      endsOn: string;
      format: string;
    };
    entries: {
      id: string;
      name: string;
      lineup: { registrationId: string | null; status: string } | null;
    }[];
    draws: { id: string; startsAt: string }[];
    games: {
      id: string;
      drawId: string | null;
      entryA: string;
      entryB: string;
      result: {
        winnerEntryId: string;
        outcome: string;
        lineupA?: { members: { playerId: string; identityStatus: string }[] };
        lineupB?: { members: { playerId: string; identityStatus: string }[] };
      } | null;
    }[];
  };
  placements: { entryId: string; place: number }[];
};
export type StartingEvidence = {
  entryId: string;
  id: string;
  version: number;
  currentRosterVersion: number;
  rankingPlayers: { playerId: string; identityStatus: string }[];
  data: {
    rosterVersion: number;
    rankingPlayerIds: string[];
    rosterSourceId: string;
    sources: { id: string }[];
    rulesId: string;
    rulesVersion: number;
    effectiveFrom: string;
    effectiveTo: string;
  };
};
export type PublishedFormat = {
  divisionId: string;
  revision: number;
  templateId: string;
  templateVersion: number;
  definition: { family: string };
  graph: { games: { id: string; key: string }[] };
  nodes: { key: string; gameId: string }[];
  seeds: { entryId: string; version: number }[];
};
/** Preparation uses only frozen sporting and evidence bytes. Worker never reads later mutable rosters or ranks. */
export function prepareEventCalculation(
  e: AssessmentEvidence,
  s: SportingSnapshot,
  starting: StartingEvidence[],
  initialIssues: string[] = [],
  timezone = "UTC",
  publishedFormat: PublishedFormat | null = null,
): CalculationField {
  const issues = [...initialIssues],
    d = s.source.division,
    event = e.event;
  if (!["men_four", "women_four"].includes(d.discipline))
    issues.push(
      "This engine accepts four-player men's/women's divisions only.",
    );
  if (e.policyId !== assessmentPolicy.id)
    issues.push("Calculation policy version is unsupported.");
  if (!e.reviewNote)
    issues.push("Record the reviewed event evidence rationale.");
  if (
    !event.kindSourceId ||
    !event.eligibilitySourceId ||
    !event.complianceNote ||
    !event.resultsUrl
  )
    issues.push(
      "Event category, eligibility, rules compliance and published-results evidence are required.",
    );
  if (!event.registrationDate || event.registrationDate > "2026-10-15")
    issues.push("WCTRS registration by 2026-10-15 is unresolved or not met.");
  if (d.startsOn < "2026-08-01" || d.endsOn >= "2027-08-01")
    issues.push("Event is outside the implemented 2026-27 season.");
  const cutoff = precedingTuesday(d.startsOn);
  let instantDate = "";
  try {
    instantDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(e.preEvent.cutoffInstant));
  } catch {}
  if (
    event.kind !== "worlds" &&
    (e.preEvent.effectiveDate !== cutoff ||
      instantDate !== cutoff ||
      !e.preEvent.sourceId ||
      e.preEvent.family !== d.discipline)
  )
    issues.push(
      `Exact preceding-Tuesday ${cutoff} ranking snapshot/instant/family is required (${timezone}).`,
    );
  const entryIds = s.source.entries.map((x) => x.id),
    allGames = s.source.games;
  if (
    e.entries.length !== entryIds.length ||
    e.entries.some((x) => !entryIds.includes(x.entryId)) ||
    (event.kind !== "worlds" && e.preEvent.rows.length !== entryIds.length) ||
    e.preEvent.rows.some((x) => !entryIds.includes(x.entryId))
  )
    issues.push(
      "Evidence and applicable rank rows must cover every frozen competing entry exactly once.",
    );
  const covered = [...event.qualificationGameIds, ...event.playoffGameIds];
  if (
    new Set(covered).size !== covered.length ||
    covered.length !== allGames.length ||
    covered.some((id) => !allGames.some((g) => g.id === id))
  )
    issues.push(
      "Classify every frozen game once as qualification or playoff; game phase labels alone do not establish ranking stages.",
    );
  let singleFormat: boolean | null = null;
  if (publishedFormat) {
    if (
      publishedFormat.divisionId !== d.id ||
      publishedFormat.nodes.length !== allGames.length ||
      new Set(publishedFormat.nodes.map((n) => n.gameId)).size !==
        allGames.length ||
      publishedFormat.nodes.some(
        (n) => !allGames.some((g) => g.id === n.gameId),
      ) ||
      publishedFormat.graph.games.length !== publishedFormat.nodes.length ||
      publishedFormat.graph.games.some(
        (g) =>
          !publishedFormat.nodes.some(
            (n) => n.gameId === g.id && n.key === g.key,
          ),
      ) ||
      publishedFormat.seeds.length !== entryIds.length ||
      publishedFormat.seeds.some((seed) => !entryIds.includes(seed.entryId))
    )
      issues.push(
        "Published competition profile does not match every frozen game and competing entry; resolve the association before assessment.",
      );
    if (
      publishedFormat.templateId === "application-single8-seeded-v1" &&
      publishedFormat.templateVersion === 1 &&
      publishedFormat.definition.family === "single_knockout"
    )
      singleFormat = true;
    else if (
      publishedFormat.templateId === "application-tko16-q8-233-v1" &&
      publishedFormat.templateVersion === 1 &&
      publishedFormat.definition.family === "triple_knockout"
    )
      // The fixed single-elimination playoffs are one stage of the published
      // triple profile; they do not make the entire event single knockout.
      singleFormat = false;
    else if (
      publishedFormat.templateId === "application-pools2x4-v1" &&
      publishedFormat.templateVersion === 1 &&
      publishedFormat.definition.family === "round_robin"
    )
      singleFormat = false;
    else
      issues.push(
        "Published competition profile needs a supported explicit calculation-format mapping.",
      );
  } else {
    const f = event.formatReview;
    if (!f || f.family === "unknown" || !f.sourceId || !f.note)
      issues.push(
        "Legacy competition needs an explicit sourced and reviewed actual format; display text is not format proof.",
      );
    else singleFormat = f.family === "single_knockout";
  }
  if (
    singleFormat !== null &&
    (event.singleKnockout !== singleFormat ||
      (singleFormat && event.qualificationGameIds.length > 0))
  )
    issues.push(
      "Single knockout designation disagrees with the frozen format/stages.",
    );
  if (allGames.some((g) => g.result?.outcome === "forfeit"))
    issues.push(
      "Forfeit win/eligibility treatment requires further normative evidence.",
    );
  if (
    event.kind === "tour" &&
    event.newEvent === false &&
    event.previous?.editionId === d.eventId
  )
    issues.push("A previous edition cannot be the current edition.");
  if (event.bronzeGameId) {
    const bronze = allGames.find((g) => g.id === event.bronzeGameId);
    const third = s.placements.find((p) => p.place === 3),
      fourth = s.placements.find((p) => p.place === 4);
    if (
      !bronze ||
      !event.playoffGameIds.includes(bronze.id) ||
      bronze.result?.winnerEntryId !== third?.entryId ||
      ![bronze.entryA, bronze.entryB].includes(fourth?.entryId ?? "")
    )
      issues.push(
        "Bronze-game evidence must match frozen third/fourth places and result.",
      );
  }
  const entries = s.source.entries.map((entry) => {
    const evidence = e.entries.find((x) => x.entryId === entry.id),
      rank = e.preEvent.rows.find((x) => x.entryId === entry.id),
      season = starting.find((x) => x.entryId === entry.id);
    let eligibility = evidence?.eligibility ?? "unknown";
    if (!evidence?.sourceId || !evidence.note)
      issues.push(
        `${entry.id}: sourced eligibility decision and rationale are required.`,
      );
    const games = allGames.filter(
      (g) => g.entryA === entry.id || g.entryB === entry.id,
    );
    if (eligibility === "eligible") {
      if (!entry.lineup || entry.lineup.status !== "declared")
        issues.push(`${entry.id}: frozen event lineup remains provisional.`);
      if (!season)
        issues.push(
          `${entry.id}: sourced official roster evidence is required.`,
        );
      else {
        const rr = evidence?.rosterReview;
        if (
          !rr ||
          rr.recordId !== season.id ||
          rr.version !== season.version ||
          !rr.sourceId ||
          !rr.note
        )
          issues.push(
            `${entry.id}: explicitly review the exact current sourced roster for this event; starting-input state alone is insufficient.`,
          );
        if (
          season.currentRosterVersion !== season.data.rosterVersion ||
          ![4, 5].includes(season.data.rankingPlayerIds.length) ||
          !season.data.rosterSourceId ||
          !season.data.sources.some(
            (x) => x.id === season.data.rosterSourceId,
          ) ||
          season.data.rankingPlayerIds.some(
            (id) =>
              !season.rankingPlayers.some(
                (p) => p.playerId === id && p.identityStatus === "identified",
              ),
          )
        )
          issues.push(
            `${entry.id}: official ranking roster is stale, incomplete, unsourced or has unresolved identities.`,
          );
        if (
          season.data.rulesId !== e.rulesId ||
          season.data.rulesVersion !== e.rulesVersion ||
          season.data.effectiveFrom > d.startsOn ||
          season.data.effectiveTo <= d.endsOn
        )
          issues.push(
            `${entry.id}: official roster rule/effective interval does not cover this event.`,
          );
        if (
          evidence?.games.length !== games.length ||
          new Set(evidence?.games.map((g) => g.gameId)).size !== games.length ||
          evidence?.games.some((g) => !games.some((x) => x.id === g.gameId))
        )
          issues.push(
            `${entry.id}: every frozen game needs sourced throughout-play participation segments.`,
          );
        for (const game of games) {
          const participation = evidence?.games.find(
              (g) => g.gameId === game.id,
            ),
            lineup =
              game.entryA === entry.id
                ? game.result?.lineupA
                : game.result?.lineupB;
          if (!participation?.segments.length)
            issues.push(
              `${entry.id}/${game.id}: actual throughout-play participation evidence is missing.`,
            );
          for (const segment of participation?.segments ?? []) {
            const regular = season.data.rankingPlayerIds;
            if (
              segment.length < 3 ||
              segment.length > 4 ||
              segment.some(
                (id) =>
                  !lineup?.members.some(
                    (m) =>
                      m.playerId === id && m.identityStatus === "identified",
                  ),
              )
            )
              issues.push(
                `${entry.id}/${game.id}: participation or identified frozen game lineup evidence is unresolved.`,
              );
            if (
              (regular.length === 4 &&
                segment.filter((id) => regular.includes(id)).length < 3) ||
              (regular.length === 5 &&
                segment.some((id) => !regular.includes(id)))
            )
              issues.push(
                `${entry.id}/${game.id}: registered ranking-roster eligibility is violated; staff review cannot waive it.`,
              );
          }
        }
      }
    }
    const qualification = games.filter((g) =>
      event.qualificationGameIds.includes(g.id),
    );
    const playoff = games.filter((g) => event.playoffGameIds.includes(g.id));
    const first =
      playoff.length === 1
        ? playoff[0]
        : playoff.find((g) => g.id === evidence?.firstPlayoffGameId);
    if (
      evidence?.firstPlayoffGameId &&
      !playoff.some((g) => g.id === evidence.firstPlayoffGameId)
    )
      issues.push(
        `${entry.id}: sourced first playoff game must belong to this entry and playoff stage.`,
      );
    const firstPlayoffWon = first
      ? first.result?.winnerEntryId === entry.id
      : playoff.length &&
          playoff.every((g) => g.result?.winnerEntryId === entry.id)
        ? true
        : null;
    return {
      entryId: entry.id,
      eligibility,
      rank: rank?.rank ?? null,
      points: rank?.points ?? null,
      place: s.placements.find((p) => p.entryId === entry.id)?.place ?? 0,
      wins: games.filter((g) => g.result?.winnerEntryId === entry.id).length,
      qualificationWins: qualification.filter(
        (g) => g.result?.winnerEntryId === entry.id,
      ).length,
      qualificationLosses: qualification.filter(
        (g) => g.result?.winnerEntryId !== entry.id,
      ).length,
      qualified: playoff.length > 0,
      firstPlayoffWon,
    };
  });
  return {
    kind: event.kind,
    newEvent: event.newEvent,
    previousSfm: event.previous?.sfm ?? null,
    singleKnockout: event.singleKnockout,
    bronzeGame: !!event.bronzeGameId,
    entries,
    issues,
  };
}
