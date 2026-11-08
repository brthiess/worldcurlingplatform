import { test } from "node:test";
import assert from "node:assert/strict";
import {
  venueInstant,
  venueFields,
  scheduleConflicts,
  drawEvidenceState,
} from "../src/domain/scheduling";
import { selectDraws } from "../src/domain/scores";

test("venue wall time requires the explicit matching offset, independent of host timezone", () => {
  assert.equal(
    venueInstant("2026-11-08T17:00", "America/Regina", "-06:00"),
    "2026-11-08T23:00:00.000Z",
  );
  assert.equal(
    venueInstant("2026-01-01T00:15", "Asia/Kathmandu", "+05:45"),
    "2025-12-31T18:30:00.000Z",
  );
  assert.throws(
    () => venueInstant("2026-11-08T17:00", "America/Regina", "-07:00"),
    /offset/,
  );
});

test("stored seconds and milliseconds never change the venue UTC offset when editing at minute precision", () => {
  for (const instant of [
    "2026-11-08T23:00:00.000Z",
    "2026-11-08T23:00:30.000Z",
    "2026-11-08T23:00:45.000Z",
    "2026-11-08T23:00:59.999Z",
  ])
    assert.deepEqual(venueFields(instant, "America/Regina"), {
      local: "2026-11-08T17:00",
      offset: "-06:00",
    });
  assert.deepEqual(venueFields("2026-01-01T00:00:59.999Z", "Asia/Kathmandu"), {
    local: "2026-01-01T05:45",
    offset: "+05:45",
  });
});

test("draw status follows actual games and never the clock; latest and next use chronological order", () => {
  assert.equal(drawEvidenceState([]), "scheduled");
  assert.equal(drawEvidenceState(["scheduled"]), "scheduled");
  assert.equal(drawEvidenceState(["confirmed", "scheduled"]), "live");
  assert.equal(drawEvidenceState(["confirmed", "confirmed"]), "completed");
  assert.equal(drawEvidenceState(["live", "confirmed"]), "live");
  assert.deepEqual(
    selectDraws([
      { id: "completed", startsAt: "2026-11-01T08:30:00Z", state: "completed" },
      {
        id: "future-actual-play",
        startsAt: "2040-01-01T12:00:00Z",
        state: drawEvidenceState(["live"]),
      },
      {
        id: "past-never-started",
        startsAt: "2000-01-01T12:00:00Z",
        state: drawEvidenceState(["scheduled"]),
      },
    ]),
    {
      selected: "future-actual-play",
      next: "past-never-started",
      label: "Current draw",
    },
  );
  assert.deepEqual(
    selectDraws([
      { id: "later", startsAt: "2026-11-01T08:30:00Z", state: "completed" },
      {
        id: "scheduled-past",
        startsAt: "2020-01-01T10:00:00Z",
        state: "scheduled",
      },
      { id: "earlier", startsAt: "2026-11-01T07:30:00Z", state: "completed" },
    ]),
    { selected: "later", next: "scheduled-past", label: "Latest draw" },
  );
});

test("DST folds require an explicit occurrence, gaps and impossible calendar dates are rejected", () => {
  assert.equal(
    venueInstant("2026-11-01T01:30", "America/Edmonton", "-06:00"),
    "2026-11-01T07:30:00.000Z",
  );
  assert.equal(
    venueInstant("2026-11-01T01:30", "America/Edmonton", "-07:00"),
    "2026-11-01T08:30:00.000Z",
  );
  for (const [date, offset] of [
    ["2026-03-08T02:30", "-07:00"],
    ["2026-02-30T10:00", "-07:00"],
    ["2026-11-01T01:30", "+14:30"],
  ])
    assert.throws(() => venueInstant(date, "America/Edmonton", offset));
  assert.throws(() =>
    venueInstant("2026-11-08T17:00", "Invalid/Zone", "-06:00"),
  );
});

test("draw ordering compares instants across offsets, with stable identity for simultaneous sessions", () => {
  assert.deepEqual(
    selectDraws([
      {
        id: "local-five",
        startsAt: "2026-11-01T10:00:00+05:00",
        state: "completed",
      },
      { id: "utc-six", startsAt: "2026-11-01T06:00:00Z", state: "completed" },
    ]),
    { selected: "utc-six", next: null, label: "Latest draw" },
  );
  assert.equal(
    selectDraws([
      { id: "z", startsAt: "2026-11-01T06:00:00Z", state: "scheduled" },
      { id: "a", startsAt: "2026-11-01T01:00:00-05:00", state: "scheduled" },
    ]).selected,
    "a",
  );
});

test("half-open availability catches sheets, entries and declared rotating players across divisions without assuming coaches play", () => {
  const games = [
    {
      id: "a",
      startsAt: "2026-11-08T18:00:00Z",
      durationMinutes: 120,
      sheet: "A",
      entries: ["entry-a"],
      players: ["rotating-five", "p2"],
    },
    {
      id: "b",
      startsAt: "2026-11-08T19:59:00Z",
      durationMinutes: 90,
      sheet: " a ",
      entries: ["entry-a"],
      players: ["rotating-five"],
    },
    {
      id: "c",
      startsAt: "2026-11-08T20:00:00Z",
      durationMinutes: 60,
      sheet: "B",
      entries: ["different"],
      players: ["p2"],
    },
  ];
  assert.deepEqual(scheduleConflicts(games), [
    { gameIds: ["a", "b"], kind: "sheet", resource: "A" },
    { gameIds: ["a", "b"], kind: "entry", resource: "entry-a" },
    { gameIds: ["a", "b"], kind: "player", resource: "rotating-five" },
  ]);
});
