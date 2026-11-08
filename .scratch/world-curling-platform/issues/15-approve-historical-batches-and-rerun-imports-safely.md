---
id: WCP-015
number: 15
title: "Approve historical batches and rerun imports safely"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-014]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 15: Approve historical batches and rerun imports safely

**What to build:** An administrator approves a reviewed batch and its historical events/results become publicly browseable with truthful origin and completeness.

**Blocked by:** [14: Stage a representative read-only Curling Crawler import](14-stage-a-representative-read-only-curling-crawler-import.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-005, US-071, US-072, US-073, US-074, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-03, T-06, T-10, T-12, T-14.
- Demo coverage: D-06.
- Specific product decisions: P-01, P-03.

## Acceptance criteria

- [ ] Tie approval to the exact staged batch contents and map source identifiers to canonical events, entries, people/teams and games only where justified.
- [ ] Rerunning an unchanged approved batch adds no duplicates; unknown core membership stays unresolved rather than creating invented team identities.
- [ ] A reimport conflict with curated staff data retains evidence/issues and cannot overwrite the correction; defer complex field-level reconciliation.
- [ ] **Unit testing:** Test mapping/idempotency decisions, reviewed-digest checks and curated-conflict classification.
- [ ] **Database/API verification:** Approve/retry/rerun against PostgreSQL and compare canonical identities/counts/history; verify unchanged import effects and no partial curated overwrite.
- [ ] **Frontend quality:** Show an explicit batch approve action and its result, public imported-source/completeness labels and inspectable unresolved issues with working event/game links.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

