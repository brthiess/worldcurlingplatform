---
id: WCP-044
number: 44
title: "Aggregate approved curling news into working source links"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-001]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 44: Aggregate approved curling news into working source links

**What to build:** Staff configure approved external feeds and fans browse concise news cards that open the original publisher.

**Blocked by:** [01: Open a persisted event and sign in with scoped demo roles](01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-014, US-024, US-060, US-092, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-06, T-11, T-12, T-14.
- Demo coverage: D-01.

## Acceptance criteria

- [ ] Fetch only approved source feeds, record publisher/date/supplied excerpt/original URL and deduplicate items.
- [ ] Allow staff to manage sources and hide unsuitable/duplicate items; record failures and stale fetch state without inventing news.
- [ ] Keep untrusted text/URLs safely rendered and exclude editorial authoring/full-article republication.
- [ ] **Unit testing:** Test feed normalization, identity/deduplication, date/URL validation, safe text projection and hide/source-status filtering.
- [ ] **Database/API verification:** Run retryable fetch jobs with controlled feed fixtures and PostgreSQL, proving duplicate-safe persistence and public/staff permission boundaries.
- [ ] **Frontend quality:** Create useful news cards and source-management controls with honest empty/failure states and working external links, without generated filler or inactive buttons.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

