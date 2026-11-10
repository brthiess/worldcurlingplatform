export class FinalizationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type Placement = { entryId: string; place: number };
export function validatePlacements(
  entryIds: string[],
  value: unknown,
  tieNote: string,
): Placement[] {
  if (
    !entryIds.length ||
    !Array.isArray(value) ||
    value.length !== entryIds.length ||
    value.some(
      (p) =>
        !p ||
        !entryIds.includes(p.entryId) ||
        !Number.isSafeInteger(p.place) ||
        p.place < 1 ||
        p.place > entryIds.length,
    ) ||
    new Set(value.map((p) => p.entryId)).size !== entryIds.length
  )
    throw new FinalizationError(
      "Place every division entry exactly once with a positive final place.",
    );
  const placements = (value as Placement[])
    .map((p) => ({ entryId: p.entryId, place: p.place }))
    .sort((a, b) => a.place - b.place || a.entryId.localeCompare(b.entryId));
  let previous = 0;
  for (const [i, p] of placements.entries()) {
    if (p.place !== previous && p.place !== i + 1)
      throw new FinalizationError(
        "Use competition places such as 1, 2, 2, 4 for a shared place.",
      );
    previous = p.place;
  }
  if (
    new Set(placements.map((p) => p.place)).size !== placements.length &&
    !tieNote.trim()
  )
    throw new FinalizationError(
      "Record how shared places were decided; no automatic tiebreak is applied.",
    );
  return placements;
}
export function finalizationPrerequisites(
  games: {
    state: string;
    result: { winnerEntryId?: string; outcome?: string } | null;
  }[],
) {
  if (!games.length) return ["Record at least one game before finalizing."];
  const issues: string[] = [];
  if (games.some((g) => g.state !== "confirmed"))
    issues.push("Every game must be confirmed.");
  if (
    games.some(
      (g) =>
        !g.result?.winnerEntryId ||
        !["normal", "conceded", "forfeit"].includes(g.result?.outcome ?? ""),
    )
  )
    issues.push(
      "Every game needs an explicitly confirmed outcome; legacy totals alone are insufficient.",
    );
  return issues;
}
import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json";
export function freezeContents(value: unknown) {
  const contents = canonicalJson(value);
  return {
    contents,
    digest: createHash("sha256").update(contents, "utf8").digest("hex"),
  };
}
export function finalizationState(
  latest: { version: number; sourceDigest: string } | null,
  sourceDigest: string,
) {
  return {
    version: latest?.version ?? 0,
    dirty: !!latest && latest.sourceDigest !== sourceDigest,
  };
}
