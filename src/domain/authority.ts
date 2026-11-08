export type ApprovalScope = {
  countries: string[];
  organizationIds: string[];
  disciplines: string[];
  categories: string[];
  includeEventIds: string[];
  excludeEventIds: string[];
};
export type ApprovalSubject = {
  id: string;
  country: string;
  organizationId: string;
  category?: string;
  divisions: { discipline: string }[];
};
export type Delegation = {
  id: string;
  reviewerId: string;
  authorityName: string;
  scope: ApprovalScope;
};
export function matchesApprovalScope(
  scope: ApprovalScope,
  app: ApprovalSubject,
) {
  if (scope.excludeEventIds.includes(app.id)) return false;
  if (scope.includeEventIds.includes(app.id)) return true;
  const match = (values: string[], value: string) =>
    !values.length || values.includes(value);
  return (
    match(scope.countries, app.country) &&
    match(scope.organizationIds, app.organizationId) &&
    match(scope.categories, app.category ?? "open") &&
    app.divisions.length > 0 &&
    app.divisions.every((d) => match(scope.disciplines, d.discipline))
  );
}
export function routeApproval(
  grants: Delegation[],
  app: ApprovalSubject,
  defaultReviewerId: string,
) {
  const matches = grants.filter((g) => matchesApprovalScope(g.scope, app));
  return matches.length === 1
    ? {
        delegationId: matches[0].id,
        reviewerId: matches[0].reviewerId,
        authorityName: matches[0].authorityName,
      }
    : {
        delegationId: null,
        reviewerId: defaultReviewerId,
        authorityName: "World Curling",
      };
}
export function approvalOverride(status: string, decision: string) {
  if (
    !["submitted", "approved", "rejected"].includes(status) ||
    !["approve", "reject"].includes(decision)
  )
    throw new Error("This application cannot receive that override.");
  return {
    status: decision === "approve" ? "approved" : "rejected",
    published: decision === "approve",
  };
}
export function approvalActionPolicy(
  actor: {
    isAdministrator: boolean;
    isOrganizer: boolean;
    isResponsibleReviewer: boolean;
  },
  action: string,
  reason: string,
): { status: number; error: string } | null {
  if (action === "reassign" || action.startsWith("override_")) {
    if (!actor.isAdministrator)
      return {
        status: 403,
        error:
          "Only World Curling administrators can reassign or override an application.",
      };
    if (!reason.trim())
      return {
        status: 400,
        error: "Record a reason for reassignment or World Curling override.",
      };
  } else if (["approve", "reject"].includes(action)) {
    if (!actor.isResponsibleReviewer)
      return {
        status: 403,
        error:
          "Only the active responsible reviewer can review this application.",
      };
  } else if (!actor.isAdministrator && !actor.isOrganizer)
    return {
      status: 403,
      error: "Organizer authority is required to change this application.",
    };
  return null;
}
