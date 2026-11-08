# WCP-003 independent integration review

Reviewed and accepted on 2026-11-08 against published issue 03 selected through `tickets.json`, the canonical specification and bounded safeguards, ADRs 0004/0005, CONTEXT, frontend specification, execution contracts and candidate verification. No material defect was found. Tracker closure and pushing remain the coordinator's responsibility.

## Frozen source and integration

- Reviewed source: `97e02bae25b1ba71d1f1e9de50cae756f4512afb` on `ticket/WCP-003`.
- Reviewed integration base: `928ad8b6eb4d3eef29b31d3ca3a8ed12280858c9`, already contained in the candidate.
- No-fast-forward merge: `25351d0009e39e53c9b3012b498802b2482045e9` on `integration/world-curling-platform`.
- The primary and candidate were clean before integration. The merge required no conflicts or production changes. `git diff HEAD 97e02bae25b1ba71d1f1e9de50cae756f4512afb --exit-code` passed immediately after merging; the merged tree exactly matched the reviewed candidate.
- The candidate diff contains only the documented result slice and inherited fixture adjustments. Neither pending WCP-005 staff authority nor WCP-032 ranking source was imported. Existing applied migration contents were unchanged; only two additive `0017_wcp003_...` migrations were added.

## Acceptance and source review

Read the result policy, command parser and transaction, game lineup adapter, public projection, result/history interfaces, relevant inherited scoring adapter, migrations and result/scoring domain/API/browser tests. Consulted installed Next route-handler and server/client component guides. No framework code was changed during review.

The assigned scorekeeper confirms and corrects without an administrator or second-person gate. The implemented four-player normal profile needs eight played ends and a decisive score matching one of two distinct participants; ties, unknown normal scores, premature normal completion and impossible end ordering are rejected. Concessions retain partial or unknown evidence and record a reason/winner; forfeits retain unknown final totals. This is bounded four-player operation, not mixed-doubles or a complete sporting eligibility engine.

Game defaults use the accepted WCP-006 `readEventLineup` seam and exact event lineup version. Defaulted evidence is frozen and game differences are separately declared without changing core identity, season registration or event entry lineup. Neither is presented as proof that each listed player delivered stones. Legacy unversioned confirmed observations preserve actual prior totals/ends on correction while leaving original actor, winner, outcome and lineup reference explicitly unknown; later event rosters do not become fabricated historical certification.

Every command rechecks current authority and scoring source while holding the game lock, before receipt replay. Accepted versions, request contents and replay receipts remain enforced. Result versions freeze participants/names, end scores/hammer and lineup evidence; immutable triggers protect result/lineup records. Audit, result, lineup, score/version and receipt updates share the transaction. Independent API checks below exercised injected audit rejection and rollback, immutable update/delete denial and concurrent identical retries. A changed upstream winner preserves a played downstream game's actual participants, 5–3 result and version while recording organizer attention through stored direct routes. Advancement, repair and attention resolution remain deferred.

Public result/lineup projections retain sport evidence, public attribution name, time and reason while omitting private actor/request/source/audit/receipt data. Real public API assertions verify that boundary. All eight committed screenshots were opened and visually inspected independently: phone/tablet/desktop corrected result and public earlier history, phone declared lineup and uncertain result. They contain fictional records, readable primary actions/status/history and honest unknown/defaulted/declared evidence.

## Checks actually run by this reviewer

Windows Git/npm commands used reviewed escalated execution. Runtime database mutations were confined to assigned `wcp003` and new `wcp003_reviewfresh` on loopback PostgreSQL port 55431. The running app used port 3103 and retained unique news fixture origin 3203. No crawler, unrelated database, hosted service or environment copy was used.

