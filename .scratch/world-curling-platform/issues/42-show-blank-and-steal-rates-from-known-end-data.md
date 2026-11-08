---
id: WCP-042
number: 42
title: "Show blank and steal rates from known end data"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-017]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 42: Show blank and steal rates from known end data

**What to build:** Fans use the minimum scoring-pattern view to inspect blank and steal rates computed from suitable observed ends.

**Blocked by:** [17: Connect event, game, team and player discovery with favorites](17-connect-event-game-team-and-player-discovery-with-favorites.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-019, US-022, US-024, US-073, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-10, T-11, T-12, T-14.
- Demo coverage: D-01, D-06.
- Specific product decisions: P-01, P-05.

## Acceptance criteria

- [ ] Define/document numerators, denominators and team/population scope before implementation, using actual completed ends and known hammer where required.
- [ ] Exclude unknown-required fields and unplayed/post-concession ends; distinguish zero sample from a true zero rate and avoid revision double counting.
- [ ] Limit the offered measures to P-05 blank/steal rates and supported disciplines with clear filters and coverage.
- [ ] **Unit testing:** Verify hand-counted numerator/denominator examples, hammer perspectives, missing/unplayed data, corrections and zero-sample behavior.
- [ ] **Database/API verification:** Calculate rates from stored games/ends and confirm filtered API values, sample counts and displayed corrections agree.
- [ ] **Frontend quality:** Show the two useful rates with sample/coverage, clear definitions and filter state, readable on a phone without unexplained percentages.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

