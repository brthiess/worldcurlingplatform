import { test } from "node:test";
import assert from "node:assert/strict";
import { coreIdentity, entryInput } from "../src/domain/entries";

test("a returning unordered core reuses its discipline identity, regardless of labels or event substitutes", () => {
  assert.equal(
    coreIdentity("men_four", ["d", "b", "a", "c"]),
    'men_four:["a","b","c","d"]',
  );
  assert.equal(
    coreIdentity("men_four", ["a", "b", "c", "d"]),
    coreIdentity("men_four", ["d", "c", "b", "a"]),
  );
  assert.notEqual(
    coreIdentity("women_four", ["a", "b", "c", "d"]),
    coreIdentity("men_four", ["a", "b", "c", "d"]),
  );
});

test("incomplete lineups remain provisional while impossible or ambiguous core declarations are rejected", () => {
  assert.throws(
    () => entryInput({ ...input, corePlayerIds: ["a", "b", "c"] }, "men_four"),
    /four or five/,
  );
  assert.throws(
    () =>
      entryInput({ ...input, corePlayerIds: ["a", "b", "c", "c"] }, "men_four"),
    /once/,
  );
  assert.throws(
    () => entryInput({ ...input, members: [member("z")] }, "men_four"),
    /regular core/,
  );
  assert.throws(
    () =>
      entryInput({ ...input, members: [member("a"), member("a")] }, "men_four"),
    /once/,
  );
  assert.deepEqual(
    entryInput(
      { ...input, coreKnown: false, corePlayerIds: [], members: [] },
      "men_four",
    ).corePlayerIds,
    [],
  );
  assert.throws(() => entryInput(input, "mixed_doubles"), /two/);
});

const member = (playerId: string, role = "core") => ({
  playerId,
  role,
  position: "skip",
  participation: "declared",
});
const input = {
  divisionId: "division",
  name: "North",
  coreKnown: true,
  corePlayerIds: ["a", "b", "c", "d"],
  members: [member("a"), member("b"), member("c"), member("d")],
};
test("five regular cores differ from a designated alternate; temporary substitutions and positions preserve core identity", () => {
  const four = entryInput(input, "men_four");
  const alternate = entryInput(
    { ...input, members: [...input.members, member("e", "alternate")] },
    "men_four",
  );
  const five = entryInput(
    {
      ...input,
      corePlayerIds: ["a", "b", "c", "d", "e"],
      members: [...input.members, member("e")],
    },
    "men_four",
  );
  const substitution = entryInput(
    {
      ...input,
      name: "New label",
      members: [
        member("a"),
        member("b"),
        member("c"),
        member("e", "substitute"),
        member("f", "coach"),
      ],
    },
    "men_four",
  );
  assert.deepEqual(alternate.corePlayerIds, ["a", "b", "c", "d"]);
  assert.deepEqual(substitution.corePlayerIds, four.corePlayerIds);
  assert.notEqual(
    coreIdentity("men_four", five.corePlayerIds),
    coreIdentity("men_four", four.corePlayerIds),
  );
  assert.notEqual(
    coreIdentity("men_four", ["a", "b", "c", "e"]),
    coreIdentity("men_four", four.corePlayerIds),
  );
});

test("only supported disciplines, safe player text and honest evidence classifications are accepted", () => {
  assert.throws(() => entryInput(input, "junior"), /discipline/);
  assert.throws(
    () => entryInput({ ...input, name: "<script>bad</script>" }, "men_four"),
    /plain-text/,
  );
  assert.throws(
    () =>
      entryInput(
        { ...input, members: [{ ...member("a"), participation: "verified" }] },
        "men_four",
      ),
    /declared\/defaulted/,
  );
  assert.throws(
    () =>
      entryInput(
        {
          ...input,
          newPlayers: [{ id: "x", name: "Unused", provisional: false }],
        },
        "men_four",
      ),
    /included/,
  );
  assert.throws(
    () =>
      entryInput(
        { ...input, registerSeason: { season: "2026-28", version: 0 } },
        "men_four",
      ),
    /season/,
  );
});
