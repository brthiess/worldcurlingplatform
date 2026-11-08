---
id: WCP-036
number: 36
title: "Calculate mixed-doubles field strength and event awards"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-026, WCP-034]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 36: Calculate mixed-doubles field strength and event awards

**What to build:** Administrators assess a mixed-doubles event using its pair/player and required four-player ranking inputs and inspect its award breakdown.

**Blocked by:** [26: Score mixed doubles and record required measurements](26-score-mixed-doubles-and-record-required-measurements.md); [34: Calculate four-player overall WCTRS draft lists](34-calculate-four-player-overall-wctrs-draft-lists.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-016, US-044, US-061, US-067, US-069, US-076, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-03, T-08, T-09, T-12, T-14.
- Demo coverage: D-06, D-07.
- Specific product decisions: P-01, P-03, P-04.

## Acceptance criteria

- [ ] Use sourced 2026-27 mixed-doubles formulas and the exact required historical inputs; pair-only history cannot silently substitute for missing individual/team inputs.
- [ ] Retain eligibility, effective roster/participation evidence, cutoff and factor explanations with frozen result snapshots.
- [ ] Blocked required inputs remain visible; document the known counting-rule interpretation instead of treating inconsistent prose as resolved fact.
- [ ] **Unit testing:** Verify independently worked strength/award examples, individual/team contribution branches, cutoffs, exclusions and rounding with valid and incomplete input sets.
- [ ] **Database/API verification:** Calculate/retry from persisted mixed-doubles results and four-player inputs, retaining all source/subject relationships and issue states.
- [ ] **Frontend quality:** Show the mixed-doubles assessment as an understandable breakdown with player/pair links, source dates and specific readiness issues.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

