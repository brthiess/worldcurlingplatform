# WCP-044 independent review — correction required

Reviewed on 2026-11-08 against published issue 44 selected through `tickets.json`, the canonical specification, relevant authority/application/worker ADRs, frontend specification and execution contracts. The original candidate is `fd3cb835bd240f1b935eb4c6ef876e91e4786e4f`. This review has **not accepted or integrated WCP-044** because an independently reproduced date-validation defect remains.

## Finding retained for the implementer

An RSS entry with `<pubDate>Tue, 31 Feb 2026 10:00:00 GMT</pubDate>` is accepted and normalized as `2026-03-03T10:00:00.000Z`. Expected behavior is to discard the impossible calendar date, as already done for impossible ISO dates, rather than silently invent a different supplied date. `docs/news.md` requires valid supplied publication dates; the ticket requires date validation.

The independent reproduction actually returned that March 3 item. The added regression in `tests/news-domain.test.ts` actually failed: two tests passed and the calendar-date test failed on the 31 February case. It also retains independently invalid 31 April 2026 and 29 February 2025 RSS dates for the correction. No production fix was made by the reviewer; the candidate returns to the implementer to preserve independent implementation and review.

## Reviewed implementation and retained evidence

Read normalization, URL/DNS fetch boundary, relational migration, transactional staff commands, public projection, queue producer, worker handlers/schedule, HTTP adapters, both interfaces and domain/database/API/browser tests. Approved sources plus visible items are required by explicit public SQL projection. Only current global administrators can manage platform news. Source/item versions and transaction-bound immutable audits guard stale changes and rollback; subsequent fetches cannot undo moderation. Fetches recheck current source approval/version before persistence. The worker registers real retryable `news-fetch` handling and the hourly UTC `news-refresh-approved` schedule. The supported supplied summaries remain bounded plain text, with full content ignored and no article-body fetch/editor.

Feed destinations require public HTTPS, reject credentials/custom ports/redirects, resolve all addresses and pin a validated connection address; network/body/XML bounds and the exact operator-controlled loopback fixture exception were inspected. This is not a claim of exhaustive DNS/IPv6/library fuzzing. No passage of a real hour was measured.

Decoded the retained Playwright HTML ZIP: the final report is **2/2 focused news tests**, 54.254 seconds, zero unexpected/flaky/skipped/errors. It is not the earlier complete 26-test run, which is separately documented by the implementer. Opened safe phone/tablet/desktop public screenshots, all three source-failure screenshots, refresh failure and controlled empty state. Synthetic fixture text is clearly labelled; real World Curling cards are distinguishable. Responsive cards, wrapped URLs, focus treatment and errors are readable. No credentials/private review assets were copied into documentation.

## Independent checks before the correction

- Original candidate: `npm test` **23/23**, `npm run typecheck`, production `npm run build`, complete `npm run test:api` **26/26** in 146.668 seconds and real `npm run worker:probe` passed. Authentication fixtures respected production throttle windows.
- Existing owned `wcp044_fresh`: migrate/seed twice passed, applied migration records matched source, literal empty news sources/items confirmed.
- Newly created owned `wcp044_merge_fresh_20261108`: complete initial migrate/seed and repeat migrate/seed passed; real public projection returned literal empty source/item arrays.
- Independent controlled PostgreSQL/HTTP check: another loopback port was denied; suspension while a response was in flight persisted a skipped attempt and zero items; reapproval permitted the later fetch; a repeated fetch retained an explicitly hidden item. The controlled source was suspended through the audited command afterward.
- Actual publisher smoke, separate from fixtures: repeated the retained approved `https://worldcurling.org/feed/` fetch at `2026-11-08T18:15:02.785Z`; no error and exactly **10** actual publisher items remained. No fabricated articles/full bodies were supplied. The original publisher link smoke in the implementer's record remains separately attributed to that run.

## Combined accepted WCP-006 integration preparation

After root granted the primary mutation lock, merged accepted integration `49e1ad69a17d736143ed141e0eff8c3eebde272a` into the candidate as `e85b7811ba2d1335e3f553d6e10fa24d6d1f87de`. Conflicts were limited to main navigation, workspace links and package scripts. Both Teams/News and Manual entries/News moderation links remain. Standard domain/coverage/API scripts retain every inherited entry and news suite. The accepted entry/identity/shared lineup implementation and migration `0014` are byte-for-byte unchanged. Installed Next layout/page guides were read before resolving framework files.

Combined production build, typecheck and `npm run test:coverage` **27/27** passed before the new deliberately failing date regression. News domain coverage was 98.26% lines, 86.25% branches, 100% functions; these figures do not cover SQL or browser behavior. Incremental `0014` application on owned `wcp044` succeeded without editing applied migrations.

Created a second genuinely empty combined review database `wcp044_combined_fresh_20261108`; all nine checked-in migrations applied in sorted order, including `0014` before `0016`. Seed, migrate, seed replay passed; every ledger hash matched its source and news remained empty. No other ticket database, crawler or hosted service was changed.

The combined complete API run was already in progress when the defect was found and completed successfully: **33/33 passed**, zero failed/skipped/cancelled/todo, **208.203 seconds**. This includes all seven accepted entry workflows, news permissions/audit/retry behavior and ten inherited scoring subtests. A labelled console tail with the complete summary is retained ignored at `.runtime/merge044/combined-api-tail.log`; the initial four passing workflows remain in the original execution output. This pass does not cover the newly discovered impossible RFC date case, whose deliberately failing domain regression is preserved separately.

Combined browser rerun and primary integration are withheld pending correction. The primary checkout/integration branch has not been mutated, and the root coordinator was immediately informed that the mutation lock was released. The production app on port 3144 and controlled fixture server on 3344 are stopped at handoff. Existing original screenshot assets and the retained focused report remain unchanged; an ignored backup is also under `.runtime/merge044/`.
