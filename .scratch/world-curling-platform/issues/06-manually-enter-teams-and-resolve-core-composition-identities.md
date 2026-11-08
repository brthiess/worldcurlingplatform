---
id: WCP-006
number: 6
title: "Manually enter teams and resolve core-composition identities"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-004]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 06: Manually enter teams and resolve core-composition identities

**What to build:** An organizer selects a team or assembles existing/new players into an entry; known core membership creates or reuses the right team and appears publicly.

**Blocked by:** [04: Submit and approve next year's event onto the calendar](04-submit-and-approve-next-year-s-event-onto-the-calendar.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-032, US-033, US-035, US-036, US-056, US-062, US-063, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-03, T-06, T-12, T-14.
- Demo coverage: D-04.
- Specific product decisions: P-01, P-03.

## Acceptance criteria

- [x] Resolve identity from discipline and unordered core players, reuse returning compositions, and separate season registration from event lineup.
- [x] Five regular rotating players are all core; a designated alternate is not. Alternate/coach/name/position changes and temporary game rotation do not create another team.
- [x] Allow incomplete/provisional entries and new sport records without player accounts; preserve declared/defaulted participation and avoid a separate team approval gate.
- [x] **Unit testing:** Cover order-independent matching, discipline differences, returning cores, five-core versus alternate classification, permanent core changes and temporary substitutes.
- [x] **Database/API verification:** Exercise automatic creation/reuse and duplicate requests with relational consistency; persist entry/lineup versions without overwriting seasonal rosters.
- [x] **Frontend quality:** Provide usable team/player search and selection, add-player flow, clear core/alternate/substitute labels and a truthful public roster/entry summary.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

