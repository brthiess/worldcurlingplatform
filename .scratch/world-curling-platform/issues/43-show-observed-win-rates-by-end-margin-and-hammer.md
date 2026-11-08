---
id: WCP-043
number: 43
title: "Show observed win rates by end, margin and hammer"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-017]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 43: Show observed win rates by end, margin and hammer

**What to build:** Fans inspect the minimum situational analytics view using actual comparable game states and known final outcomes.

**Blocked by:** [17: Connect event, game, team and player discovery with favorites](17-connect-event-game-team-and-player-discovery-with-favorites.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-021, US-022, US-024, US-073, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-10, T-11, T-12, T-14.
- Demo coverage: D-01, D-06.
- Specific product decisions: P-01, P-05.

## Acceptance criteria

- [ ] Document the state timing, win/sample definition and population filters, separating supported disciplines and relevant regulation/rule contexts.
- [ ] Use only observed situations with the required margin/hammer/outcome evidence; exclude hypothetical ends after concession and unknown required data.
- [ ] Show sample sizes and unknown/zero-sample states; do not present calibrated live prediction or expand the metric inventory.
- [ ] **Unit testing:** Compare matrix cells/filters to independent hand-worked game-state fixtures, including both hammer perspectives, missing outcomes and conceded games.
- [ ] **Database/API verification:** Read persisted score/outcome history and verify API cells, population filters and sample counts against the same immutable fixture evidence.
- [ ] **Frontend quality:** Provide an understandable filtered table/heatmap with accessible cell details and mobile table access, showing exact context and samples rather than unsupported certainty.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

