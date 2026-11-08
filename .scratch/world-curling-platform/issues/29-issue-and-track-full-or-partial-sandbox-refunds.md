---
id: WCP-029
number: 29
title: "Issue and track full or partial sandbox refunds"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-028]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 29: Issue and track full or partial sandbox refunds

**What to build:** Authorized staff request a full or partial sandbox refund and entrants/staff see its truthful transaction status and remaining balance.

**Blocked by:** [28: Collect an entry fee with sandbox Checkout and verified events](28-collect-an-entry-fee-with-sandbox-checkout-and-verified-events.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-037, US-038, US-084, US-085, US-086, US-087, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-06, T-07, T-12, T-14.
- Demo coverage: D-04.

## Acceptance criteria

- [ ] Record refund actor/reason, idempotent provider request, pending/succeeded/failed status and amount/currency separately from withdrawal.
- [ ] Reserve the refundable balance including pending requests so retries or overlapping requests cannot over-refund.
- [ ] Demonstrate ordinary sequential refunds and flag uncertain outcomes; defer elaborate concurrent-operator reconciliation UI and automatic refund policy.
- [ ] **Unit testing:** Test refundable/pending balance arithmetic, valid partial amounts, repeated request handling and refund/withdrawal independence.
- [ ] **Database/API verification:** Use PostgreSQL transactions and controlled provider responses to prove duplicate/overlapping requests cannot exceed the balance; perform normal full/partial sandbox checks.
- [ ] **Frontend quality:** Provide a clear staff amount/reason/confirmation form and readable refund history/status without promising success before provider confirmation.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

