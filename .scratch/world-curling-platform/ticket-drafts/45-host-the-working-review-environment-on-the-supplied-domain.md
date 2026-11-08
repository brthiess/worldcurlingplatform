---
id: WCP-045
number: 45
title: "Host the working review environment on the supplied domain"
parent: WCP-SPEC-001
type: implementation
status: proposed
labels: []
blocked_by: [WCP-001]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 45: Host the working review environment on the supplied domain

**What to build:** The implemented application runs as web/worker/PostgreSQL services with a reviewer-accessible HTTPS domain and configured provider adapters.

**Blocked by:** [01: Open a persisted event and sign in with scoped demo roles](01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-051, US-077, US-082, US-088, US-089, US-090, US-092, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-05, T-06, T-07, T-12, T-13, T-14.
- Demo coverage: D-01, D-02, D-03, D-04, D-05, D-06, D-07.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Use actual repository/provider/domain inputs when supplied; this ticket may deploy an early completed slice and accept later feature migrations without waiting for all product branches.
- [ ] Keep resettable synthetic scenarios separate from imported history; configure scoped review accounts, environment secrets, email, media and sandbox payment services as they become available.
- [ ] Document setup, health/jobs, migration/release and operator/API use; do not activate live payments or add the excluded independent backup/recovery project.
- [ ] **Unit testing:** Run applicable deployment/configuration validation and existing domain suites; add focused tests only for new substantive configuration/adapter logic, not duplicate library behavior.
- [ ] **Database/API verification:** Perform hosted web/worker/database persistence, authentication, configured provider and restart/job smoke checks, with real credentials kept out of logs/recordings.
- [ ] **Frontend quality:** Verify the live HTTPS page/sign-in and currently delivered flows on phone/desktop; clearly label demo data and report any unresolved deployment inputs instead of claiming a successful host.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

## External deployment inputs

- User-supplied domain and DNS access.
- Source repository and hosting access with a reviewed service quote.
- Configured email/media/payment sandbox credentials when those integrations are exercised.

These are provisioning-time inputs, not fabricated ticket IDs. Local implementation and other ready slices can proceed while they are unavailable.

