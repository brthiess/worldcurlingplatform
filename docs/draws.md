# Single-knockout profile

WCP-019 adopts `application-single8-seeded-v1`, template version 1. This is an application profile, not a claim of official competition regulations. It supports men's/women's four-player divisions, with six or eight explicitly selected entries in seed order and no bronze game. The main 16-team triple-knockout demonstration is unchanged.

Every known core team may occupy only one seed, even when represented by two distinct entry records. Preview and publication both check current trusted team IDs. Distinct entries with unresolved/null team identity remain allowed; equal display names or overlapping partial rosters never cause an inferred merge.

Eight entries: Q1=1/8, Q2=4/5, Q3=2/7, Q4=3/6; S1=WQ1/WQ2, S2=WQ3/WQ4; F=WS1/WS2. Seven actual games. Six entries: omit Q1/Q3; seed 1 enters S1 and seed 2 enters S2 directly. Q2, Q4, S1, S2 and F are five actual games. These structural byes have provenance in the immutable graph and create no game, result, forfeit or win. The literal top-seed champion plays two games in the six-entry profile.

At `/admin/draws`, choose an authorized division and each seed, save a persistent preview, inspect the stored graph, then publish that exact reviewed revision. Publishing refuses changed entry versions and divisions with existing games. A published graph cannot be replaced by this bounded command. An ordinary new preview preserves prior previews. Future unrestricted graph editing, other families and qualification tiebreak rules are outside this slice.

The repeatable seed adds a separate fictional `single-knockout-2026` edition and `single-knockout-six` division, with six explicitly named review entries and organizer scope. It leaves the main Prairie Open scenario intact. Entry lineups remain honestly provisional until recorded through the entry workflow. A lineup's readiness is separate from selection into this field. `src/modules/entries/draw-field.ts` is the single trusted field projection for workspace/preview/publication: configured registration requires accepted admission, independently of submission origin. Pending, invited, held, expired and waitlisted entries are excluded. Unconfigured legacy organizer records and explicit subsets retain their accepted behavior. Existing actual game participants/results are never filtered away by a later field-eligibility change.

Configured registration adds two fresh-command checks at preview and publication: the operated family must match the immutable opened terms, and selection must equal the complete current accepted field. Publication reads the full current field under the edition lock, so a new accepted peer or admission-only change cannot bypass review merely because lineup versions stayed unchanged. Capacity is a ceiling, not field size: six/eight actual accepted entries under capacity16 are valid for this profile. Mismatched families or unsupported actual counts receive preparation errors; terms are not silently rewritten. Current authority/association checks precede exact historical receipt replay; fresh field checks follow it. `validateRegistrationDrawField` is the generic registration contract for later accepted engines, not an implementation of those engines.

`draw_template_version`, `draw_revision`, `draw_seed`, `draw_node` and `draw_slot` retain immutable template, graph, seed identity/version and slot-source evidence. Preview node IDs reserve stable game identities; games are created only at publication. Preview IDs intentionally have no game foreign key before publication. Published games have a required division independent of an optional draw session: `draw_id=NULL` and an empty sheet mean no schedule assignment. A trigger maintains same-division sessions/participants, including legacy inserts that derive division from an existing session. Public game and bracket views say time/sheet are not scheduled; no timestamp is inferred from event dates or the clock. Schedule the actual games through WCP-018.

Confirmed results resolve the persisted winner routes atomically with scoring audit/history. Scheduled downstream slots can change and increment their version. Started/confirmed games retain actual participants/results; a changed upstream winner creates immutable assignment attention. `draw_assignment_revision` ties each assignment/preservation to the precise result version and audit. Legacy WCP-003 dependencies retain their attention behavior. There is no administrator correction gate or downstream repair engine.

Finalization reads every recorded game by its stable `game.division_id`, including games without a draw session. An unfinished required game cannot disappear merely because it is unscheduled. Once every actual game has a confirmed outcome, unknown schedule times remain unknown in the frozen snapshot; they do not prevent sporting finalization or become invented dates.

Graph/scoring writers lock edition first, before division/game/entry rows, aligning with the schedule writer. Preview/publication commands recheck current organizer grants, version and actor-bound request replay inside the transaction. Public graph projections require public admission and a published draw and omit private preview reasons, actors and requests.

The division association is rechecked after the edition/division locks, before either a new command or an exact receipt replay. Draw saves retain the original serialized request in tab-local, actor-and-division-bound recovery storage until acknowledgement; reload preserves an uncertain request, and `X-WCP-Actor` prevents a changed account from sending it. The public last-successful-refresh label uses the explicit venue clock even when the browser is in a different timezone.

