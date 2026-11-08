import { test } from "node:test";
import assert from "node:assert/strict";
import { represents } from "../src/domain/representation";
test("representation matches current account, canonical team, season and explicit action only", () => {
  const grant = {
    userId: "sam",
    teamId: "core-four",
    season: "2026-27",
    actions: ["submit", "amend", "withdraw", "payment"],
    revokedAt: null,
  };
  for (const action of ["submit", "amend", "withdraw", "payment"] as const)
    assert.equal(
      represents(grant, "sam", "core-four", "2026-27", action),
      true,
    );
  assert.equal(
    represents(grant, "profile-owner", "core-four", "2026-27", "submit"),
    false,
  );
  assert.equal(
    represents(grant, "sam", "different-core", "2026-27", "submit"),
    false,
  );
  assert.equal(
    represents(grant, "sam", "core-four", "2027-28", "submit"),
    false,
  );
  assert.equal(
    represents(
      { ...grant, actions: ["submit"] },
      "sam",
      "core-four",
      "2026-27",
      "amend",
    ),
    false,
  );
  assert.equal(
    represents(
      { ...grant, revokedAt: new Date() },
      "sam",
      "core-four",
      "2026-27",
      "submit",
    ),
    false,
  );
});
