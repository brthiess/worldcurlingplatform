import { exact } from "./ranking-inputs";
export const assessmentEngine = "wcp.four-event.2026-27.v1";
export type EventKind =
  | "tour"
  | "nationals"
  | "slam"
  | "trials"
  | "olympics"
  | "worlds";
export type CalculationEntry = {
  entryId: string;
  rank: number | null;
  points: string | null;
  eligibility: "eligible" | "excluded" | "unknown";
  place: number;
  wins: number;
  qualificationWins: number;
  qualificationLosses: number;
  qualified: boolean;
  firstPlayoffWon: boolean | null;
};
export type CalculationField = {
  kind: EventKind;
  newEvent: boolean | null;
  previousSfm: string | null;
  singleKnockout: boolean;
  bronzeGame: boolean;
  entries: CalculationEntry[];
  issues: string[];
};
function parts(v: string) {
  const [a, b] = exact.value(v).split("/");
  return [BigInt(a), BigInt(b ?? "1")] as const;
}
export function compareExact(a: string, b: string) {
  const [n, d] = parts(a),
    [m, e] = parts(b);
  return n * e < m * d ? -1 : n * e > m * d ? 1 : 0;
}
function ratio(a: number, b: number) {
  return exact.value(`${a}/${b}`);
}
function tenth(v: string) {
  const [n, d] = parts(v);
  return exact.value(`${(n * 20n + d) / (2n * d)}/10`);
}
export type AssessmentResult = {
  state: "completed" | "blocked";
  engine: string;
  issues: string[];
  sfm: string | null;
  series: "Champion" | "Elite" | "Challenger" | null;
  stages: { stage: string; value: string }[];
  awards: {
    entryId: string;
    place: number;
    points: string;
    multiplier: string;
    reason: string;
    adjustments: string[];
  }[];
  contributions: { entryId: string; value: string; reason: string }[];
};
/** Exact rational event awards. This is event assessment, never world-list selection. */
export function assessFourPlayer(f: CalculationField): AssessmentResult {
  const r: AssessmentResult = {
    state: "blocked",
    engine: assessmentEngine,
    issues: [...f.issues],
    sfm: null,
    series: null,
    stages: [],
    awards: [],
    contributions: [],
  };
  let sum = "0";
  for (const e of f.entries) {
    let value = "0",
      reason = "Excluded from field strength and awards";
    if (e.eligibility === "unknown")
      r.issues.push(`${e.entryId}: ranking eligibility is unresolved.`);
    if (e.eligibility === "eligible" && f.kind !== "worlds") {
      if (e.rank === null || e.points === null)
        r.issues.push(
          `${e.entryId}: exact pre-event rank and points are required.`,
        );
      else if (!Number.isSafeInteger(e.rank) || e.rank < 1)
        r.issues.push(`${e.entryId}: invalid pre-event rank.`);
      else if (e.rank === 200)
        r.issues.push(
          `${e.entryId}: official rank-200 contribution overlap is unresolved.`,
        );
      else {
        value =
          e.rank <= 20
            ? ratio(46 - e.rank, 100)
            : e.rank <= 30
              ? "1/4"
              : e.rank <= 50
                ? "1/5"
                : e.rank <= 75
                  ? "3/20"
                  : e.rank <= 100
                    ? "1/10"
                    : e.rank < 200
                      ? "1/20"
                      : exact.value(e.points) === "0"
                        ? "1/100"
                        : "1/50";
        reason = `Pre-event rank ${e.rank}`;
      }
    }
    if (
      e.eligibility === "eligible" &&
      e.qualified &&
      e.qualificationWins < e.qualificationLosses &&
      e.firstPlayoffWon === null
    )
      r.issues.push(
        `${e.entryId}: first playoff result is required for a losing-record qualifier.`,
      );
    if (e.eligibility === "eligible" && f.kind === "worlds")
      reason = "Fixed Worlds SFM; rank contribution is not used";
    sum = exact.add(sum, value);
    r.contributions.push({ entryId: e.entryId, value, reason });
  }
  const n = f.entries.length;
  if (n < 8 && f.kind === "tour")
    r.issues.push("Tour field needs at least eight competing teams.");
  if (n < 8)
    r.issues.push(
      "Sub-eight award entitlement requires further evidence; padding alone does not define awards.",
    );
  if (f.kind === "tour" && f.newEvent === null)
    r.issues.push("New or previous edition linkage is unresolved.");
  if (f.kind === "tour" && f.newEvent === false && f.previousSfm === null)
    r.issues.push("Existing tour needs the sourced previous edition SFM.");
  if (r.issues.length) return r;
  const stage = (stage: string, value: string) => {
    r.stages.push({ stage, value });
    return value;
  };
  stage("contribution sum", sum);
  const scale = stage("teams scale", ratio(24, n));
  const factor = stage("teams factor", ratio(n + 16, 32));
  let value = stage(
    "scaled field",
    exact.multiply(exact.multiply(sum, scale), factor),
  );
  if (f.kind === "worlds") value = stage("set strength", "11");
  else if (f.kind === "tour") {
    if (f.newEvent === false) {
      const floor = stage(
        "previous/current average",
        exact.multiply(exact.add(value, f.previousSfm!), "1/2"),
      );
      if (compareExact(floor, value) > 0) value = floor;
    }
    value = stage("tour cap", compareExact(value, "8") > 0 ? "8" : value);
  } else {
    const importance = {
      nationals: "7/4",
      slam: "5/4",
      trials: "19/10",
      olympics: "5/2",
    }[f.kind];
    stage("importance factor", importance);
    value = stage("importance adjusted", exact.multiply(value, importance));
    if (f.kind !== "olympics")
      value = stage(
        "special cap",
        compareExact(value, "10") > 0 ? "10" : value,
      );
  }
  if (f.singleKnockout)
    value = stage("single knockout reduction", exact.multiply(value, "3/4"));
  const sfm = stage(
    "final nearest tenth (application half-up policy)",
    tenth(value),
  );
  r.sfm = sfm;
  r.series =
    f.kind !== "tour"
      ? "Champion"
      : compareExact(sfm, "4") >= 0
        ? "Elite"
        : "Challenger";
  const slots = Math.min(8, Math.max(4, Math.floor(n / 2)));
  for (const e of f.entries) {
    let multiplier = "0",
      reason = "Excluded",
      adjustments: string[] = [];
    if (e.eligibility === "eligible") {
      if (e.qualified || e.place <= 4) {
        multiplier =
          e.place === 1
            ? "15/2"
            : e.place === 2
              ? "11/2"
              : e.place <= 4
                ? n <= 9
                  ? e.place === 3 &&
                    f.entries.filter((x) => x.place === 3).length === 2
                    ? "29/8"
                    : e.place === 3
                      ? "17/4"
                      : "3"
                  : f.bronzeGame
                    ? e.place === 3
                      ? "9/2"
                      : "4"
                    : "17/4"
                : e.place <= 8
                  ? "3"
                  : "0";
        // Shared last qualifying group splits available placement slots. Top four entitlement is preserved.
        const group = f.entries.filter(
          (x) => x.place === e.place && (x.qualified || x.place <= 4),
        );
        const available = Math.max(0, slots - (e.place - 1));
        if (group.length > available) {
          multiplier = exact.multiply(
            multiplier,
            ratio(available, group.length),
          );
          adjustments.push(
            `Last qualifier split: ${available}/${group.length}`,
          );
        }
        if (
          e.qualified &&
          e.qualificationWins < e.qualificationLosses &&
          e.firstPlayoffWon === false
        ) {
          multiplier = exact.multiply(multiplier, "1/2");
          adjustments.push(
            "Losing qualification record; first playoff lost: ×1/2",
          );
        }
        reason = "Placement award";
      } else {
        multiplier = exact.multiply("3/8", String(e.wins));
        reason = `Non-playoff wins: ${e.wins}`;
      }
    }
    r.awards.push({
      entryId: e.entryId,
      place: e.place,
      multiplier,
      points: exact.multiply(sfm, multiplier),
      reason,
      adjustments,
    });
  }
  r.state = "completed";
  return r;
}
