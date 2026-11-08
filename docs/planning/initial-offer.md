# World Curling Platform: initial offer

Product scope consolidated on 2026-11-07 after Q1-Q62. Ready for shared-understanding review. This is a planning artifact for the user's proposed offer to World Curling, not implementation authorization or World Curling endorsement. Detailed decisions are recorded in `design-tree.md`, terminology in root `CONTEXT.md`, and consequential decisions in `docs/adr/`.

## Outcome

A standalone, nearly production-ready first draft with a World Curling-owned PostgreSQL data model, administrative workflows, competition operations, complete in-scope WCTRS calculations, public website/API, and scoped partner writes. Demonstrate and record the requested workflows. No fixed launch date; this version is an offer, not an immediately live official service.

Keep the first offer simple. Implement the main workflows and agreed audit/correction behavior, using documented defaults for ordinary UI details. Do not add optional policy engines or explore every edge case before making the offer concrete.

The public frontend is a functioning delivery requirement. It combines CurlingZone's cross-event discovery and score/team/ranking navigation with House of Curling's current-draw presentation and connected history/analytics. The user explicitly requires high-quality execution without generic AI copy or filler. See `frontend-specification.md` for the page map, visual/content standard, backend connection, and acceptance checks.

## Main product boundaries

| Area | Agreed behavior |
|---|---|
| Ownership | No CurlHub or existing administrative-system dependency. Crawler supplies initial historical data only. |
| Event structure | Recurring series -> dated edition -> one or more independently run divisions. World Curling-controlled delegates may approve events. Ranking eligibility and registration opening are separate. |
| Coverage | Men's/women's four-player and mixed doubles; main demonstration is a 16-team four-player triple-knockout event. One documented configuration per other accepted format family. Additional disciplines, age-specific variants and unusual combinations are deferred under accepted P-01. No automatic playoff-qualification tiebreak engine. |
| Team identity | Core-player set plus discipline; core changes create/reuse another identity. Alternate/coach/name/position changes do not. Identical compositions reuse identity across seasons. No lineage feature. |
| Entries | Team self-entry or organizer creation from existing teams/players or newly added players. Known core membership creates/reuses teams automatically; incomplete entries can be provisional. |
| Administration | Event-created teams can appear immediately; World Curling staff correct records and resolve issues afterward. Players need no accounts merely to participate. |
| Payments | Central collection is provisional; use test payment clients. Open/reviewed/invited entry, capacity reservations/expiry, manual waitlist invitations, explicit waivers/discounts/external payments, and authorized full/partial test refunds. |
| Competition | Template-driven games/advancement, organizer-managed schedule/sheets and bracket corrections, mobile-friendly online scoring, and visible saved/unsent status. |
| Results | Assigned scorekeeper or explicitly authorized feed can confirm/correct results, with audit history. No compulsory second approver. Game lineups default from the event lineup; record differences. |
| Finalization | Organizer finalizes division results into preserved snapshots. Corrections remain allowed; changed results can be finalized again. Approved rankings require a separately approved replacement publication. |
| Rankings | WCTRS only, first fully calculated season 2026-27: relevant overall, series, team/pair/player lists. World Curling approves a dated list publication with change comparisons, contributions, explanations, and preserved inputs. Older publications and reviewed starting entitlements retain provenance. |
| Profiles | Anyone may register an account. World Curling administrator approves a requested existing-player link. Linked players maintain short biography/handedness and submit photos for approval. |
| Partners | World Curling provisions organization/event/action-scoped credentials. Approved feeds may score/confirm/correct assigned games; organizer powers are separate grants. Audit human and partner actions. |
| Initial import | Administrator-reviewed batches, repeatable imports, preserved source identities/missingness, and flagged ambiguous identities. Validate a representative batch before broader loading; fictional demo scenarios remain distinct. |
| Hosting | Hosted review environment required, on a public domain the user will purchase. One modular app plus PostgreSQL and background processing; framework/provider choices delegated to documented technical defaults. |
| News | Approved external feeds provide linked headline/publisher/date/excerpt cards; source management and hiding items, without article authoring. |
| Analytics | Win/loss records and titles; approved rank/points history and contributions; blank/steal rates; historical win rates by end/margin/hammer. Show samples and exclude unknown required data. Further metrics are deferred under accepted P-05; denominator details remain bounded design work. |

## Public homepage and event navigation

The user's attached screenshot is a layout/information reference, not instructions or a requirement to duplicate site assets. Lead with event score cards rather than requiring fans to navigate to an event before seeing scores.

Each active event card presents its name, location, dates, divisions, and status; the current/latest draw and end-by-end scores; and a next-draw preview when scheduled. Provide direct access to standings or bracket, teams, and full event details. The reference shows latest completed scores remaining visible between draws; use that as a working default until the next draw starts. Represent unknown opponents/scores honestly.

