---
id: WCP-035
number: 35
title: "Calculate Champion, Elite and Challenger series drafts"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-034]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 35: Calculate Champion, Elite and Challenger series drafts

**What to build:** Administrators select and inspect the applicable men's/women's 2026-27 series drafts separately from overall rankings.

**Blocked by:** [34: Calculate four-player overall WCTRS draft lists](34-calculate-four-player-overall-wctrs-draft-lists.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-015, US-016, US-017, US-020, US-067, US-069, US-076, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-08, T-09, T-11, T-12, T-14.
- Demo coverage: D-06.
- Specific product decisions: P-01, P-04.

## Acceptance criteria

- [ ] Implement the supported series-specific event classifications, schedules and counting/weight rules from sourced versions.
- [ ] Reuse the recorded run/contribution/readiness contract while keeping different lists distinct and versioned.
- [ ] Expose list/series selection and correct exclusions; do not invent series outside the accepted WCTRS scope.
- [ ] **Unit testing:** Use independently worked fixtures for each series' distinct checkpoints, classification, counted awards and ordering, not a copy of overall expected values.
- [ ] **Database/API verification:** Persist/replay the different series lists and verify their inputs/contributions remain separate and compatible with generic publication readiness.
- [ ] **Frontend quality:** Provide useful series selectors, dates and breakdowns with no misleading overall/series mixing or placeholder list rows.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

