# Offer coverage

Execution began 2026-11-08. This file describes the bounded acceptance inventory; the published graph and individual verification records carry actual completion state. No workflow below is verified yet.

| Capability | Approved configuration / boundary | Main tickets | State |
|---|---|---|---|
| Application foundation | PostgreSQL persistence, scoped demo sign-in, public scores, web/worker runtime | WCP-001 | Verified locally; see WCP-001.md and WCP-001-merge.md |
| Fan follows main event (D-01) | 16-team four-player triple knockout; stored A/B/C routes, qualifiers, phone list/bracket | 002,003,017–020,046 | Planned |
| Event admission (D-02) | Dated editions/divisions, responsible approver, explicit delegation; registration/ranking separate | 004,005,046 | Planned |
| Mobile scoring (D-03) | Assigned scorekeeper starts/scores/confirms/corrects; stale/idempotent commands and honest save status | 002,003,026,046 | Planned |
| Entry/payment (D-04) | Existing/assembled/provisional lineups, team-season authority, holds/withdrawal, sandbox checkout/refunds | 006–011,028,029,046 | Planned |
| Profile/media (D-05) | Staff-approved claims; biography/handedness; reviewed immutable private photo replacement | 012,013,047 | Accounts/claims locally verified (012); photo work pending |
| Ranking review (D-06) | Sourced history and complete 2026-27 drafts, contribution/replay evidence and explicit publication gates | 014–016,032–039,047 | Planned |
| Finalization/revision (D-07) | Frozen result snapshots, direct replacement ranking publication, retained originals | 027,038,039,047 | Planned |
| Partner companion | Scoped feed score/confirm/correct; denied unrelated command; sequential active-source switch | 030,031,047 | Planned |
| Other accepted formats | One documented configuration each: single/double knockout, pooled round robin, Page, Swiss/Schenkel, pooled-to-Page | 019,021–025,047 | Planned |
| Discipline/list coverage | Men's/women's four-player overall and Champion/Elite/Challenger lists; mixed-doubles pair/individual lists | 026,032–039 | Planned |
| Analytics | Records/titles; approved rank/points/contributions; blank/steal rates; observed end/margin/hammer win rates | 040–043 | Planned |
| Public supporting features | Connected discovery, local favorites, approved-source linked news, honest coverage | 017,044 | Planned |
| Hosted review package | User domain, HTTPS, configured providers, setup/operator/API notes, seven recordings plus partner example | 045–047 | Planned; external inputs not supplied |

All ticket slices require their published unit, real PostgreSQL/API and frontend/browser acceptance. Testing one slice never verifies the entire inventory. Preserve the six exceptional-scenario deferrals and minimum safeguards in the canonical specification. Historical input observations do not establish complete ranking reconstruction, verified participation or known hammer.
