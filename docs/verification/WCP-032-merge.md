# WCP-032 independent integration review

Accepted on 2026-11-08 after independent candidate review and combined integration checks. This accepts the bounded source/roster/starting-input evidence slice, not event/list calculation or publication. The original [implementation record](WCP-032.md), its early failures/corrections and all earlier issue history remain unchanged. Tracker closure and pushing belong to the coordinator.

## Frozen source and integration

- Phase 1 reviewed clean `ticket/WCP-032` at `55f112e046519d2e9c845c7b2f2d21b3c0493a66`, including accepted `6f690cd`. Primary mutations were withheld until the coordinator granted the lock after WCP-005 acceptance.
- Accepted primary base: `a9a8fc7e3adc71309cd7f7a41d3121e0bc47c47e`. Candidate merge: `2e1fe25c9ce76948422f6c12077eec931edc3142`.
- The sole conflict was `package.json`. The resolution retained every test file from both parents exactly once: ten domain files and thirteen API/service/worker files. Authority, ranking, result, scoring, account, profile, photo, application, entry and news suites remain in the standard commands. Browser discovery remains unchanged.
- Authority recovery/journal, current-scope staff/receipt commands and application responsibility code are byte-for-byte unchanged against accepted WCP-005. Ranking domain/module/workbench and tests are unchanged against `55f112e`. Shared administration navigation and scoped styles retain both features. No pending WCP-018/WCP-008 runtime source was imported.
- Primary no-fast-forward merge: `1d875b411ce348c4cc190a693311f46a676dfdff`. Immediately afterward, `git diff --exit-code HEAD ticket/WCP-032` passed: the integrated tree exactly matched the tested candidate. `git diff --check a9a8fc7 HEAD` passed. This evidence document is the only subsequent change.

## Independent acceptance findings

Read the execution/ticket/tracker contracts, published issue 32 selected through `tickets.json`, canonical specification, CONTEXT, ADR 0004/0006, frontend specification, implementation/API/interpretation records and external WCTRS research. Reviewed source normalization, exact arithmetic, readiness, transactional staff commands, immutable schema, HTTP adapter, UI and tests; consulted the installed Next.js route-handler guide. No reviewer production fix was needed beyond the understood package-script merge conflict.

Platform core identity, platform season snapshots, event/game lineups, separately sourced official ranking regular/alternate roles and individual point ownership remain distinct. The real API regression preserves platform A/B/C/D plus alternate E while reviewing official A/B/C/E plus alternate D. D cannot receive an official regular's share. Public core, season and old entry records remain unchanged. Five regulars versus a designated alternate is independently covered as well. Profile ownership, organizer/scoring roles and representation do not acquire staff ranking authority.

The exact-value regression normalizes `1000.123456789013` to `1000123456789013/1000000000000`, persists and reparses it, and produces the independently expected input sum `1150123456789013/1000000000000`. Rounded front-rotation literals totaling 100.01% are rejected; exact two quarters plus three sixths sum to one, with `300 × 1/6 = 50`. No hidden normalization/residual or floating-point ownership calculation was introduced.

The server derives readiness and ignores forged client flags. Aggregate totals, missing ownership/eligibility/declaration evidence, provisional regular identities, unreviewed/inapplicable rules and stale season versions block review; missing optional biography is informational. A complete draft remains a draft. Downstream consumers must require `state='reviewed'` and current completeness. Later roster changes invalidate current readiness while the old reviewed revision, exact data, roster/rule versions and saved readiness remain inspectable. Atomic audit rollback, immutable revision rejection, exact duplicate/concurrent retries and competing-version conflict passed through PostgreSQL and HTTP.

A separate real-session check in Phase 1 removed the owned fixture administrator's committed staff grant, verified ranking GET and POST returned 403 using the existing session, restored the original grant in a finally-protected cleanup, and verified the same session could read again. An untrusted Origin returned 403. This used real persisted grants and authentication, without disabling guards. Ranking-specific revocation racing an already in-flight write was not separately exercised.

## Official sources and interpretation limits

Independently opened the official four-player and mixed-doubles calculation pages and both registered PDFs. Their dated schedules and allocation options match the template. The six-event and exact one-sixth choices are explicitly documented application interpretations, not official errata. Mixed-doubles field-strength examples do not establish individual/pair ownership.