Private: `GET/POST /api/v1/divisions/:id/draw` (organizer/administrator). POST uses `requestId`, `expectedVersion`, `action` (`preview` with `seedEntryIds`, or `publish`) and a plain-text `reason`. Public: `GET /api/v1/public/divisions/:id/draw`. Public event pages link to `/events/:eventId/bracket?division=:divisionId`; `entry` and `view=list` retain selected-team/list context in the URL. Game links reach the existing scoring/result/lineup history views.

# Main 16-team triple-knockout profile

WCP-020 adopts the independently reviewed application profile below before implementation. Primary sources establish the 2 A / 3 B / 3 C family; exact routes, fixed playoff pairings and joint placements are application choices. This does not claim official event endorsement. Research and independent review pointers are in docs/agents/research-index.md.

## Selected exact template

Adopted identity: `application-tko16-q8-233-v1`. Exactly sixteen occupied seed slots, no byes, no play-ins, no withdrawals/walkovers in this fixture, no dynamic reseeding, no tiebreaking draw and no bracket reset. A bye must not be fabricated as a played game or count as a win/loss. This exact template rejects an incomplete field; WCP-019 can independently document its bounded single-knockout bye configuration.

Qualification stage has 33 games: A01-A14 (14), B01-B11 (11), C01-C08 (8). It creates eight distinct qualification records: QA1, QA2, QB1, QB2, QB3, QC1, QC2, QC3. These are qualification destinations, separate from final division placements. They feed the fixed eight-team single-knockout playoff stage P01-P07. Total division games including playoffs: 40.

`W:G` / `L:G` mean the confirmed winner / loser of named game G. A destination such as `B05.2` means slot 2 of B05. T01-T16 are fictional entries assigned seed numbers 1-16; they stand for four-player teams, not players. Game slots are stable identities. No route is inferred from current loss count; counts below validate the stored graph.

### Complete qualification graph: sources and both destinations

| Game | Slot 1 source | Slot 2 source | Winner destination | Loser destination |
|---|---|---|---|---|
| A01 | T01 | T16 | A09.1 | B01.1 |
| A02 | T08 | T09 | A09.2 | B01.2 |
| A03 | T04 | T13 | A10.1 | B02.1 |
| A04 | T05 | T12 | A10.2 | B02.2 |
| A05 | T02 | T15 | A11.1 | B03.1 |
| A06 | T07 | T10 | A11.2 | B03.2 |
| A07 | T03 | T14 | A12.1 | B04.1 |
| A08 | T06 | T11 | A12.2 | B04.2 |
| A09 | W:A01 | W:A02 | A13.1 | B06.2 |
| A10 | W:A03 | W:A04 | A13.2 | B05.2 |
| A11 | W:A05 | W:A06 | A14.1 | B08.2 |
| A12 | W:A07 | W:A08 | A14.2 | B07.2 |
| A13 | W:A09 | W:A10 | QA1 | B09.1 |
| A14 | W:A11 | W:A12 | QA2 | B10.1 |
| B01 | L:A01 | L:A02 | B05.1 | C01.1 |
| B02 | L:A03 | L:A04 | B06.1 | C01.2 |
| B03 | L:A05 | L:A06 | B07.1 | C02.1 |
| B04 | L:A07 | L:A08 | B08.1 | C02.2 |
| B05 | W:B01 | L:A10 | B10.2 | C04.2 |
| B06 | W:B02 | L:A09 | B11.1 | C05.1 |
| B07 | W:B03 | L:A12 | B09.2 | C03.2 |
| B08 | W:B04 | L:A11 | B11.2 | C05.2 |
| B09 | L:A13 | W:B07 | QB1 | C08.2 |
| B10 | L:A14 | W:B05 | QB2 | C06.2 |
| B11 | W:B06 | W:B08 | QB3 | C07.2 |
| C01 | L:B01 | L:B02 | C03.1 | ELIMINATED |
| C02 | L:B03 | L:B04 | C04.1 | ELIMINATED |
| C03 | W:C01 | L:B07 | C06.1 | ELIMINATED |
| C04 | W:C02 | L:B05 | C07.1 | ELIMINATED |
| C05 | L:B06 | L:B08 | C08.1 | ELIMINATED |
| C06 | W:C03 | L:B10 | QC1 | ELIMINATED |
| C07 | W:C04 | L:B11 | QC2 | ELIMINATED |
| C08 | W:C05 | L:B09 | QC3 | ELIMINATED |

### Complete playoff graph and qualifier destinations

These fixed pairings are application policy, not extracted from the source event. No re-ranking of qualifiers, random draw or rematch avoidance calculation occurs at runtime. A and B brackets end at qualification; qualification records remain visible after playoff losses.

