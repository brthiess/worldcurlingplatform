# WCP-032: sourced input interpretations and hand-worked fixtures

Reviewed 2026-11-08. This ticket implements source/roster/ownership review, not event/list calculations or publication. The registry in `src/domain/wctrs-2026.ts` retains primary URLs, edition descriptions, retrieval time and hashes. Full copyrighted pages are not committed. Hashes identify the exact downloaded bytes; mutable HTML can later change.

All four sources were retrieved afresh at the actually recorded UTC timestamp `2026-11-08T19:02:37Z`. Each request completed within that same second. PDF hashes matched the earlier retrieval; HTML hashes changed, illustrating why retrieval metadata matters. The initial checkpoint's unsubstantiated `12:50:00Z` timestamp was corrected before acceptance; it was not retained as evidence of an actual UTC retrieval.

## Supported, explicitly recorded interpretations

- The [2026-27 mixed-doubles dated table](https://worldcurling.org/teamrankings/ranking-calculations-mixed-doubles/) reaches six counting events. Its introductory eight conflicts with that table. The [adopted 2024-25 change](https://worldcurling.org/wp-content/uploads/2024/07/MD-Points-Group-2024-2025-changes.pdf) corroborates six. The template records six as an application interpretation, not an official erratum. Checkpoints only identify calendar dates; no UTC-midnight cutoff/event-completion convention is asserted.
- The [June 2026 eligibility edition](https://worldcurling.org/wp-content/uploads/2026/07/WCTRS-Team-and-Player-Eligibility-Rules-2026-2027.pdf) prints two 25% and three 16.67% front-rotation shares. Supported application interpretation: `[1/4,1/4,1/6,1/6,1/6]`. A staff-reviewed rules revision must explicitly record this interpretation before front-rotation input can become complete. Arbitrary decimal allocations are never normalized or assigned a hidden residual.
- Exact nonnegative decimal/fraction inputs use integer rational arithmetic, reduced without floating-point arithmetic. Display rounding never changes ownership. The supported four/five-player options retain exact source proportions; membership and player assignments are explicit. This is not a generic custom allocation/exception engine.

## Independently hand-worked input fixtures

These expected values were worked from source statements before the implementation. They are not assertions that later calculators exist.

| Fixture | Independent arithmetic and limit |
| --- | --- |
| Four equal owners, prior total 200 | Each owns `200 × 1/4 = 50`; four individually evidenced entitlements sum to 200. An aggregate observation 200 alone establishes neither individual rights nor current eligibility. |
| Full five rotation, total 200 | Each owns `200 × 1/5 = 40`, sum 200. A sixth designated alternate is outside core/ranking ownership and cannot be inserted into this allocation. |
| Front rotation, total 300 | Two shares `300/4 = 75`; three shares `300/6 = 50`; total 300. Literal `300 × 0.1667 = 50.01` gives 300.03 overall and must fail exact-sum validation. |
| Newly formed five | Conditional on complete prior entitlement evidence: previous totals 100,120,140,160,180 at 20% produce 20,24,28,32,36, sum 140. This does not infer the prior ownership/provenance. |
| Four-player calendar | August 1: 1 slot/weight1; September 15: 2/3⁄4; October 6: 3/5⁄8; October 27: 4/1⁄2; November 17: 5/3⁄8; December 8: 6/1⁄4; December 29: 7/1⁄8; January 19: 8/0. September 14 remains the first checkpoint. |
| Mixed-doubles calendar | August 1:1/1; October 1:2/4⁄5; November 1:3/3⁄5; December 1:4/2⁄5; January 1:5/1⁄5; February 1:6/0. The six-event interpretation does not establish pair/individual ownership. |
| Stage-sensitive rounding diagnostic | For a special four-team field with ranks1–4, summed contribution1.74 padded to8 gives3.915 before importance. Multiplication by1.75 gives6.85125, which rounds to6.9. Rounding3.915 to3.9 first gives6.825, rounding to6.8. Neither stage order is claimed supported by this ticket. |

The [four-player calculations](https://worldcurling.org/teamrankings/ranking-calculations-four-player/) publish the dated four-player/series schedule. Source editions and checkpoints are recorded through an authorized versioned command. Staff can inspect and revise sources, dates, interpretations and rationale. A reviewed source record is not a verified whole rule engine.

## Honest unresolved branches and handoff

Mixed-doubles individual/pair ownership after partner changes lacks complete normative evidence. Field-strength 50/50 examples cannot establish ownership. All mixed-doubles starting-input readiness remains blocked in this bounded slice. No pair award halving or best-partner inference is implemented.

SFM midpoint convention, stage order, series threshold stage, rank200 overlap, exhausted ties, carryover/deduction participation in tiebreaks, exact deadline instants and transfer event-subtotal scope remain open for the relevant later assessment/list/ownership tickets. Exact inputs can be preserved now; unresolved calculation branches must not acquire verified/publication-ready status there. Staff source review does not waive those blockers.

Starting-input readiness here is deliberately scoped: explicit season ranking members, exact current allocation, applicable reviewed rules version, sourced individual amounts, ownership/eligibility evidence and review rationale. A prior-team-share record additionally preserves exact prior total/share and checks its arithmetic. Continuity floors, event awards, list selection, deductions and publication are not computed. An input sum is labelled accordingly, never a manual ranking-total shortcut. Missing optional biography is informational; missing rights/eligibility/provenance is blocking. Factual roster changes use accepted WCP-006 versions; older entry/season/evidence snapshots remain immutable. Team identity/public participation does not require ranking evidence review.

Platform core/season roles and official ranking regular/alternate roles are independent records. A sourced official ranking declaration may differ from the platform core without rewriting identity or old entry/season snapshots. Staff explicitly assign official roles, cite roster evidence and allocate only to official regulars. The initial exact-core equality guard had no supporting rule and was removed after a failing independent-roster regression. The real API fixture preserves platform core A/B/C/D and platform alternate E while recording official regulars A/B/C/E and official alternate D; old platform records remain unchanged, and D cannot receive an ownership share in that official allocation. Existing players outside the season snapshot can also be explicitly selected; they do not become platform core members through this command.
