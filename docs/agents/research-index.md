# Implementation research pointers

Read-only exploration completed 2026-11-08. These notes are inputs for future ticket implementers, not ticket completion or verification evidence. Files live outside the repository per `/implement-spec` and are accessible to fresh agents in this session.

- Import: `C:/Users/brthi/.codex/visualizations/2026/11/08/01a1bbca-a597-7480-aa34-dc89e3b680c3/import-research.md`.
  - Includes a checksum-verified frozen SQLite backup/registry, revision 690, schema/extraction predicate, real parent-scoped IDs, 26,018 games and 20 observed ranking editions.
  - Preserve unknown discipline/core identity/hammer and incomplete extractor provenance. Do not derive permanent teams from partial event lineups. No crawler source writes, service starts or live database connections occurred.
- WCTRS: `C:/Users/brthi/.codex/visualizations/2026/11/08/01a1bbca-a597-7480-aa34-dc89e3b680c3/wctrs-research.md`.
  - Contains official URLs, dated calculation schedules, independent synthetic worked fixtures and explicitly proposed interpretations for the six-event and exact-share ambiguities.
  - Distinguish sourced branches from unresolved mixed-doubles ownership, precision/order and exhausted-tie facts. Further ticket-specific research remains necessary; do not describe notes as verified rule-engine output.
- Draw: `C:/Users/brthi/.codex/visualizations/2026/11/08/01a1bbca-a597-7480-aa34-dc89e3b680c3/draw-research.md`.
  - Candidate application template `application-tko16-q8-233-v1`: 33 qualification games, 2 A / 3 B / 3 C qualifiers, followed by seven fixed single-knockout playoff games. Primary sources support the family; exact routes/pairings are explicit application choices, not an official draw claim.
  - The coordinator independently reviewed the literal qualification graph/fixture using `review-draw.py` beside the notes; `draw-review.json` records passing source/destination, record-depth, terminal and qualifier checks. This adopts the candidate for future WCP-020 implementation, subject to its actual stored-graph/API/browser acceptance. It is not application test evidence. Preserve literal expected edges independently of generator code and inspect remaining result/correction branches during implementation.

The canonical specification and published ticket acceptance always take precedence over research suggestions. Preserve required checks and the approved bounded scope.
