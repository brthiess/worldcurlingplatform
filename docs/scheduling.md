# Draw scheduling

Open `/admin/schedule` as a current event organizer or global administrator. Select the edition; `?event=<edition-id>` opens it directly. The page creates/revises sessions and moves existing games between sessions in their own division. Each accepted edit records a reason, actor, before/after snapshot, schedule version and immutable retry receipt. Current grants are checked again on retries. Scorekeeper/reviewer access does not permit scheduling.

Enter the **venue** wall time and its explicit UTC offset (`-06:00`, `+05:45`, etc.). The server validates the offset against the edition's IANA timezone on that date. A nonexistent daylight-saving hour is rejected; a repeated hour requires the intended offset. Browser/host timezone is never used for conversion. Edits use minute precision, while prior timestamp evidence remains in revision snapshots. Duration is 15–1440 elapsed minutes; existing sessions start with an explicit 120-minute default that organizers can revise. Sessions can remain empty.

Conflicts are advisory and remain visible after saving: overlapping planned sheet assignments, the same entry, or known non-coach players across any divisions in this edition. Intervals include their start and exclude their end. All declared/defaulted candidates, including five rotating regulars and alternates, count as scheduling evidence. They do not prove stone delivery. Incomplete/unresolved lineups are labelled and absence of a known conflict is not complete availability verification. Game-specific referenced lineup versions take precedence over later event-roster changes. Other editions/venues and inferred identity matches are outside this check.

Public scores and the expanded draw schedule use the same persisted assignments and explicit venue timezone. Previous/next controls follow chronological sessions and retain selected draw during polling. Actual game evidence determines draw state: all confirmed games means completed; any live/confirmed with unfinished games means active; empty/all scheduled means scheduled. The latest active planned start wins, otherwise the latest completed draw, otherwise the earliest scheduled draw. Next is the earliest scheduled session, including overdue sessions. Passing a start/end time never marks a game played. Rescheduling preserves score/source versions, actual participants, frozen results/lineups and downstream assignment-attention records.

## HTTP contract

`GET /api/v1/events/:id/schedule` requires current organizer/global administrator authority and returns scoped edition/divisions, sessions, assignments, known conflicts/coverage and revision history. No anonymous schedule-management data is exposed. Public fan reads remain under `/api/v1/public/events/:id?division=:divisionId` and `/api/v1/public/games/:id`.

`POST /api/v1/events/:id/schedule` requires the same authority and matching configured application Origin. Both actions accept `requestId` (1–100 letters/digits/hyphens), `expectedVersion` (the edition's schedule version), and a nonblank `reason` of at most500 characters:

```json
{
  "requestId": "unique-client-request",
  "expectedVersion": 0,
  "reason": "Evening ice booking confirmed",
  "action": "session",
  "session": {
    "id": "stable-session-id",
    "divisionId": "prairie-men",
    "number": 5,
    "localStart": "2026-11-09T18:15",
    "utcOffset": "-06:00",
    "durationMinutes": 135
  }
}
```

```json
{
  "requestId": "another-client-request",
  "expectedVersion": 1,
  "reason": "Assign existing game to booked ice",
  "action": "assign",
  "gameId": "existing-game-id",
  "drawId": "stable-session-id",
  "sheet": "C"
}
```

Responses identify the accepted schedule version and projection. Identical retries return the exact original response; altered request reuse/stale versions return409, malformed/timezone input400, missing session401, unrelated authority/division403. A failed or lost response is unconfirmed; retry the unchanged request. The UI freezes new edits until that receipt is recovered. A409 requires reload before editing. Schedule revisions are serialized on the edition and hold current game/entry records while accepting changes. A failed audit rolls back the entire edit.

The migration is `0019_wcp018_schedule_revisions.sql`. Format generation and schedule optimization are separate work; the form operates existing games only. Acceptance evidence and limits are in [WCP-018 verification](verification/WCP-018.md).
