# Live four-player scoring

The browser editor at `/admin/games/<game-id>` and the HTTP adapter use the same `saveScoring` application command. This slice supports explicit start, live end entry/correction and end-specific known hammer. Confirmation, confirmed-result correction, advancement and partner credentials belong to later tickets.

`GET /api/v1/games/<game-id>/scoring` requires a real session with scoring authority for that resource. It returns accepted version, participants, ends, end-specific hammer, current hammer end and attributed before/after history. Public projections omit command receipts and audit payloads.

`POST` to the same path requires the session and the configured same-origin `Origin` header. Start a scheduled game with both opponents assigned:

```json
{"requestId":"start-review-game","expectedVersion":0,"action":"start","hammer":"a"}
```

Save or correct one live end, using the last accepted version:

```json
{"requestId":"save-end-one","expectedVersion":1,"action":"end","endNumber":1,"end":{"state":"played","a":0,"b":2},"hammer":"b"}
```

Hammer describes the **selected end**, including end one for start. Use `null` when unknown. Correcting another end preserves the remaining end facts. Current public hammer is shown only when explicitly recorded for the current end (the end after the latest played/unknown end); no hammer progression is inferred. Public game details expose recorded per-end hammer.

Played points are whole numbers from 0 to 8; at most one side is positive. Played `0–0` is a blank. `unknown`, `upcoming` and `unplayed` require both points to be `null`; unknown ends make totals unknown. End numbers are 1–20 and remain in their actual columns even when entered out of order.

The labelled end selector offers all 20 supported ends, including further ends beyond the initial eight columns. Recording a played/unknown later end makes any intervening unrecorded/upcoming ends **unknown**, with null points and unknown live totals. It does not fabricate zeros or continue calling elapsed ends upcoming. A prior explicitly unplayed end must be corrected before recording a later actual end; an earlier end cannot become upcoming/unplayed while a later actual end exists. These inconsistent commands return 409 without applying changes.

Successful commands return `{"requestId":"…","version":2}`. Retry the **same identifier and entire command** after an uncertain response. A committed duplicate returns its original receipt without changing scores, version or history. A conflicting reused identifier or stale version returns 409. Invalid input returns 400, missing session 401, current scope/origin denial 403, and an unconfirmed server/database failure 503. Manual writes also require the current `manual` scoring source. Both current grants and source are checked while the game is locked.

The transaction commits scores, end hammer, totals, version, before/after audit and the receipt together. A receipt references its audit record. The public projection reads a consistent PostgreSQL snapshot. The editor keeps an unfinished draft and exact pending command in session storage scoped to actor/game, blocks conflicting edits while a request is uncertain, and offers an explicit identical retry. A stale edit must load the accepted version for comparison before resubmission. It does not promise offline synchronization or recovery after the browser tab/storage is lost.
