---
id: WCP-034
number: 34
title: "Calculate four-player overall WCTRS draft lists"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-033]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 34: Calculate four-player overall WCTRS draft lists

**What to build:** World Curling reviews complete men's/women's overall draft rankings with counted/excluded awards, ownership and dated carryover explanations.

**Blocked by:** [33: Calculate four-player event assessments and point awards](33-calculate-four-player-event-assessments-and-point-awards.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-015, US-016, US-017, US-061, US-062, US-063, US-067, US-069, US-070, US-076, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-03, T-08, T-09, T-11, T-12, T-14.
- Demo coverage: D-06, D-07.
- Specific product decisions: P-01, P-03, P-04.

## Acceptance criteria

- [x] Apply supported 2026-27 effective checkpoints, counting limits, weights, tie ordering, entitlements and ordinary adjustments without relying on lineage.
- [x] Keep core-identity reuse separate from restored point rights and retain frozen run manifests/contribution values.
- [x] Show unresolved required inputs/eligibility as calculation blockers; keep nonmaterial biography/unneeded-end-score warnings distinguishable.
- [x] **Unit testing:** Work independent expected totals/orderings for normal and meaningful boundary cases, roster/ownership changes, carryover dates, caps/exclusions, exact arithmetic and required ranking ties.
- [x] **Database/API verification:** Calculate/retry/replay complete fixtures and reject incomplete ones through admin APIs using persisted awards/inputs; prove no duplicate or mutable contribution shortcuts.
- [x] **Frontend quality:** Deliver a readable draft table and subject contribution drill-down with dates, meaningful precision, explanations and clear blocked/ready states.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

