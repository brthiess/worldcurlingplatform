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
        corePlayerIds: [],
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
      corePlayerIds: [],
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

test("a factual regular-core replacement preserves every unaffected member and distinguishes the resulting selection", () => {
  const before = {
    coreKnown: true,
    corePlayerIds: ["a", "b", "c", "wrong"],
    members: [
      {
        playerId: "a",
        role: "core" as const,
        position: "lead",
        participation: "declared" as const,
      },
      {
        playerId: "wrong",
        role: "core" as const,
        position: "skip",
        participation: "declared" as const,
      },
    ],
  };
  const after = correctedSelection(before, "wrong", "right");
  assert.deepEqual(after.corePlayerIds, ["a", "b", "c", "right"]);
  assert.deepEqual(after.members, [
    {
      playerId: "a",
      role: "core",
      position: "lead",
      participation: "declared",
    },
    {
      playerId: "right",
      role: "core",
      position: "skip",
      participation: "declared",
    },
  ]);
  assert.deepEqual(before.corePlayerIds, ["a", "b", "c", "wrong"]);
  assert.equal(after.collision, false);
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
