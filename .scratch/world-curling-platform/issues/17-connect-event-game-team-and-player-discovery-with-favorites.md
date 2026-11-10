---
id: WCP-017
number: 17
title: "Connect event, game, team and player discovery with favorites"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-003, WCP-006, WCP-012]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 17: Connect event, game, team and player discovery with favorites

**What to build:** Fans search the event archive and move between actual event/game/team/player pages while preserving useful context and browser favorites.

**Blocked by:** [03: Confirm results and make ordinary auditable corrections](03-confirm-results-and-make-ordinary-auditable-corrections.md); [06: Manually enter teams and resolve core-composition identities](06-manually-enter-teams-and-resolve-core-composition-identities.md); [12: Create accounts, approve player claims and edit profiles](12-create-accounts-approve-player-claims-and-edit-profiles.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-003, US-004, US-005, US-006, US-007, US-010, US-011, US-012, US-013, US-022, US-023, US-024, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-03, T-05, T-11, T-12, T-14.
- Demo coverage: D-01, D-04, D-05.
- Specific product decisions: P-01, P-03.

## Acceptance criteria

- [x] Complete the public pages around existing persisted data, with calendar/status/discipline filters and stable identity-based links.
- [x] Expose current results, next known game, core/alternate season context and known player information without lineage or fabricated participation.
- [x] Save favorites locally without account synchronization; preserve filters/draw selection/back navigation during refresh.
- [x] **Unit testing:** Test search/filter/read-projection rules, stable context links, favorites serialization and current-versus-archived identity presentation.
- [x] **Database/API verification:** Query representative seeded and available imported records through public APIs, verifying privacy and correct identity/date/division scopes.
- [x] **Frontend quality:** Browser-check homepage -> event -> game -> team/player navigation, search, empty/error states and favorites at phone/tablet/desktop widths with no dead controls or filler sections.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