| Independent command/check | Observed result |
|---|---|
| Candidate `npm test` | All 32 domain tests passed. |
| Candidate `npm run typecheck` | Passed. |
| Candidate `npm run worker:probe` | Actual PostgreSQL pg-boss job completed and handler output verified. |
| `npx tsx --test --test-concurrency=1 tests/results-api.test.ts tests/scoring-api.test.ts` | 13 tests passed (two result cases plus inherited scoring case and ten subtests), 4.8 seconds. Real sessions, current source/scope, stale/version/receipt behavior, public privacy, lineup identity, legacy correction, downstream preservation, atomic rollback and retries were exercised. |
| `PLAYWRIGHT_HTML_REPORT=.runtime/browser-independent-merge-report npx playwright test tests/browser/results.spec.ts --output=.runtime/browser-independent-merge-results` | All five production Chromium workflows passed in 15.2 seconds: phone/tablet/desktop confirmation and correction including hammer evidence; live/corrected declared lineups; and loading/stale/accepted-response-loss recovery with byte-identical retry and one persisted result. Responsive flows assert axe, no overflow and no page errors. |
| `node .runtime/review-fresh.mjs` in candidate | Created new `wcp003_reviewfresh`; all 11 checked-in migrations applied, then seed → repeat migrate → repeat seed and real public/assigned end-five hammer probe passed. Every stored migration filename and SHA256 matched checked-in bytes. The ignored helper remains in the candidate worktree. |
| Merged primary `npm test`, `npm run typecheck`, `npm run build` | All 32 domain tests, types, production compilation and all 22 static pages passed. Build used `DOTENV_CONFIG_PATH` pointing to the existing WCP-003 local configuration; no secrets copied. Next emitted its existing warning about an out-of-repository parent package-lock; compilation and generation succeeded. |
| Candidate diff and merged-tree checks | `git diff --check` passed; merge tree exactly matched candidate source before this review document. |

The first independent HTTP attempt returned three fetch failures because the retained production process had exited. The worker/domain/type checks had passed. Restarting only this candidate's production server on 3103 and rerunning produced the passing real HTTP result above; this was an environment prerequisite, not a suppressed application test failure. No authentication limit, immutable guard or shared application pool was bypassed or disabled.

## Retained evidence inspected separately

Decoded the embedded ZIP from **each entire HTML report**, including all per-file JSON test records and the first report's actual error messages. Paths below are relative to `.worktrees/WCP-003/` and remain ignored local review evidence:

| Retained report | Independently decoded outcome |
|---|---|
| `.runtime/browser-combined-first-report/index.html` | 36 total: 23 passed, 6 failed, 7 skipped; 303.4 seconds. Failures were three outdated version-3 assertions, exact player-label lookup, broad summary locator and actual authentication 429. These correspond to the documented fixes; skipped tests are not counted as passes. |
| `.runtime/browser-combined-final-report/index.html` | 36/36 passed, zero failed/flaky/skipped; 268.9 seconds. All eleven inherited/new browser files are present, including application, entry, history, news/feed, photo, profile, public scores/timezone, results and scoring. This broad report predates the final live-only hammer display/discard assertion delta. |
| `.runtime/browser-final-affected-report/index.html` | 14/14 passed, zero failed/flaky/skipped; 36.6 seconds. Five result and nine inherited scoring workflows; final affected report is separate from the earlier broad report. |

SHA256 of the retained HTML reports, respectively: `0365D94287539A91409B6908B7ED0791D819B4B8D65038A62A9DDA68C84D73CE`, `FD7CB519FB7FBB0B0717C3524CFE6FCDA72B30289D1584AFABC1EA6A2E6E2C63`, `A3E6CCA3F98D9E8BF873B8E4AD4304CAC40250C05D1E2AD3BC6EB798B99C6DFF`.

The implementer's [verification record](WCP-003.md) also records the final complete sequential API/news/service/worker run as 36/36 in 210.6 seconds, final coverage 32/32, fresh and incremental migrations/repeat seeds, build/types, worker and zero-vulnerability audit. Those broader API/coverage/audit claims are retained implementer evidence, not falsely labelled as independently rerun here. The reviewer independently reran the affected PostgreSQL/HTTP, browser, domain, worker, fresh migration/hash/seed and merged build layers described above. The final production delta after the broad browser run was UI-only, plus assertions/documentation; a redundant full browser/news run was not required to establish this narrow merge.

## Limits and handoff

Accepted only this ordinary confirmation/correction slice. No draw advancement/generation/repair, comprehensive downstream continuation, mixed doubles, measurement verification, finalization or ranking correctness is claimed. Direct assignment attention remains unresolved work for organizers/later tickets. Historical unknowns remain unknown. Browser drafts depend on tab session storage and do not promise closed-tab recovery or full offline synchronization. Hosted delivery and domain remain user pending.

No tracker closure or push was performed by this reviewer. The review-document commit is reported to the coordinator with the exact candidate and merge SHAs above; the primary mutation lock is released at handoff.
