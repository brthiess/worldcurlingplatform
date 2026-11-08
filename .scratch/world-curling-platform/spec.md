---
id: WCP-SPEC-001
title: World Curling Platform initial offer
type: spec
labels: [ready-for-agent]
created: 2026-11-07
decision_basis: User interview Q1-Q62, subsequent clarifications, approved audit scope refinement, and accepted P-01 through P-05 with a 16-team main demonstration
implementation_order: Decompose into tickets before implementation
---

# World Curling Platform initial offer

## Problem Statement

Fans need one useful place to follow competitive curling: current scores, competition progress, teams, players, rankings, historical results, news, and analytics. Following a team through a live triple-knockout event must be straightforward on a phone or desktop, with direct access to the current draw and its bracket path.

The proposed platform also needs to support the people producing those records. World Curling staff, delegated event approvers, organizers, scorekeepers, players, and partner systems need appropriately scoped ways to register events and entries, enter and correct results, maintain profiles, finalize competitions, and approve rankings. Historical records and later corrections must remain understandable and auditable.

The deliverable is a functioning, high-quality first offer to World Curling: a hosted site and administrative system with a World Curling-owned PostgreSQL data model, competition operations, and WCTRS calculations. It must demonstrate the agreed workflows with persistent data and working interfaces. It is not yet an official World Curling production launch.

## Solution

Build a standalone World Curling Platform with a scores-first public website, role-specific administration, public read APIs, scoped partner write APIs, background work, and canonical PostgreSQL records. There is no CurlHub or existing administrative-platform dependency.

Use CurlingZone's cross-event discovery and connected score/team/ranking navigation together with House of Curling's current/next-draw presentation and connected history/analytics. Deliver an original, coherent interface with complete interactions and concise curling-specific content. The homepage shows the most current draw and scores directly; fans can enter standings/brackets, teams, games, and event details without searching through promotional content.

Import historical data collected by the user's Curling Crawler into the new model using repeatable, administrator-reviewed batches. Preserve provenance, uncertain identities, and incomplete records. Historical data, resettable fictional demonstrations, and newly operated events remain distinguishable.

Support event series, dated editions, and independently operated divisions; self/manual entries; core-composition team identities; online scoring and corrections; organizer bracket edits; preserved finalized results; and administrator-approved ranking publications. Calculate WCTRS for 2026-27, retaining older publications and sourced starting inputs without claiming complete historical reconstruction.

Host the review environment on a public domain the user will purchase. Provide scoped demo accounts, setup/API/operator documentation, and recordings of the seven agreed workflows. Keep payment collection/refunds in a central sandbox for the offer. Simplicity means deferring the explicitly excluded features, not substituting a static facade for functioning workflows.

## Initial-offer acceptance: seven demonstration workflows

Scope refinement approved by the user on 2026-11-07 after the independent audit: organize delivery around the seven demonstration workflows, defer elaborate handling of the six exceptional scenarios below, and retain basic security, data integrity, and ranking correctness. This is a specification update only; implementation is not authorized by this refinement.

These workflows are the primary acceptance structure. The story catalog below remains the requirements inventory; news, favorites, historical import, analytics, partner access, and the accepted format/ranking families remain supporting capabilities. The accepted P-01/P-05 decisions below narrow discipline coverage and the metric inventory explicitly and supersede earlier broader ambitions/examples. The offer does not require every possible configuration or every audit recommendation. All workflows require persistent application data and working interfaces, not recordings of static mockups.

| ID | Demonstration and setup | Required observable end state | Supporting acceptance checks |
|---|---|---|---|
| D-01 | Fan follows a team through a published 16-team, four-player triple-knockout division with scheduled games and scoped scoring access. | Homepage current/latest scores, mobile bracket/list, selected team's A/B/C path and next game work. A confirmed result follows stored advancement routes; links reach the correct event/game/team/player context. | T-01, T-04, T-11, T-12 |
| D-02 | Organizer submits a new dated edition/divisions to its responsible approval authority. | Reviewer approves the application onto the calendar with attribution/history. Public admission, registration opening, and ranking eligibility remain separate. An out-of-scope actor cannot approve it. | T-02, T-06 |
| D-03 | Assigned volunteer opens a permitted game on a phone. | Start, end scores, known hammer, lineup difference, confirmation, and an ordinary correction persist and reach public views. Saved, unsent/uncertain, and connection states are truthful; duplicate/stale submissions cannot corrupt scores. Demonstrate a correction that does not require resolving an already-started downstream game. | T-01, T-03, T-06, T-12 |
| D-04 | Organizer creates next year's edition and completes terms, capacity, and format before opening entries. | Demonstrate an existing-team entry, assembled core, and new/provisional player; automatic team reuse and temporary substitution stay distinct. Exercise authorized self-entry, one sandbox checkout, a recorded fee exception, ordinary withdrawal/hold expiry, and explicit full/partial sandbox refunds. | T-02, T-03, T-07 |
| D-05 | Visitor registers, claims an existing player, and obtains World Curling approval. | Biography/handedness persist. A private pending/rejected photo leaves the old image public; approval publishes the exact reviewed asset. Claim ownership does not confer unrelated authority. | T-05, T-06 |
| D-06 | Administrator opens imported historical publications and a calculated 2026-27 draft with sufficient sourced inputs. | Historical origin is clear. Draft comparison, contributions, rules/input/engine evidence, and effective date are inspectable; the approved list is reproducible and publicly selectable. Missing required calculation inputs are not fabricated or passed off as a verified complete list. | T-08, T-09, T-10, T-11 |
| D-07 | Organizer finalizes one completed division and World Curling reviews its resulting ranking draft. | Immutable results and a separately approved ranking publication exist. Correct a result without an already-started downstream dependency, finalize the revision, and approve its direct replacement while retaining the original snapshot/publication. | T-08, T-09 |

