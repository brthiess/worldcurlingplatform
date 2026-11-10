---
id: WCP-026
number: 26
title: "Score mixed doubles and record required measurements"
parent: WCP-SPEC-001
type: implementation
status: in-progress
labels: [ready-for-agent]
blocked_by: [WCP-003, WCP-006]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 26: Score mixed doubles and record required measurements

**What to build:** A mixed-doubles division can be entered and scored through the same working UI with its applicable scoring, participation and measurement profile.

**Blocked by:** [03: Confirm results and make ordinary auditable corrections](03-confirm-results-and-make-ordinary-auditable-corrections.md); [06: Manually enter teams and resolve core-composition identities](06-manually-enter-teams-and-resolve-core-composition-identities.md).

**Status:** in-progress

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-022, US-039, US-044, US-045, US-046, US-047, US-061, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-03, T-04, T-06, T-12, T-14.
- Demo coverage: D-03, D-04.
- Specific product decisions: P-01, P-03.

## Acceptance criteria

- [ ] Implement the documented men's/women's four-player and mixed-doubles profiles; do not add wheelchair/age-specific variants deferred by P-01.
- [ ] Preserve discipline-appropriate hammer/end/outcome and LSD/DSC measurements where required, with unknown versus measured distinctions.
- [ ] Keep core identity, registered roster and actual game participation separate, including temporary substitutions/recorded differences.
- [ ] **Unit testing:** Use sourced profile fixtures to test valid/invalid discipline-specific scores, outcomes, measurement units and lineup restrictions without imposing one universal four-player rule.
- [ ] **Database/API verification:** Enter, score, confirm and ordinarily correct representative mixed-doubles games and required measurements against real PostgreSQL.
- [ ] **Frontend quality:** Verify a clear mixed-doubles entry/scoring screen and public line score, with applicable labels/measurement fields and no irrelevant four-player-only controls.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

