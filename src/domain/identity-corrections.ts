import { EntryError, type LineupMember } from "./entries";
export function candidateClassification(
  query: string,
  candidates: { id: string; name: string }[],
) {
  const matches = candidates.filter((p) =>
    p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return matches.length > 1
    ? "ambiguous"
    : matches.length === 1
      ? "possible_match"
      : "no_match";
}
export function correctedSelection<
  T extends {
    coreKnown: boolean;
    corePlayerIds: string[];
    members: LineupMember[];
  },
>(before: T, from: string, to: string) {
  if (from === to) throw new EntryError("Choose a different player record.");
  if (
    !before.corePlayerIds.includes(from) &&
    !before.members.some((m) => m.playerId === from)
  )
    throw new EntryError("The mistaken player is not selected in this entry.");
  const collision =
    before.corePlayerIds.includes(to) ||
    before.members.some((m) => m.playerId === to);
  return {
    ...before,
    corePlayerIds: before.corePlayerIds.map((id) => (id === from ? to : id)),
    members: before.members.map((m) => ({
      ...m,
      playerId: m.playerId === from ? to : m.playerId,
    })),
    collision,
  };
}
