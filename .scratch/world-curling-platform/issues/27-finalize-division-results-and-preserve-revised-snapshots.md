---
id: WCP-027
number: 27
title: "Finalize division results and preserve revised snapshots"
parent: WCP-SPEC-001
type: implementation
status: in-progress
labels: [ready-for-agent]
blocked_by: [WCP-003, WCP-006]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 27: Finalize division results and preserve revised snapshots

**What to build:** An organizer finalizes a completed division, later accepts an ordinary correction and finalizes its revision without losing the original snapshot.

**Blocked by:** [03: Confirm results and make ordinary auditable corrections](03-confirm-results-and-make-ordinary-auditable-corrections.md); [06: Manually enter teams and resolve core-composition identities](06-manually-enter-teams-and-resolve-core-composition-identities.md).

**Status:** in-progress

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-027, US-041, US-042, US-047, US-067, US-070, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-03, T-06, T-09, T-12, T-14.
- Demo coverage: D-07.
- Specific product decisions: P-04.

## Acceptance criteria

- [ ] Record required outcomes, final placements, referenced entries/lineups/rules and exact frozen contents for each division independently.
- [ ] Do not treat sporting finalization as ranking approval or an eligibility waiver; expose ranking-specific issues separately.
- [ ] Allow the scorekeeper's correction without an admin gate, flag changed results and create a replacement finalization; defer transitive historical reassessment.
- [ ] **Unit testing:** Test finalization prerequisites, placement validation, revision/dirty-state transitions and snapshot-content stability.
- [ ] **Database/API verification:** Finalize two divisions independently, correct and refinalize one, and prove old contents/digests remain unchanged with atomic audit evidence.
- [ ] **Frontend quality:** Deliver an understandable final-results review/finalize screen and changed-since-finalization notice with working revision/history access.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