The partner example is a companion to D-03, not an eighth product workflow: an explicitly scoped test feed scores/confirms/corrects its game, an unrelated write is denied, and staff switch sources while no request is in flight. D-01/D-06 also expose the agreed supporting public capabilities and honest data coverage. Hosted setup, seven recordings plus the partner example, and meaningful domain-unit/database/API/browser evidence apply across all workflows (T-13/T-14).

### Deferred exceptional scenarios and minimum safeguards

These are recorded limitations for the initial offer, not requirements for elaborate resolution screens, policy engines, or exhaustive test permutations. They do not defer ordinary corrections, repeat imports, refunds, source switching, or safe retries.

| Exceptional scenario | Deferred handling | Minimum safeguard retained for the offer |
|---|---|---|
| Upstream winner corrected after dependent games start or finish | Comprehensive downstream repair/continuation policy and automated repair of played brackets. | Save the authorized correction with history, preserve actual participants/results, flag affected assignments for organizer attention, and never silently rewrite played games. The demo avoids this situation; no administrator correction gate is introduced. |
| Corrected historical rankings affect later events' field strength | Transitive reassessment/cascade engine and retrospective sporting-policy decisions. | Preserve exact original assessment inputs and approved history. Demonstrate direct revised-finalization/replacement publication only; report broader impacts as unresolved rather than claiming they were recalculated. |
| Person resolution collapses several teams, entries, or ranking subjects | Multi-record merge/consolidation tooling and automatic collision resolution. | Ordinary audited factual corrections remain supported. Detect collisions, leave conflicting changes unapplied, and retain an issue for staff; no partial merge, double counting, or inferred sporting lineage. |
| Reimport disagrees with a later staff correction | Field-by-field reconciliation and complex reimport conflict workflows. | Repeat an unchanged approved import without duplicates. Retain conflicting evidence for staff and do not overwrite curated canonical data automatically. Approval remains tied to the reviewed batch contents. |
| Feed requests are queued/in flight during revocation or source takeover | Elaborate queue-draining, handoff, and interrupted-feed recovery workflows. | Keep one active source, check current authority/source before applying a write, and reject stale-source work. Demonstrate a sequential source switch; ordinary revocation must still prevent subsequent writes. |
| Late payment after released capacity or overlapping refund requests | Automated exceptional settlement/refund decisions and concurrent-operator reconciliation UI. | Never overbook or exceed the refundable balance, including pending refund requests. Flag exceptional outcomes for staff; withdrawal/payment/refund remain distinct. Demonstrate ordinary sequential sandbox payments/refunds; no automatic refund promise. |

### Core safeguards and verification boundary

- Use scoped server-side authorization for every command, deny unrelated resources, and preserve atomic change/audit records. Public reads and pending-media privacy remain explicit boundaries.
- Retain version checks, duplicate-safe retries, truthful save status, capacity/balance constraints, and preservation of frozen results/publications. Basic protections apply even to deferred scenarios; comprehensive recovery automation does not.
- Validate untrusted text, URLs, uploads, and provider events; bind approved photos to immutable reviewed content. These are routine implementation duties, not new product-policy interviews.
- Verify supported WCTRS rule branches against sourced, independently worked fixtures, including dated checkpoints. Staff may use the existing on-demand calculation/review flow for the offer; an automated ranking calendar is not a prerequisite. Official-rule research remains necessary before correctness claims.
- Reuse T-01 through T-14 within this scope. Test the ordinary workflows, meaningful failure cases, and minimum safeguards; do not turn the deferred scenarios into mandatory full recovery demonstrations or require every audit finding to be closed first.

### Accepted core product decisions (2026-11-07)

The user accepted all five recommendations, changing the main demonstration from eight to sixteen teams. The following are settled initial-offer decisions, not World Curling endorsement. No further input on these five decisions is required. Named template configurations and metric denominator details are bounded design/decomposition work under these decisions, not an invitation to restart the product interview. Implementation remains unauthorized.

| ID | Product decision | Accepted initial-offer behavior |
|---|---|---|
| P-01 | Supported coverage and main demonstration | Use a 16-team, four-player triple-knockout event for D-01. Support men's/women's four-player and mixed doubles, retaining the agreed 2026-27 WCTRS men's/women's overall/series and mixed-doubles pair/individual lists. Use one documented configuration per other accepted format family. Additional disciplines, age-specific variants, and unusual stage combinations are deferred; this explicitly narrows the earlier all-disciplines ambition. |
| P-02 | Team representation | World Curling staff grant team-season authority to submit/amend/withdraw entries and handle their payments. Organizers retain manual entry. Player-profile ownership confers no team authority, and authority does not automatically transfer to a different core-composition identity. |
| P-03 | Rotating-five core identity | Five regular rotating members are all core; a designated alternate is outside the core. World Curling staff record the distinction. Game rotation never changes team identity. This is the platform identity convention, separate from the registered ranking roster and official eligibility rules. |
| P-04 | Ranking publication evidence | Block publication of a calculated list when required calculation inputs or ranking eligibility remain unresolved. Staff may acknowledge informational warnings irrelevant to that calculation, such as missing biographies or unnecessary end scores. Use complete fixtures for demos, preserve approved historical versions, and label incomplete imported observations honestly. No configurable exception engine or implicit readiness-based eligibility waiver. |
| P-05 | Minimum analytics inventory | Deliver four small views: win/loss records and titles; approved rank/points history and contributions; blank/steal rates; historical win rates by end, score margin, and hammer. Show sample sizes, exclude unknown required data, and avoid predictions or hypothetical post-concession situations. Define denominators/participation evidence consistently during design. Streaks, rivalries, and other reference-site statistics are not required for initial-offer completion. |

