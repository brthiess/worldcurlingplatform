---
id: WCP-019
number: 19
title: "Preview and run a single-knockout draw through public views"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-018]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 19: Preview and run a single-knockout draw through public views

**What to build:** An organizer configures one documented single-knockout template, previews/publishes its persisted draw and sees confirmed results resolve future slots.

**Blocked by:** [18: Schedule draw sessions and show known conflicts](18-schedule-draw-sessions-and-show-known-conflicts.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-007, US-008, US-009, US-010, US-039, US-040, US-041, US-046, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-04, T-06, T-12, T-14.
- Demo coverage: D-01, D-03.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Introduce the shared relational graph/template-version contract with stable games, participants, explicit advancement and published revision history.
- [ ] Use one bounded documented configuration, seeded entries and supported bye behavior; no unrestricted graph designer.
- [ ] Expose usable bracket and game-list views; actual result/participant history cannot be rewritten by a later slot revision.
- [ ] **Unit testing:** Compare generated fixtures and advancement to an independently specified expected graph; check bye, slot/participant and progression invariants.
- [ ] **Database/API verification:** Publish and advance via real score confirmation APIs, verifying stored graph/slot state and auditable revision behavior in PostgreSQL.
- [ ] **Frontend quality:** Deliver responsive preview/publish, linked bracket/list navigation and selected-team highlighting with unresolved-slot labels and keyboard-accessible game links.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

