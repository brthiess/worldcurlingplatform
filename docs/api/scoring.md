# Live four-player scoring

The browser editor at `/admin/games/<game-id>` and the HTTP adapter use the same `saveScoring` application command. This slice supports explicit start, live end entry/correction, end-specific known hammer, game lineup differences, result confirmation and ordinary corrections. Draw advancement and partner credentials belong to later tickets.

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

## Results and game lineups (WCP-003)

The same assigned scorekeeper can confirm and subsequently correct the game. No administrator or second approver is required. Each command still supplies `requestId`, `expectedVersion` and `hammer:null`; current authority/source is rechecked before replay as well as writes. A confirmation uses the accepted live ends, never client-supplied replacement ends:

```json
{"requestId":"confirm-game","expectedVersion":9,"action":"confirm","hammer":null,"outcome":"normal","winnerEntryId":"entry-1","reason":""}
```

The implemented four-player profile uses eight regulation ends and supports further ends through twenty. A normal completion needs at least eight played ends, no unknown scores, a decisive total, and a winner matching that total. An early stop is `conceded`: preserve the played/unknown scores, record the participating winner and a reason without inferring that winner from a partial total. `forfeit` also needs a reason and participating winner, can confirm a scheduled game, and leaves final score totals unknown rather than inventing penalty points. Future ends become `unplayed`. A concession/forfeit does not invent stones or future scores. Mixed doubles and measurements remain outside this ticket.

Corrections include the entire corrected line score, outcome, same participating identities, winner and reason. Optional `endHammer:["a",null,...]` records known/unknown hammer for each supplied corrected end; omitting it preserves accepted end-scoped facts. Immutable result versions also freeze their hammer evidence. Missing trailing columns become unplayed. The confirmed result's original participant identities cannot be silently changed. Live `end` writes remain closed after confirmation:

```json
{"requestId":"correct-game","expectedVersion":10,"action":"correct","hammer":null,"outcome":"conceded","winnerEntryId":"entry-3","reason":"North conceded; winner initially reversed","ends":[{"state":"played","a":2,"b":0}]}
```

`game_result_version` preserves every confirmed/corrected version, actor, public attribution name, time, exact result/line score/hammer, participant IDs/names and lineup evidence with an atomic audit reference. Update/delete triggers protect immutable versions. Authorized scoring reads return `results` newest first and the audit history. Public game/event reads return public result versions, names/time/reasons and evidence, omitting actor IDs, request IDs, command receipts and audit payloads. The first correction of a legacy confirmed game also freezes its original unversioned score/ends as `legacyBefore`, with missing original winner/confirmation/lineup reference explicitly unknown; no attribution or later roster is fabricated.

On explicit start (or first confirmation/difference for a preexisting live game), defaults use the shared `readEventLineup` boundary. Each frozen game lineup references entry ID plus the event lineup version. Missing/legacy version zero remains `eventLineupVersion:null` and an empty unknown roster. Later event edits do not rewrite that game. Default members are `participation:defaulted`. No unchanged-lineup confirmation is required.

Before confirmation, record a game-only difference with `action:lineup`, `side:a|b`, and `members:[{playerId,position}]`. Allow up to five distinct existing players, including incomplete/unknown evidence as an empty list. These records use `mode:difference` and `participation:declared`. A result correction optionally includes `lineups:{a:[...],b:[...]}` in the same command; omitted sides preserve their accepted game lineup. This never changes team core, season registration or event lineup. Neither defaulted nor declared evidence independently proves which players delivered stones. New lineup revisions link to the same command's audit via a deferred FK; prior experimental revisions remain unchanged by the additive audit migration.

For the minimal downstream safeguard, `game_assignment_dependency(upstream_game_id,downstream_game_id,side,route)` is the stored-route seam for later draw work. A changed winner records an immutable `game_assignment_attention` when a direct winner/loser assignment differs, including actual/expected entry and downstream state. The correction succeeds, and actual downstream participants/results stay unchanged. Scorer/public game views display organizer attention. This ticket does not advance or repair draws, clear attention, infer routes from slot text, or build a downstream continuation policy.
