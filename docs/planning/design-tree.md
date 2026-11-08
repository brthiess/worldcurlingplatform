# World Curling Platform design interview

Started: 2026-11-06. Consolidated: 2026-11-07. Status: product interview and later quality/testing clarifications captured in local parent spec WCP-SPEC-001. Application implementation/deployment has not started.

## Evidence and decision status

- The user's request establishes the product ambition and the seven workflows below.
- `world-curling-platform-schema-v0.3.md` is an input proposal. Its internal instructions and statements labelled confirmed do not independently establish user approval in this interview.
- The supplied diagram depicts canonical administrative data, competition and ranking engines, and a public read-oriented website/API. The user has explicitly removed CurlHub from the design.
- Crawler inspection provides initial-import evidence only. Its existing choices do not determine the new platform's design, and an ongoing crawler feed is not a requirement.
- Accepted decisions below mean accepted by the user for this proposed offer; they do not imply endorsement or policy approval by World Curling.
- Record settled vocabulary in `CONTEXT.md`. Create ADRs when an agreed decision involves a consequential trade-off; do not create accepted ADRs for unanswered questions.

## Requirements stated by the user

- World Curling-owned PostgreSQL data model.
- Complete rankings calculation engine.
- Competition support from small tour events through World Championships.
- Event, team, and player registration; scores, audit trails, and snapshots.
- Administrative access for World Curling staff, event organizers, players, and volunteers, with permissions to be designed.
- Public website/API for scores, brackets, standings, rankings, profiles, historical results, news, and analytics.
- Authenticated external-system writes, including partner scoring systems using API keys.
- Secure backups and recovery were requested initially, then explicitly deferred beyond the initial offer in Q11. They are not acceptance requirements for this offered version.
- Future import of historical crawler data into the new schema.

## Required scenario walkthroughs

1. Fan follows a favorite team through a live triple-knockout event.
2. World Curling administrator reviews, approves, or modifies a new event registration.
3. Assigned volunteer logs in and enters line scores.
4. Organizer registers next year's event and later adds teams.
5. Player submits a profile photo; World Curling administrator approves it.
6. World Curling administrator inspects and audits historical rankings.
7. Organizer finalizes an event, enabling final ranking calculations.

Each walkthrough must eventually address its normal path, permissions, incomplete information, conflicts, corrections, public visibility, and audit evidence.

Session steering on 2026-11-07: the user explicitly asked to keep the offer simple and said not all edge cases need coverage. Finish main workflow and major architecture/import decisions; document sensible implementation defaults and defer optional edge-case branches rather than expanding the interview indefinitely. See `docs/planning/initial-offer.md` for the consolidated working scope.

## Settled decisions: round 1

- Q1: Use the name World Curling Platform. It is standalone, with no existing-system dependency. The crawler supplies data for an initial import.
- Q2: World Curling administrators determine which events are allowed in the system. Awarding ranking points is not a prerequisite for inclusion.
- Q3: The crawler is otherwise outside the operating design. The deliverable is a nearly production-ready first draft to present as an offer to World Curling, not an immediately live service. The user did not adopt the proposed ongoing-crawler conflict scenario; Q59 later establishes batch-reviewed initial import with truthful provenance.
- Q4: No fixed launch date. Test and record realistic workflows, including the seven requested scenarios, for the presentation. A live-event pilot was suggested but not adopted as the acceptance milestone.

See `docs/adr/0001-standalone-platform-and-initial-import.md` for the system ownership boundary.

## Settled decisions: round 2