Technical details such as framework versions, retry envelopes, image processing, browser widths, and workload measurements remain delegated implementation choices. Official formulas, exemptions, measurement requirements, six/eight counting-event interpretation, and allocation rounding are sourced research tasks, not questions asking the user to invent sporting rules. Exceptional downstream continuation, transitive reassessment, and late-payment automation policies are deferred above rather than outstanding initial-offer product questions. Production finance, backups/recovery, domain/provider credentials, and deployment remain under their existing boundaries.

## User Stories

### Fans and ranking readers

1. **US-001** As a fan, I want current event cards with the most current draw and line scores on the homepage, so that I can check games immediately.
2. **US-002** As a fan, I want the latest completed draw to remain visible between draws and the next draw to be shown, so that I can understand what just happened and what starts next.
3. **US-003** As a fan, I want previous/next draw navigation and a schedule, so that I can inspect earlier results or upcoming games.
4. **US-004** As a fan, I want scores to refresh without losing my selected draw, filters, or expanded event, so that live updates do not interrupt navigation.
5. **US-005** As a fan, I want event, date, discipline/division, and location discovery, so that I can find relevant current and historical competitions.
6. **US-006** As a fan, I want a game permalink showing its event, division, phase, participants, sheet, time, score, and result state, so that I can inspect and share a specific game.
7. **US-007** As a fan, I want team links to show the relevant roster, results, and next known game, so that I can follow that team's event.
8. **US-008** As a fan, I want a selected team's A/B/C bracket path highlighted, so that I can follow wins, losses, qualification, and elimination in triple knockout.
9. **US-009** As a mobile fan, I want a usable bracket and readable game-list alternative, so that I can follow the competition on a narrow screen.
10. **US-010** As a fan, I want direct access from each event card to standings/bracket, teams, and the event page, so that I can move from scores to context quickly.
11. **US-011** As a fan, I want player pages with approved photos, biography, handedness, and known sport history, so that I can learn about players without invented profile details.
12. **US-012** As a fan, I want browser-saved team, player, and event favorites without a required account, so that I can return to the records I follow.
13. **US-013** As a fan, I want team favorites to refer to the actual core composition and player pages to remain useful through team changes, so that history follows the platform's identity model.
14. **US-014** As a fan, I want news cards with publisher, date, supplied excerpt, and original article link, so that I can find curling coverage at its source.
15. **US-015** As a ranking reader, I want to select an approved WCTRS list, discipline, series, season, and effective date, so that I can see the intended rankings publication.
16. **US-016** As a ranking reader, I want rank movement, points, and event-by-event contribution breakdowns, so that I can understand a team's or player's position.
17. **US-017** As a ranking reader, I want historical publications and corrected versions to remain distinguishable, so that I can see both what was published then and later corrections.
18. **US-018** As a fan, I want results/career analytics such as records, finishes, titles, streaks, and opponent comparisons, so that I can compare supported performance history.
19. **US-019** As a fan, I want scoring-pattern analytics based on available end scores and known hammer, so that I can inspect scoring, conceding, steals, and blanks with the correct sample.
20. **US-020** As a ranking reader, I want historical rank/points charts and comparisons, so that I can examine change across approved publications.
21. **US-021** As a fan, I want historical winning outcomes filtered by end, score margin, hammer, discipline, and applicable rules, so that I can inspect comparable game situations and sample coverage.
22. **US-022** As a fan, I want unknown, unplayed, upcoming, and played-zero scores to be distinct, so that incomplete data does not misrepresent a game.
23. **US-023** As a fan, I want explicit time-zone and last-update labels, so that I can interpret schedules and stale scores correctly.
24. **US-024** As a site visitor, I want visible links, tabs, filters, forms, and charts to work with real application data, so that the site is usable beyond its first screen.

### Organizers and team representatives

25. **US-025** As an organizer, I want to apply for a new dated event edition rather than overwrite a previous edition, so that next year's registration preserves history.
26. **US-026** As an organizer, I want to begin with organization, name, dates, city/country, and proposed divisions, so that an unconfirmed venue or incomplete operational details do not prevent an initial application.
27. **US-027** As an organizer, I want event admission, registration opening, and division ranking eligibility to be separate, so that public listing does not falsely promise ranking points or open entries prematurely.
28. **US-028** As an organizer, I want to edit ordinary approved event details with change history, so that routine administration stays simple for this offer.
29. **US-029** As an organizer, I want to complete capacity, payment terms, entry requirements, and format information before opening entries, so that applicants can make an informed registration.
30. **US-030** As an organizer, I want open, reviewed, and invitation-only entry modes per division, so that the same platform supports tour entries and invited fields.
31. **US-031** As an authorized team representative, I want to submit my team's event entry, so that entry does not depend on an organizer typing everything manually.
32. **US-032** As an organizer, I want to manually add an existing team, so that I can enter an invited field or act on a team's behalf.
33. **US-033** As an organizer, I want to assemble an entry from existing players and create a missing player, so that incomplete prior registration does not block event operations.
34. **US-034** As an organizer, I want possible duplicate player matches and provisional identity records, so that uncertainty can be reviewed without merging different people by name.
35. **US-035** As an organizer, I want complete core rosters to automatically create or reuse team records, so that a separate permanent-team registration screen is unnecessary.
36. **US-036** As an organizer, I want temporary event substitutes and incomplete lineups to be recorded separately from permanent team membership, so that one event does not redefine a team's identity.
37. **US-037** As an authorized organizer, I want explicit discounts, waivers, and external-payment records with reasons, so that manually entered or invited teams are not silently assumed to have paid or entered free.
38. **US-038** As an organizer, I want a waitlist, withdrawals, and explicit replacement invitations, so that I can manage the field without automatic promotion or refund assumptions.
39. **US-039** As an organizer, I want configurable common competition templates and a preview before publication, so that I can run the agreed competition formats without an unrestricted format designer.
40. **US-040** As an organizer, I want to assign games to draw sessions and sheets and see known scheduling conflicts, so that I can produce a workable schedule.
41. **US-041** As an organizer, I want to select qualifiers/seeds and edit affected bracket assignments with audit history, so that I can resolve qualification ties and result changes myself.
42. **US-042** As an organizer, I want to finalize divisions independently and finalize revised results after corrections, so that completed results and their prior snapshots remain identifiable.

