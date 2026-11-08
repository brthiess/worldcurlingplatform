---
id: WCP-024
number: 24
title: "Generate and score bounded Swiss/Schenkel pairings"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-019]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 24: Generate and score bounded Swiss/Schenkel pairings

**What to build:** An organizer runs one documented Swiss/Schenkel configuration, reviews each pairing round and scores the published games.

**Blocked by:** [19: Preview and run a single-knockout draw through public views](19-preview-and-run-a-single-knockout-draw-through-public-views.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-003, US-010, US-039, US-040, US-041, US-046, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-04, T-12, T-14.
- Demo coverage: D-01, D-04.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Specify field size, rounds and deterministic pairing/ordering rules for the supported profile; record seeds/tie inputs explicitly.
- [ ] Persist pairings and inputs before publishing the next round; preserve organizer changes and prior rounds.
- [ ] Do not add automated playoff-qualification tiebreaks or claim every Swiss/Schenkel variation.
- [ ] **Unit testing:** Verify initial/next-round pairings, deterministic equal-record ordering and documented rematch/bye constraints against independent fixtures.
- [ ] **Database/API verification:** Generate successive rounds from confirmed results using real PostgreSQL and assert no duplicate/incorrect assignments or hidden overwrite of prior games.
- [ ] **Frontend quality:** Provide a usable review/publish-next-round flow and public round/standing navigation, with pending-result and validation states.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