- Q5: Backup restoration is not required; accounts, persistent data, approvals, scoring, ranking calculations, and partner API writes are desirable operational capabilities for the offered version. Q11 subsequently clarified that secure backups are also excluded from initial-offer scope.
- Q6: Ideally support all disciplines. Detailed competition/rules coverage still needs a matrix; this does not mean identical scoring or eligibility rules for every discipline.
- Q7: Adopt the recommendation: complete WCTRS calculations for selected disciplines/seasons, with older published rankings retained with provenance. Historical recalculation is promised only where rules and required inputs can be established. Q43 later explicitly excludes Member Association ranking calculation from the offer.
- Q8: Adopt the recommendation: self-registration, verification before controlling an existing player profile or organizer organization, and organizer invitations for event-specific volunteers. Account creation confers no authority over existing sport records.
- Q9: Adopt explicit World Curling-controlled delegation. Other organizations' personnel, including Curling Canada personnel, may approve events when authorized. Organizers/volunteers/API clients receive scoped permissions and shared validation/audit rules. Q15/Q22 subsequently define scope matching and assigned approval responsibility.
- Q10: Include actual entry-fee collection workflows using test payment clients for the offer. Exclude an editorial authoring system. Collect news from external curling sites. Investigate The House of Curling for analytics ideas; this is permission to research, not acceptance of every feature it contains.

## Settled decisions: round 3

- Q11: Explicitly exclude secure data backup work from the initial offer. Do not require a backup demonstration or restore tooling. This supersedes the initial backup requirement for this version; later deployment readiness is a separate future scope.
- Q12: Accept all four proposed analytics groups: results/careers, ranking history, scoring patterns, and situational analysis, with visible samples and coverage. Detailed metrics and inclusion rules remain open. Shot-by-shot execution analytics is not an accepted requirement. See `docs/planning/analytics-reference.md`.
- Q13: Accept automatic news aggregation from approved sources: headline, publisher, date, supplied excerpt, and original article link. Administrators manage sources and may hide duplicates or unsuitable items. No editorial authoring system.
- Q14: Provisionally collect entry fees centrally. The user remains unsure about the long-term collection arrangement. Use test payment clients for the offer; final central collecting organization, distribution/settlement model, commissions, and refund responsibilities are not settled. Do not adopt the earlier recommendation for direct organizer collection.
- Q15: Accept configurable delegated approval scopes based on geography, organizer affiliation, discipline, event category, and named exceptions, with visible responsibility for each application. Delegated event approval does not automatically confer ranking publication authority. Overlapping-scope and review-conflict handling still need design.
- Q16: Accept event series -> dated event edition -> division. Each division has its own entries, format, games, and results. Even a single-competition edition has one division. Distinguish discipline, eligibility category, and stages in later modeling.

## Settled decisions: round 4

- Q17: Accept separate decisions for event admission/public listing, opening registration, and each division's ranking eligibility assessment. Public listing does not guarantee ranking points.
- Q18: Keep changes to approved event information simple for the offer; the detailed amendment policy is left for World Curling. The earlier proposal for a material-change/reapproval matrix was not adopted. Working default below is explicitly provisional.
- Q19: Teams can register themselves and organizers can manually add teams. The organizer can select an existing team, assemble from existing players, or create a missing player. Q23/Q44-Q52 subsequently settle event-lineup isolation, core-composition identity, and automatic creation/reuse.
- Q20: Accept per-division open registration, reviewed applications, and invitation-only modes. Reviewed applications request payment after acceptance, with a defined payment window reserving a place. Open registration may combine payment and acceptance while space remains. Handle payment failures and capacity without silent overbooking.
- Q21: Accept minimum application fields: responsible organization, event name, dates, city/country, and proposed divisions. Venue and operational details may initially be incomplete. Require capacity, fees/payment terms, entry requirements, and sufficiently defined format before opening entries; teams and detailed draws come later.
- Q22: Accept one responsible approval authority and visible assigned reviewer per application. Other authorized reviewers may comment or explicitly take over. World Curling can resolve disputes or override with a recorded reason; do not maintain contradictory independent approvals.

## Settled decisions: round 5

