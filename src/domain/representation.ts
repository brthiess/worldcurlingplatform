export const representationActions = [
  "submit",
  "amend",
  "withdraw",
  "payment",
] as const;
export type RepresentationAction = (typeof representationActions)[number];
export function represents(
  grant: {
    userId: string;
    teamId: string;
    season: string;
    actions: string[];
    revokedAt: Date | string | null;
  },
  userId: string,
  teamId: string,
  season: string,
  action: RepresentationAction,
) {
  return (
    !grant.revokedAt &&
    grant.userId === userId &&
    grant.teamId === teamId &&
    grant.season === season &&
    grant.actions.includes(action)
  );
}