The implementer's corrected source retrieval timestamp `2026-11-08T19:02:37Z` remains recorded with its correction history. The review independently re-retrieved all four sources in memory at actual completion times `2026-11-08T19:54:29.096Z` through `19:54:29.316Z`, retaining only metadata in ignored `.runtime/verification/merge032-source-recheck.log`. Both PDF hashes match the registered bytes: eligibility `c13342eef3033965562db54038e46a86e4090d00fd11e5cba27d02c6ac77fc99`, historical mixed doubles `cac15e5c9f0233ab928c17546b2ce4eacd8c34394fb34048309341653bfdf15f`. Later mutable HTML hashes differ: four-player `bfe06da1ccea35774375fbed561fde2eaeac518edeefb3c1fddd27dcbffd9d18`, mixed doubles `3f308e15b6c549e6955efa4ae6ce3d9875e852edbc6b6cd21b4b06ba2fee2372`. These later bytes do not replace the earlier edition metadata or independently prove its original retrieval time. No full copyrighted pages were saved or committed.

Mixed-doubles starting readiness remains blocked even after staff source review. Rounding stage/midpoint, exact cutoff/deadline instants, exhausted ties, transfer/continuity/event-subtotal and later eligibility/calculation branches remain unresolved for their dependent engines. A reviewed four-player starting-input sum is not a ranking total, continuity award, calculated list or publication permission. See [interpretations and independent fixtures](../planning/wctrs-input-interpretations.md).

## Checks actually run by this reviewer

Reviewed Windows Git/npm/Node execution was used. All database writes were confined to assigned `wcp032` or newly created merger-owned `wcp032_merge_review_20261108` on project PostgreSQL `127.0.0.1:55431`. Production app port 3132 and controlled news fixture origin 3232 were used. API/browser suites ran sequentially; real authentication throttles and bounded header-aware waits remained enabled. Fixture pools/listeners owned and released their lifetimes. Existing outside-worktree media configuration was used; no environment/credential copy occurred.

| Source context and command | Actual result |
| --- | --- |
| Phase 1 `55f112e`: `npm test`; `npm run typecheck` | 38/38 domain tests passed; TypeScript passed. |
| Phase 1 retained production runtime `388a0cf`, current test source `55f112e`: `npx tsx --test --test-concurrency=1 tests/ranking-inputs.api.test.ts` | 4/4 real HTTP/PostgreSQL ranking workflows passed, 2.009 seconds. Later source differences from the runtime were documentation, screenshots and browser assertions only. |
| Phase 1 `npm run worker:probe` | Real PostgreSQL/pg-boss job completed; expected handler output verified. Worker code was unchanged by WCP-005 integration. |
| Phase 1 `npx playwright test tests/browser/ranking-inputs.spec.ts --output=.runtime/verification/phase1-ranking-browser-results` with separate HTML output directory | 2/2 production browser workflows passed, 17.702 seconds. |
| Phase 1 owned current and retained fresh database inspection | `wcp032` and `wcp032_combined_20261108` each had twelve matching migration hashes and the six-member fictional ranking seed. Earlier `wcp032_fresh_20261108` honestly had ten matching migrations from its pre-results context. These inspections are distinct from the new thirteen-migration execution below. |
| Combined `2e1fe25`: `npm run test:coverage` | 44/44 passed, no failures/skips/cancelled/todo. Ranking domain 95.04% lines / 80.63% branches / 97.87% functions; loaded-file aggregate 97.04% / 91.47% / 99.60% includes tests and erased declarations. Observations, not a coverage gate. |
| Combined `npm run db:migrate`; `npm run typecheck`; `npm run build` | Incremental accepted 0015 applied alongside existing 0018; hashes verified. TypeScript and production build passed; all 24 static pages generated. |
| New empty `wcp032_merge_review_20261108`: migrate, seed, migrate, seed | All thirteen checked-in migrations applied in lexical order, both unique 0017 files included; repeated hash verification and seed passed. Every ledger SHA-256 independently matched actual file bytes. Seed: 2 editions, 5 games, 5 accounts, 6 fictional ranking-season members. |
| Combined production `npm run test:api` | 48/48 passed in 273.272 seconds: 38 top-level tests including ten scoring subtests, zero failures/skips/cancelled/todo. This executes the actual merged standard command, including both authority and ranking suites. |
| Combined production `npx playwright test tests/browser/applications.spec.ts tests/browser/authority.spec.ts tests/browser/authority-recovery.spec.ts tests/browser/ranking-inputs.spec.ts --output=.runtime/verification/merge032-affected-browser-results` with separate HTML output directory | 14/14 passed in 248.102 seconds: applications 4, authority 4, actor-bound recovery 4, ranking inputs 2. All results passed once, retry 0, zero report/result errors; no flaky or skipped tests. |
| Source/merge preservation and whitespace | Both parents' test lists retained exactly once; accepted authority/results/scoring/entry and existing migration bytes unchanged; ranking source unchanged through integration; primary equals tested candidate before this document; changed-range whitespace passed. |

