import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateEnd,
  scoreTotals,
  commandDecision,
} from "../src/domain/scoring";
test("duplicate commands replay before version checks, conflicting requests and stale edits never apply", () => {
  assert.equal(commandDecision(4, 4, undefined), "apply");
  assert.equal(commandDecision(5, 4, true), "replay");
  assert.equal(commandDecision(5, 5, false), "conflict");
  assert.equal(commandDecision(5, 4, undefined), "stale");
});
import { saveTransition } from "../src/domain/save-state";
test("save states never turn an unacknowledged request into saved and block edits until resolved", () => {
  assert.equal(saveTransition("saved", "edit"), "unsent");
  assert.equal(saveTransition("saved", "send"), "saving");
  assert.equal(saveTransition("unsent", "send"), "saving");
  assert.equal(saveTransition("saving", "interrupted"), "uncertain");
  assert.equal(saveTransition("uncertain", "edit"), "uncertain");
  assert.equal(saveTransition("uncertain", "send"), "saving");
  assert.equal(saveTransition("saving", "acknowledged"), "saved");
  assert.equal(saveTransition("saving", "conflict"), "conflict");
  assert.equal(saveTransition("conflict", "reload"), "unsent");
  assert.equal(saveTransition("conflict", "edit"), "conflict");
  assert.equal(saveTransition("saved", "interrupted"), "saved");
});
test("four-player ends allow a blank or one scoring side, preserve unknown and reject impossible scores", () => {
  assert.deepEqual(validateEnd({ state: "played", a: 0, b: 0 }), {
    state: "played",
    a: 0,
    b: 0,
  });
  assert.deepEqual(validateEnd({ state: "played", a: 8, b: 0 }), {
    state: "played",
    a: 8,
    b: 0,
  });
  assert.deepEqual(validateEnd({ state: "unknown", a: null, b: null }), {
    state: "unknown",
    a: null,
    b: null,
  });
  for (const end of [
    { state: "played", a: 1, b: 1 },
    { state: "played", a: 9, b: 0 },
    { state: "played", a: null, b: 0 },
    { state: "played", a: 1.5, b: 0 },
    { state: "upcoming", a: 0, b: 0 },
  ])
    assert.throws(() => validateEnd(end));
  assert.deepEqual(
    scoreTotals([
      { state: "played", a: 0, b: 1 },
      { state: "played", a: 2, b: 0 },
      { state: "upcoming", a: null, b: null },
    ]),
    { a: 2, b: 1 },
  );
  assert.deepEqual(
    scoreTotals([
      { state: "unknown", a: null, b: null },
      { state: "played", a: 2, b: 0 },
    ]),
    { a: null, b: null },
  );
});
