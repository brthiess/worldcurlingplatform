---
id: WCP-030
number: 30
title: "Provision a scoped scoring feed and switch active sources"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-003]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 30: Provision a scoped scoring feed and switch active sources

**What to build:** World Curling provisions a feed that scores/confirms/corrects its designated game, and authorized staff switch between that feed and manual scoring.

**Blocked by:** [03: Confirm results and make ordinary auditable corrections](03-confirm-results-and-make-ordinary-auditable-corrections.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-048, US-050, US-060, US-077, US-079, US-081, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-06, T-09, T-12, T-14.
- Demo coverage: D-03.

## Acceptance criteria

- [ ] Issue/rotate/revoke event/action-scoped credentials with nonrecoverable secret verification and recorded client/request attribution.
- [ ] Use the same score validation/version/idempotency rules as humans; only one active source controls a game.
- [ ] Check current authority/source at the application point; reject stale-source work after a switch/revocation. Demonstrate sequential switching, not queue-draining/recovery automation.
- [ ] **Unit testing:** Test scope/action matching, credential/source decisions, duplicate/stale update classification and revoked-source rejection.
- [ ] **Database/API verification:** Drive permitted/forbidden feed commands and human takeover against real PostgreSQL, including current authority checks and retained audit history.
- [ ] **Frontend quality:** Deliver usable client/scope/source administration and visible game source/takeover feedback; secrets appear only at issuance and never in public views.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

