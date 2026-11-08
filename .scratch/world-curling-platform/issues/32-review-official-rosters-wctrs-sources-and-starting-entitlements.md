---
id: WCP-032
number: 32
title: "Review official rosters, WCTRS sources and starting entitlements"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-006]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 32: Review official rosters, WCTRS sources and starting entitlements

**What to build:** World Curling staff inspect and maintain versioned seasonal registration, allocation and sourced starting-input records with visible ranking-readiness issues.

**Blocked by:** [06: Manually enter teams and resolve core-composition identities](06-manually-enter-teams-and-resolve-core-composition-identities.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-061, US-062, US-063, US-064, US-067, US-069, US-076, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-03, T-06, T-08, T-09, T-12, T-14.
- Demo coverage: D-06, D-07.
- Specific product decisions: P-01, P-03, P-04.

## Acceptance criteria

- [x] Separate platform core identity, registered ranking roster and point ownership, including five regular core members versus a designated alternate.
- [x] Record official rule/source editions, effective checkpoints and reviewed starting entitlements; missing required evidence remains unresolved instead of normalized away.
- [x] Document supported interpretations and independently worked input fixtures for the known counting-event/rounding ambiguities before verified calculations; an aggregate old total alone does not establish all future ownership inputs.
- [x] **Unit testing:** Test roster/allocation membership and exact-share validation, effective interval/source requirements and blocker-versus-informational issue classification.
- [x] **Database/API verification:** Save/revise sourced records with staff authorization and PostgreSQL history, and prove unreviewed/incomplete inputs cannot be represented as complete approved evidence.
- [x] **Frontend quality:** Provide a focused team-season/rules/input review with inspectable sources, version/effective dates and actionable issues, without a manual editable ranking-total shortcut.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

