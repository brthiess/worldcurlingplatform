---
id: WCP-012
number: 12
title: "Create accounts, approve player claims and edit profiles"
parent: WCP-SPEC-001
type: implementation
status: in-progress
labels: [ready-for-agent]
blocked_by: [WCP-001]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 12: Create accounts, approve player claims and edit profiles

**What to build:** A visitor registers, requests control of an existing player, receives World Curling approval and edits biography/handedness through the working site.

**Blocked by:** [01: Open a persisted event and sign in with scoped demo roles](01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md).

**Status:** in-progress

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-011, US-051, US-052, US-053, US-056, US-065, US-089, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-05, T-06, T-12, T-14.
- Demo coverage: D-05.
- Specific product decisions: P-02.

## Acceptance criteria

- [ ] Provide configured account verification/recovery integration and safe local email fixtures; account creation alone links no player or team authority.
- [ ] Let administrators approve/reject a claim and retain the decision; sport records remain independent of login accounts.
- [ ] Limit player-controlled text fields to short biography and handedness and preserve other role boundaries.
- [ ] **Unit testing:** Test claim/link transitions, permitted field changes, validated profile input and denial before approval or for another player.
- [ ] **Database/API verification:** Use real application sessions and PostgreSQL to prove ownership/link uniqueness and public projection boundaries; verify email/recovery adapters without exposing tokens.
- [ ] **Frontend quality:** Deliver complete register/sign-in/claim/status/profile forms and public profile reads with concise errors, keyboard access and no invented biography.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

