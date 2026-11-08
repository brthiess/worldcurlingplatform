import { test } from "node:test";
import assert from "node:assert/strict";
import { selectDraws, scoreCell } from "../src/domain/scores.js";
import { permitted } from "../src/domain/permissions.js";

test("active draw takes precedence and next remains scheduled", () => {
  assert.deepEqual(
    selectDraws([
      { id: "d3", startsAt: "2026-11-08T20:00:00Z", state: "scheduled" },
      { id: "d1", startsAt: "2026-11-08T10:00:00Z", state: "completed" },
      { id: "d2", startsAt: "2026-11-08T15:00:00Z", state: "live" },
    ]),
    { selected: "d2", next: "d3", label: "Current draw" },
  );
});
test("the most recent active draw wins when games overlap", () => {
  assert.equal(
    selectDraws([
      { id: "early", startsAt: "2026-11-08T10:00:00Z", state: "live" },
      { id: "recent", startsAt: "2026-11-08T15:00:00Z", state: "live" },
    ]).selected,
    "recent",
  );
});

test("between draws retains completed results; future and empty are honest", () => {
  assert.deepEqual(
    selectDraws([
      { id: "old", startsAt: "2026-11-08T10:00:00Z", state: "completed" },
      { id: "future", startsAt: "2026-11-09T10:00:00Z", state: "scheduled" },
    ]),
    { selected: "old", next: "future", label: "Latest draw" },
  );
  assert.deepEqual(
    selectDraws([
      { id: "future", startsAt: "2020-01-01T10:00:00Z", state: "scheduled" },
    ]),
    { selected: "future", next: "future", label: "Next draw" },
  );
  assert.deepEqual(selectDraws([]), {
    selected: null,
    next: null,
    label: "Next draw",
  });
});

test("played zero differs from unknown, upcoming and unplayed", () => {
  assert.deepEqual(
    ["played", "unknown", "upcoming", "unplayed"].map((state) =>
      scoreCell({ state, points: state === "played" ? 0 : null }),
    ),
    [
      { text: "0", label: "0 points" },
      { text: "?", label: "Score unknown" },
      { text: "·", label: "Upcoming end" },
      { text: "—", label: "End not played" },
    ],
  );
});

test("roles authorize only their event/game; reviewer and ungranted users cannot write", () => {
  const game = { eventId: "event-a", gameId: "game-a" };
  assert.equal(
    permitted(
      [{ role: "administrator", eventId: null, gameId: null }],
      "manage",
      game,
    ),
    true,
  );
  assert.equal(
    permitted(
      [{ role: "organizer", eventId: "event-a", gameId: null }],
      "manage",
      game,
    ),
    true,
  );
  assert.equal(
    permitted(
      [{ role: "organizer", eventId: "other", gameId: null }],
      "manage",
      game,
    ),
    false,
  );
  assert.equal(
    permitted(
      [{ role: "scorekeeper", eventId: "event-a", gameId: "game-a" }],
      "score",
      game,
    ),
    true,
  );
  assert.equal(
    permitted(
      [{ role: "scorekeeper", eventId: "event-a", gameId: "other" }],
      "score",
      game,
    ),
    false,
  );
  assert.equal(
    permitted(
      [{ role: "scorekeeper", eventId: "event-a", gameId: "game-a" }],
      "manage",
      game,
    ),
    false,
  );
  assert.equal(
    permitted(
      [{ role: "reviewer", eventId: "event-a", gameId: null }],
      "read",
      game,
    ),
    true,
  );
  assert.equal(
    permitted(
      [{ role: "reviewer", eventId: "event-a", gameId: null }],
      "score",
      game,
    ),
    false,
  );
  assert.equal(permitted([], "read", game), false);
});
