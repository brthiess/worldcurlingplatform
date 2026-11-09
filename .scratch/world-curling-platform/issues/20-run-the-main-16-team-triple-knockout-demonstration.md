---
id: WCP-020
number: 20
title: "Run the main 16-team triple-knockout demonstration"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-019]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 20: Run the main 16-team triple-knockout demonstration

**What to build:** The main four-player demo operates a real 16-team triple-knockout draw with visible A/B/C routes, explicit qualifiers and next-game assignments.

**Blocked by:** [19: Preview and run a single-knockout draw through public views](19-preview-and-run-a-single-knockout-draw-through-public-views.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-001, US-002, US-007, US-008, US-009, US-010, US-039, US-041, US-046, US-091, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-04, T-12, T-13, T-14.
- Demo coverage: D-01, D-03.
- Specific product decisions: P-01.

## Acceptance criteria

- [x] Document one exact 16-team template, including its qualifier count/destinations, byes if any, and full A/B/C winner/loser routing before implementing it.
- [x] Use the stored graph, not loss count alone, and demonstrate representative A, B and C paths plus qualification/elimination.
- [x] Keep the current/next homepage draw, game links and bracket/list views consistent with confirmed results; defer played-downstream conflict repair.
- [x] **Unit testing:** Use an independently reviewed expected routing fixture; cover each routing/qualification branch and whole-graph completeness without mirroring generator code.
- [x] **Database/API verification:** Drive representative and full bounded completion sequences through scoring APIs and assert final placements/qualifiers and next slots match the expected graph.
- [x] **Frontend quality:** Verify a fan can follow one selected team on a phone and desktop through A/B/C and its next known game, with legible connectors and a readable list alternative.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

