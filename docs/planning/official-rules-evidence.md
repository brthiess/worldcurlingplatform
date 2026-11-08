# Official rules evidence for later design rounds

Research date: 2026-11-06. Bounded read-only primary-source review by a research agent. These sources inform modeling; they do not establish user-approved platform policy or World Curling endorsement of this offer. Historical rules and full calculation formulas have not yet been audited.

## Source register

| Source | Edition or scope observed |
|---|---|
| [WCTRS overview](https://worldcurling.org/teamrankings/) | Current overview, ranking families, and eligibility clarification |
| [Four-player calculations](https://worldcurling.org/teamrankings/ranking-calculations-four-player/) | 2026-27 calculation and dated transition schedules |
| [Mixed doubles calculations](https://worldcurling.org/teamrankings/ranking-calculations-mixed-doubles/) | Individual/pair inputs and dated 2026-27 schedule; discrepancy below |
| [Team and Player Eligibility Rules](https://worldcurling.org/wp-content/uploads/2026/07/WCTRS-Team-and-Player-Eligibility-Rules-2026-2027.pdf) | Internally June 2026; July upload path |
| [Competition Series Explainer](https://worldcurling.org/wp-content/uploads/2026/07/WCTRS-Competition-Series-Explainer.pdf) | Champion, Elite, and Challenger Series |
| [Member Association methodology](https://rankings.worldcurling.org/associations/description) | Association subjects, four-season weighting, and Olympic/Paralympic attribution |
| [Rules of Curling and Rules of Competition](https://worldcurling.org/wp-content/uploads/2026/10/Rules-of-Curling-2026.pdf) | Cover 1 September 2026; October upload path |
| [Competition Policy & Procedure Manual](https://worldcurling.org/wp-content/uploads/2026/11/Policy-Procedures-Manual-2026_Clean_20261030.pdf) | Rules portal labels November 2026; cover October 2026 |
| [Competition Formats and Qualification Criteria](https://worldcurling.org/wp-content/uploads/2026/11/Competition-Formats-and-Qualification-criteria_20261030.pdf) | Rules portal labels November 2026; cover October 2026 |

Documents were followed from the [WCTRS overview](https://worldcurling.org/teamrankings/) and [rules portal](https://worldcurling.org/rules/). Upload-path dates alone must not identify a rules edition.

## Model implications to discuss

- Ranking subjects include men's/women's teams, mixed doubles pairs, and mixed doubles individual players. The men's/women's series lists and association rankings are distinct calculation families.
- Mixed doubles field-strength inputs can depend on individual and four-player ranking information; a pair-only history is insufficient.
- Eligibility rules distinguish four-player/five-player registrations, roster continuity, individual allocations, transfer timing, and exemptions. Sporting identity, registered roster, game participation, and ranking entitlement need separate definitions. A skip name is not a universal team identity rule.
- Four-player assessments use a specific preceding-Tuesday ranking input. Prior-edition event strength may also matter; dated publications and series/edition lineage are relevant evidence.
- Competition participation rules and WCTRS eligibility are separate policies. Discipline-specific rules include wheelchair, wheelchair mixed doubles, mixed, and mixed doubles; a universal four-player validation rule would be inappropriate.

## Unresolved official-source discrepancies

- The mixed doubles calculation page mentions eight counting events in its introduction, while its dated 2026-27 rollout reaches six. Do not silently select a value; establish a documented interpretation and later obtain official clarification before claiming production rule correctness.
- The eligibility PDF's rounded five-player example gives 25%, 25%, and three 16.67% allocations, totaling 100.01%, alongside a requirement for 100%. Exact internal entitlement representation and displayed rounding need deliberate treatment; the proposed schema's exact-sum invariant cannot simply ingest those rounded literals.

These are future rule-engine research/interpretation tasks. They do not block the current event-registration interview.

## Follow-up on the two discrepancies

Further official-source research found corroboration, not an explicit erratum. The [2024-25 mixed doubles update](https://worldcurling.org/wp-content/uploads/2024/07/MD-Points-Group-2024-2025-changes.pdf), linked by the [July 2024 announcement](https://worldcurling.org/2024/07/wctrs-changes-2425/), describes six counting events and the same six-step calendar. The [2026-27 update](https://worldcurling.org/wp-content/uploads/2026/07/WCTRS-update-2026-2027.pdf) does not resolve the conflicting introductory text on the current calculation page. Evidence favors six for mixed doubles; treating the eight-event introduction as retained four-player boilerplate remains an inference, not an official correction.

All four pages of the current eligibility PDF were checked for allocation precision/residual guidance; none was found. The [2022 announcement](https://worldcurling.org/2022/08/wctrs-review/) repeats the rounded allocation example. Its SFM-rounding guidance does not establish an ownership-allocation rounding rule. The example is consistent with three equal one-sixth shares displayed to two decimal places, but exact entitlement representation is still unspecified. Do not silently assign a residual to one player or normalize supplied percentages and claim that policy is official.