### Scorekeepers

43. **US-043** As an assigned scorekeeper, I want a mobile-friendly list of my permitted games, so that I can start scoring the correct game.
44. **US-044** As a scorekeeper, I want to record end scores, known hammer, game outcome/termination, and required measurements, so that the game record contains the applicable competition information.
45. **US-045** As a scorekeeper, I want the game lineup to default from the event lineup and to record differences, so that unchanged lineups need no repeated confirmation.
46. **US-046** As an assigned scorekeeper, I want to confirm the final result without another approver, so that the competition can advance promptly.
47. **US-047** As an assigned scorekeeper, I want to correct a confirmed result without administrator approval, so that errors can be fixed while the change remains auditable.
48. **US-048** As a scorekeeper, I want conflicting or outdated edits to be identified and repeated submissions to be safe, so that concurrent work does not silently overwrite or duplicate scores.
49. **US-049** As a scorekeeper, I want saved scores, unsent edits, and connection status to be clear, so that I know whether an edit reached the platform during a temporary interruption.
50. **US-050** As authorized event staff, I want an explicit recorded switch between manual scoring and the selected partner feed, so that conflicting sources do not control a game simultaneously.

### Players

51. **US-051** As a visitor, I want to create an account without already being registered as a player, so that I can access self-service requests.
52. **US-052** As a player, I want to request a link from my account to an existing player profile for World Curling approval, so that profile control is verified separately from account creation.
53. **US-053** As an approved profile owner, I want to edit my short biography and handedness, so that my public profile reflects those details.
54. **US-054** As an approved profile owner, I want to submit a replacement photo privately while the current approved photo stays public, so that a pending submission does not change the public profile.
55. **US-055** As a player, I want to see my photo request's status and rejection reason, so that I know its outcome.
56. **US-056** As a player without an account, I want organizers to be able to include my sport record in an entry, so that a login is not a prerequisite for participation.

### World Curling staff and delegated approvers

57. **US-057** As a World Curling administrator, I want to review, approve, or reject new event applications, so that admitted events meet the platform's governance requirements.
58. **US-058** As an authorized delegated approver, I want to approve events within my granted scope, so that personnel from organizations such as Curling Canada can share event administration.
59. **US-059** As an administrator, I want each application to have one responsible approval authority and assigned reviewer, with explicit reassignment/override history, so that overlapping scopes do not create contradictory decisions.
60. **US-060** As an administrator, I want scoped human roles, so that organizers, scorekeepers, players, and representatives have only their assigned authority.
61. **US-061** As World Curling staff, I want to maintain official seasonal rosters and required allocation/eligibility information, so that ranking inputs can be reviewed independently of event-lineup edits.
62. **US-062** As World Curling staff, I want core-player changes to resolve another team ID while alternate, coach, name, and position changes preserve identity, so that team history follows the agreed membership rule.
63. **US-063** As World Curling staff, I want identical core rosters in the same discipline to reuse their identity across seasons or after a break, so that recurrence does not create unnecessary duplicates or automatically restore point rights.
64. **US-064** As World Curling staff, I want audited identity corrections and explicit duplicate resolution, so that a mistaken player selection can be repaired without pretending a real roster change occurred.
65. **US-065** As a World Curling administrator, I want to approve player-account link requests, so that creating an account does not grant control of an existing player record.
66. **US-066** As a World Curling administrator, I want to approve/reject photo requests and change the public image only on approval, so that pending media remains private.
67. **US-067** As a World Curling administrator, I want draft ranking comparisons, event contributions, calculation explanations, and unresolved-input issues, so that I can review a publication before approval.
68. **US-068** As a World Curling administrator, I want to approve a complete WCTRS list for an effective date, so that one identifiable publication becomes official within the offered system.
69. **US-069** As a World Curling administrator, I want published rankings to retain rules, exact inputs, contributions, and engine revision, so that a calculation can be audited and replayed.
70. **US-070** As a World Curling administrator, I want a corrected event to produce a replacement ranking candidate without rewriting approved history, so that original and corrected publications remain available.

### Historical import and ranking inputs

71. **US-071** As an administrator, I want to import historical data collected by the designated Curling Crawler project, so that existing results populate this platform's own database.
72. **US-072** As an administrator, I want to validate and approve historical import batches, so that broad history can be admitted without individual manual approval of every record.
73. **US-073** As an administrator, I want source identifiers, provenance, completeness, and uncertain identities preserved, so that imported results remain traceable and unknown fields are not invented.
74. **US-074** As an operator, I want repeat imports to reuse mappings and records safely, so that rerunning an import does not duplicate games, teams, or people.
75. **US-075** As a ranking reader, I want older imported ranking publications to remain viewable with their origin, so that historical output is retained without claiming it was recalculated.
76. **US-076** As World Curling staff, I want sourced, reviewed prior-season starting entitlements and complete calculation fixtures, so that 2026-27 calculations can be verified while historical gaps remain explicit.

### Partner integrations

