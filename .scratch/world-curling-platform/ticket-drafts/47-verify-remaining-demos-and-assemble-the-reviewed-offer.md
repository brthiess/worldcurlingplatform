---
id: WCP-047
number: 47
title: "Verify remaining demos and assemble the reviewed offer"
parent: WCP-SPEC-001
type: verification
status: proposed
labels: []
blocked_by: [WCP-013, WCP-021, WCP-024, WCP-031, WCP-035, WCP-037, WCP-039, WCP-040, WCP-041, WCP-042, WCP-043, WCP-044, WCP-046]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
---

# 47: Verify remaining demos and assemble the reviewed offer

**What to build:** Record D-05 through D-07 and the partner companion, rerun the agreed supporting capability checks and deliver a coherent hosted offer package.

**Blocked by:** [13: Review private photo submissions and publish approved images](13-review-private-photo-submissions-and-publish-approved-images.md); [21: Run one documented double-knockout configuration](21-run-one-documented-double-knockout-configuration.md); [24: Generate and score bounded Swiss/Schenkel pairings](24-generate-and-score-bounded-swiss-schenkel-pairings.md); [31: Submit event, entry and finalization commands through partner APIs](31-submit-event-entry-and-finalization-commands-through-partner-apis.md); [35: Calculate Champion, Elite and Challenger series drafts](35-calculate-champion-elite-and-challenger-series-drafts.md); [37: Calculate mixed-doubles pair and individual draft lists](37-calculate-mixed-doubles-pair-and-individual-draft-lists.md); [39: Audit ranking history and approve a direct replacement](39-audit-ranking-history-and-approve-a-direct-replacement.md); [40: Show team win-loss records and title counts](40-show-team-win-loss-records-and-title-counts.md); [41: Chart approved rank and points history with contributions](41-chart-approved-rank-and-points-history-with-contributions.md); [42: Show blank and steal rates from known end data](42-show-blank-and-steal-rates-from-known-end-data.md); [43: Show observed win rates by end, margin and hammer](43-show-observed-win-rates-by-end-margin-and-hammer.md); [44: Aggregate approved curling news into working source links](44-aggregate-approved-curling-news-into-working-source-links.md); [46: Verify and record the fan, approval, scoring and entry demos](46-verify-and-record-the-fan-approval-scoring-and-entry-demos.md).

**Status:** proposed — awaiting breakdown approval; not published as ready-for-agent.

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-011, US-014, US-015, US-016, US-017, US-018, US-019, US-020, US-021, US-024, US-042, US-051, US-052, US-053, US-054, US-055, US-061, US-065, US-066, US-067, US-068, US-069, US-070, US-071, US-072, US-073, US-074, US-075, US-076, US-077, US-078, US-079, US-080, US-081, US-088, US-089, US-090, US-091, US-092, US-093, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14.
- Demo coverage: D-05, D-06, D-07.
- Specific product decisions: P-01, P-02, P-03, P-04, P-05.

## Acceptance criteria

- [ ] Exercise claim/photo review, historical and calculated ranking audit, direct corrected-finalization/replacement approval, and sequential scoped partner scoring/source switching.
- [ ] Verify one documented configuration for each accepted format, supported four-player/mixed-doubles coverage and the four P-05 analytics views; publish only actual verification status.
- [ ] Assemble seven recordings plus partner example, setup/API/operator notes, source/provenance and known limitations; preserve all explicit deferrals and unresolved official-rule claims honestly.
- [ ] **Unit testing:** Run all domain suites and review coverage gaps against supported rule branches and P-01 through P-05; no arbitrary percentage or trivial tests substitutes for meaningful evidence.
- [ ] **Database/API verification:** Run T-01 through T-14 within the bounded acceptance map, including real PostgreSQL, repeat imports, publication gates/replay and configured sandbox checks; do not require deferred recovery engines.
- [ ] **Frontend quality:** Perform cross-page mobile/tablet/desktop and accessibility review, correct material visible/console/network defects, and confirm every displayed control uses implemented behavior and purposeful content.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

This is a bounded integration/recording slice over already delivered features, not a final place to defer their tests or visual quality. Fix observed scoped regressions and add focused regression evidence; new features require their own agreed work.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

