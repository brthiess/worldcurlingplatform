# Frontend specification

Added 2026-11-07 following the user's quality refinement. The offer includes a functioning public website and usable role-specific administration connected to PostgreSQL-backed APIs. This is part of delivery scope, not a separate visual prototype. Smaller interaction choices below are implementation defaults under the user's instruction to keep the offer simple.

The accepted post-audit P-01 through P-05 decisions in the canonical spec bound this page map: a 16-team four-player triple-knockout main demonstration; men's/women's four-player and mixed doubles; one documented configuration per other accepted format family; and the four minimal analytics views. Additional disciplines, age-specific variants, unusual combinations and extra metric examples are deferred. Seven workflows remain the acceptance structure; implementation has not started.

## Reference synthesis

| Reference | Retain |
|---|---|
| [CurlingZone scoreboard](https://home.curlingzone.com/) | Cross-event discovery, direct score/team/standings access, meaningful game states, and dated ranking previews. |
| [CurlingZone event scores](https://home.curlingzone.com/event.php?eventid=9513&view=Scores) | Draw navigation, sheet/time/phase context, game permalinks, and links between scores, schedule, teams, and playoffs. |
| [CurlingZone rankings](https://home.curlingzone.com/rankings.php?oomid=81) and [team contribution view](https://home.curlingzone.com/team.php?profileid=37258&teamid=1005141&view=OOM) | Discipline/date/season filtering, movement and points, roster links, and explanations of contributing events/carryover. |
| [House of Curling](https://thehouseofcurling.com/site-slams/) and the user's attached scorecard image | Compact expandable event cards, current/latest draw with next-draw preview, and rapid access to deeper event content. |
| [House of Curling team history](https://thehouseofcurling.com/site-slams/#/team/M/bruce-mouat) and [statistics](https://thehouseofcurling.com/site-slams/#/winprob/M) | Connected history, comparable situations, visible sample counts, filters, and data-coverage explanations. |

These are observed information/behavior patterns, not a requirement to reproduce another site's visual identity, source code, copy, assets, or team-identity assumptions. The CurlingZone review covered four fetched pages; its mobile rendering and interactive controls were not tested. House browser observations and limits are in `analytics-reference.md`.

## Public page map

| Page | Required experience |
|---|---|
| Home / live scores | Current events first; current/latest draw and line scores directly on the homepage; next draw; filters and expandable cards; direct routes to bracket/standings, teams, event, and game. |
| Events | Searchable calendar/archive filtered by date, discipline, location, and status; clear upcoming/live/completed editions. |
| Event | Scores, schedule, teams, results, and event information; show standings/bracket views appropriate to the configured format. Hybrids can expose both. |
| Game | Stable permalink with participants, event/division/phase, sheet/time, line score, known hammer, result state, and lineup differences where available. |
| Team | Core roster and season/alternate context, event results, game history, and approved WCTRS points/contributions/history. Respect core-composition identity; no deferred lineage feature. |
| Player | Approved photo, name, biography, handedness and known public sport information; associated teams/events and supported career history. Do not invent missing biography or participation. |
| Rankings | Approved WCTRS list, discipline/series/date/season selection, rank movement, points, team/player links, contribution breakdown, and historical publication selection. |
| Analytics | Four views: win/loss records and titles; approved rank/points history and contributions; blank/steal rates; historical win rates by end/margin/hammer. Use real results, sample sizes and unknown-data exclusions; no predictions or hypothetical post-concession situations. |
| News | Linked items from approved external sources: headline, publisher, date, and supplied excerpt. No generated news filler or article-authoring interface. |
| Search/favorites | Search across events, teams, and players; browser-saved favorites without compulsory login. Preserve relevant date/division context in drill-down links. |

Global navigation should expose Scores, Events, Rankings, Teams & Players, Analytics, and News, plus search and sign-in. A visible item leads to completed content; omit unsupported tabs/actions instead of displaying empty reports or placeholder buttons.

## Homepage scorecard behavior

1. Event header: name, location, dates, status, and explicit division/category labels. Multiple divisions may share a draw view, with filtering that makes its scope clear.
2. Default to the active draw. Between draws, retain the latest completed draw until the next starts. If none has been played, show the next scheduled draw. Older draws remain accessible through previous/next selection and schedule navigation.
3. Each game identifies sheet, participants, known hammer, end scores, total, and provisional/confirmed state. Team names open the correct team/entry context; the game has its own link.
4. Show the next scheduled draw and start time beneath the current results. A countdown may be included when based on an actual scheduled instant; it never substitutes for the scheduled time.
5. Provide direct Scores, Standings/Bracket, Teams, and Event access. Keep the hierarchy consistent across homepage cards and event pages.
6. Refresh scores without resetting expanded cards, selected draw, filters, scroll, or keyboard focus. Display last successful update and an honest stale/connection state.
7. Use venue-local times with an explicit timezone label as the initial default. Do not mix browser-local and venue-local times silently.

Played zero, unknown, upcoming, and unplayed/conceded ends are distinct. A future fixture does not have a zero score; a scheduled start passing does not by itself mean the game is live. Source/result state determines labels. Show TBD/source-slot descriptions until opponents are resolved.

## Brackets and history

Triple knockout exposes A/B/C paths, winner/loser connections, qualifiers, and eliminated entries from the stored draw. Selecting a team highlights its games/path and next known assignment. Provide a usable mobile pan/zoom view and a readable game-list alternative, with keyboard-accessible game links.

Organizer edits and scorekeeper corrections refresh current public views while preserving recorded history. Team/player/game/event links use stable identities and appropriate context, not names as identifiers. Ranking pages distinguish effective date from publication time and imported observations from calculated publications. Display meaningful precision rather than rounding small positive point values into misleading zeros.

## Administrative frontend

Use purpose-built task screens for the agreed roles: event applications/review, organizer entries/draw/schedule, assigned-game scoring, profile claim/photo submission, photo approval, ranking comparison/publication/audit, and partner scope/source administration. Seeded demo personas exercise actual permission checks and database commands.

Mobile scoring should put game identity, current end, score entry, save state, and final confirmation within easy reach. Corrections remain available with audit history. Player forms contain biography, handedness, and photo submission; claim/review state is explicit. Ranking approval shows actual changes and calculation explanations, not a manually editable total.

## Visual and content standard

- Scores-first sports publication: compact navigation and filters followed by useful event content. No oversized marketing hero, promotional slogans, generic feature tiles, or decorative KPI rows.
- Original, restrained design: clear sans-serif typography, tabular score figures, aligned score columns, consistent spacing, strong text contrast, and one coherent accent palette. Use the project-name wordmark until approved brand assets are supplied.
- Useful density without clutter: readable rows, concise labels, clear grouping, limited decorative effects. Event/task content precedes unrelated rankings or promotional material.
- Real content or honest states: approved source data, clearly separated demo scenarios, and short loading/empty/error messages. No invented live scores, player biographies, testimonials, statistics, AI portraits, or filler paragraphs.
- Status is communicated by text and accessible meaning as well as color. Controls have visible focus, usable labels, and sensible touch targets. Line-score headers/participants remain understandable on narrow screens.
- Charts answer a specified curling question and expose their filters/units/sample. Missing measurements and sparse samples remain visible; historical frequencies are not presented as validated live predictions.

## Functional acceptance

| Check | Required evidence |
|---|---|
| Data connection | Public pages read the application's APIs; a scorekeeper's saved database change appears in the public view within the configured refresh target. Hardcoded fixtures are confined to labelled seed scenarios. |
| Full navigation | Homepage -> event/game -> team/player -> ranking contribution works; browser back preserves useful selection context. Every displayed button/tab/filter has a working behavior. |
| Competition | Triple-knockout highlighting and current slots match the canonical draw. A result confirmation advances it, and an organizer correction is reflected consistently. |
| Profile | Account creation, staff-approved profile link, biography/handedness changes, private photo submission, approval, and public-photo replacement work end to end. |
| Rankings | Only approved publications appear by default. Date/list selection, comparisons, event contributions, and publication history use recorded data. |
| Responsive/accessibility | Check representative 360px, tablet, and desktop views; keyboard navigation, score-table readability, bracket/list access, and touch controls. No clipped primary actions or unreadable score cells. |
| State handling | Exercise loading, no games, unknown opponent, missing ends, lost connection, denied write, and failed request. Retain last good scores with a stale indicator where appropriate. |
| Review quality | Browser-check the seven workflows, fix material console/network errors, inspect screenshots at the chosen widths, and record the implemented flow. A successful build alone does not establish frontend completion. |

All acceptance items are planned, not executed. Exact layout tokens, chart library, and component internals remain implementation choices. Reference sites inform the product's strengths; the agreed domain model and backend remain authoritative.