- Q23: Selecting a registered team prefills an event-specific lineup. Changes affect that entry only. An assembled lineup may enter without creating a permanently registered team; association with a registered team is explicit and separate from ranking eligibility.
- Q24: A missing player may be created immediately with a required display name and structured name/country where known. No login or email is required merely to appear in competition. Additional private information is collected only where the relevant eligibility policy requires it; later account/profile control requires verification.
- Q25: Show possible player matches and distinguishing information. If identity remains uncertain, permit a provisional new player flagged for authorized review. Name matching alone cannot merge people; resolutions preserve history.
- Q26: Draft and accepted entries may have incomplete rosters, visibly marked. Readiness to compete requires applicable discipline lineup information or a recorded authorized exception. Entry acceptance, payment, roster readiness, and ranking eligibility are distinct dimensions.
- Q27: Manually added/invited teams owe the division's normal fee unless an authorized person explicitly records a waiver, discount, or external payment with a reason. External-payment records remain distinguishable from platform-processed payments.
- Q28: Support withdrawal, payment-reservation expiry, waitlists, and authorized full/partial refunds through the test integration. Expiry releases capacity. Staff explicitly decide refunds and invite replacements; withdrawal does not automatically imply a refund.

The user accepted Q23-Q28 together and reiterated simplicity for the initial offer. Do not add automatic refund-policy engines, waitlist promotion, or account requirements for every player.

## Settled decisions: round 6

- Q29: Accept configurable templates for round robin, pools, single/double/triple knockout, Page playoffs, Swiss/Schenkel, and combinations of supported stages. Organizers choose participants, seeds, qualifiers, and rules and preview before publishing. Defer an unrestricted format designer.
- Q30: Generate competition structure and support organizer-assigned draw sessions/sheets with template assistance. Detect sheet/entry clashes and known player conflicts across divisions. Defer a sophisticated schedule optimizer.
- Q31: Provide mobile-friendly scoring for assigned games: start game, enter/correct end scores, known hammer, game completion/outcome/termination, and LSD/DSC measurements where required. Missing information remains unknown. Shot-by-shot tracking is excluded.
- Q32: Online scoring for the initial offer. Distinguish saved and unsent input, preserve unfinished edits during temporary interruptions, and show connection status. Full offline synchronization/conflict resolution is deferred; local unsent input is not a confirmed score.
- Q33: The user's explicit correction grants final-result confirmation to the assigned scorekeeper; no additional results-official permission or compulsory second approver is required. Live scores are provisional, confirmed results advance the bracket, and confirmer/time are retained. Partner API auto-confirmation is not settled by this human-role decision.
- Q34: Each game uses manual scoring or one designated partner feed. Authorized staff may explicitly take over with a recorded reason. Conflicting/outdated edits require review rather than overwriting newer scores; duplicate deliveries cannot duplicate scoring actions.

The user accepted Q29-Q34 with the explicit Q33 correction and again requested simplicity for the offer.

## Settled decisions: round 7

- Q35: The scorekeeper may change a confirmed result without administrator approval. The change must be auditable. Do not introduce the proposed administrator-authorized reopening gate.
- Q36: Allow the event organizer to modify affected competition/bracket records as needed. Do not impose an administrator dispute-resolution workflow. The prior recommendation's precise automatic-repair and conflict-blocking behavior was not accepted wholesale; preserve audit history and provide organizer correction capability.
- Q37: Default game lineups to the event lineup for convenience. Scorekeepers confirm/record differences, rather than confirming every unchanged lineup. Preserve the distinction between a declared/defaulted lineup and independently verified participation without adding mandatory confirmation steps.
- Q38: Leave automated playoff-qualification tiebreak policy out of the initial offer. This does not remove basic standings, bracket display, or recording final placements. Working simplification: organizers identify tied qualifiers/seed order manually; no configurable qualification-tiebreak engine.
- Q39: Provisionally allow independent division finalization (user said probably). Q41 subsequently accepts the snapshot/revised-finalization flow without removing scorekeeper correction authority.
- Q40: World Curling administrators may approve ranking updates. Q42 subsequently defines dated-list approval; the technical plan documents draft job triggers. Organizer finalization does not itself publish rankings.

## Settled decisions: round 8

