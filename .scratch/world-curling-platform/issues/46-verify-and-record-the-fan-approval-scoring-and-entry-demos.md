---
id: WCP-046
number: 46
title: "Verify and record the fan, approval, scoring and entry demos"
parent: WCP-SPEC-001
type: verification
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-005, WCP-011, WCP-017, WCP-020, WCP-025, WCP-029, WCP-045]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 46: Verify and record the fan, approval, scoring and entry demos

**What to build:** Record reproducible hosted D-01 through D-04 using the 16-team main event, real persisted interactions and scoped personas.

**Blocked by:** [05: Delegate event approval and assign scoped event staff](05-delegate-event-approval-and-assign-scoped-event-staff.md); [11: Withdraw entries and invite replacements from the waitlist](11-withdraw-entries-and-invite-replacements-from-the-waitlist.md); [17: Connect event, game, team and player discovery with favorites](17-connect-event-game-team-and-player-discovery-with-favorites.md); [20: Run the main 16-team triple-knockout demonstration](20-run-the-main-16-team-triple-knockout-demonstration.md); [25: Select qualifiers and run a pooled-to-Page stage combination](25-select-qualifiers-and-run-a-pooled-to-page-stage-combination.md); [29: Issue and track full or partial sandbox refunds](29-issue-and-track-full-or-partial-sandbox-refunds.md); [45: Host the working review environment on the supplied domain](45-host-the-working-review-environment-on-the-supplied-domain.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-001, US-002, US-004, US-007, US-008, US-009, US-010, US-025, US-027, US-031, US-033, US-037, US-038, US-043, US-046, US-047, US-082, US-085, US-088, US-089, US-090, US-091, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-02, T-03, T-04, T-06, T-07, T-12, T-13, T-14.
- Demo coverage: D-01, D-02, D-03, D-04.
- Specific product decisions: P-01, P-02, P-03.

## Acceptance criteria

- [ ] Reset only the synthetic scenario and exercise current/next homepage draws, A/B/C path, event approval, mobile scoring/correction and organizer/manual/self-entry/payment flows.
- [ ] Demonstrate the ordinary correction/refund/withdrawal examples, not full resolution of the six deferred exceptional scenarios.
- [ ] Fix scoped observed regressions before claiming the flow complete; retain truthful implemented/verified coverage and record reproducible steps.
- [ ] **Unit testing:** Run the inherited identity/scoring/draw/registration/payment/permission suites, inspect uncovered core branches and add focused regression cases for substantive defects discovered.
- [ ] **Database/API verification:** Run the PostgreSQL/API acceptance paths and hosted sandbox checks for D-01 through D-04; retain actual commands/results without credentials.
- [ ] **Frontend quality:** Inspect and capture phone/tablet/desktop views, keyboard flow, loading/error/stale states and all visible navigation; recordings must show actual operations with clear scores, not static mockups.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

This is a bounded integration/recording slice over already delivered features, not a final place to defer their tests or visual quality. Fix observed scoped regressions and add focused regression evidence; new features require their own agreed work.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

