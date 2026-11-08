---
id: WCP-031
number: 31
title: "Submit event, entry and finalization commands through partner APIs"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-027, WCP-030]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 31: Submit event, entry and finalization commands through partner APIs

**What to build:** An explicitly authorized partner can submit permitted event/entry data and finalize assigned divisions through the same domain behavior used by the UI.

**Blocked by:** [27: Finalize division results and preserve revised snapshots](27-finalize-division-results-and-preserve-revised-snapshots.md); [30: Provision a scoped scoring feed and switch active sources](30-provision-a-scoped-scoring-feed-and-switch-active-sources.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-027, US-031, US-032, US-042, US-077, US-078, US-079, US-080, US-081, US-092, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-06, T-09, T-12, T-14.
- Demo coverage: D-02, D-03, D-04, D-07.
- Specific product decisions: P-02, P-04.

## Acceptance criteria

- [ ] Expose bounded command contracts and action/scope grants for event information, entries and organizer-level finalization.
- [ ] Scoring access alone grants neither finalization nor event approval/ranking publication; preserve on-behalf-of client attribution and safe retries.
- [ ] Return clear accepted/current/conflict/denied outcomes and documented API usage; do not invent another data-authority model.
- [ ] **Unit testing:** Test command/scope policy and input/response validation for allowed and denied partner actions.
- [ ] **Database/API verification:** Compare equivalent human and partner command outcomes, audit attribution and duplicate behavior in PostgreSQL; deny unrelated scopes and publication attempts.
- [ ] **Frontend quality:** The existing admin/public views reflect partner changes accurately and expose client provenance where appropriate; no separate unimplemented integration dashboard is required.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