77. **US-077** As a World Curling administrator, I want organization/event/action-scoped partner credentials with rotation and revocation, so that external systems have accountable, limited write access.
78. **US-078** As an authorized partner system, I want to submit permitted event information and manage permitted entries through APIs, so that an external input system can use the same platform rules as the browser UI.
79. **US-079** As an explicitly authorized scoring feed, I want to score, confirm, and correct my designated games, so that every final result does not require a separate human confirmation.
80. **US-080** As an administrator, I want organizer-level partner actions such as division finalization separately permissioned, so that scoring access does not automatically grant wider authority or ranking publication.
81. **US-081** As an auditor, I want changes attributed to the responsible partner/client and request, so that automated submissions are as traceable as human changes.

### Entry payments

82. **US-082** As a team representative, I want to pay an entry fee through the central test payment integration, so that the offered registration workflow includes working collection.
83. **US-083** As an organizer, I want accepted entries to have a defined payment reservation window and expired holds to release capacity, so that payment delays do not overbook or indefinitely reserve places.
84. **US-084** As authorized staff, I want an externally received payment to be recorded distinctly from online collection, so that payment history remains accurate.
85. **US-085** As authorized staff, I want to issue explicit full or partial test refunds and see their provider status, so that refund handling is demonstrated without an automatic refund-policy engine.
86. **US-086** As an organizer, I want payment confirmations and repeated provider events processed safely, so that redirects or duplicate deliveries do not falsely pay or double-count an entry.
87. **US-087** As a team representative, I want withdrawal and refund decisions to be shown separately, so that withdrawing does not silently promise a refund.

### Review and delivery

88. **US-088** As a World Curling reviewer, I want to explore the working site on the public domain the user supplies, so that I can assess the offer myself.
89. **US-089** As a reviewer, I want scoped demonstration accounts, so that I can exercise administrator, organizer, scorekeeper, and player workflows with their real permissions.
90. **US-090** As an operator, I want resettable fictional scenarios kept distinct from imported history, so that demonstrations remain repeatable without misrepresenting real results.
91. **US-091** As a reviewer, I want recordings of the seven agreed workflows and a partner-feed example, so that I can inspect the complete paths and their outcomes.
92. **US-092** As an operator, I want setup, API, and operating documentation, so that the hosted offer can be reproduced and maintained.
93. **US-093** As a reviewer, I want discipline, format, and ranking coverage marked as planned, implemented, or verified, so that the offer does not claim untested capabilities.
94. **US-094** As a reviewer, I want a polished, responsive interface with purposeful content and complete controls, so that the project can be assessed as a functioning product rather than a collection of placeholder screens.
95. **US-095** As a reviewer and future maintainer, I want substantial, meaningful unit-test coverage alongside integration and browser checks, so that core curling and workflow rules can be changed with confidence.

## Implementation Decisions

