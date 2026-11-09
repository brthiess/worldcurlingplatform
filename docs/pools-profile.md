# Two pools of four

`application-pools2x4-v1`, version 1, is the supported bounded round-robin configuration. It is an application choice adopted by the coordinator on 2026-11-09 UTC from the independent format research referenced in `docs/agents/research-index.md`. No governing body is claimed to endorse these seed assignments, pairings or display order.

Eight distinct admitted entries are explicitly seeded. Pool A contains seeds **1, 4, 5, 8**; pool B contains **2, 3, 6, 7**, in that pool-local order. Every team plays each other team in its pool once: three rounds, six games per pool, twelve actual games. There are no byes or cross-pool games.

| Round | Pool-local pairings | Pool A seed pairings | Pool B seed pairings |
| --- | --- | --- | --- |
| 1 | 1 vs 4; 2 vs 3 | 1 vs 8; 4 vs 5 | 2 vs 7; 3 vs 6 |
| 2 | 1 vs 3; 4 vs 2 | 1 vs 5; 8 vs 4 | 2 vs 6; 7 vs 3 |
| 3 | 1 vs 2; 3 vs 4 | 1 vs 4; 5 vs 8 | 2 vs 3; 6 vs 7 |

Configured registration must use family `round_robin`. Capacity is a ceiling: eight accepted entries under capacity sixteen are valid. The complete current admitted field must match the eight seeds at preview and publication. Pending, held, invited, expired and waitlisted registrations are excluded. Two entry records for the same known team cannot take different seeds. Unresolved identities are not inferred from matching names.

The organizer chooses the profile in **Draw preparation**, assigns eight seeds, saves a preview, reviews both pool sections, and publishes with a reason. Seed snapshots, groups, game identifiers and revision history persist. Publication creates all required games without inventing dates, sheets, scores or results; use **Draw scheduling** to assign sessions. An interrupted command can be retried with its original request after reload. Current authority and edition association are checked before an exact receipt can replay; freshness is checked for new commands.

Public event/game links open **Pools and standings**. Pool tabs support arrow keys, Home and End. The `pool=A` or `pool=B` URL parameter survives refresh, polling and browser back. The public draw API `/api/v1/public/divisions/{id}/draw` returns the frozen group/fixture definition, current game facts and pool-scoped standings. The separate labelled seeded example is `/events/pools-2026/bracket?division=pools-eight&pool=A`.

Standings count each confirmed result once. Unfinished and unresolved outcomes remain pending; missing scores never become played zeroes or ties. Current four-player scoring confirms a decisive winner and does not accept drawn games, so its drawn-game count is zero. Equal win/loss/tie records remain visibly tied. Rows display wins descending, drawn games descending, losses ascending, then initial seed solely to stabilize display. This display order is **not a qualification tiebreak**. Corrections update current records while retaining actual participants, result history and the frozen published graph.

This profile creates no playoff qualifiers, cross-pool ranking, championship stage or champion. Any later qualifiers and playoff seeds require a separate explicit manual selection workflow; WCP-025 owns that future combination. An assessment can recognize this exact ID/version/family as non-single-knockout, but recognition does not supply final placements or waive finalization, stage, eligibility, roster or participation evidence. Required unfinished games remain finalization prerequisites even without scheduled sessions.

Actual acceptance evidence and known limitations are in `docs/verification/WCP-022.md`.