| Game | Slot 1 source | Slot 2 source | Winner destination | Loser destination |
|---|---|---|---|---|
| P01 | QA1 | QC3 | P05.1 | playoff quarterfinal exit, joint 5th |
| P02 | QB1 | QB2 | P05.2 | playoff quarterfinal exit, joint 5th |
| P03 | QA2 | QC2 | P06.1 | playoff quarterfinal exit, joint 5th |
| P04 | QB3 | QC1 | P06.2 | playoff quarterfinal exit, joint 5th |
| P05 | W:P01 | W:P02 | P07.1 | playoff semifinal exit, joint 3rd |
| P06 | W:P03 | W:P04 | P07.2 | playoff semifinal exit, joint 3rd |
| P07 | W:P05 | W:P06 | champion, 1st | runner-up, 2nd |

There is no bronze game and no individual ranking within the four quarterfinal exits, two semifinal exits, or eight qualification-stage exits. The latter are recorded as qualification-stage eliminated, without inventing unique ninth-through-sixteenth placements. Joint final positions are an explicit application placement convention. Playoff losses immediately end championship participation regardless of the team's qualification-stage losses; this is a separate single-knockout stage. A champion may have two earlier losses. Do not keep applying the three-loss threshold in playoffs.

## Literal complete result fixture

The following literal teams, winners and losers were worked separately from any repository generator. Confirm results in a dependency-respecting order. The listed A-all, then B-all, then C-all order is topologically valid, not a proposed ice schedule. A practical schedule may interleave ready games, but must preserve dependencies and avoid simultaneous participation.

| Game | Actual slot 1 | Actual slot 2 | Confirmed winner | Confirmed loser |
|---|---|---|---|---|
| A01 | T01 | T16 | T01 | T16 |
| A02 | T08 | T09 | T08 | T09 |
| A03 | T04 | T13 | T04 | T13 |
| A04 | T05 | T12 | T05 | T12 |
| A05 | T02 | T15 | T02 | T15 |
| A06 | T07 | T10 | T07 | T10 |
| A07 | T03 | T14 | T03 | T14 |
| A08 | T06 | T11 | T06 | T11 |
| A09 | T01 | T08 | T01 | T08 |
| A10 | T04 | T05 | T04 | T05 |
| A11 | T02 | T07 | T02 | T07 |
| A12 | T03 | T06 | T03 | T06 |
| A13 | T01 | T04 | T01 | T04 |
| A14 | T02 | T03 | T02 | T03 |
| B01 | T16 | T09 | T16 | T09 |
| B02 | T13 | T12 | T13 | T12 |
| B03 | T15 | T10 | T15 | T10 |
| B04 | T14 | T11 | T14 | T11 |
| B05 | T16 | T05 | T05 | T16 |
| B06 | T13 | T08 | T08 | T13 |
| B07 | T15 | T06 | T06 | T15 |
| B08 | T14 | T07 | T07 | T14 |
| B09 | T04 | T06 | T04 | T06 |
| B10 | T03 | T05 | T03 | T05 |
| B11 | T08 | T07 | T08 | T07 |
| C01 | T09 | T12 | T09 | T12 |
| C02 | T10 | T11 | T10 | T11 |
| C03 | T09 | T15 | T09 | T15 |
| C04 | T10 | T16 | T16 | T10 |
| C05 | T13 | T14 | T13 | T14 |
| C06 | T09 | T05 | T05 | T09 |
| C07 | T16 | T07 | T16 | T07 |
| C08 | T13 | T06 | T13 | T06 |
| P01 | T01 | T13 | T01 | T13 |
| P02 | T04 | T03 | T03 | T04 |
| P03 | T02 | T16 | T16 | T02 |
| P04 | T08 | T05 | T05 | T08 |
| P05 | T01 | T03 | T01 | T03 |
| P06 | T16 | T05 | T16 | T05 |
| P07 | T01 | T16 | T16 | T01 |

### Independently expected qualification paths and terminal states

Here W/L is the result in that named game; records exclude playoffs.

| Team | Full qualification path | Record | Qualification-stage terminal state |
|---|---|---|---|
| T01 | A01 W, A09 W, A13 W | 3-0 | QA1 -> P01.1 |
| T02 | A05 W, A11 W, A14 W | 3-0 | QA2 -> P03.1 |
| T03 | A07 W, A12 W, A14 L, B10 W | 3-1 | QB2 -> P02.2 |
| T04 | A03 W, A10 W, A13 L, B09 W | 3-1 | QB1 -> P02.1 |
| T05 | A04 W, A10 L, B05 W, B10 L, C06 W | 3-2 | QC1 -> P04.2 |
| T06 | A08 W, A12 L, B07 W, B09 L, C08 L | 2-3 | eliminated at C08 |
| T07 | A06 W, A11 L, B08 W, B11 L, C07 L | 2-3 | eliminated at C07 |
| T08 | A02 W, A09 L, B06 W, B11 W | 3-1 | QB3 -> P04.1 |
| T09 | A02 L, B01 L, C01 W, C03 W, C06 L | 2-3 | eliminated at C06 |
| T10 | A06 L, B03 L, C02 W, C04 L | 1-3 | eliminated at C04 |
| T11 | A08 L, B04 L, C02 L | 0-3 | eliminated at C02 |
| T12 | A04 L, B02 L, C01 L | 0-3 | eliminated at C01 |
| T13 | A03 L, B02 W, B06 L, C05 W, C08 W | 3-2 | QC3 -> P01.2 |
| T14 | A07 L, B04 W, B08 L, C05 L | 1-3 | eliminated at C05 |
| T15 | A05 L, B03 W, B07 L, C03 L | 1-3 | eliminated at C03 |
| T16 | A01 L, B01 W, B05 L, C04 W, C07 W | 3-2 | QC2 -> P03.2 |