- Q41: Preserve the finalized result snapshot while allowing scorekeeper corrections. Audit the correction, flag changed results, and allow organizer finalization of the revision. Previously approved rankings remain unchanged until World Curling approves a replacement update.
- Q42: Approve a complete ranking list for an effective date, showing differences from the prior publication, event contributions, calculation explanations, and unresolved issues. Approval publishes that version with recoverable inputs/history.
- Q43: Calculate WCTRS only, including applicable WCTRS team/pair/player and series lists. Do not implement a Member Association ranking calculation engine for the offer.
- Q44: Permanent core-player additions/removals create a new team ID. Do not use a permanent team identity that survives core-composition changes. Rankings respond to membership according to their rules. Q47-Q50 subsequently resolve identity membership/reuse and explicitly defer lineage.
- Q45: The user's likely preference is World Curling staff maintenance of official team registrations/rosters, with event registration able to create teams automatically. Do not adopt the proposed team-manager-maintained official-roster/declaration workflow. Q49/Q52 subsequently settle automatic creation/provisional entries and after-the-fact staff correction.
- Q46: Public rankings show approved publications/history for the offer. Live competition data updates independently. Projected/live world rankings are deferred.

## Settled decisions: round 9 (2026-11-07)

- Q47: Alternate and coach changes do not create a new team. Apply Q44's identity-change rule to core players; names/playing positions are not identity changes under the retained Q48 recommendation. Do not include every registered fifth/alternate in an identity fingerprint.
- Q48: Accept reuse of the same team ID for an identical core-player set and discipline, including after a break or across seasons. Season registrations and dated participation remain separate. Reuse does not itself restore or transfer points.
- Q49: Reuse/create a team automatically when an entry's permanent core membership is identified, without another registration screen. Incomplete entries may remain provisional. Temporary substitutes on an existing team's event entry retain that team's association. This refines Q23's allowance for entries without a permanently registered team.
- Q50: Defer team lineage entirely for the initial offer: no lineage feature or automatic history chaining. Preserve team/player/event records without inferring predecessor/successor relationships.
- Q51: Treat erroneous player selection as an audited data correction rather than a genuine permanent roster transition. Staff explicitly resolve resulting duplicates. Preserve earlier publication inputs and review affected rankings through replacement updates.
- Q52: Automatically created teams can appear publicly and participate immediately through their admitted event. World Curling administrators can change records and resolve issues afterward. Do not impose a separate pre-publication team-registration approval gate.

## Settled decisions: round 10

- Q53: Anyone may create an account. To control an existing player profile, the user submits a link request that a World Curling administrator must approve. No automatic account/profile linkage by name or account creation.
- Q54: Player-editable fields are short biography, handedness, and photo submission. Public links are not included. Photo replacements require approval; keep the current approved photo public while a replacement is pending/rejected, keep pending media private, and show status/rejection reason to the player. Other identity/eligibility corrections go to World Curling staff.
- Q55: Accept browser-saved team/player/event favorites without login. Defer email/push alerts and account synchronization. Team favorites follow the exact core composition; no lineage-based migration.
- Q56: The public homepage leads with event cards containing the most current draw and line scores, with routes into standings/bracket, teams, and the event page. Follow the attached House of Curling screenshot's information pattern: event header/status, latest/current draw, upcoming draw preview, and event navigation. Scores and bracket paths support mobile viewing and live updates; provisional/confirmed status and update time remain visible. This refines the earlier event-detail-page-only recommendation.
- Q57: World Curling administrators provision partner integrations with organization/event scopes and explicit permitted actions. Organizers may select approved feeds for their games. Credentials can be rotated/revoked and changes identify the responsible partner.
- Q58: An explicitly authorized designated partner feed may confirm/correct its games with scorekeeper-equivalent validation/audit, without compulsory human confirmation. Organizer actions such as division finalization require separate permission. Ranking publication still requires World Curling approval.

## Settled decisions: round 11

