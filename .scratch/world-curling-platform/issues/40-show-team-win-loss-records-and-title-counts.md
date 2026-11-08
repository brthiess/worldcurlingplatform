---
id: WCP-040
number: 40
title: "Show team win-loss records and title counts"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-017, WCP-027]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 40: Show team win-loss records and title counts

**What to build:** Fans inspect the first minimum analytics view: supported team win/loss records and titles with explicit sample and result coverage.

**Blocked by:** [17: Connect event, game, team and player discovery with favorites](17-connect-event-game-team-and-player-discovery-with-favorites.md); [27: Finalize division results and preserve revised snapshots](27-finalize-division-results-and-preserve-revised-snapshots.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-007, US-011, US-018, US-022, US-024, US-073, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-03, T-09, T-11, T-12, T-14.
- Demo coverage: D-01, D-06.
- Specific product decisions: P-01, P-05.

## Acceptance criteria

- [ ] Document counting rules for confirmed/unknown/tied/forfeit/void results and titles from finalized placements; count a logical game/division once across revisions.
- [ ] Filter by the supported discipline/date/event context and retain source/completeness information.
- [ ] Do not infer that every listed/defaulted player played or expand into deferred streak/rivalry statistics; any player-level attribution must state its evidence.
- [ ] **Unit testing:** Use small hand-counted fixtures for records, title counts, revisions, missing outcomes and scope filters with independently expected denominators.
- [ ] **Database/API verification:** Query persisted results/finalizations and ordinary corrections through analytics APIs, proving no double counting or private-data leakage.
- [ ] **Frontend quality:** Render purposeful records/title tables or charts with filters, units/sample labels, working team/event links and honest no-data states at all target widths.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

