import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateApplication,
  applicationTransition,
  nextEdition,
} from "../src/domain/applications";
const input = {
  organizationId: "prairie-club",
  seriesId: "prairie",
  name: "Prairie Open 2027",
  startsOn: "2027-11-08",
  endsOn: "2027-11-10",
  city: "Regina",
  country: "Canada",
  venue: "",
  timezone: "America/Regina",
  divisions: [{ id: "men-2027", name: "Men", discipline: "men_four" }],
};
test("initial event application requires essentials but accepts an unconfirmed venue", () => {
  assert.deepEqual(validateApplication(input), {});
  assert.deepEqual(
    validateApplication({
      ...input,
      name: " ",
      startsOn: "2027-02-30",
      country: "",
      divisions: [],
    }),
    {
      name: "Enter an edition name (1–160 characters).",
      startsOn: "Enter a valid start date.",
      country: "Enter a country (1–80 characters).",
      divisions: "Propose between 1 and 12 divisions.",
    },
  );
});
test("only submitted applications can be admitted; admission does not open registration or resolve ranking", () => {
  assert.deepEqual(applicationTransition("submitted", "approve"), {
    status: "approved",
    published: true,
  });
  assert.deepEqual(applicationTransition("submitted", "reject"), {
    status: "rejected",
    published: false,
  });
  assert.deepEqual(applicationTransition("rejected", "submit"), {
    status: "submitted",
    published: false,
  });
  assert.deepEqual(applicationTransition("approved", "edit"), {
    status: "approved",
    published: true,
  });
  for (const [status, action] of [
    ["draft", "approve"],
    ["approved", "submit"],
    ["approved", "reject"],
    ["draft", "reject"],
    ["submitted", "submit"],
  ])
    assert.throws(() => applicationTransition(status, action), /transition/);
  assert.equal(
    "registration" in applicationTransition("submitted", "approve"),
    false,
  );
  assert.equal(
    "ranking" in applicationTransition("submitted", "approve"),
    false,
  );
});
test("next edition is a fresh application in the same series and leaves original dates/divisions intact", () => {
  const original = structuredClone(input);
  const next = nextEdition(input, "2028-11-08", "2028-11-10", ["new-men"]);
  assert.equal(next.seriesId, "prairie");
  assert.equal(next.startsOn, "2028-11-08");
  assert.equal(next.divisions[0].id, "new-men");
  next.divisions[0].name = "Changed";
  assert.deepEqual(input, original);
});
test("invalid dates, reversed dates, unsupported disciplines and unsafe text receive field errors", () => {
  assert.deepEqual(validateApplication({ ...input, newSeriesName: " " }), {
    newSeriesName: "Enter a new recurring series name (1–160 characters).",
  });
  assert.deepEqual(
    validateApplication({ ...input, newSeriesName: "Prairie Open" }),
    {},
  );
  assert.deepEqual(validateApplication({ ...input, endsOn: "2027-01-01" }), {
    endsOn: "End date must be on or after the start date.",
  });
  assert.deepEqual(
    validateApplication({ ...input, timezone: "Invented/Zone" }),
    { timezone: "Enter an IANA time zone, for example America/Regina." },
  );
  assert.deepEqual(
    validateApplication({
      ...input,
      divisions: [{ id: "one", name: "Mixed", discipline: "mixed_four" }],
    }),
    {
      "divisions.0":
        "Give each division a unique name and supported discipline.",
    },
  );
  assert.deepEqual(
    validateApplication({
      ...input,
      divisions: [
        input.divisions[0],
        { id: "two", name: " MEN ", discipline: "women_four" },
      ],
    }),
    {
      "divisions.1":
        "Give each division a unique name and supported discipline.",
    },
  );
  const errors = validateApplication({
    ...input,
    name: "Hidden\u0000control",
    venue: "x".repeat(161),
    startsOn: "2027-13-01",
    endsOn: "wrong",
  });
  assert.deepEqual(Object.keys(errors), [
    "name",
    "startsOn",
    "endsOn",
    "venue",
  ]);
  assert.equal(Object.keys(validateApplication(null)).length, 10);
  assert.deepEqual(
    validateApplication({
      ...input,
      divisions: [
        { id: "doubles", name: "Doubles", discipline: "mixed_doubles" },
      ],
    }),
    {},
  );
});
