import { EntryError } from "./entries";
import { exact, checkpointAt, type RulesInput } from "./ranking-inputs";
export const overallEngine = "wcp.four-overall.2026-27.v1";
export const overallPolicy = {
  id: "wcp.four-overall-policy.2026-27.v1",
  authority:
    "Application interpretations, not an official World Curling clarification",
  cutoff:
    "Inclusive effective calendar date; completed event endsOn must be on or before that date. The season is [2026-08-01,2027-08-01).",
  arithmetic:
    "Exact rational values throughout; display precision does not change ownership or ordering.",
  ties: "Equal totals: fewer actual counting awards, then repeatedly remove smallest counting awards. Carryover remains in each reduced total. Exhausted equal vectors remain unresolved and block readiness; IDs/names never decide sporting order.",
  ownership:
    "Core identity reuse confers no point rights. Current reviewed starting ownership, continuity and ordinary adjustment evidence are independently required. Unknown penalties/exemptions remain blockers.",
} as const;
export type OverallAward = {
  id: string;
  date: string;
  points: string;
  excluded?: string;
};
export function supportedOverallCheckpoint(rules:RulesInput,date:string){
 const schedule=[['2026-08-01',1,'1'],['2026-09-15',2,'3/4'],['2026-10-06',3,'5/8'],['2026-10-27',4,'1/2'],['2026-11-17',5,'3/8'],['2026-12-08',6,'1/4'],['2026-12-29',7,'1/8'],['2027-01-19',8,'0']] as const;
 const expected=schedule.filter(s=>s[0]<=date).at(-1),c=checkpointAt(rules,'four_overall',date);
 if(!expected||!c||rules.season!=='2026-27'||rules.effectiveFrom!=='2026-08-01'||rules.effectiveTo!=='2027-08-01'||c.from!==expected[0]||c.maxEvents!==expected[1]||c.priorWeight!==expected[2])throw new EntryError('No supported sourced 2026-27 overall checkpoint covers this date; modified schedules are not implemented.',422);
 return c;
}
export function compareRational(a: string, b: string) {
  const [n, d = "1"] = a.split("/"),
    [m, e = "1"] = b.split("/");
  const l = BigInt(n) * BigInt(e),
    r = BigInt(m) * BigInt(d);
  return l < r ? -1 : l > r ? 1 : 0;
}
export function overallContribution(
  rules: RulesInput,
  date: string,
  starting: string,
  awards: OverallAward[],
) {
  const checkpoint = supportedOverallCheckpoint(rules,date);
  if (!checkpoint || rules.season !== "2026-27")
    throw new EntryError(
      "No supported 2026-27 overall checkpoint covers this date.",
      422,
    );
  if (new Set(awards.map((a) => a.id)).size !== awards.length)
    throw new EntryError("An award may contribute only once.");
  const eligible = awards
    .filter(
      (a) =>
        !a.excluded &&
        a.date >= rules.effectiveFrom &&
        a.date <= date &&
        a.date < rules.effectiveTo,
    )
    .sort(
      (a, b) => compareRational(b.points, a.points) || a.id.localeCompare(b.id),
    );
  const counted = eligible.slice(0, checkpoint.maxEvents),
    ids = new Set(counted.map((a) => a.id));
  const excluded = awards
    .filter((a) => !ids.has(a.id))
    .map((a) => ({
      ...a,
      reason:
        a.excluded ||
        (a.date > date
          ? "Completed after effective date"
          : a.date < rules.effectiveFrom || a.date >= rules.effectiveTo
            ? "Outside season"
            : "Below counting-event limit"),
    }));
  const eventTotal = counted.reduce((s, a) => exact.add(s, a.points), "0"),
    carryover = exact.multiply(starting, checkpoint.priorWeight);
  return {
    checkpoint,
    counted,
    excluded,
    eventTotal,
    starting,
    carryover,
    total: exact.add(eventTotal, carryover),
  };
}
type Contribution = ReturnType<typeof overallContribution>;
export function orderOverall<T extends Contribution & { id: string }>(
  subjects: T[],
) {
  function sporting(a: T, b: T) {
    const totals = compareRational(b.total, a.total);
    if (totals) return totals;
    if (a.counted.length !== b.counted.length)
      return a.counted.length - b.counted.length;
    const av = a.counted
        .map((x) => x.points)
        .sort((a, b) => compareRational(b, a)),
      bv = b.counted.map((x) => x.points).sort((a, b) => compareRational(b, a));
    for (let n = av.length - 1; n >= 0; n--) {
      const at = av.slice(0, n).reduce(exact.add, a.carryover),
        bt = bv.slice(0, n).reduce(exact.add, b.carryover),
        c = compareRational(bt, at);
      if (c) return c;
    }
    return 0;
  }
  const sorted = [...subjects].sort(sporting),
    unresolved: string[][] = [];
  const rows = sorted.map((s, i) => {
    const peers = sorted.filter((x) => sporting(s, x) === 0);
    if (peers.length > 1 && !unresolved.some((g) => g.includes(s.id)))
      unresolved.push(peers.map((x) => x.id));
    return {
      ...s,
      rank: peers.length > 1 ? null : i + 1,
      ordering:
        peers.length > 1
          ? "Unresolved exhausted ranking tie"
          : "Exact total, counting-event count, then successive lowest-result removal",
    };
  });
  return { rows, unresolved };
}
export type PriorRoster = {
  total: string;
  members: { playerId: string; share: string }[];
};
export function continuityStarting(
  current: { playerId: string; amount: string }[],
  prior: PriorRoster | null,
) {
  const sum = current.reduce((s, c) => exact.add(s, c.amount), "0");
  if (!prior)
    return { starting: sum, individualSum: sum, floor: "0", extra: "0" };
  const retained = prior.members.filter((p) =>
    current.some((c) => c.playerId === p.playerId),
  );
  if (
    !(
      (prior.members.length === 4 &&
        current.length === 4 &&
        retained.length === 3) ||
      (prior.members.length === 5 &&
        current.length === 5 &&
        retained.length === 4)
    )
  )
    throw new EntryError(
      "Continuity needs exactly three of four or four of five retained registered players; identity alone gives no floor.",
      422,
    );
  if (
    new Set(prior.members.map((m) => m.playerId)).size !==
      prior.members.length ||
    prior.members.reduce((s, m) => exact.add(s, m.share), "0") !== "1"
  )
    throw new EntryError(
      "Prior ownership must be unique and sum exactly to one.",
    );
  for (const p of retained)
    if (
      current.find((c) => c.playerId === p.playerId)!.amount !==
      exact.multiply(prior.total, p.share)
    )
      throw new EntryError(
        "A retained player's prior entitlement does not match the sourced total and share.",
        422,
      );
  const starting = compareRational(sum, prior.total) >= 0 ? sum : prior.total;
  return {
    starting,
    individualSum: sum,
    floor: prior.total,
    extra: subtract(starting, sum),
  };
}
export function subtract(a: string, b: string) {
  if (compareRational(a, b) < 0)
    throw new EntryError(
      "An ordinary adjustment cannot create negative ownership.",
      422,
    );
  const [n, d = "1"] = a.split("/"),
    [m, e = "1"] = b.split("/");
  // exact.value validates external bounds; internal rational operations may exceed those bounds.
  return exact.add(
    "0",
    `${BigInt(n) * BigInt(e) - BigInt(m) * BigInt(d)}/${BigInt(d) * BigInt(e)}`,
  );
}
export type TransferBranch =
  | "pre-none"
  | "pre-pre"
  | "pre-post"
  | "post-none"
  | "post-post";
export function transferEntitlement(
  branch: TransferBranch,
  oldPlayed: string,
  newPlayed: string,
  oldFinal: string | null,
  newFinal: string | null,
) {
  const quarter = (x: string) => exact.multiply(x, "1/4"),
    fifth = (x: string) => exact.multiply(x, "1/5");
  if (branch === "pre-none") return quarter(oldPlayed);
  if (branch === "pre-pre") {
    if (newFinal === null)
      throw new EntryError("A sourced new final total is required.", 422);
    return quarter(newFinal);
  }
  if (branch === "pre-post")
    return compareRational(oldPlayed, newPlayed) >= 0
      ? quarter(oldPlayed)
      : quarter(newPlayed);
  if (oldFinal === null)
    throw new EntryError("A sourced old final total is required.", 422);
  const old = fifth(oldFinal);
  return branch === "post-none" || compareRational(old, quarter(newPlayed)) >= 0
    ? old
    : quarter(newPlayed);
}
