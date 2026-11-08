---
id: WCP-003
number: 3
title: "Confirm results and make ordinary auditable corrections"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-002]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 03: Confirm results and make ordinary auditable corrections

**What to build:** The assigned scorekeeper confirms a result, records a lineup difference or ordinary correction without admin approval, and fans see the correct final state and history.

**Blocked by:** [02: Save live end scores from a mobile scorekeeper screen](02-save-live-end-scores-from-a-mobile-scorekeeper-screen.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-006, US-045, US-046, US-047, US-048, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-03, T-06, T-09, T-12, T-14.
- Demo coverage: D-01, D-03, D-07.
- Specific product decisions: P-01, P-03.

## Acceptance criteria

- [x] Support normal/conceded/forfeit outcome distinctions under the implemented four-player profile; retain result versions and participant identities.
- [x] Default game lineup from the referenced event lineup; record differences without mandatory unchanged-lineup confirmation or claims that every declared player delivered stones.
- [x] Permit post-confirmation corrections with audit history and no second approver; preserve played-game evidence and flag downstream-started effects instead of building the deferred repair policy.
- [x] **Unit testing:** Test outcome/confirmation/correction transitions, participant/winner validation and defaulted-versus-declared-difference lineup behavior.
- [x] **Database/API verification:** Confirm, retry and correct through authenticated APIs; assert original result versions remain recoverable and unrelated actors cannot alter them.
- [x] **Frontend quality:** Make confirm/correct actions usable on a phone, distinguish provisional/final/corrected states by text and show useful correction feedback in scorer and public game views.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