- Q59: Accept administrator-reviewed historical-import batches, repeatable import, a representative validation batch followed by broader loading, preserved sources/missingness, flagged identities, and clearly separated fictional demonstration data.
- Q60: First fully calculated season is 2026-27. Retain older publications with provenance. Use traceable prior-season inputs and reviewed imported starting entitlements where necessary. Demonstrate reproducibility with complete test fixtures; missing historical inputs remain explicit issues.
- Q61: Accept one modular application backed by PostgreSQL, distinct public/admin/API permissions, and background imports/news/ranking work. The user has no strong framework or hosting preference and explicitly favors PostgreSQL. Specific implementation/provider defaults may be selected and documented in the consolidated technical plan.
- Q62: Hosted demonstration is required so World Curling can explore it. The user will purchase a public domain and host it there. Include repeatable demo data/accounts, seven recordings, setup documentation, and test-mode payments. Domain purchase/DNS details are deployment-time inputs, not blockers to planning.

## Current frontier

The earlier interview closed optional edge-case questioning and the user authorized the linked to-spec skill. Following the independent audit, the user approved organizing the offer around the seven demonstrations and deferring elaborate exceptional recovery handling. The user subsequently accepted the five recommended core product decisions, changing the main demonstration to sixteen teams. Those decisions are settled; implementation remains unauthorized. The canonical local parent specification remains the single requirements body for ticket decomposition.

### Accepted post-audit scope refinement (2026-11-07)

- D-01 through D-07 in the canonical spec are the primary acceptance map: fan follows triple knockout; event approval; volunteer scoring/correction; next-year event and entries; profile/photo approval; ranking audit; division finalization and direct ranking replacement. The partner example accompanies scoring.
- Defer elaborate handling of corrections after downstream play, transitive historical ranking reassessment, cascading identity collisions, reimport conflicts with curated records, in-flight feed handoff/recovery, and late-payment/overlapping-refund reconciliation.
- Keep basic safeguards: preserve history, flag conflicts, leave colliding changes unapplied, protect curated values, check current write authority/source, prevent overbooking/excess refunds, and retain safe retries. Ordinary workflow capabilities and meaningful testing remain required.
- The 95 stories remain the inventory; supporting public features and accepted format/ranking families are not silently removed. Concrete offer coverage and metric completion are bounded by explicit core decisions.
- P-01 through P-05 are accepted: a 16-team four-player triple-knockout main demonstration; men's/women's four-player and mixed-doubles support with one documented configuration per other accepted format family; World Curling-granted team-season representation without automatic transfer to another core identity; all five regular rotating members as core and designated alternates outside it; calculated publication blocked on unresolved required inputs/eligibility; and four minimal analytics views. Additional disciplines, age-specific variants, unusual combinations and additional metrics are explicitly deferred. Do not reopen these decisions or deferred exceptional policies as initial-offer interview blockers.
- The accepted analytics minimum is win/loss records and titles; approved rank/points history and contributions; blank/steal rates; and historical win rates by end/margin/hammer, with samples and unknown-data exclusions. Staff operate ranking calculations/reviews for the offer; no scheduling prerequisite is added.
- Staff may use the existing on-demand ranking calculation/review flow to demonstrate dated rules. An automated ranking calendar, transitive cascade engine, exhaustive recovery permutations, and closure of every audit finding are not prerequisites to an offer.

Technical details delegated to documented defaults include framework versions, exact UI labels, endpoint pagination, queue tuning, and deployment configuration. Deferred features remain deferred rather than silently becoming prerequisites. Official-rule evidence gaps remain explicit research/validation items before claiming verified ranking correctness, not questions asking the user to guess sporting rules.

The user's final quality refinement explicitly requires a functioning frontend combining the strengths of CurlingZone and House of Curling, without AI filler. A bounded CurlingZone reference review and `frontend-specification.md` make this concrete without reopening edge-case interviewing. Frontend completion includes backend-connected interactions and visual/browser verification, not just page mockups.

During to-spec the user explicitly reconfirmed the crawler source project and requested substantial unit testing as far as reasonably possible. The parent specification therefore combines domain-unit tests with real PostgreSQL integration and browser/API acceptance, independent ranking expectations, and reported coverage/gaps.

Recorded answers supersede earlier recommendations where they differ. The consolidated implementation defaults remain reviewable in the technical plan.