Ignored combined logs remain in candidate `.runtime/verification/merge032-domain-2e1fe25.log`, `merge032-build-2e1fe25.log`, `merge032-fresh-2e1fe25.log`, `merge032-api-2e1fe25.log` and `merge032-affected-browser.log`. No broad second build/API pass was repeated on primary because its source tree exactly matched the tested candidate. After the final source merge only this evidence document was added.

All thirteen fresh migration hashes matched. In particular, accepted 0015 remains `0c1b92700385c2e7a4d2a9eba366869b0acb6dc1d3bfdcf4c22768ddc59d052f`; accepted result migrations remain `5c26eb5bb93f04c42bcada97b7fac366193c20cb5914c452a9b2244abaf0c0b2` and `f5e1b6c929941e372e118cccf3e20f254a2ebadfe02ab935b0a3a2e97d273e93`; WCP-032's 0018 is `7366df73fd43cfd6237c6dcd41e2a6aded3e09f9e3fdbfd5194e0892a49369af`. No accepted migration was edited.

## Retained browser reports and screenshots

Independently decoded every report's embedded ZIP, summary and detailed results. Each listed test had one passed result, retry 0 and no errors. These retained runs are not relabeled as a new full post-WCP-005 run.

| Report | Decoded outcome | HTML SHA-256 |
| --- | --- | --- |
| Project `.runtime/wcp032-reports/5776ebf-full/playwright-report/index.html` | Earlier full run: 33/33 expected, zero unexpected/flaky/skipped. | `2616e4c237b596adc60af6ebbf57de6bc6b26d19fd2bd85f6fff38bc7d0220a9` |
| Project `.runtime/wcp032-reports/b7ed6f9-full/playwright-report/index.html` | Pre-WCP-005 full run: 38/38 expected, including results 5 and ranking 2; zero unexpected/flaky/skipped. | `94dbbc18b44272558dd779ceaaaa2e17eb84070969a8750931f5165811a274bb` |
| Candidate `.runtime/verification/phase1-ranking-browser-report/index.html` | New independent Phase 1 focused run: 2/2 expected. | `efb6aa2cea734bbd470e43062d5dc96c2fdb5ca86c2c251c080dbece9d7e06d3` |
| Candidate `.runtime/verification/merge032-affected-browser-report/index.html` | New combined affected run: 14/14 expected, 248.102 seconds. | `1b10a69a1f03ec4c8b6ca338e417bb3efd15e2d077c2db9fb947ca0c9b20576a` |

Visually opened all seven committed [safe ranking screenshots](assets/WCP-032/phone-review-top.png), including phone/readiness/full season, tablet/desktop season and phone/desktop rule edition views. Every committed screenshot's SHA-256 matches the corresponding image retained from the full `b7ed6f9` production run. Source/role distinctions, input-sum limitation, informational biography and unresolved interpretations are readable, with synthetic records and no credentials/private inbox. The new combined run again checks 360/768/1440 layouts, overflow, axe, keyboard, history, stale data, denial, loading/read failure and actual lost committed acknowledgement recovery; its fresh phone ranking and authority screenshots were also opened visually. Reports/traces remain ignored because they can contain private fixture details.

## Limits and handoff

No full post-integration browser rerun is claimed: the new fourteen affected workflows complement the separately decoded earlier full runs and accepted WCP-005 review. Full combined domain/API, production build and new empty-database evidence are current to `2e1fe25`. Browser evidence is Chromium/local PostgreSQL, not other engines or hosted delivery. Automated source authenticity, every malformed-input/source-editing/allocation permutation and the ranking-specific in-flight revocation race remain uncovered as recorded in the original verification.

The slice adds no manual editable ranking-total shortcut, representative/profile authority expansion, event/list engine, publication command or exception waiver. Hosted/provider credentials and domain remain user-pending under WCP-045. No crawler write, hosting action, tracker closure or push occurred. Primary mutation ownership is released to the coordinator at handoff after this evidence commit.
