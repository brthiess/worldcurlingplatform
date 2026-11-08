---
id: WCP-018
number: 18
title: "Schedule draw sessions and show known conflicts"
parent: WCP-SPEC-001
type: implementation
status: in-progress
labels: [ready-for-agent]
blocked_by: [WCP-003, WCP-006]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 18: Schedule draw sessions and show known conflicts

**What to build:** An organizer assigns existing games to draw sessions/sheets, sees known clashes, and fans can browse the resulting schedule and draws.

**Blocked by:** [03: Confirm results and make ordinary auditable corrections](03-confirm-results-and-make-ordinary-auditable-corrections.md); [06: Manually enter teams and resolve core-composition identities](06-manually-enter-teams-and-resolve-core-composition-identities.md).

**Status:** in-progress

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-003, US-023, US-040, US-043, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-02, T-04, T-06, T-12, T-14.
- Demo coverage: D-01, D-03, D-04.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Persist session/sheet/time revisions using explicit venue time zones and show current/latest/next draw consistently.
- [ ] Detect overlapping sheets, entries and known player assignments across divisions; do not introduce a schedule optimizer.
- [ ] Keep playing/status evidence distinct from a scheduled start having passed.
- [ ] **Unit testing:** Test overlap/availability decisions, session ordering, current/latest/next selection and timezone-aware schedule boundaries.
- [ ] **Database/API verification:** Save/revise schedules through scoped commands; verify PostgreSQL relationships/history and public schedule projections agree.
- [ ] **Frontend quality:** Provide a usable organizer scheduling form/grid and public previous/next draw controls with explicit time labels, unclipped phone actions and clear conflict feedback.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

