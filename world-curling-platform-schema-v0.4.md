---
title: World Curling Platform - Revised Logical Schema
version: 0.4-draft
date: 2026-11-07
status: Consolidated planning contract; not executable migrations
database: PostgreSQL
decision_basis: User interview Q1-Q62
---

# World Curling Platform: revised logical schema v0.4

This contract reconciles the original v0.3 proposal with the user's interview decisions. It is ready for shared-understanding review, not executable DDL or a claim of World Curling endorsement. Keep the original proposal as historical input; use this revision and the recorded ADRs when generating migrations after implementation is authorized.

The user's 2026-11-07 post-audit refinement and accepted P-01 through P-05 make the canonical specification's [seven demonstration workflows, deferrals, safeguards and settled core decisions](.scratch/world-curling-platform/spec.md#initial-offer-acceptance-seven-demonstration-workflows) the offer acceptance boundary. The main demonstration is a 16-team four-player triple-knockout event. Offer support is men's/women's four-player and mixed doubles with bounded format configurations; additional disciplines/age-specific variants and unusual combinations are deferred. This logical inventory does not require elaborate recovery tooling for deferred scenarios. No implementation is authorized by this document update.

## 1. Ownership and global conventions

One modular application owns one canonical PostgreSQL database. Logical modules own their writes; public consumers use restricted read APIs. Web and worker processes share domain commands, permissions, and transactions. No existing CurlHub dependency or ongoing crawler dependency is required.

Unless specified otherwise, entities use UUID primary keys, creation/update timestamps, and optimistic version fields where mutable. Use explicit foreign keys, constrained statuses, timezone-aware instants, calendar dates, IANA venue time zones, and unique scoped external identifiers. Monetary values are integer minor units plus currency. Ranking arithmetic is decimal/rational, never binary floating point; rules specify rounding and published precision.

Use JSON only for drafts, raw source evidence, parameters, frozen manifests/snapshots, and structured explanations. Core players, entries, game participants, end scores, and result relationships remain relational. Ordinary sport corrections retain history rather than deleting prior evidence.

All authoritative writes commit an audit record in the same database transaction. External provider calls are separately recorded/retryable; transactions cannot atomically commit remote Stripe or object-storage actions. Inbox/outbox/job records make retries safe.

## 2. Accounts, people, roles, and claims

| Logical table | Essential data and relationships |
|---|---|
| Authentication-provider tables | Accounts, credentials/identities, sessions, verification/recovery tokens; generated and maintained through the selected auth integration, separate from sport identities. |
| `core.users` | Application actor linked uniquely to an authentication subject; status. No automatic player/organization privileges. |
| `core.people` | Required display name; structured names/country where known; biography; handedness; current approved photo asset FK; identity status. Participation does not require an account. |
| `core.player_account_links` | User FK, person FK, approved claim FK, effective/revoked timestamps. Initial default: one active direct player link per user/person; staff roles remain independent. |
| `core.organizations` | Name, organization type, optional parent and country. |
| `core.person_affiliations` | Person/organization FKs, affiliation type, effective dates. |
| `core.role_assignments` | User FK, permitted role/actions, optional organization/event/division/game or team-season scope, grantor, validity/revocation. Global grants are explicit. Team-season representation is explicitly granted by World Curling staff under P-02; it does not transfer to another core identity. |
| `governance.player_profile_claims` | Requesting user/person FKs, request/status, administrator decision/actor/reason/time. |
| `governance.delegated_approval_scopes` | Granting authority, recipient organization/users, geography/organizer/discipline/category filters and named exceptions, validity. |

Anyone may create an account. A World Curling administrator must approve a request to link it to an existing player. Linked players edit biography/handedness and submit photos; other official identity/eligibility corrections are staff actions. Do not infer ownership from matching names or emails. Organizer/scorekeeper permissions are separate grants.

Accepted P-02 gives staff-authorized team-season representatives entry submission/amendment/withdrawal and related payment handling. Profile ownership grants no team authority; organizers retain manual entry. Scope relationships must match the referenced team-season/entry and event hierarchy.

Approval scope matching routes an application to one responsible authority and assigned reviewer. Reassignment and World Curling overrides are recorded decisions, not independent contradictory approval flags.

## 3. Core-composition teams, seasonal registration, and entitlements

### Team identity

`team = discipline + unordered set of core player identities`.

Alternate/coach/name/playing-position changes do not create a different team. A permanent core-player change creates or resolves another team ID. An identical known core roster reuses its team ID across seasons or after a break. Temporary event/game substitutions do not redefine the team.

| Logical table | Essential data and relationships |
|---|---|
| `core.teams` | Discipline FK/code, canonical identity key, display label/status. Identity key represents discipline plus normalized sorted core-person IDs. |
| `core.team_core_members` | Team/person FKs; unique membership. Relational membership must match the canonical identity key. |
| `core.seasons` | Name and start/end calendar dates. |
| `core.team_seasons` | Team/season FKs, seasonal display name, registration state; unique team/season. |
| `core.team_registration_versions` | Team-season FK, revision, effective interval, source/event origin where applicable, staff review state. |
| `core.team_registration_members` | Registration-version/person FKs, identity role (core/alternate/nonplaying), applicable registered playing role/position. |
| `core.point_allocation_declarations` | Team-season and registration-version FKs, revision, relevant effective dates, approval actor/status, source evidence/ruleset reference. |
| `core.point_allocation_members` | Declaration/person FKs, exact share numerator/denominator, optional original displayed percentage. |
| `integration.identity_corrections` | Retained/corrected person or team references, correction kind, actor/reason/time and evidence. Supports explicit duplicate resolution/redirects, not sporting lineage. |

Create/reuse teams automatically from event entries when core membership is identified. Incomplete entries can remain unlinked/provisional; do not invent core players or infer them from every person appearing in a game. World Curling staff maintain official registrations and resolve issues afterward; no separate approval blocks public participation.

Canonical team membership is immutable under ordinary roster changes. A staff correction of mistaken identity data is a distinct audited command, resolving any canonical-key collision explicitly. Preserve earlier result/ranking snapshots rather than silently rewriting their contents. Enforce membership/key consistency transactionally, including normal creation and reviewed corrections.

For the initial offer, a correction causing cascading team/entry/subject collisions may be rejected with a retained staff issue; multi-record consolidation tooling is deferred. Do not partially apply the correction. Accepted P-03 makes all five regular rotating members core while a designated alternate stays outside the core. World Curling staff record that distinction; a game's rotation never changes team identity. This platform convention is separate from the official registered ranking roster and eligibility rules.

Registered eligibility rosters may include alternates whose changes preserve team identity but affect ranking inputs. Preserve their versions. Staff-reviewed entitlements/allocations and dated ownership records, not identity equality, determine point rights.

Exact fractional storage can represent an approved one-sixth share without forcing rounded displayed literals to sum incorrectly. It does not authorize inferring fractions from a source example: the actual allocation interpretation and rounding policy must be documented in its ruleset before verified calculation. See the official-rule evidence notes.

No `team_lineage`/predecessor graph is included in the offer. Ranking carryover must be traceable through dated entitlements, source awards, declarations, and rules without requiring lineage features.

## 4. Event applications, editions, divisions, and entries

| Logical table | Essential data and relationships |
|---|---|
| `registration.event_series` | Recurring competition name and optional organizing organization. |
| `registration.events` | Dated edition; optional series FK, season/organizer FKs, name/dates/time zone, approved application FK, public-listing and lifecycle state. |
| `registration.event_divisions` | Event FK, name, discipline, eligibility category, rules profile, format configuration, capacity, registration mode/open state, ranking-applicability/review state. |
| `registration.venues`, `ice_sheets` | Venue location/time zone, optional coordinates; uniquely labelled sheets within venue. |
| `registration.event_venues` | Event/venue relationship, supporting multi-venue editions. |
| `registration.event_applications` | Applicant user/organization, proposed series/edition reference, submission state, responsible authority/reviewer, decision and resulting edition FK. |
| `registration.event_application_revisions` | Application FK, revision, proposed draft fields and author/time. Draft JSON does not replace canonical event/division rows. |
| `registration.event_staff_assignments` | User/event FK, narrower division/game scope where needed, assignment role/validity. |
| `registration.event_entries` | Division FK; optional resolved team-season FK; optional represented organization; display label, seed, submitting actor/on-behalf-of, entry status and version. |
| `registration.entry_lineup_versions` | Entry FK, revision/effective time, completeness state and author/source. |
| `registration.entry_lineup_players` | Lineup-version/person FKs, declared core/alternate/event-substitute roles and positions. |
| `registration.entry_readiness` | Entry FK, separate roster/eligibility issues and explicit exceptions. Payment state is derived from the payment ledger, not a single entry-status enum. |
| `registration.waitlist_records` | Division/entry FKs, order/request state, staff invitation and response timestamps. |

Separate event admission/listing, registration opening, sporting readiness, and ranking eligibility. A next-year application requires responsible organization, name, dates, city/country, and proposed divisions; venue/operational detail may be incomplete. Opening entries additionally requires capacity, terms/fees, entry requirements, and sufficiently defined format.

For the initial offer, authorized organizers edit ordinary approved event details with audit history. Do not implement a generalized material-amendment reapproval engine. Permission-controlled ranking decisions and versioned sporting corrections remain separate.

Teams may enter themselves through authorized representatives; organizers may select existing teams, assemble players, or create missing players. Provisional players need a display name and reviewable identity status, not a login. Name collisions suggest matches but never automatically merge people.

Support open, reviewed, and invited modes per division. Accepted entries may still have incomplete rosters, outstanding payment, or unresolved ranking eligibility. Historical unknowns are not equivalent to modern confirmed readiness.

## 5. Fees, reservations, provider events, and refunds

| Logical table | Essential data and relationships |
|---|---|
| `payments.division_fee_versions` | Division FK, amount/currency, effective revision, terms. |
| `payments.entry_charges` | Entry/fee-version FKs, frozen original amount/currency and current balance/state. Later fee edits do not overwrite an existing charge's history. |
| `payments.fee_adjustments` | Charge FK, discount/waiver type and amount, authorized actor/reason. |
| `payments.capacity_reservations` | Division/entry FKs, expires-at, held/converted/expired/released state, originating attempt. |
| `payments.checkout_attempts` | Charge/reservation FKs, unique provider session/reference, outbound idempotency key, state/timestamps. |
| `payments.provider_events` | Unique provider/event ID, verification/processing state, restricted relevant payload/digest, attempt/payment/refund links. |
| `payments.transactions` | Charge FK, provider payment reference, minor-unit amount/currency, provider confirmation/status/time. |
| `payments.external_payment_records` | Charge FK, externally received amount/currency, reference, recording actor/reason; never impersonates an online provider transaction. |
| `payments.refunds` | Payment-transaction FK, amount/currency, actor/reason, unique provider/refund reference and request key, requested/succeeded/failed state. |

Use a central Stripe sandbox account, not Connect/payout distribution or live money. Reviewed entries receive a payment invitation after acceptance with an expiring place reservation. Open entries may pay and accept immediately while capacity exists. Transactionally serialize capacity changes; count active holds and accepted entries consistently. Payment events cannot overbook after expiry.

Signed server events/provider state determine payment success; a browser redirect does not. Deduplicate inbox events and outbound requests. Refund totals cannot exceed the settled unrefunded amount. Withdrawals, payment expiry, staff-selected replacement invitations, waivers, and manual refunds are explicit actions; do not add automatic refund/promotion policy engines.

## 6. Competition formats, draws, scheduling, scoring, and results

| Logical table | Essential data and relationships |
|---|---|
| `competition.rule_profiles` | Versioned discipline-specific scoring/participation rules and provenance. |
| `competition.format_templates`, `format_template_versions` | Supported format family, generator revision, validated configuration and rule/profile versions. |
| `competition.stages`, `stage_groups`, `stage_entries` | Division-stage order/type, pools/brackets, entry/seed relationships. |
| `competition.draw_versions` | Division FK, revision, draft/published/superseded state, author/time and prior version. |
| `competition.games` | Stable fixture identity within a division/stage, current status and version. |
| `competition.draw_games` | Draw-version/game FKs; retains graph membership without duplicating a played game's identity when the draw changes. |
| `competition.game_slots` | Game FK and slot number 1/2, current entry FK where resolved. |
| `competition.advancement_rules` | Draw-version FK, source game outcome/group/manual qualifier, destination slot/stage or qualification/elimination label. |
| `competition.slot_assignment_events` | Slot FK, previous/new entry, source rule or organizer action, actor/reason/time. |
| `competition.draw_sessions` | Event FK, label, scheduled start/end/time zone context. |
| `competition.game_schedule_versions` | Game/session/sheet FKs, start/end or duration, revision/actor. |
| `competition.qualifier_selections` | Stage/entry FK, organizer-selected qualifier/seed/target, reason/actor/time. No automated playoff-qualification tiebreak policy. |
| `competition.game_scoring_sources` | Game FK, manual or designated partner-client FK, active validity interval and takeover actor/reason. |
| `competition.game_ends`, `game_end_scores` | Game/end number/status, known hammer entry FK; per-participant score rows. |
| `competition.game_score_events` | Game FK, ordered sequence, expected version/idempotency key, before/after state, actor/source and correction reason/time. |
| `competition.game_lineup_versions`, `game_lineup_players` | Game/entry FKs, source event-lineup version, declared/defaulted/confirmed-difference provenance and player roles. |
| `competition.game_participation_changes` | Game/entry/person FKs, substitution/participation change and end/time range where known. |
| `competition.measurements` | Entry/game/stage relationships as appropriate, LSD/DSC kind, value/unit, known provenance. |
| `competition.game_result_versions` | Game FK, revision, participant entry IDs, final scores, explicit winner/outcome/termination, source completeness, confirmer/corrector/time and superseded version. |
| `competition.standings_runs`, `standings_positions` | Stage/input revision, basic results/records and resolved/tied position information. Not world rankings. |

Generate relational games/advancement from round-robin/pool, single/double/triple-knockout, Page, Swiss/Schenkel, and supported stage-combination templates. Persist generated decisions and their version; do not infer a triple-knockout route solely from loss count. Defer unrestricted format authoring and schedule optimization. Organizers assign sessions/sheets and fix brackets as needed, with audit evidence.

Detect sheet/entry conflicts and known overlapping player assignments across divisions. Resolve qualification ties through organizer-selected qualifiers/seeds rather than an automatic playoff tiebreak engine. Template pairing/progression rules still require tested deterministic behavior.

The assigned scorekeeper can confirm and correct final results without an admin gate. Explicitly scoped partner feeds have the same game authority; organizer-level actions need separate grants. Accept only the selected scoring source, with authorized recorded takeover. Concurrent stale edits fail for review; duplicate requests cannot duplicate changes.

Game lineups default to the event lineup and scorekeepers record differences; no mandatory unchanged-lineup confirmation. Preserve the referenced lineup/version so later entry edits do not alter old game evidence. Defaulted participation is not independently verified participation.

Validate scores/hammer/outcomes under the discipline's rule profile. Do not hardcode one universal end count, point ceiling, or winner-from-total rule. Completed ordinary ends have appropriate participant scores; a blank, unplayed end, unknown end, concession, shootout, and forfeit are distinct. Historical final-score-only results are valid without fabricated ends. Result revisions retain participant identities so later organizer slot edits cannot rewrite who a prior result concerned.

Online scoring distinguishes local unsent input from server-accepted scores. Local transient edits are not canonical database records. Full offline synchronization is excluded.

## 7. Division finalization and corrections

| Logical table | Essential data and relationships |
|---|---|
| `competition.division_result_snapshots` | Division FK, revision, immutable frozen entries/lineups/results/placements/rule references, content digest, author/time and prior snapshot. |
| `competition.division_finalizations` | Snapshot FK, organizer actor/time, result revision captured, superseded finalization where applicable. |
| `competition.final_placements` | Snapshot/entry FKs, place or equal-placement group and evidence. |
| `competition.division_result_state` | Division FK, current result revision and last finalized snapshot/revision references; changed-since-finalization is derived. |

Divisions finalize independently. Keep required game outcomes and final placements complete or explicitly resolved by the organizer; do not require an excluded automatic qualification-tiebreak engine. Freeze source contents and references, not a mutable live query.

Scorekeeper corrections remain allowed after finalization. Increment current result state, preserve the old snapshot, flag changes, and let the organizer finalize a replacement. Organizer bracket changes remain auditable without an admin dispute workflow. A new sporting snapshot does not rewrite previously published ranking inputs or totals.

The offer demonstrates ordinary corrections without an already-started downstream dependency. If one occurs, retain actual participants/results and flag affected assignments; comprehensive continuation/repair policy is deferred. Do not infer an automatic sporting resolution or introduce an administrator permission gate.

## 8. WCTRS rules, ownership, calculations, and publications

| Logical table | Essential data and relationships |
|---|---|
| `ranking.lists` | WCTRS overall/series code, discipline/category, subject kind and publication state. No Member Association calculation lists. |
| `ranking.subjects` | Exactly one team-season FK or person FK, consistent with list/subject type; mixed doubles pair identity uses its two-core-player team-season. |
| `ranking.rule_sources` | Source URL/title, edition/cover/effective dates, stored content/digest and authority/interpretation notes. |
| `ranking.rule_versions` | List/season FKs, immutable versioned parameters, effective interval, source references, implementation revision and approval/interpretation state. |
| `ranking.starting_entitlements` | Subject/person/registration references as required, prior season/as-of dates, source publication/records, approved amounts/ownership details and provenance. |
| `ranking.season_carryovers` | Prior award/entitlement and source roster references, receiving person/team-registration references, applicable rule/version, eligibility evidence and dated raw/weighted amounts. Calculation trace only, not a general team-lineage feature. |
| `ranking.event_assessments` | Division/ruleset FKs, revision, exact source pre-event publication/cutoff, eligible field and factor inputs, computed/approved field strength. |
| `ranking.event_assessment_entries` | Assessment/entry FKs, resolved subjects, source rank/publication and explained contribution. |
| `ranking.event_point_awards` | Result-snapshot/entry/assessment/ruleset FKs, placement, amount, eligibility/exclusion and breakdown, revision/superseded award. |
| `ranking.award_ownership` | Award/person/team-registration/declaration references, exact share and resulting entitlement, effective interval/source rule. |
| `ranking.adjustments` | Subject/award FK where applicable, approved amount/reason/actor/effective time; explicit correction/penalty/exception, not hidden totals. |
| `ranking.calculation_runs` | List/ruleset FK, effective date and input cutoff, calculation time, code/artifact revision, input/output digests, draft/ready/published/superseded state and replacement run FK. |
| `ranking.run_inputs` | Run FK plus typed source FKs for snapshot/assessment/award/entitlement/carryover/adjustment/prior run, exact frozen content references/digests. |
| `ranking.positions` | Run/subject composite key, rank, raw/current/carryover/total values and tie-break explanation. |
| `ranking.position_contributions` | Run/subject FK, typed award/entitlement/adjustment source, raw amount/weight/effective amount, counted flag and exclusion reason. |
| `ranking.publication_decisions` | Run FK, World Curling approving actor/time/decision and predecessor reference. |
| `ranking.imported_editions`, `imported_rows` | Historical dated observation/publication, original source/labels/points/ranks, optional resolved subject mappings and completeness. Separate from calculated-run claims. |

Implement 2026-27 WCTRS men's/women's overall and applicable series lists, mixed doubles pairs, and mixed doubles individual lists under their official rules. Full competition-discipline coverage does not imply invented WCTRS lists for each discipline. Ranking tie rules are in scope even though playoff-qualification tiebreak automation is not.

Team identity does not carry points automatically. Player/registered-team entitlements, official eligibility/continuity rules, effective dates, declarations, and exceptions determine ownership/carryover. No lineage feature is required. Reviewed starting entitlements must contain the inputs needed by subsequent rules; a single historical total is not sufficient evidence for every ownership/weighting calculation.

Use the exact required historical pre-event rankings and event-edition history for field-strength assessments. Preserve resolved inputs and exclusions, not references to today's mutable rank or roster. Freeze content-addressed manifests; copied JSON is acceptable for a frozen snapshot but not a replacement for relational current sport records.

A World Curling administrator approves one dated list publication after inspecting changes/contributions/issues. Published runs, positions, inputs, and decisions are immutable. Later corrections calculate and approve replacement runs. Keep effective-date and published-at queries separate so corrected history and what the public originally saw both remain recoverable.

The offer demonstrates direct replacement after revised division finalization. A transitive reassessment engine for later events is deferred; retain exact historical inputs and report unresolved wider impacts without claiming they were recalculated. Accepted P-04 blocks calculated publication when required calculation inputs or ranking eligibility are unresolved. Staff may acknowledge informational warnings irrelevant to the calculation, such as missing biographies or unnecessary end scores; no configurable exception engine or implicit readiness-based waiver is included. Imported historical observations retain honest labels. Staff-operated on-demand calculations exercise dated rule checkpoints.

Public rankings show approved publications, not draft/live projections. Older imported rows can retain unresolved labels without fabricating team identities or reproducibility. Calculate complete synthetic fixtures for independent verification; missing historical inputs remain issues. Store source-seeded provenance so forward replay never falsely implies every prior season was recalculated.

## 9. Photos, news, partners, imports, and audit

| Logical table | Essential data and relationships |
|---|---|
| `governance.media_assets` | Object key, digest/type/size, uploading actor, private-pending/approved-public/private visibility. |
| `governance.profile_photo_requests` | Person/user/proposed asset FKs, pending/approved/rejected status, reviewer/time/reason. |
| `news.sources`, `news.items` | Approved feed URL/status; unique source/external item, headline/publisher/date/supplied excerpt/original link, hidden state. No article authoring. |
| `integration.partner_clients`, `partner_credentials` | Organization/client identity, verifier/key prefix, permitted action/scope records, expiry/revocation/rotation. No recoverable raw API keys. |
| `integration.partner_scopes` | Client/action/organization/event/division/game grants and validity. |
| `integration.sources`, `import_batches`, `source_records` | Source identity; batch digest/parser/export versions/review; restricted raw evidence and source completeness. |
| `integration.entity_mappings` | Source + entity kind + fully parent-scoped external key -> internal identity, unique per source key. |
| `integration.provenance`, `data_quality_issues` | Entity/field evidence, verification state, uncertain identities/conflicts and administrative resolution. |
| `integration.inbox`, `outbox` | Unique external delivery/request identity or internal event sequence, payload/digest, processing/retry state. |
| `governance.audit_log` | Human/client/service actor, action/entity, request correlation, time, redacted before/after values or revision links, source/reason. |
| Job-library tables | Separate library-managed schema/version for durable jobs; coordinate migrations and business-role permissions. |

Approving a photo changes the public reference; rejected/pending uploads never replace the current public photo. Restrict private media/review payloads and redact credentials, personal contact details, and provider secrets from generic logs. Public read models expose only selected sport/profile/news fields and approved media.

Approval binds to immutable server-controlled reviewed bytes/digest, not a client-writable staging object. Basic current-authority/source checks apply before a queued write changes canonical data, even though elaborate in-flight source handoff recovery is deferred.

Use administrator-approved historical batches and idempotent translation, not an ongoing crawler connection. A batch can admit historic events/results with truthful source status without inventing human certification. Keep fully scoped external IDs and raw evidence where available; unknowns stay unknown. Fictional demonstration scenarios use separate environments/data and clear labels.

Bind import approval to the reviewed batch contents. Repeat unchanged batches safely; preserve staff-corrected canonical values when reimported evidence conflicts and retain an issue. Detailed field-level reconciliation is deferred. Payment exceptions likewise retain no-overbooking and no-excess-refund constraints, including pending refund amounts, while elaborate automated settlement is deferred.

Analytics query suitable result/line-score/ranking evidence with explicit filters, denominators, sample coverage, and method versions. Only known hammer supports hammer-dependent measures. Profile/career statistics cannot treat defaulted or missing historical participation as verified stone delivery. Browser favorites need no server-side table in this offer.

## 10. Essential database checks and migration review

1. Canonical team identity agrees with unique relational core membership; alternate/coach changes do not affect the key. Enforce immutable normal membership and explicit reviewed identity correction.
2. Team-season uniqueness; registration revisions/effective intervals and allocation-declaration membership remain consistent. Exact allocation sums follow the approved ruleset, not rounded display strings.
3. Active entry uniqueness for a known team-season/division; keep nullable unresolved entries possible. Lineup versions belong to their entry; game entries/slots belong to the game's division.
4. Unique game/end and score-per-participant keys; constrain participants, known hammer, result/winner/outcome, and rule-profile scoring. Do not reject valid equal-score shootout outcomes solely from totals.
5. Draw rules/slot assignments have compatible sources/destinations. Version structural edits and preserve game-result participant references.
6. Capacity holds, acceptance, release/expiry, payment/refund states, provider IDs and idempotency keys are transactionally consistent; money/currency checks apply.
7. Typed ranking inputs/contributions have exactly the applicable source relation. Calculated positions resolve real subjects; imported observations are separate.
8. Published/finalized snapshots and ranking outputs cannot be overwritten by mutable current-record edits. Replacement chains and effective/publication timestamps are indexed.
9. Source mappings include parent scope; feed/provider inbox deliveries are unique. Repeat imports and jobs cannot duplicate canonical records.
10. Audit changes and canonical writes are atomic. Dedicated migration/library permissions differ from ordinary web/worker runtime privileges. Use foreign keys, checks, partial unique indexes, and transactional/deferred validation where required; not application checks alone.

## 11. Acceptance and explicit exclusions

The [implementation plan](docs/planning/implementation-plan.md) defines staged delivery and verification; the [initial offer](docs/planning/initial-offer.md) contains the seven user demonstrations. This document does not claim those checks have run.

Excluded: team lineage, Member Association calculations, secure backup/recovery implementation, full offline synchronization, shot-by-shot collection, automated playoff-qualification tiebreak policy, unrestricted format design, schedule optimization, editorial authoring, automated refund/promotion policies, and live projected world rankings.

Resolve official mixed-doubles counting-event and allocation-rounding interpretations in [rule evidence](docs/planning/official-rules-evidence.md) before claiming verified sporting correctness. Keep the offer's unresolved production financial and operator-policy choices explicit. No provider resources, database migrations, or live data changes are authorized merely by this logical schema.
