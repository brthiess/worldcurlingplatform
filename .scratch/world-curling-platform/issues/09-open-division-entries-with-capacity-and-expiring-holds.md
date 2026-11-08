---
id: WCP-009
number: 9
title: "Open division entries with capacity and expiring holds"
parent: WCP-SPEC-001
type: implementation
status: in-progress
labels: [ready-for-agent]
blocked_by: [WCP-008]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 09: Open division entries with capacity and expiring holds

**What to build:** An organizer opens a configured division in open, reviewed or invitation-only mode, and entrants receive the correct acceptance/reservation state.

**Blocked by:** [08: Grant team-season representatives self-entry authority](08-grant-team-season-representatives-self-entry-authority.md).

**Status:** in-progress

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-027, US-029, US-030, US-031, US-083, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-06, T-07, T-12, T-14.
- Demo coverage: D-04.
- Specific product decisions: P-01, P-02.

## Acceptance criteria

- [ ] Require capacity, entry requirements, fee/payment terms and a documented format selection before opening; zero-fee fixtures can exercise the flow before online checkout exists.
- [ ] Keep acceptance, roster readiness, payment and ranking eligibility separate; reviewed acceptance creates a defined payment window.
- [ ] Expired holds release capacity, and competing accept/reserve operations cannot exceed capacity; exceptional late payment is only flagged, not automatically settled.
- [ ] **Unit testing:** Test mode/state transitions, prerequisite validation, reservation deadlines and capacity counting under a controlled clock.
- [ ] **Database/API verification:** Use concurrent PostgreSQL transactions to prove holds/acceptance cannot overbook, plus expiry/retry and scoped action checks.
- [ ] **Frontend quality:** Give organizers and entrants clear open/reviewed/invited/held/expired states, remaining-capacity feedback and validation errors without a false paid/eligible badge.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

