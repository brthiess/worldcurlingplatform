---
id: WCP-023
number: 23
title: "Run a documented Page-playoff draw"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-019]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 23: Run a documented Page-playoff draw

**What to build:** An organizer supplies the manual seeds for one documented Page-playoff profile and its stored routes produce the expected final.

**Blocked by:** [19: Preview and run a single-knockout draw through public views](19-preview-and-run-a-single-knockout-draw-through-public-views.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-008, US-009, US-010, US-039, US-041, US-046, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-04, T-12, T-14.
- Demo coverage: D-01, D-04.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Persist explicit seeded games and advancement for the selected Page profile, with the same confirmation/history contract as other formats.
- [ ] Keep source qualification a manual input instead of adding the excluded tiebreak engine.
- [ ] Display named stages and unresolved opponents accurately.
- [ ] **Unit testing:** Compare all seed/winner/loser branches and final placement implications to a hand-specified expected fixture.
- [ ] **Database/API verification:** Publish, score and complete the profile via the application and verify graph/slot/result consistency.
- [ ] **Frontend quality:** Make seed selection and public bracket/list views understandable and keyboard/touch accessible with correct event/game links.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

