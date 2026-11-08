---
id: WCP-007
number: 7
title: "Correct mistaken player selections and flag identity collisions"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-006]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 07: Correct mistaken player selections and flag identity collisions

**What to build:** World Curling staff fix an ordinary player/entry identity mistake, while collisions remain visible issues instead of partial merges.

**Blocked by:** [06: Manually enter teams and resolve core-composition identities](06-manually-enter-teams-and-resolve-core-composition-identities.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-034, US-064, US-073, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-03, T-06, T-10, T-12, T-14.
- Demo coverage: D-04.
- Specific product decisions: P-03.

## Acceptance criteria

- [ ] Suggest distinguishing existing records and permit a provisional person when uncertain; never merge by name alone.
- [ ] Record factual corrections separately from genuine core transitions and retain their audit/source evidence.
- [ ] Detect multi-record/team/entry/subject collisions, leave conflicting changes unapplied and retain a staff issue; defer cascading merge/consolidation tooling.
- [ ] **Unit testing:** Test candidate/ambiguity classification, ordinary correction rules and collision rejection without mutating partial state.
- [ ] **Database/API verification:** Correct a mistaken selection through staff APIs and prove atomicity/history; attempt a collision and verify canonical and published evidence stays intact.
- [ ] **Frontend quality:** Make affected identity, proposed correction and unresolved issue clear; show successful correction or actionable conflict without a pretend merge-success screen.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

