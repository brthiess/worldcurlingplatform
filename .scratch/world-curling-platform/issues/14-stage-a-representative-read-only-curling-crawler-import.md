---
id: WCP-014
number: 14
title: "Stage a representative read-only Curling Crawler import"
parent: WCP-SPEC-001
type: implementation
status: in-progress
labels: [ready-for-agent]
blocked_by: [WCP-003, WCP-007]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 14: Stage a representative read-only Curling Crawler import

**What to build:** An administrator runs and inspects a staged import from a consistent export of the confirmed Curling Crawler project without changing its archive.

**Blocked by:** [03: Confirm results and make ordinary auditable corrections](03-confirm-results-and-make-ordinary-auditable-corrections.md); [07: Correct mistaken player selections and flag identity collisions](07-correct-mistaken-player-selections-and-flag-identity-collisions.md).

**Status:** in-progress

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-071, US-073, US-074, US-076, US-092, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-03, T-10, T-12, T-14.
- Demo coverage: D-06.
- Specific product decisions: P-01, P-03.

## Acceptance criteria

- [ ] Translate source claims/records with fully parent-scoped keys, parser/export version and retained provenance; stream rather than inventing a live crawler dependency.
- [ ] Preview final-score-only and complete-line-score games, incomplete rosters, known/unknown hammer and uncertain player/core identities.
- [ ] Persist a frozen reviewable batch/digest and quality issues; staging alone does not publish or fabricate human certification.
- [ ] **Unit testing:** Use representative source fixtures to test scoped key normalization, translation, completeness/missingness and rejected malformed inputs.
- [ ] **Database/API verification:** Read a representative real source export, persist/retry a staging job and query its preview/issues through admin APIs; verify source data is unchanged.
- [ ] **Frontend quality:** Show useful import progress/failure state, exact batch identity, previewed records and issue counts without presenting observation counts as unique games.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

