---
id: WCP-038
number: 38
title: "Approve and publish complete dated WCTRS lists"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-034]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 38: Approve and publish complete dated WCTRS lists

**What to build:** A World Curling administrator compares and approves a complete dated list, and public rankings expose that exact approved publication.

**Blocked by:** [34: Calculate four-player overall WCTRS draft lists](34-calculate-four-player-overall-wctrs-draft-lists.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-015, US-016, US-017, US-020, US-024, US-067, US-068, US-069, US-070, US-089, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-06, T-08, T-09, T-11, T-12, T-14.
- Demo coverage: D-06, D-07.
- Specific product decisions: P-01, P-04.

## Acceptance criteria

- [ ] Use a list/subject-type-independent review/publication contract compatible with overall, series and mixed-doubles draft producers.
- [ ] Block publication on required calculation/eligibility issues; allow only informational acknowledgements unrelated to the calculation, without an exception/waiver engine.
- [ ] Freeze inputs, contributions, outputs and decision evidence; expose effective and publication dates separately and exclude drafts/live projections from public defaults.
- [ ] **Unit testing:** Test readiness gating, informational-versus-blocking issues, authorized publication transitions, comparison rules and meaningful precision.
- [ ] **Database/API verification:** Attempt incomplete/forbidden approval and publish/replay a complete list in PostgreSQL; prove outputs cannot be silently overwritten and published reads are exact.
- [ ] **Frontend quality:** Deliver a focused comparison/approve flow and polished public list/filter/contribution views with actual data and honest blocked/imported/draft/published labels.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

