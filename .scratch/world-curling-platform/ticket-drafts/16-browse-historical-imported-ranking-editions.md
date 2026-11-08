---
id: WCP-016
number: 16
title: "Browse historical imported ranking editions"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-015]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 16: Browse historical imported ranking editions

**What to build:** Readers and administrators select dated historical ranking observations without pretending they were recalculated by this platform.

**Blocked by:** [15: Approve historical batches and rerun imports safely](15-approve-historical-batches-and-rerun-imports-safely.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-015, US-017, US-020, US-069, US-075, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-09, T-10, T-11, T-12, T-14.
- Demo coverage: D-06.
- Specific product decisions: P-01, P-04.

## Acceptance criteria

- [ ] Retain original labels/ranks/points, source/publication dates and optional subject mappings; unresolved historical rows remain viewable with honest status.
- [ ] Keep imported observations distinct from calculated WCTRS run/approval records and preserve published-as-seen values.
- [ ] Provide season/list/date selection and inspectable provenance, preserving meaningful point precision.
- [ ] **Unit testing:** Test edition selection, nullable subject mapping, origin/date presentation and meaningful decimal formatting.
- [ ] **Database/API verification:** Load representative imported editions via approved batches, select them through public/admin reads and prove later mapping changes do not rewrite frozen observed values.
- [ ] **Frontend quality:** Build a readable dated ranking table/history selector with working resolved subject links and honest unresolved rows, plus accessible phone layouts.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

