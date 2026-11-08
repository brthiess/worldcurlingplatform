---
id: WCP-013
number: 13
title: "Review private photo submissions and publish approved images"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-012]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 13: Review private photo submissions and publish approved images

**What to build:** A linked player uploads a replacement, sees review status, and an administrator publishes only the exact reviewed image.

**Blocked by:** [12: Create accounts, approve player claims and edit profiles](12-create-accounts-approve-player-claims-and-edit-profiles.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-011, US-054, US-055, US-066, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-05, T-06, T-12, T-14.
- Demo coverage: D-05.

## Acceptance criteria

- [ ] Keep pending/rejected media private and leave the previous approved image visible until approval.
- [ ] Validate and process uploads into durable storage; bind approval to immutable reviewed content rather than a replaceable upload key.
- [ ] Retain approval/rejection actor, time and reason; do not expose upload credentials or private originals through public APIs.
- [ ] **Unit testing:** Test media type/size/input validation, request transitions, asset binding and public/private projection policy.
- [ ] **Database/API verification:** Exercise upload, rejection and approval with controlled storage adapters and real PostgreSQL; prove a pending asset is inaccessible through public paths and cannot be swapped after review.
- [ ] **Frontend quality:** Provide usable upload/progress/preview/status controls and reviewer comparison, with clear rejection feedback and correct public image replacement at mobile and desktop sizes.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