1. **Architecture and authority.** Use one modular application and canonical PostgreSQL database. Public, administration, self-service, and partner API surfaces have distinct permissions. Web and background worker processes share domain commands. Existing crawler code does not become a runtime dependency.
2. **Recorded technical defaults.** The delegated implementation defaults are TypeScript/Next.js on Node.js, Drizzle-reviewed PostgreSQL migrations, pg-boss background work, Better Auth sessions, Stripe-hosted Checkout in a central sandbox, and S3-compatible media storage with Cloudflare R2 as the hosted default. Render web/worker/managed PostgreSQL is the hosting default. The user requires PostgreSQL and a hosted review site and has no strong framework/provider preference. Exact compatible versions and routine component choices are implementation work.
3. **Module interfaces.** Identity owns people, team composition, seasonal registrations, and roles. Registration owns applications, editions/divisions, entries, and lineup declarations. Competition owns draws, games, score/result revisions, and finalization. Ranking owns WCTRS rules/inputs/calculations/publications. Governance owns reviews and audit. Integration owns historical staging/provenance, partner scopes, and inbox/outbox. Payments owns charges/reservations/provider/refund records. Media/news and public reads expose their agreed capabilities through narrow interfaces.
4. **Shared command contract.** Browser and partner commands apply the same authorization, sport validation, concurrency, idempotency, and audit rules. Command acknowledgements identify accepted state/version; stale/conflicting edits cannot silently overwrite newer data. Human/client/service actors and request correlation remain recoverable.
5. **Transactional persistence.** Canonical relational changes, corresponding audit evidence, and required durable job/outbox work commit consistently. Provider calls use recorded, retryable transitions. The application does not claim an atomic transaction spanning PostgreSQL and remote payment/storage/email systems.
6. **Public read contract.** Expose selected public fields and approved assets through read APIs. A live-event projection supplies edition/division context, current/latest draw, participant entries, individual end states/scores, totals, known hammer, result state, update time, and the next scheduled draw. Bracket reads expose stored games, slots, and advancement paths. Ranking reads expose only approved publications by default. Raw authentication, payment secrets, private reviews, and pending media are not public projections.
7. **Account and profile control.** Anyone may register an account. A requested link to an existing player requires World Curling administrator approval. A player's sport record can exist without an account. Profile ownership grants biography/handedness editing and photo submission; it does not confer organizer permissions or control of official sport results/eligibility.
8. **Team identity.** A team identity is defined by discipline and the unordered core-player set. Permanent core changes create or resolve another ID. Alternate/coach/name/position changes do not. Identical compositions reuse their ID across seasons or after a break. Temporary event/game substitutes and data corrections remain distinct from genuine permanent changes. No team-lineage feature is included.
9. **Registration and rosters.** Event registration automatically creates/reuses teams when core membership is known; incomplete entries may remain provisional. Event and game lineups do not overwrite the registered season roster. World Curling staff maintain official roster/eligibility/allocation information and can resolve records after public participation. Automatically created teams need no separate pre-publication approval gate. Preserve the difference between defaulted lineup data and independently confirmed participation.
10. **Event hierarchy and approval.** Separate recurring series, dated editions, and independently operated divisions. Edition admission/public listing, opening entries, and division ranking eligibility are distinct. World Curling-controlled delegation uses explicit geography/organizer/discipline/category scopes and exceptions. Each application has one responsible authority/reviewer; reassignment and overrides have history. Ordinary organizer edits use a simple audit trail rather than a generalized amendment-review engine.
11. **Entry workflow.** Support open, reviewed, and invited division entry. Separate acceptance, payment, roster readiness, and ranking eligibility. Require basic event application information first and complete entry/payment/capacity/format terms before registration opens. Representatives self-enter; organizers select teams, assemble players, or create missing players. Ambiguous people are reviewable provisional records, not automatic name-based merges.
12. **Payments and capacity.** Collect centrally in a sandbox for the offer; the long-term financial arrangement is provisional. Reserve capacity for defined payment windows, release expired holds, and process accepted places consistently with payment outcomes. Verify server/provider payment events; redirects alone do not establish payment. Deduplicate deliveries/requests. Store currency minor-unit amounts, explicit waivers/discounts/external payments, and full/partial refund transactions. Staff control refunds and replacement invitations.
13. **Competition and scheduling.** Provide configurable round robin/pools, single/double/triple knockout, Page, Swiss/Schenkel, and supported stage-combination templates. Persist the generated graph and its version. Organizers preview/publish draws, assign sessions/sheets, see known conflicts, and select qualifiers/seeds manually where needed. The offer includes no automatic playoff-qualification tiebreak engine or unrestricted format designer.
14. **Scoring authority.** Assigned scorekeepers can confirm and correct final results without an administrator approval or compulsory second signer. Authorized designated feeds have equivalent game permissions. Each game uses manual scoring or one selected feed; authorized staff explicitly take over with history. Game lineups default to the event lineup and scorekeepers record differences. Apply discipline-specific score/outcome/measurement rules rather than one universal end/score model.
15. **Results and corrections.** Live scores are provisional; confirmed results advance the draw. Organizers can modify affected brackets as needed with audit history. Finalizing a division preserves a dated result snapshot. Later score corrections remain allowed, flag changed results, and permit revised organizer finalization. Previously finalized snapshots and approved rankings do not silently change. Elaborate handling after dependent games have started follows the exceptional-scenario deferral above.
16. **WCTRS scope.** Fully calculate 2026-27 WCTRS men's/women's overall and applicable series lists and mixed doubles pair/individual lists. Do not calculate Member Association rankings or invent a WCTRS list for every competition discipline. Ranking tie ordering required by WCTRS remains in scope despite excluding playoff-qualification tiebreak automation.
17. **Ranking inputs and ownership.** Preserve ruleset/source versions, historical cutoff inputs, event assessments, eligible/excluded contributions, point ownership, roster/declaration/entitlement revisions, adjustments, and sourced starting/carryover records. Identity reuse does not automatically restore points. Exact arithmetic and stage-specific rounding follow documented rules. The known mixed-doubles and allocation-rounding ambiguities remain explicit validation work, not invented policy.
18. **Ranking approval and history.** Finalization/revision prepares affected draft calculations when required inputs exist. World Curling administrators compare and approve a complete list for an effective date. Preserve its code revision, input manifest, outputs, contributions, digests, and approval. Corrections produce replacement publications, retaining effective-date and published-as-seen history. Public live/projected world rankings are excluded.
19. **Initial crawler import.** Read a consistent archive/export from the designated crawler project, translate to the platform's model, preserve fully scoped source identifiers and parser/export provenance, and stage quality issues. Validate a representative batch before broader loading and administrator batch approval. Imports are repeatable/idempotent. Missing ends/players/hammer and unresolved subject labels stay unknown; a final-score-only game remains valid. Imported history does not acquire fabricated scorekeeper certification or full calculation provenance.
20. **Homepage and navigation.** Put current event cards and line scores directly on the homepage. Keep the latest completed draw visible until the next starts and show the next scheduled draw. Link games, teams, players, standings/brackets, and event pages with stable identity/context. Preserve view state during polling; display result/update/connection state and explicit timezone. The technical plan's 5-10 second active refresh is a target to measure, not an untested guarantee.
21. **Frontend quality.** Deliver an original scores-first interface with readable/tabular scores, consistent hierarchy, mobile brackets and a list alternative, working search/filters/navigation, accessible labels/focus, and complete loading/empty/error states. Every visible control performs its advertised action with application data. No generic marketing hero, filler paragraphs, fake live statistics, invented biographies, testimonials, or decorative data claims.
22. **Profiles and media.** Keep pending/rejected photos private and retain the current approved photo until approval changes the public reference. Show request status/rejection reason to the player. Durable object storage is separate from ephemeral application files. Public profile editing is limited to biography, handedness, and photo submission in this offer.
23. **News, favorites, and analytics.** Aggregate linked items from approved external sources without editorial authoring. Store favorites in the browser without compulsory login. Provide the four accepted analytics groups with suitable filters, sample counts, coverage, and honest treatment of missing measurements. Historical situation frequencies are not presented as verified live predictions.
24. **Hosted delivery.** Provide a public-domain review environment, scoped demo accounts, separate imported history and resettable fictional scenarios, operating/setup/API documentation, and recordings of the seven workflows plus a partner example. Label delivered coverage as planned/implemented/verified. Domain/DNS/provider credentials are deployment-time inputs; publishing this spec does not provision services or implement the application.

## Testing Decisions

### Boundary and prior art

