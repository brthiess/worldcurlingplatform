---
id: WCP-041
number: 41
title: "Chart approved rank and points history with contributions"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-016, WCP-017, WCP-038]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 41: Chart approved rank and points history with contributions

**What to build:** Fans compare approved ranking/points history and inspect contributing events across calculated publications and honestly labelled imported history.

**Blocked by:** [16: Browse historical imported ranking editions](16-browse-historical-imported-ranking-editions.md); [17: Connect event, game, team and player discovery with favorites](17-connect-event-game-team-and-player-discovery-with-favorites.md); [38: Approve and publish complete dated WCTRS lists](38-approve-and-publish-complete-dated-wctrs-lists.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-015, US-016, US-017, US-020, US-024, US-069, US-075, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-08, T-09, T-10, T-11, T-12, T-14.
- Demo coverage: D-01, D-06.
- Specific product decisions: P-01, P-04, P-05.

## Acceptance criteria

- [ ] Use dated approved/observed values, preserving effective-versus-publication-time and imported-versus-calculated origin.
- [ ] Expose contribution detail where it exists and explicitly mark unavailable historical explanation rather than reconstructing it silently.
- [ ] Keep core-composition subjects distinct and person histories stable without deferred team lineage.
- [ ] **Unit testing:** Test history/date selection, series alignment, contribution reconciliation, sparse-history handling and meaningful decimal values against explicit fixtures.
- [ ] **Database/API verification:** Read representative calculated and imported publications through public APIs and verify graph/table values agree with frozen rows and selected context.
- [ ] **Frontend quality:** Provide readable chart plus table access, date/list filters, comparison/point drill-down and keyboard/mobile usability without decorative or invented trend lines.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

