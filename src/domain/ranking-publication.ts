import { EntryError } from "./entries";
import { compareRational } from "./overall-rankings";
import { canonicalJson } from "./canonical-json";

/** Producer-independent publication boundary. Future producers provide these
 * explicit subject/list fields; identity is never inferred from a name. */
export type PublicationList = {
  family: "overall" | "series" | "mixed-doubles";
  subjectType: "team" | "pair" | "individual";
  discipline: string;
  season: string;
  seriesId: string | null;
};
export type PublicContribution = {
  id: string;
  label: string;
  date: string;
  points: string;
  counted: boolean;
  reason: string | null;
};
export type PublicRankingRow = {
  subjectId: string;
  name: string;
  subjectType: PublicationList["subjectType"];
  href: string | null;
  rank: number;
  total: string;
  starting: string;
  carryover: string;
  eventTotal: string;
  contributions: PublicContribution[];
  previousRank?: number | null;
  previousTotal?: string | null;
  movement?: number | null;
};
export type PublicRankingList = {
  schema: "wcp.public-ranking-list.v1";
  list: PublicationList;
  title: string;
  effectiveDate: string;
  origin: "calculated";
  rows: PublicRankingRow[];
};
export function publicationReadiness(
  result: { state: string; issues: string[]; warnings: string[] },
  acknowledged: string[],
) {
  if (
    new Set(acknowledged).size !== acknowledged.length ||
    acknowledged.some((x) => !result.warnings.includes(x))
  )
    throw new EntryError(
      "Only exact informational issues may be acknowledged.",
    );
  const blockers = [...result.issues];
  if (result.state !== "ready" && !blockers.length)
    blockers.push("Calculation is incomplete.");
  return [
    ...blockers,
    ...new Set(
      result.warnings
        .filter((x) => !acknowledged.includes(x))
        .map((x) => `Acknowledge informational issue: ${x}`),
    ),
  ];
}
export function comparePublication(
  current: PublicRankingList,
  previous: PublicRankingList | null,
) {
  if (
    previous &&
    (canonicalJson(current.list) !== canonicalJson(previous.list) ||
      previous.effectiveDate > current.effectiveDate)
  )
    throw new EntryError(
      "Compare the same list and subject type at this or an earlier effective date.",
      409,
    );
  const rows = current.rows.map((row) => {
    const old = previous?.rows.find((x) => x.subjectId === row.subjectId);
    return {
      subjectId: row.subjectId,
      name: row.name,
      rank: row.rank,
      previousRank: old?.rank ?? null,
      movement: old ? old.rank - row.rank : null,
      total: row.total,
      previousTotal: old?.total ?? null,
      pointsChanged: old ? compareRational(row.total, old.total) !== 0 : true,
    };
  });
  return {
    rows,
    removed:
      previous?.rows
        .filter((x) => !current.rows.some((y) => y.subjectId === x.subjectId))
        .map((x) => ({
          subjectId: x.subjectId,
          name: x.name,
          rank: x.rank,
          total: x.total,
        })) ?? [],
  };
}
/** Six decimal places for reading, original rational retained alongside it. */
export function pointsLabel(value: string) {
  const [n, d = "1"] = value.split("/"),
    scaled = (BigInt(n) * 1000000n) / BigInt(d);
  if (BigInt(n) > 0n && scaled === 0n) return `<0.000001 (exact ${value})`;
  const fraction = String(scaled % 1000000n)
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${scaled / 1000000n}${fraction ? `.${fraction}` : ""}${d !== "1" ? ` (exact ${value})` : ""}`;
}