## Provisional decisions to revisit

- Central fee collection is a working assumption for the offer, not a final financial operating model. Resolve production collection/distribution responsibilities before any real-money activation.
- For Q18, use a simple offer-stage default: authorized organizers may edit their approved event's ordinary details with change history, and authorized administrators may inspect/correct them. Do not build a configurable amendment reapproval matrix yet. Existing admission, scoped permissions, and separately controlled ranking eligibility still apply; competition/result corrections follow their own later design. This is a provisional simplification under the user's instruction, not World Curling's settled policy.
- Q38 playoff-qualification ties are handled by organizer selection for the offer; do not reintroduce qualification tiebreak automation as a finalization prerequisite. Q41 accepts the revised finalization/correction flow following Q39's independent-division working assumption.
- World Curling staff maintain official team data; Q49/Q52 establish automatic creation/public participation and after-the-fact administrative correction without a separate team-registration gate.

## Dependent branches

- Ownership and coverage -> event/series/division language, organizations, disciplines, eligibility, calendars, and historical coverage.
- Ownership and evidence policy -> partner write authority, source conflicts, identity resolution, initial import, and provenance. Ongoing crawler synchronization is outside the requested scope.
- Coverage and acceptance milestone -> rollout sequence, operating scale, service expectations, and staffing needs.
- Registration ownership -> people/accounts, team continuity, roster versions, approvals, fees, and media moderation.
- Competition scope -> draw generation, scheduling, score entry, offline behavior, game certification, advancement, and correction handling.
- Ranking scope and official-result policy -> rulebook research, historical rule versions, point ownership, finalization, appeals, reproducibility, and publication.
- Public evidence policy -> fan navigation, live status, brackets, accessibility, profiles, historical views, news, and analytics.
- Q53-Q58 settle the main profile, homepage, favorites, and partner-feed workflows. Low-impact UI details and optional edge cases can use documented defaults under the user's simplification instruction.
- Operating obligations and authority -> access controls and audit protection. Secure backups and restoration are outside initial-offer scope by Q11; do not reintroduce them as required demonstrations or implementation tasks.
- Settled domain behavior -> schema critique, module boundaries, API contracts, technology choices, and implementation plan.

## Initial-import evidence

Read-only crawler inspection is complete. Detailed migration design is deferred until the import branch of the interview.

- The crawler uses a SQLite evidence archive and separate derived publication generations. It is a source dataset, not the platform's operational database.
- Its roster-based team identity resembles the user's Q44 direction more closely than the proposed schema's enduring teams. The accepted platform identity uses core players and discipline, excludes alternate/coach changes, and reuses identical known compositions. Its discipline-specific event identity still differs from the accepted event/edition/division structure. Translate source identities rather than importing crawler policy wholesale; uncertain historical core membership remains unresolved evidence.
- Source identifiers may be parent-scoped; source, entity kind, and parent scope must survive translation.
- Historical ranking observations do not establish a reproducible ranking calculation engine. Missing lineup information does not establish actual on-ice participation.
- Raw HTML retention is limited. Do not promise that all historical source pages can be re-extracted from the archive.
- Evidence references: crawler `CONTEXT.md`, `src/curling_archive/source_history_sqlite.py`, `src/curling_archive/identity.py`, `src/curling_api/prepare.py`, `docs/feature-collection.md`, and `docs/lineup-collection.md`. No current deployed coverage or historical completeness was established.

## Open evidence work

- The House of Curling review is complete for initial feature inspiration; evidence and proposals are in `docs/planning/analytics-reference.md`. Detailed statistical-method and data-readiness work follows feature selection.
- Primary-source research and a bounded discrepancy follow-up are complete; see `docs/planning/official-rules-evidence.md`. Historical rules/full formulas remain unaudited. Official historical updates corroborate six mixed-doubles counting events but no explicit current erratum was found; allocation precision/residual policy remains unspecified. Record supported interpretations and open official clarifications rather than asking the user to guess sporting facts.
