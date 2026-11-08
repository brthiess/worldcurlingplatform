# WCP-005 independent review — acceptance withheld

Reviewed frozen candidate `56fb53db80d508dc7ddafca663700179714dc8cd` against primary integration `761e939` on 2026-11-08. No merge or production-source correction was made. Primary mutation ownership was released to the coordinator after the finding below. Tracker closure and remote publication were not performed.

Read the execution/ticket/tracker contracts, published issue 05 selected through `tickets.json`, canonical specification, ADR 0002, CONTEXT, frontend specification, candidate verification, authority policy and transactional commands, affected application commands/forms, scoped HTTP adapters and domain/API/browser tests. Candidate retains accepted WCP-006 entry/public/scoring sources and migration bytes; pending WCP-003/WCP-044 source was not imported.

## Material finding: a lost delegation acknowledgement duplicates live authority

`src/components/authority-workbench.tsx:185` generates a new delegation ID on each submit. After an accepted POST loses its browser response, `save()` reports the error and releases the form without retaining the accepted command for exact retry. Resubmitting the unchanged form sends another ID. The server correctly treats that as a different grant, and the two matching grants invoke the intended ambiguous-scope fallback. A matching new application therefore loses the intended delegated reviewer and routes to World Curling.

Independent real-browser reproduction forwarded the first POST to the actual production server, verified HTTP 200, then aborted only the browser acknowledgement. After the error rendered, submitting the unchanged form returned success with a different ID. The PostgreSQL-backed workspace contained **two active identical grants**. An actual new matching application then returned `authorityName: World Curling`, `reviewerId: demo-administrator`, `delegationId: null`; the intended single grant names `demo-reviewer`. The assertion expecting one active grant failed **2 != 1**. Both synthetic grants were revoked afterward through real administrator commands, each returning HTTP 200. The completed reproduction was repeated with the same failure while recording readable card captures.

The latest failing attempt IDs were `5dc65856-c941-46f2-bc4d-eb1341d3a404` and `2974220f-b1e5-4f17-8b0e-9047b7efa7ca`. The full independent regression and output are retained, ignored, in the candidate worktree:

- `.runtime/merge005-grant-loss.mjs` — run `node .runtime/merge005-grant-loss.mjs` from the candidate with its existing assigned environment and running production server.
- `.runtime/merge005-grant-loss.log` — actual failing output and successful cleanup.
- `.runtime/merge005-grant-loss-first.png`, `.runtime/merge005-grant-loss-second.png` — the two synthetic live authority cards.

Earlier harness attempts were corrected to allow the React error/finally render to complete and to avoid overlapping inherited-suite waits; they did not establish the product finding. The completed executions above establish it directly without mocked persistence. No credentials, sessions or private media are included in this review record.

Return to the original implementer for a regression and minimal correction preserving the exact pending grant ID/body until acknowledgement or a deliberate recovery. Do not globally prohibit overlapping grants: overlap is an accepted policy and must continue to route safely. Also examine the staff grant submit at line 370 and responsibility command at line 565, which likewise generate new command identities per attempt; their recovery behavior was source-reviewed but not independently reproduced in this review.

## Independent checks that passed

All database writes were confined to assigned `wcp005_latest` or newly created merger-owned `wcp005_merge_review_20261108` on project PostgreSQL `127.0.0.1:55431`. Candidate production build was restarted on port 3105 with `npm start`; no environment files were copied. Auth throttling remained enabled and bounded header-aware retries were honored.

| Check | Actual result |
|---|---|
| `npm run test:coverage` | 30/30 passed, no skipped/cancelled/todo. Authority branches 97.14%, functions 100%; loaded-file aggregate includes tests and erased declarations. |
| `npm run typecheck` | Passed. |
| `npm run worker:probe` | Real pg-boss job completed; expected handler output verified. |
| Complete `npm run test:api` | 34/34 passed (24 top-level plus 10 scoring subtests), 203.774 seconds, no skipped/cancelled/todo. All inherited account/application/entry/photo/profile/scoring suites retained. |
| Fresh migration/seed sequence | New empty database: migrate, seed, migrate, seed passed. All nine ledger names matched the checked-in lexical sequence; each stored SHA-256 independently compared with the actual file content. Seed counts: 2 editions, 5 games, 5 accounts. |
| Fresh migration 0014 / 0015 hashes | `4d7adbd89e4b1e2b102aae97f5ee4794fee2872cba6cd689287a033d2922213c` / `0c1b92700385c2e7a4d2a9eba366869b0acb6dc1d3bfdcf4c22768ddc59d052f`. All eight accepted migration bytes are unchanged against primary. |

The complete changed-range whitespace check `git diff --check 761e939 HEAD` reports extra blank lines at EOF in package.json, tests/browser/profiles.spec.ts, tests/profiles-api.test.ts and tests/scoring-api.test.ts. This minor cleanup does not explain or supersede the acceptance blocker.

## Retained browser and visual evidence reviewed

Independently decoded the embedded ZIP in candidate `playwright-report/index.html`; SHA-256 `fc30cd5cbb3250f3dee6f7f0429e470526f99da36e35321d0f02b7999a1b1d9e`. `report.json` records **33 total/33 expected, zero unexpected/flaky/skipped**, duration **294.284 seconds**. Every detailed result is passed, retry 0, zero errors, with no annotations. Files: applications 4, authority 4, entries 5, history 2, photos 1, profiles 2, scores 5, scoring 9, timezone 1. This is the implementer's retained final full run, independently inspected, not a new full browser execution by this reviewer. Earlier 28-test and focused 8-test runs in the candidate record remain distinct. The full retained report was not overwritten.

Viewed all thirteen committed WCP-005 screenshots. Scope names, event/game assignments, reviewer responsibility and versioned reassignment/override reasons are readable at phone/tablet/desktop widths. The corrected phone responsibility fieldset stays within its panel, and the denied scoring screen is explicit. Browser source assertions check the updated rejected/v5 queue after override at all widths; the retained final report confirms those assertions passed. These passing scenarios do not cover the lost delegation acknowledgement reproduced above.

Source and successful API evidence support all-dimension/all-division scopes, named inclusion/exclusion precedence, singular/ambiguous routing, WC-only delegation and reasoned reassignment/decided overrides, live authorization/revocation checks, organizer own-event scorekeeper-only assignments, queued revocation denial, accepted scoring-receipt replay denial after revocation, and atomic immutable attributed history. Acceptance remains withheld because uncertain browser grant recovery can change those routing results.

Hosted delivery/provider credentials remain pending under WCP-045; no hosted or other-browser claim is made. A new build was not run after the material failure because source acceptance stopped and no production source changed. No integration checks or merged SHA are claimed.
