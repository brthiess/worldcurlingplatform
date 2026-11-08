---
id: WCP-001
number: 1
title: "Open a persisted event and sign in with scoped demo roles"
parent: WCP-SPEC-001
type: implementation
status: in-progress
labels: [ready-for-agent]
blocked_by: []
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 01: Open a persisted event and sign in with scoped demo roles

**What to build:** Run the application locally, read one seeded event and game from PostgreSQL, and sign in as scoped administrator, organizer, scorekeeper, or read-only reviewer.

**Blocked by:** None (can start immediately).

**Status:** in-progress

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-001, US-022, US-023, US-043, US-060, US-089, US-090, US-092, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-06, T-12, T-13, T-14.
- Demo coverage: D-01, D-03.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Bootstrap only the web/worker runtime, migrations, isolated demo seed and test harness needed by this slice; do not prebuild the entire schema.
- [ ] The public scorecard and game detail show stored participants, current/latest draw, honest unknown scores, venue time and result state; reload/restart preserves data.
- [ ] Seeded sessions enforce role/resource checks, and no public response exposes credentials, private person fields or internal payloads.
- [ ] **Unit testing:** Test current/latest/next draw selection, score-cell states and initial role/scope decisions using explicit expected outputs.
- [ ] **Database/API verification:** Use real PostgreSQL for migrations, seed repeatability, session-scoped reads and denied writes; exercise the minimal worker/job runtime without mocking application persistence.
- [ ] **Frontend quality:** Establish the shared scores-first visual standard at phone, tablet and desktop widths: aligned/tabular scores, readable hierarchy, keyboard focus, loading/empty/error states and no placeholder controls.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

