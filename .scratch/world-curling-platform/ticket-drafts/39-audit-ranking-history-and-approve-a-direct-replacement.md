---
id: WCP-039
number: 39
title: "Audit ranking history and approve a direct replacement"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-038]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 39: Audit ranking history and approve a direct replacement

**What to build:** An ordinary result correction leads to revised finalization, a directly affected draft and an approved replacement, while administrators can audit both publications.

**Blocked by:** [38: Approve and publish complete dated WCTRS lists](38-approve-and-publish-complete-dated-wctrs-lists.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-017, US-020, US-042, US-047, US-067, US-068, US-069, US-070, US-091, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-06, T-08, T-09, T-11, T-12, T-14.
- Demo coverage: D-06, D-07.
- Specific product decisions: P-04.

## Acceptance criteria

- [ ] Preserve the original finalized snapshot/publication and show what changed, who acted and the exact calculation inputs/engine revision.
- [ ] Support replay and published-as-seen versus corrected-effective-date views with a direct replacement chain.
- [ ] Do not build transitive later-event field-strength reassessment; retain original later assessment inputs and flag broader impacts as unresolved instead of claiming full cascade completion.
- [ ] **Unit testing:** Test immutable-content/digest comparison, direct supersession/date selection and changed-input classification with independent expected results.
- [ ] **Database/API verification:** Complete correction -> revised finalization -> recalculation -> approval through real commands and assert original snapshots/runs remain unchanged and auditable.
- [ ] **Frontend quality:** Provide useful history/version comparison, actor/reason and contribution navigation, with a clear limitation for wider unprocessed impacts and no fake recalculated status.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

