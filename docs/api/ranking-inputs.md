# Staff ranking source and starting-input review

`/api/v1/ranking-inputs` is private to a current global World Curling administrator session. Write requests also require the configured application Origin. Profile ownership, organizer permissions and team representation confer no authority here. The shared command is `saveRankingInput` in `src/modules/rankings/inputs.ts`; HTTP does not implement a separate policy.

## Reads and versioned commands

- `GET` returns current rule/source editions and season registrations, including independent platform core/member roles and any evidence-record ID.
- `GET ?id=<record-id>` returns the latest revision, actor/time, immutable history, and (for season inputs) saved versus current readiness and the pinned platform roster snapshot.
- `GET ?id=<record-id>&version=<positive-version>` inspects an earlier immutable revision. Current readiness is reevaluated; the originally saved readiness remains unchanged.
- `POST` accepts `{id, kind, version, requestId, state, data}`. `kind` is `rules` or `season`; `state` is `draft` or `reviewed`; `version` is the expected current revision, zero for creation. Reuse the exact request identifier/content after an uncertain response. A new command needs a new request ID.

The record, immutable revision and audit commit atomically. Identical actor/request deliveries replay their recorded revision; conflicting reuse or stale versions return409. Concurrent creation is serialized per record and season. A season has one evidence-record history; it cannot move to another registration. Rule revisions and season-roster versions remain pinned, never silently upgraded.

## Rules/source data

`data` contains `title`, `season`, inclusive `effectiveFrom`, exclusive `effectiveTo`, `sources`, `checkpoints`, `interpretations`, and `reviewNote`. A source has `{id,title,url,edition,retrievedAt,sha256}`: HTTPS URL without credentials/fragment, inspected edition, recorded ISO retrieval timestamp, and lowercase SHA-256 of retrieved bytes. Sources are staff-recorded evidence, not an automated authenticity certification.

Checkpoints have `{family,from,maxEvents,priorWeight,sourceId}`. Supported 2026-27 families are `four_overall`, `four_series`, `mixed_doubles`; exact prior weights are fractions/decimals. Dates must be unique/increasing per family and lie in the edition interval. Series carryover is zero. This is calendar selection, not event eligibility, a cutoff instant or a ranking calculation.

Interpretations have `{code,state,sourceIds,note}`; state is `supported` or `unresolved`. A reviewed rules/source record needs rationale and sourced checkpoints. It does not certify every later engine branch. The 2026-27 template and concrete independent fixtures are documented in `docs/planning/wctrs-input-interpretations.md`.

## Season starting-input data

`data` contains:

- `registrationId`, exact `rosterVersion`, `rulesId`, exact `rulesVersion`, `effectiveFrom`, `effectiveTo`.
- Explicit official `rankingPlayerIds` (regulars), `rankingAlternateIds` (designated alternates), and `rosterSourceId`. Both arrays contain existing distinct player IDs and cannot overlap. Official ranking roles may differ from platform core/alternate roles; this command never rewrites team core, accepted season snapshots or event lineups.
- `allocationOption`, `allocations: [{playerId,share}]`. Supported source proportions are four-equal, five-equal, front-rotation, one-rotation, majority-four and skip-fixed. An unresolved option/empty allocation remains a blocker. A supplied allocation must list exactly the official regulars, match its declared option and sum to exactly1. Official alternates cannot receive those shares. Rounded percentages are never normalized.
- `sources` in the same source format, plus `contributions` for the official regulars. Each contribution has `playerId`, exact `amount` (or null while unknown), `basis`, `sourceId`, `ownershipSourceId`, `eligibilitySourceId`, and applicability `note`. Basis is `unknown`, `historical-aggregate`, `documented-individual`, or `prior-team-share`. The last additionally requires `priorTotal`/`priorShare` whose exact product matches the amount. The aggregate/unknown branches never become complete ownership evidence.
- `reviewNote` and optional `biographyMissing`. Missing biography is informational, never a waiver of provenance, ownership or eligibility.

External exact values normalize to reduced nonnegative rational strings, with canonical numerator/denominator bounded to128 digits and decimals to12 fractional digits. Internal exact addition/multiplication accept their own canonical results without the former decimal-expansion parser defect. No floating-point allocation or hidden rounding residual is used.

Readiness has scope `starting-input-evidence`. `complete` means the scoped evidence fields/identities/applicability pass; `startingInput` is their exact sum, explicitly not a ranking total or a continuity-floor award. Consumers must require the revision's `state='reviewed'` **and** current completeness before treating it as reviewed input. A complete draft is still a draft. Later assessments/publications require their own event eligibility, ownership branch and calculation evidence; this screen supplies no publication command or generic waiver.

A stale platform season snapshot, unreviewed/inapplicable rule version, missing roster declaration, unresolved/provisional regular, missing exact ownership/amount/eligibility evidence or absent rationale is blocking. Front rotation requires the explicit supported exact-share interpretation. Mixed-doubles pair/individual ownership is still normatively unresolved and remains blocked. Historical approvals remain inspectable when current readiness changes.

## Errors

401 sign-in required;403 current staff/Origin required;404 record/version absent;400 malformed or invalid exact evidence;409 stale/conflicting command;422 attempted review with required unresolved evidence;503 save acknowledgement uncertain. After503/network loss retry the original command before editing. The UI freezes all editing/navigation controls during that uncertainty, and offers explicit read retry, source/registration refresh, current platform-snapshot rebasing and immutable history inspection.
