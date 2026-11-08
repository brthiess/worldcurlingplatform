---
id: WCP-021
number: 21
title: "Run one documented double-knockout configuration"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-019]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 21: Run one documented double-knockout configuration

**What to build:** An organizer selects and publishes one bounded double-knockout profile and fans follow its stored advancement paths.

**Blocked by:** [19: Preview and run a single-knockout draw through public views](19-preview-and-run-a-single-knockout-draw-through-public-views.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-008, US-009, US-039, US-041, US-046, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-04, T-12, T-14.
- Demo coverage: D-01.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Document the selected field size, routes, byes and qualification/final behavior; do not claim all variants are supported.
- [ ] Reuse common scoring, schedule and published-graph interfaces without changing the main triple-knockout configuration.
- [ ] Show honest planned/implemented/verified coverage for this named profile.
- [ ] **Unit testing:** Verify graph and winner/loser outcomes against independent fixtures, including elimination and any documented bye/final branch.
- [ ] **Database/API verification:** Complete a representative profile using real persistence and score-confirmation APIs and assert resolved slots/history.
- [ ] **Frontend quality:** Make profile selection/preview and public bracket/list navigation as usable as the first template, with no generic template placeholder pages.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

