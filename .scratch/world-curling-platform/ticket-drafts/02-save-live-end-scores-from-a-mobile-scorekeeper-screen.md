---
id: WCP-002
number: 2
title: "Save live end scores from a mobile scorekeeper screen"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-001]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 02: Save live end scores from a mobile scorekeeper screen

**What to build:** An assigned scorekeeper starts a four-player game, saves or corrects an end, and sees the accepted change on the live homepage and game view.

**Blocked by:** [01: Open a persisted event and sign in with scoped demo roles](01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-004, US-022, US-043, US-044, US-048, US-049, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-06, T-12, T-14.
- Demo coverage: D-01, D-03.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Persist end scores and known hammer with actor/request attribution and an atomic audit record.
- [ ] Retries are duplicate-safe; stale or out-of-scope writes cannot overwrite accepted state.
- [ ] Show saved, unsent/uncertain and connection states honestly, preserving an unfinished edit through a temporary interruption without claiming full offline synchronization.
- [ ] **Unit testing:** Test four-player end validation, blank/unknown/unplayed distinctions, valid totals, version/idempotency decisions and save-state transitions.
- [ ] **Database/API verification:** Submit valid, duplicate, conflicting and forbidden commands against real PostgreSQL; assert accepted scores and audit evidence commit together.
- [ ] **Frontend quality:** Browser-check thumb-friendly entry, clear game/end identity, labelled errors and visible public refresh without losing the selected draw or expanded card.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

