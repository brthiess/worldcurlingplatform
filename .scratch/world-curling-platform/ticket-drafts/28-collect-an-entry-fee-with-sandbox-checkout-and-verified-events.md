---
id: WCP-028
number: 28
title: "Collect an entry fee with sandbox Checkout and verified events"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-010]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 28: Collect an entry fee with sandbox Checkout and verified events

**What to build:** An authorized entrant pays a held entry through central sandbox Checkout and the application confirms the correct charge/place from verified provider state.

**Blocked by:** [10: Record entry charges, waivers and external payments](10-record-entry-charges-waivers-and-external-payments.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-030, US-037, US-082, US-083, US-084, US-086, US-087, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-06, T-07, T-12, T-14.
- Demo coverage: D-04.
- Specific product decisions: P-02.

## Acceptance criteria

- [ ] Use the existing charge/reservation model and scoped representative/organizer actions; a success redirect alone does not mark an entry paid.
- [ ] Verify provider events, deduplicate deliveries and outbound requests, and retain request/provider/payment status and audit attribution.
- [ ] Never overbook after released capacity; retain a late/exceptional outcome as a visible staff issue without implementing automated settlement policy.
- [ ] **Unit testing:** Test checkout/payment state classification, reservation/balance decisions, invalid/duplicate event handling and minor-unit amounts.
- [ ] **Database/API verification:** Exercise signed provider fixtures, reordered/duplicate delivery and PostgreSQL capacity races, plus a real sandbox checkout when credentials are configured.
- [ ] **Frontend quality:** Show clear pay/return/pending/paid/failed/expired states and charge context on phone and desktop; uncertain outcomes never display a fabricated successful payment.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

