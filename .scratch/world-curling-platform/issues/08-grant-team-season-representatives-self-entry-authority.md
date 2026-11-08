---
id: WCP-008
number: 8
title: "Grant team-season representatives self-entry authority"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-006]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 08: Grant team-season representatives self-entry authority

**What to build:** World Curling grants a representative team-season authority and that person can submit or amend an entry for that team while organizers retain manual entry.

**Blocked by:** [06: Manually enter teams and resolve core-composition identities](06-manually-enter-teams-and-resolve-core-composition-identities.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-031, US-036, US-052, US-060, US-089, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-03, T-06, T-12, T-14.
- Demo coverage: D-04.
- Specific product decisions: P-02, P-03.

## Acceptance criteria

- [x] Support scoped submit/amend/withdraw/payment authority for the represented team-season.
- [x] A player-profile link grants no team powers, and authority does not transfer automatically to a different core-composition identity.
- [x] Use the existing canonical resolution and event-lineup behavior, with clear on-behalf-of actor attribution.
- [x] **Unit testing:** Test team-season/action matching, profile-versus-team authority and denial after a core identity change or grant revocation.
- [x] **Database/API verification:** Exercise staff grants and permitted/forbidden self-entry commands with real sessions and database audit records.
- [x] **Frontend quality:** Expose a representative's permitted teams/entries and staff grant controls; make team/season context and lack of authority explicit.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