Use the running application, driven through browser workflows and HTTP APIs with real PostgreSQL persistence, as the primary acceptance boundary. It covers public reads and authenticated human/partner commands. Add focused unit-test boundaries at the public interfaces of domain modules for their calculations, policy decisions, validation, and state transitions. There is no existing application or test suite in this repository; the planning documents describe acceptance examples, not executed tests.

This carries forward the seven browser workflows, API/permission checks, and independently worked ranking fixtures. During the test-boundary check, the user explicitly required the project to be very well unit tested as far as reasonably possible. The resulting agreement includes substantial domain-unit coverage as well as end-to-end evidence; keep unit interfaces small and behavior-oriented rather than testing every private helper or implementation detail.

Use controlled adapters/fixtures for external providers where deterministic behavior is required, together with selected sandbox integration checks. Do not replace the application's database or core business behavior with mocks and then claim to have tested persistence or transactions. A ranking example is good evidence only if its expected values were worked independently of the implementation.

### Unit-test coverage

| Domain boundary | Required unit behavior |
|---|---|
| WCTRS calculation and eligibility | Independently worked points/field-strength examples, counting limits, weights/carryover, ownership/allocations, exclusions, effective cutoffs, ranking ties, exact arithmetic/rounding, and invalid/missing required inputs for the supported rule versions. |
| Competition templates and progression | Deterministic generated games/slots, winner/loser routing, byes, qualifiers, stage transitions, and validation of organizer edits across the accepted format families. |
| Identity and lineup policy | Order-independent core identity, discipline separation, identity reuse, core changes, alternate/coach/position exclusions, and temporary-substitute versus permanent-change behavior. |
| Scoring and result transitions | Discipline-specific valid/invalid ends and outcomes, known/unknown/unplayed distinctions, totals where applicable, confirmation/correction behavior, and preservation of result identity. |
| Registration, capacity, and payments | Entry/readiness/payment distinctions, fee/waiver/discount/external-payment arithmetic, reservation/expiry transitions, payment/refund state handling, and permitted refundable amounts. Verify concurrency separately against real PostgreSQL. |
| Authorization and integration policy | Role/action/scope decisions, explicit partner capabilities, source ownership/takeover, idempotent delivery classification, and mapping validation. Verify actual route/session enforcement in integration tests. |
| Analytics and public projection rules | Known sample counts and denominators, unknown-data exclusions, comparable population filters, ranking contribution totals, current/latest/next draw selection, and public/private field selection. |

Exercise normal paths and meaningful failure/boundary cases from the agreed rules. Test inputs and observable outputs through domain interfaces, not internal call counts, private-method spies, or code structure. Use small explicit fixtures and independent expectations; introduce property-based checks only where they add evidence for arithmetic/conservation or graph invariants. Report coverage and review uncovered core branches. No arbitrary global percentage replaces behavior coverage, and trivial tests added solely to inflate a metric do not satisfy this requirement.

### Observable acceptance checks

| ID | Scope and observable result |
|---|---|
| T-01 | **Fan/scorer path:** a permitted scorekeeper saves end scores, confirms and corrects a game; homepage/game/event views display the accepted values/status and bracket progression within the configured refresh target. A stale edit cannot silently replace a newer score. |
| T-02 | **Event/entry path:** an organizer submits a next-year edition/divisions, the responsible approver admits it, registration opens after required terms, and self/manual entries work without conflating payment, readiness, and ranking eligibility. |
| T-03 | **Team identity path:** through entry/staff interfaces, identical core/discipline compositions reuse identity; permanent core changes resolve another identity; alternate/coach/position/name changes and temporary substitutes preserve the expected identity. A factual correction is audited. |
| T-04 | **Competition path:** representative fixtures exercise each accepted format family. Triple knockout follows stored winner/loser routes and qualifiers; organizer schedule/qualifier/bracket edits are visible and auditable. Do not require an excluded qualification-tiebreak engine. |
| T-05 | **Player/media path:** account creation does not control an existing profile; administrator approval links it. Biography/handedness edits persist. A pending/rejected replacement stays private and leaves the existing photo public; approval replaces the public photo. |
| T-06 | **Scope/source path:** cross-event/organization writes are denied, the designated feed can confirm/correct its games, organizer actions require their grant, source takeover is explicit, duplicate deliveries are safe, and revocation removes credential access. |
| T-07 | **Payment path:** sandbox checkout and verified provider events update the correct charge/reservation; a redirect alone does not mark paid. Retries, expiry, waivers, external records, and full/partial refunds produce the expected observable state without overbooking or duplicate payment effects. |
| T-08 | **Ranking path:** independently worked 2026-27 fixtures cover in-scope lists, field strength/cutoffs, eligibility/ownership, carryover, counting/exclusions, rounding, adjustments, and ranking tie ordering. Inspect calculations through the application's calculation/review interfaces and compare expected publication/contribution results. |
| T-09 | **Replay/correction path:** the same frozen inputs/rules/engine revision reproduce the expected ranking output. After result correction and revised finalization, a replacement publication can be approved while the old snapshot/publication and its inputs remain unchanged and queryable. |
| T-10 | **Crawler-import path:** import a representative real crawler export including final-score-only games, complete line scores, incomplete rosters, parent-scoped IDs, and uncertain identities. Review/approve the batch, inspect public/provenance results, then rerun it without duplicating canonical records. Do not modify the crawler to make a fixture pass. |
| T-11 | **Public history/analytics path:** selected rankings come from approved or truthfully labelled historical publications; contributions reconcile to their output. Analytics expose filters/units/sample coverage, exclude unknown-required measurements appropriately, and do not invent absent data. |
| T-12 | **Frontend path:** homepage -> event/game -> team/player -> ranking contribution navigation works with real API data; selection survives updates/back navigation. Verify representative phone, tablet, and desktop layouts, keyboard access, readable score cells, bracket/list access, and useful error/stale states. A successful build alone is insufficient. |
| T-13 | **Offer path:** reproduce the hosted setup with scoped demo personas and resettable fictional scenarios separate from imported history; run and record all seven agreed workflows and the partner example; report actual implemented/verified coverage. |
| T-14 | **Unit-test evidence:** run the focused domain suites, report coverage/gaps, and show independently verified expected values for the major ranking, progression, identity, scoring, payment, and permission rules. Keep real database/provider/browser checks for behavior a unit test cannot establish. |

