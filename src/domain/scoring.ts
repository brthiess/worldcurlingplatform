export type End = {
  state: "played" | "unknown" | "upcoming" | "unplayed";
  a: number | null;
  b: number | null;
};
export function commandDecision(
  version: number,
  expected: number,
  existingMatches: boolean | undefined,
) {
  if (existingMatches !== undefined)
    return existingMatches ? "replay" : "conflict";
  return version === expected ? "apply" : "stale";
}
export function validateEnd(value: unknown): End {
  const end = value as End;
  if (
    !end ||
    !["played", "unknown", "upcoming", "unplayed"].includes(end.state)
  )
    throw new Error("Choose a score state");
  if (end.state === "played") {
    if (
      !Number.isInteger(end.a) ||
      !Number.isInteger(end.b) ||
      end.a! < 0 ||
      end.b! < 0 ||
      end.a! > 8 ||
      end.b! > 8 ||
      (end.a! > 0 && end.b! > 0)
    )
      throw new Error(
        "Use whole points from 0 to 8; only one team can score in an end",
      );
  } else if (end.a !== null || end.b !== null)
    throw new Error("Only played ends have points");
  return { state: end.state, a: end.a, b: end.b };
}
export function scoreTotals(ends: End[]) {
  if (ends.some((e) => e.state === "unknown")) return { a: null, b: null };
  return ends.reduce<{ a: number; b: number }>(
    (sum, e) => ({ a: sum.a + (e.a ?? 0), b: sum.b + (e.b ?? 0) }),
    { a: 0, b: 0 },
  );
}