Expected playoff placements: T16 first (overall 6-2), T01 second (5-1), T03 and T05 joint third, T02/T04/T08/T13 joint fifth. This deliberately includes T16 starting with an A loss, winning in B, losing into C, qualifying through C, then winning the championship.

Small additional literal qualification fixture for a different C-entry branch: retain all qualification results above except B09 becomes T06 defeats T04, and C08 becomes T04 defeats T13 (actual slots T13/T04). Expected qualifiers then QA1=T01, QA2=T02, QB1=T06, QB2=T03, QB3=T08, QC1=T05, QC2=T16, QC3=T04. T04's path is A03 W, A10 W, A13 L, B09 L, C08 W (3-2); T13 exits C08 at 2-3. Recompute playoff participants if this alternate fixture is used; do not reuse the primary playoff result rows unchanged.

## Completeness and conservation reasoning

Every qualification-game outcome has exactly one destination: either one named later slot, one qualification record, or elimination. There are 66 outcome edges: 50 internal feeds and 16 terminal outcomes (8 qualification, 8 elimination). The 66 game input slots consist of 16 distinct entry seeds and 50 single-producer result feeds. There are no dangling winner/loser outputs, multiply produced slots, unused initial entries or game cycles. A qualification winner cannot also continue in A/B/C; an eliminated loser cannot re-enter.

For arbitrary legal game winners, a team always leaves its current live game through exactly one of that game's distinct W/L branches. Each live participant has exactly one remaining destination; two branches cannot duplicate that team into separate live games. This inductive property, plus initially distinct entries, prevents self-opponents and simultaneous live duplicates. Winner/loser identity must still be validated against actual participants and preserved on confirmation. Future correction/revision handling must not mutate actual already-played participants.

Records at each named layer are fixed by graph paths:

| Games | Each entrant's pregame record | Winner record/destination | Loser record/destination |
|---|---|---|---|
| A01-A08 | 0-0 | 1-0, A | 0-1, B |
| A09-A12 | 1-0 | 2-0, A | 1-1, B |
| A13-A14 | 2-0 | 3-0, qualified | 2-1, B |
| B01-B04 | 0-1 | 1-1, B | 0-2, C |
| B05-B08 | 1-1 | 2-1, B | 1-2, C |
| B09-B11 | 2-1 | 3-1, qualified | 2-2, C |
| C01-C02 | 0-2 | 1-2, C | 0-3, eliminated |
| C03-C05 | 1-2 | 2-2, C | 1-3, eliminated |
| C06-C08 | 2-2 | 3-2, qualified | 2-3, eliminated |

- A counts: 8 opening games + 4 second games + 2 qualifier games = 14; fourteen first losses feed B, two unbeaten qualifiers leave A.
- B counts: four games reduce eight 0-1 entries to four 1-1 survivors; four A second-round losers join them for four games; two A qualifier losers join those four survivors for three qualifier games. Total 4+4+3=11. Eleven second losses feed C; three B qualifiers leave.
- C counts: four 0-2 B opening losers make two games; their two winners join four 1-2 B middle losers for three games; their three winners join three 2-2 B qualifier losers for three C qualifiers. Total 2+3+3=8. Eight third losses eliminate and three C winners qualify.
- Total losses = 8 eliminated teams x 3 + 2 A qualifiers x 0 + 3 B qualifiers x 1 + 3 C qualifiers x 2 = 33, exactly one per qualification game.
- Total qualifier wins = 8 x 3 = 24. Eliminated teams' wins are necessarily 2 x 0 + 3 x 1 + 3 x 2 = 9; total wins 33. Qualification player appearances = 16 seed appearances + 50 internal feeds = 66 = 2 x 33.
- Playoffs add exactly seven wins and seven losses, and end with one champion plus seven playoff exits. Division total is forty wins and forty losses across forty games. Qualification-stage exits remain eight distinct teams, playoff teams remain eight distinct teams, together partitioning all sixteen.


