---
id: WCP-010
number: 10
title: "Record entry charges, waivers and external payments"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-009]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 10: Record entry charges, waivers and external payments

**What to build:** Staff and entrants see an accurate amount due with explicit discounts, waivers or externally received payments, independent of online provider processing.

**Blocked by:** [09: Open division entries with capacity and expiring holds](09-open-division-entries-with-capacity-and-expiring-holds.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-037, US-082, US-084, US-087, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-07, T-12, T-14.
- Demo coverage: D-04.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Freeze charge currency and fee terms for an entry; later event fee edits do not rewrite prior charge history.
- [ ] Apply normal fees to manual/invited entries unless an authorized reasoned adjustment exists.
- [ ] Keep external receipts distinguishable from provider transactions and show payment status separately from withdrawal/readiness.
- [ ] **Unit testing:** Test minor-unit currency arithmetic, allowable adjustments, balance reconciliation and immutable charge-term behavior.
- [ ] **Database/API verification:** Create and adjust charges through guarded commands, retaining an audit trail and rejecting unauthorized/invalid balance changes.
- [ ] **Frontend quality:** Render an understandable entry charge/history view with labelled fee exceptions and external references, avoiding a misleading online-payment success state.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

