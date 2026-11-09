import { test } from "node:test";
import assert from "node:assert/strict";
import {
  candidateClassification,
  correctedSelection,
} from "../src/domain/identity-corrections";

test("same-name candidates require explicit choice and keep uncertainty visible", () => {
  assert.equal(
    candidateClassification("Alex Smith", [
      { id: "a", name: "Alex Smith" },
      { id: "b", name: "Alex Smith" },
    ]),
    "ambiguous",
  );
  assert.equal(
    candidateClassification("Alex Smith", [{ id: "a", name: "Alex Smith" }]),
    "possible_match",
  );
  assert.equal(candidateClassification("Alex Smith", []), "no_match");
});

test("factual selection replaces only the mistaken ID and preserves roles and unknown core", () => {
  assert.deepEqual(
    correctedSelection(
      {
        coreKnown: false,
        corePlayerIds: ["wrong"],
        members: [
          {
            playerId: "wrong",
            role: "substitute",
            position: "third",
            participation: "defaulted",
          },
        ],
      },
      "wrong",
      "right",
    ),
    {
      coreKnown: false,
      corePlayerIds: ["right"],
      members: [
        {
          playerId: "right",
          role: "substitute",
          position: "third",
          participation: "defaulted",
        },
      ],
      collision: false,
    },
  );
});

test("person collision leaves the proposed source evidence untouched", () => {
  const before = {
    coreKnown: true,
    corePlayerIds: ["wrong", "right"],
    members: [],
  };
  assert.equal(correctedSelection(before, "wrong", "right").collision, true);
  assert.deepEqual(before.corePlayerIds, ["wrong", "right"]);
  assert.throws(
    () => correctedSelection(before, "absent", "new"),
    /not selected/,
  );
  assert.throws(
    () => correctedSelection(before, "wrong", "wrong"),
    /different/,
  );
});