The seven demonstrations are: fan follows triple knockout; administrator approves a new event; volunteer scores/confirms/corrects; organizer registers next year's event and entries; player requests profile/photo changes with approval; administrator audits rankings; organizer finalizes a division and World Curling approves its ranking update. Their observable end states, not internal method calls, are the acceptance evidence.

D-01 through D-07 above are the primary acceptance map for these checks. The six exceptional-scenario deferrals govern the depth of T-03/T-06/T-07/T-09/T-10; their minimum safeguards remain testable. T-04 includes the 16-team main demonstration and one documented configuration per other accepted format family, not every theoretical parameter combination. T-11 uses the accepted P-05 metric inventory. P-01/P-05 explicitly bound the earlier broader coverage and metric examples; remaining supporting capabilities are retained.

All tests and recordings above are planned. No application test pass, benchmark, deployed service, imported production dataset, or verified WCTRS implementation exists merely because this spec is labelled ready for decomposition.

## Out of Scope

- Additional competition disciplines beyond men's/women's four-player and mixed doubles, age-specific variants, unusual format/stage combinations, and analytics beyond the minimum accepted P-05 inventory. Broader earlier ambitions/examples are superseded by these accepted offer limits; historical source data may still be retained with honest coverage labels.
- Elaborate resolution of the six exceptional scenarios listed above: already-started downstream bracket conflicts, transitive historical ranking reassessment, cascading identity collisions, curated-data reimport reconciliation, in-flight feed handoff/recovery, and automated late-payment/concurrent-refund reconciliation. Retain their stated minimum safeguards and ordinary workflow capabilities.
- Existing CurlHub integration or another pre-existing administrative-system dependency; ongoing crawler synchronization or operating the crawler as part of this platform.
- Secure backup implementation, independent breach-recovery design, restoration tooling, and restore demonstrations for the initial offer.
- Member Association ranking calculation, historical recalculation of every prior season, and public live/projected world rankings.
- Team lineage, predecessor/successor features, inferred history chains, and point transfers inferred from a lineage link.
- Full offline scoring synchronization, unrestricted competition-format authoring, sophisticated schedule optimization, and automated playoff-qualification tiebreak policy.
- Shot-by-shot collection/execution analytics and invented data filling historical gaps.
- Mandatory unchanged-game-lineup confirmations, second-person game result approval, administrator permission to correct a scorekeeper's confirmed result, or administrator dispute cases required for organizer bracket fixes.
- Generalized event-amendment review/policy engines, automatic refund policy, automatic waitlist promotion, live-money collection, and organizer payout/distribution workflows.
- Editorial article authoring/full-article republication, public-link editing on player profiles, fan email/push alerts, and cross-device favorites synchronization.
- Exhaustive optional edge-case design, copying reference-site implementation/assets, and filler content used to make unfinished pages look populated.
- Treating this parent spec as a single implementation ticket or representing a hosted offer as an official World Curling production launch.

## Further Notes

### Confirmed crawler source

The initial historical data source is the existing project at **`C:\Users\brthi\Projects\crawler-and-hq\curling-crawler-ai`**, as explicitly reconfirmed by the user. The platform checkout is **`C:\Users\brthi\Projects\world-curling-platform-2`**. The former is a source for a one-time export/import; it does not become the latter's live database or required running service.

Read-only inspection found a SQLite evidence archive and derived publication/API tooling. Source identifiers can be parent-scoped; source observations and extraction batches are not unique game counts. Historical team/event semantics require translation, and source player listings are not proof of actual stone delivery. Raw HTML retention is limited, so do not promise offline re-extraction of every old source page. Verify the available consistent input snapshot and its actual coverage when implementing the importer; this spec does not claim the archive is complete.

### Rule evidence and remaining interpretation work

The official-source review found an eight-versus-six inconsistency on mixed doubles counting events; the dated schedule and an official historical update support six, but no explicit current erratum was found. The eligibility example also displays allocations totaling 100.01% while requiring 100%, without specifying allocation residual handling. Preserve a sourced, explicit ruleset interpretation and independent expected values. Do not silently normalize ownership or claim those ambiguities were officially resolved.

### Decision authority and references

The user's final interview answers and later clarifications override earlier recommendations and the original schema proposal. Use the existing domain glossary and ADRs; the enduring-team assumption in the old proposal is superseded by core-composition identity. Accepted product requirements remain distinguishable from delegated technical defaults and unsettled production financial/operator policies.

Supporting project records: [scope and demonstrations](../../docs/planning/initial-offer.md), [frontend requirements](../../docs/planning/frontend-specification.md), [implementation defaults and stages](../../docs/planning/implementation-plan.md), [logical schema v0.4](../../world-curling-platform-schema-v0.4.md), [domain glossary](../../CONTEXT.md), [ADRs](../../docs/adr/), [decision record](../../docs/planning/design-tree.md), and [official-rule evidence](../../docs/planning/official-rules-evidence.md).

This single local parent issue was produced using the user-invoked [to-spec skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-spec/SKILL.md), following its problem/solution/stories/implementation/testing/exclusions structure. The `ready-for-agent` label makes it an input to ticket decomposition, not a request to build the whole platform at once. No external tracker issue, application implementation, or hosting resource was created by this spec.
