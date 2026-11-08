import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchesApprovalScope,
  routeApproval,
  approvalActionPolicy,
} from "../src/domain/authority";
const scope = {
  countries: ["Canada"],
  organizationIds: ["club"],
  disciplines: ["men_four", "women_four"],
  categories: ["open"],
  includeEventIds: ["named"],
  excludeEventIds: ["excluded"],
};
const application = {
  id: "ordinary",
  country: "Canada",
  organizationId: "club",
  category: "open",
  divisions: [{ discipline: "men_four" }, { discipline: "women_four" }],
};
test("approval scopes require all dimensions and every division, with explicit named inclusions and exclusions", () => {
  assert.equal(matchesApprovalScope(scope, application), true);
  for (const change of [
    { country: "Sweden" },
    { organizationId: "other" },
    { category: "junior" },
    { divisions: [{ discipline: "mixed_doubles" }] },
  ])
    assert.equal(
      matchesApprovalScope(scope, { ...application, ...change }),
      false,
    );
  assert.equal(
    matchesApprovalScope(scope, {
      ...application,
      id: "named",
      country: "Sweden",
    }),
    true,
  );
  assert.equal(
    matchesApprovalScope(scope, { ...application, id: "excluded" }),
    false,
  );
});
test("reassignment and overrides remain WC controlled and require explicit reasons", () => {
  const delegate = {
    isAdministrator: false,
    isOrganizer: false,
    isResponsibleReviewer: true,
  };
  assert.equal(approvalActionPolicy(delegate, "approve", ""), null);
  assert.equal(
    approvalActionPolicy(delegate, "reassign", "Federation change")?.status,
    403,
  );
  assert.equal(
    approvalActionPolicy(delegate, "override_approve", "Dispute resolved")
      ?.status,
    403,
  );
  const wc = {
    ...delegate,
    isAdministrator: true,
    isResponsibleReviewer: false,
  };
  assert.equal(approvalActionPolicy(wc, "approve", "")?.status, 403);
  assert.equal(approvalActionPolicy(wc, "reassign", "")?.status, 400);
  assert.equal(approvalActionPolicy(wc, "override_reject", "")?.status, 400);
  assert.equal(
    approvalActionPolicy(wc, "override_approve", "WC verified the event"),
    null,
  );
  assert.equal(
    approvalActionPolicy(wc, "reassign", "Explicit reviewer transfer"),
    null,
  );
});
test("delegated approval conveys no organizer editing, submission or staff authority", () => {
  const delegate = {
    isAdministrator: false,
    isOrganizer: false,
    isResponsibleReviewer: true,
  };
  assert.equal(approvalActionPolicy(delegate, "edit", "")?.status, 403);
  assert.equal(approvalActionPolicy(delegate, "submit", "")?.status, 403);
  assert.equal(
    approvalActionPolicy(
      { ...delegate, isResponsibleReviewer: false },
      "approve",
      "",
    )?.status,
    403,
  );
  assert.equal(
    approvalActionPolicy(
      {
        isAdministrator: false,
        isOrganizer: true,
        isResponsibleReviewer: false,
      },
      "approve",
      "",
    )?.status,
    403,
  );
});
test("wildcard scope accepts supported dimensions but excluded named events win even over inclusion", () => {
  const all = {
    countries: [],
    organizationIds: [],
    disciplines: [],
    categories: [],
    includeEventIds: ["excluded"],
    excludeEventIds: ["excluded"],
  };
  assert.equal(
    matchesApprovalScope(all, {
      ...application,
      country: "Sweden",
      category: "invitational",
    }),
    true,
  );
  assert.equal(
    matchesApprovalScope(all, { ...application, id: "excluded" }),
    false,
  );
  assert.equal(
    matchesApprovalScope(scope, {
      ...application,
      divisions: [{ discipline: "men_four" }, { discipline: "mixed_doubles" }],
    }),
    false,
  );
  assert.equal(
    matchesApprovalScope(scope, { ...application, divisions: [] }),
    false,
  );
});
test("overlap routes to World Curling rather than choosing contradictory independent reviewers", () => {
  const grant = {
    id: "canada",
    reviewerId: "reviewer",
    authorityName: "Curling Canada",
    scope,
  };
  assert.deepEqual(routeApproval([grant], application, "wc"), {
    delegationId: "canada",
    reviewerId: "reviewer",
    authorityName: "Curling Canada",
  });
  assert.deepEqual(
    routeApproval([grant, { ...grant, id: "overlap" }], application, "wc"),
    { delegationId: null, reviewerId: "wc", authorityName: "World Curling" },
  );
  assert.equal(
    routeApproval([grant], { ...application, country: "Sweden" }, "wc")
      .reviewerId,
    "wc",
  );
});
