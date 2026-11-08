import { test } from "node:test";
import assert from "node:assert/strict";
import {
  profileInput,
  claimDecision,
  canEditProfile,
} from "../src/domain/profiles";
test("only an approved owner may change biography and handedness", () => {
  assert.equal(canEditProfile("account-a", null), false);
  assert.equal(canEditProfile("account-a", "account-b"), false);
  assert.equal(canEditProfile("account-a", "account-a"), true);
  assert.deepEqual(
    profileInput({
      biography: "  Local club player.  ",
      handedness: "left",
      version: 2,
    }),
    { biography: "Local club player.", handedness: "left", version: 2 },
  );
  for (const input of [
    { biography: "x".repeat(501), handedness: "left", version: 0 },
    { biography: "ok", handedness: "both", version: 0 },
    { biography: "ok", handedness: "right", version: -1 },
    { biography: "ok", handedness: "right", version: 0, name: "Changed" },
    { biography: "<script>x</script>", handedness: null, version: 0 },
  ])
    assert.throws(() => profileInput(input));
});
test("claim decisions are final and retries must match the recorded review", () => {
  assert.equal(claimDecision("pending", "approved"), "apply");
  assert.equal(claimDecision("pending", "rejected"), "apply");
  assert.equal(claimDecision("rejected", "rejected"), "replay");
  assert.throws(() => claimDecision("pending", "withdrawn"));
  assert.equal(claimDecision("approved", "approved"), "replay");
  assert.throws(() => claimDecision("approved", "rejected"));
  assert.throws(() => claimDecision("rejected", "approved"));
});
