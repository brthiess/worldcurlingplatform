---
id: WCP-005
number: 5
title: "Delegate event approval and assign scoped event staff"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-004]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 05: Delegate event approval and assign scoped event staff

**What to build:** World Curling grants scoped approval or event duties, and the correct reviewer or scorekeeper sees only the work assigned to them.

**Blocked by:** [04: Submit and approve next year's event onto the calendar](04-submit-and-approve-next-year-s-event-onto-the-calendar.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-043, US-058, US-059, US-060, US-089, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-06, T-12, T-14.
- Demo coverage: D-02, D-03.
- Specific product decisions: P-02.

## Acceptance criteria

- [x] Apply geography/organizer/discipline/category scopes and named exceptions with one responsible approval authority and reviewer per application.
- [x] Record reassignment and World Curling override reasons; do not create contradictory independent approvals or implicit onward delegation.
- [x] Let authorized organizers assign their event's scoring access without granting global or ranking-publication authority.
- [x] **Unit testing:** Test positive/negative scope matches, authority routing, explicit reassignment/override policy and role separation.
- [x] **Database/API verification:** Exercise administrative grants and actual guarded commands in PostgreSQL-backed sessions, including cross-event denial and revocation.
- [x] **Frontend quality:** Show readable scoped grant/assignment forms and reviewer responsibility, with clear denied/empty views rather than global lists filtered only in the browser.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

