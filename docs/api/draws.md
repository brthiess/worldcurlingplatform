# Persisted competition draws

Organizer/administrator `GET /api/v1/divisions/:id/draw` returns the authorized workspace, current saved graph, admitted candidate entries and immutable revision history. `POST` uses the current session and same-origin protection. Browser requests also send `X-WCP-Actor` to bind a retained command to the account that reviewed it.

Preview body: `requestId`, `expectedVersion`, `action: "preview"`, `seedEntryIds` in explicit seed order, `reason`, and optional `template`. Omitted template preserves the accepted single-knockout default. Supported exact template IDs:

- `application-single8-seeded-v1`: six or eight distinct admitted four-player entries, with the documented structural byes at six.
- `application-tko16-q8-233-v1`: exactly sixteen distinct admitted four-player entries; no byes; A/B/C qualification followed by fixed eight-team playoffs.

The plain-text reason is required. Duplicate trusted core teams cannot occupy two seeds; unresolved identities stay independent. Pending submissions are not admitted places. An unknown template or unsupported field is rejected; no template is inferred from a display name or partial roster.

Publication body: `requestId`, `expectedVersion`, `action: "publish"`, `reason`. It publishes the exact saved preview, rechecking current entry versions/admission/identity and authority. Existing games or a published graph cannot be replaced with this bounded command. Games begin with unknown schedule assignments; use the scheduler to assign actual sessions/sheets.

Exact actor/resource/request replays return the original response. A changed command under the same request identifier, stale version or changed division association returns409; unauthorized requests return401/403. Public reads never expose previews or private audit/request data.

`GET /api/v1/public/divisions/:id/draw` returns a published graph only for an admitted published edition. The response includes explicit seed/winner/loser sources, qualifier labels, terminal destinations, current actual game assignments/results, attention flags and current terminal records. A qualifier is distinct from final placement. C losers have qualification-stage elimination without invented unique ninth-to-sixteenth ranks. Playoff quarterfinal exits share fifth, semifinal exits share third, final winner/loser are first/second. These follow the adopted application profile in `docs/draws.md`.

Scoring confirmations/corrections use the existing assigned-game scoring endpoint. Winner/loser assignments and immutable terminal records commit in the same transaction as the confirmed result and audit. Correcting an upstream game updates only unstarted assignments; already-started/confirmed downstream participants/results remain actual evidence and receive organizer attention. The terminal projection follows the latest result version for its source game while old immutable records remain retained. This ticket adds no played-game repair or unrestricted bracket editor.
