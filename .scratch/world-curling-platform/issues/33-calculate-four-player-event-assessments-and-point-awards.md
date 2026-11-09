---
id: WCP-033
number: 33
title: "Calculate four-player event assessments and point awards"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-027, WCP-032]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 33: Calculate four-player event assessments and point awards

**What to build:** An administrator calculates and reviews a four-player event's field strength and awards from a frozen result snapshot and sourced historical inputs.

**Blocked by:** [27: Finalize division results and preserve revised snapshots](27-finalize-division-results-and-preserve-revised-snapshots.md); [32: Review official rosters, WCTRS sources and starting entitlements](32-review-official-rosters-wctrs-sources-and-starting-entitlements.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-016, US-061, US-067, US-069, US-070, US-076, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-08, T-09, T-12, T-14.
- Demo coverage: D-06, D-07.
- Specific product decisions: P-01, P-04.

## Acceptance criteria

- [x] Use the applicable 2026-27 rules, exact cutoff/pre-event ranking and event-edition inputs with eligible/excluded entries and explained factors.
- [x] Persist a replayable assessment/award revision and durable calculation job state; incomplete required inputs block a verified result instead of producing invented points.
- [x] Preserve source/rule/engine/input references and explicit adjustments; do not publish a world ranking list in this slice.
- [x] **Unit testing:** Use independent sourced fixtures for field-strength/factors, award placement, eligibility/exclusion and stage-specific rounding, including missing/invalid inputs.
- [x] **Database/API verification:** Queue/retry calculations using real PostgreSQL, inspect completed/failed/blocked jobs and prove immutable input/result associations and duplicate safety.
- [x] **Frontend quality:** Show an administrator useful assessment/award breakdown, inputs, exclusions and job/issues state rather than a bare unexplained points number.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