Make team names actionable, highlight a selected team's bracket path, and show its next game when known. Keep mobile layouts usable and live updates visible without a manual page reload. Browser favorites may save teams, players, and events without login. A different core roster is a different team favorite; player pages offer career continuity without a lineage feature.

Proposed ordinary UI defaults, not additional user decisions: prioritize active events, label update time and provisional/confirmed state, and collapse other event cards for scanning. Detailed colors, card ordering, refresh implementation, and responsive breakpoints are implementation choices.

## Seven demonstration walkthroughs

The canonical specification's [D-01 through D-07 acceptance map](../../.scratch/world-curling-platform/spec.md#initial-offer-acceptance-seven-demonstration-workflows) is the controlling delivery structure following the user's 2026-11-07 audit refinement. The six exceptional-scenario deferrals and safeguards there apply. Accepted P-01/P-05 explicitly bound discipline/format coverage and analytics completion; remaining supporting capabilities stay included. All five core decisions are now accepted, with sixteen teams replacing the proposed eight for the main demonstration.

1. **Fan follows triple knockout.** Use a 16-team four-player event. Open the homepage's current draw, select a team, inspect its line scores and A/B/C bracket route, then follow a confirmed result into its next game. Show mobile navigation, standings/bracket access, and team/event pages.
2. **Administrator approves an event.** An organizer submits next year's edition/divisions; the assigned approval authority sees it, reviews it, and approves it onto the calendar. Show separate registration-opening and ranking-eligibility status.
3. **Volunteer scores a game.** An organizer assigns access; the volunteer starts a game, enters ends and known hammer information, records a lineup difference if needed, confirms the result, then makes an auditable correction. Show public updates and organizer bracket-edit capability. Use a correction without an already-started downstream dependency.
4. **Organizer registers an event and teams.** Start with dates/location/divisions, complete entry/payment/format details before opening registration, then demonstrate an existing-team entry, a team assembled from players, and a newly created player. Exercise one test payment and a manually recorded fee exception.
5. **Player updates a photo.** Register an account, request an existing-profile link, obtain World Curling approval, edit biography/handedness, and submit a replacement photo. Keep the previous photo public until administrator approval; show the player's request status.
6. **Administrator audits rankings.** Inspect an approved historical publication and its preserved input/version information; compare a draft update with the prior publication, inspect event contributions/calculation explanations, and approve the dated ranking list.
7. **Organizer finalizes results.** Finalize one division independently, prepare its ranking inputs, and demonstrate World Curling ranking approval. Correct a result afterward without an already-started downstream dependency, retain the earlier snapshot/publication, and show revised finalization and direct replacement approval. Retrospective reassessment of other events is deferred.

A partner-feed demonstration should exercise the same scoped scoring behavior using test credentials: receive an update, confirm/correct an assigned game, reject an out-of-scope write, and explicitly switch scoring source sequentially while no request is in flight. Basic authority/source checks remain required; elaborate interrupted handoff recovery is deferred. No real credentials or payments belong in recordings.

## Deferred or excluded from this offer

- Elaborate handling of upstream corrections after downstream play, transitive historical ranking reassessment, multi-entity identity collisions, reimport conflicts with staff corrections, in-flight feed handoff/recovery, and late-payment/overlapping-refund reconciliation. The canonical deferral table defines retained safeguards; ordinary corrections, repeat imports, refunds, and source switching remain included.
- Secure backup implementation, restoration tooling, and restore demonstrations.
- Member Association ranking calculation and live/projected world ranking displays.
- Team lineage features and inferred roster-history chains.
- Full offline scoring synchronization.
- Shot-by-shot collection/analytics, unrestricted competition-format authoring, and sophisticated schedule optimization.
- Automated playoff-qualification tiebreak policy, automated refund policy, and automatic waitlist promotion.
- Editorial article authoring, public-link editing on player profiles, push/email fan alerts, and cross-device favorites synchronization.
- Exhaustive edge-case policy coverage. Keep unresolved official-rule clarifications visible rather than inventing sporting rules.

## Plan and review boundary

The user has accepted all five core decisions P-01 through P-05: bounded coverage with a 16-team main demonstration, World Curling-granted team-season representation, all five regular rotating members as core, blocking unresolved calculation/eligibility inputs at publication, and the minimum four-view analytics inventory. No further approval of these five decisions is required. Deferred exceptional policies are not initial-offer blockers. The proposed technical defaults, implementation stages, and acceptance evidence are in `implementation-plan.md`; functional frontend requirements are in `frontend-specification.md`; the revised logical data contract is root `world-curling-platform-schema-v0.4.md`. Current rule evidence and discrepancies are in `official-rules-evidence.md`; differences from the input proposal are in `schema-review-notes.md`.

Confirm that this consolidated plan reflects shared understanding before implementation. Later domain purchase, DNS access, source repository, hosting credentials, email delivery configuration, payment test credentials, and any unresolved official-rule clarifications are implementation/deployment inputs. They do not require expanding the product interview now. No services or accounts were provisioned during planning.
