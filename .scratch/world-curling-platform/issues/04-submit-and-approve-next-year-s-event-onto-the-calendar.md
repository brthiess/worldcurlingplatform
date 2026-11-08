---
id: WCP-004
number: 4
title: "Submit and approve next year's event onto the calendar"
parent: WCP-SPEC-001
type: implementation
status: completed
labels: [ready-for-agent]
blocked_by: [WCP-001]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 04: Submit and approve next year's event onto the calendar

**What to build:** An organizer submits a dated edition with divisions; a World Curling administrator reviews it and lists the approved event publicly.

**Blocked by:** [01: Open a persisted event and sign in with scoped demo roles](01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md).

**Status:** completed

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-005, US-025, US-026, US-027, US-028, US-029, US-057, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-02, T-06, T-12, T-14.
- Demo coverage: D-02, D-04.
- Specific product decisions: P-01.

## Acceptance criteria

- [x] Require organization, name, dates, city/country and proposed divisions while permitting initially incomplete venue/operational details.
- [x] Keep recurring series, dated editions, admission, registration opening and ranking eligibility distinct; creating next year does not overwrite last year.
- [x] Support ordinary organizer edits and administrator corrections with history, without a generalized amendment-reapproval engine.
- [x] **Unit testing:** Test application validation, edition separation, allowed review transitions and independent admission/open/ranking states.
- [x] **Database/API verification:** Persist submit/review/edit actions and atomic audit records; denied actors and unapproved applications do not leak into admitted calendar reads.
- [x] **Frontend quality:** Deliver clear organizer draft/submission and reviewer queue/detail screens plus a usable public event/calendar view, including field errors and empty states.
- [x] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

