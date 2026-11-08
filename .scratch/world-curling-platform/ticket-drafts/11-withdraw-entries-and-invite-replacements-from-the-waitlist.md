---
id: WCP-011
number: 11
title: "Withdraw entries and invite replacements from the waitlist"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-010]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 11: Withdraw entries and invite replacements from the waitlist

**What to build:** Authorized staff or representatives withdraw an entry, release its place appropriately and explicitly invite a waitlisted replacement.

**Blocked by:** [10: Record entry charges, waivers and external payments](10-record-entry-charges-waivers-and-external-payments.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-038, US-083, US-087, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-07, T-12, T-14.
- Demo coverage: D-04.
- Specific product decisions: P-02.

## Acceptance criteria

- [ ] Maintain waitlist order/request state and record staff-selected invitations; do not automatically promote the next team.
- [ ] Enforce representative/team-season or organizer scope and consistent reservation release.
- [ ] Keep withdrawal and refund decisions distinct; preserve charge/payment history and avoid an automatic refund promise.
- [ ] **Unit testing:** Test withdrawal/invitation transitions, capacity release, deadline handling and separation from payment/refund state.
- [ ] **Database/API verification:** Exercise repeated withdrawals/invitations and competing capacity claims against PostgreSQL without duplicate active entries or overbooking.
- [ ] **Frontend quality:** Give staff a usable waitlist/invitation action and entrants an accurate withdrawn/invited/held state with explicit payment/refund context.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

