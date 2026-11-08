---
id: WCP-037
number: 37
title: "Calculate mixed-doubles pair and individual draft lists"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-036]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 37: Calculate mixed-doubles pair and individual draft lists

**What to build:** World Curling reviews the supported mixed-doubles pair, female-player and male-player draft rankings with independent contributions and history.

**Blocked by:** [36: Calculate mixed-doubles field strength and event awards](36-calculate-mixed-doubles-field-strength-and-event-awards.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-015, US-016, US-017, US-020, US-061, US-063, US-067, US-069, US-076, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-03, T-08, T-09, T-11, T-12, T-14.
- Demo coverage: D-06, D-07.
- Specific product decisions: P-01, P-03, P-04.

## Acceptance criteria

- [ ] Apply each supported subject/list's 2026-27 counting, ownership, weighting and tie-ordering rules to sufficient sourced inputs.
- [ ] Keep person subjects separate from pair identities and preserve counts/exclusions/effective dates in replayable runs.
- [ ] Do not auto-publish, fabricate inputs or add Member Association/other discipline lists.
- [ ] **Unit testing:** Use independently worked pair and individual expected totals/orderings across relevant dated checkpoints, partner changes, excluded events and rounding branches.
- [ ] **Database/API verification:** Persist and replay all three subject/list types and verify correct subject mappings, contributions and incomplete-input blocking.
- [ ] **Frontend quality:** Make pair/individual selection and contributor drill-down readable at mobile and desktop widths, with clear list names and no mislabeled team-only views.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

