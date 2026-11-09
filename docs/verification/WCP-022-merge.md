# WCP-022 independent integration review

Accepted after independent source, artifact and runtime review on 2026-11-09 UTC. No unresolved material finding remains. The coordinator owns tracker closure.

## Source and scope

- Accepted starting integration: `7a892b69eb5a3b9d198b5b233f743f6b433bcd2b`.
- Reviewed candidate: `5a78b3f0c1f7041085c5c7ba834fc86e9d738f08`, branch `ticket/WCP-022`; its final runtime source is `2b2fa245be173118c2a635ea8efa1de01f8dcf82` and its final checkpoint changes documentation/safe screenshots only.
- Independent integration merge: `983f23199fb8bca473c13cfd51492744954519ef`. `git diff` between candidate and this merge is empty for `src`, `scripts`, `tests`, `migrations`, `package.json` and the lockfile. No pending WCP-007/034 source was imported. All inherited suites remain in the standard commands; the pool suites were appended.
- Production integration build ID: `ziGNHZfj1uaq1kEf5R_zd` (BUILD_ID file SHA256 `31a1dec9a08dee470d214a1328726b428930330e44b00bed039f41f6dc13da52`). Product source stayed frozen throughout checks. Only independent evidence and inspected fictional pool screenshots follow this merge.
- Read canonical specification, published issue22/task graph, glossary/ADRs, frontend specification, execution/tracker contracts, and adopted external format fixtures. Read the installed Next `use-client` and client-fetching guides. Archived ticket drafts were not execution inputs.

The literal fixture matches the adopted application profile: exactly eight four-player entries, A=(1,4,5,8), B=(2,3,6,7), twelve unique games in three rounds with no cross-pool games. Independent lower-numbered winners produce A1 3–0/A4 2–1/A5 1–2/A8 0–3 and B2 3–0/B3 2–1/B6 1–2/B7 0–3. Current confirmed results drive standings; an ordinary correction changes the records without changing participants or the frozen graph. Unknown/unfinished outcomes remain pending. Four-player scoring requires a decisive result, so no drawn result or played0–0 is inferred.

Reviewed generator/persisted graph, explicit public field selection, current result/correction projection, exact profile ID/version/family assessment mapping, admitted-only full configured field, capacity ceiling, known-team collision, current authority before receipt replay, edition-first locking, audit rollback, and required unscheduled-game finalization. Shared draw freshness/abort guards and retained exact-command recovery preserve existing single/triple behavior. Pool selection, keyboard focus/back, stored-profile public link labels and actual game links were checked. No sporting tiebreak, automatic qualifier, cross-pool ranking, playoff or champion is created.

## Independent checks

Durable private evidence is under `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp022-review-independent/`, outside disposable worktrees. API and browser fixtures ran sequentially, using owned PostgreSQL13 loopback55431/database `wcp022`, web3122/news3222. Primary has no `.env`; commands used process-scoped `DOTENV_CONFIG_PATH` to the private owned runtime configuration. No credentials were copied into primary or committed.

| Check | Actual result |
| --- | --- |
| Frozen candidate `npm test` |93/93 passed,0 failed/skipped; `domain-candidate.log`. Literal fixture/outcome, unknown/pending/tied records, duplicate exclusion, public allowlist and assessment association/evidence cases reviewed. Runtime source is identical to the integration merge. |
| Integration `npm run build`; `npm run typecheck` |Both passed; complete `build.log`, `typecheck.log`. |
| Integration real HTTP/PostgreSQL affected scope below |74/74 tests passed,0 failed/skipped,191.04s; complete `api-affected.log`. Includes real lock-barrier/concurrency tests,12 confirmations/correction, admissions/receipts, audit503 rollback/exact retry, and all12 required unscheduled pool games blocking finalization. Each file retains its own PostgreSQL pool lifetime; real authentication throttles and bounded waits were retained. |
| Integration production browser scope below |44/44 passed across9 files,8.1min. Complete `browser.log`, `browser-report/`, `browser-results/`; decoded actual embedded report retained as `report.json`, summary in `report-summary.log`. Unexpected/flaky/skipped/errors all0. HTML SHA256 `6e15c76796f4ce742f5b7d96c6c556c545b2ca503ec6ecccf6b1851f2b26bc0f`. |
| Independent seeded public phone navigation |Passed event→pools→filtered-empty→actual game→pools→schedule→back. Axe0 violations, console/page errors0, HTTP5xx0, no document overflow; `public-navigation.mjs`, `.log`, `.zip`, `.png`. Actual screenshot opened. |
| Fresh complete migration/seed/repeat |Privately archived pre-existing owned `wcp022_fresh` with pg_dump, verified no active connections, recreated only this owned database. All25 SQL files applied and seed passed. Actual stored migration SHA256 values matched every checked-in file. Repeat migration/seed preserved12 game rows and2 frozen revisions; `fresh-review.mjs`, `fresh-snapshot.json`, `fresh-snapshot.log`, `fresh-repeat-migrate.log`, `fresh-repeat-seed.log`, `fresh-compare.log`. Whole row/graph snapshot SHA256 `ac7d996805221580cfb9f1175c69c1aeaa0f0314022e7514e190d7f32a3e69bf`. |
| Fresh operated result survives reseed |Confirmed a real A01 using the integration scoring command, observed seed1's win, captured public graph/result/standings/history, then seeded again. Exact public snapshot preserved, SHA256 `731f28842328ae50749cc864385f6be85c24251996c780393539abb2394ff5cd`; `played-proof.ts`, `fresh-played-operate.log`, `fresh-played-seed.log`, `fresh-played-compare.log`, `played-snapshot.json`. |
| Worker and fixture cleanup |External producer-only real queue probe passed against the independently launched primary worker (`worker-probe.log`); assessment HTTP/browser jobs also passed. Final `database-final-probe.log` confirms no owned audit-fault triggers remain and12 seeded pool games remain. No self-stopping probe is treated as a persistent worker. |

HTTP command, with the private process-scoped configuration:

```text
node node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 tests/scoring-api.test.ts tests/entries.api.test.ts tests/scheduling-api.test.ts tests/finalization-api.test.ts tests/entries-concurrency-api.test.ts tests/event-assessments.api.test.ts tests/draws-api.test.ts tests/registration-api.test.ts tests/registration-draw-api.test.ts tests/triple-draws-api.test.ts tests/pools-api.test.ts
```

Browser command (`PLAYWRIGHT_HTML_OUTPUT_DIR` selected the dedicated retained report):

```text
node node_modules/@playwright/test/cli.js test tests/browser/draws.spec.ts tests/browser/triple-draws.spec.ts tests/browser/pools.spec.ts tests/browser/scores.spec.ts tests/browser/scoring.spec.ts tests/browser/scheduling.spec.ts tests/browser/registration-draw.spec.ts tests/browser/finalization.spec.ts tests/browser/event-assessments.spec.ts --output=C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp022-review-independent/browser-results
```

The four pool browser cases passed at360/768/1440px with real publication/scoring/polling, selected-pool/focus/back retention, arrow-key tabs, axe, console/network checks and recovery after reload. The held request loading state, deliberately interrupted refresh/stale retention/retry, unpublished empty state and denied reviewer view all passed. Opened all four newly generated pool images: [phone](assets/WCP-022-phone.png), [tablet](assets/WCP-022-tablet.png), [desktop](assets/WCP-022-desktop.png), [stale](assets/WCP-022-stale.png). They contain deliberately fictional public fixtures. Complete generated images were archived privately as `generated-assets/`; the three inherited WCP-009 PNG changes were restored. Only the four inspected pool PNG updates accompany this record.

## Retained failures and provenance limits

There were no failed independent domain, build, type, HTTP or browser runs. The private fresh snapshot helper initially used PostgreSQL13's problematic unquoted alias `data` and failed with42601 after migration/seed had succeeded. Corrected only the private helper to explicit `AS payload`, then reran the snapshot/repeat/comparison successfully (`fresh-helper-first-failure.log`). This was a review helper failure, not application acceptance evidence.

Independently decoded the candidate's actual44-case report, confirming its separate HTML SHA256 `a541eda67112f62be508f26bf7154feb8ba7ca5c928a337b54bba8e6ad620b5b`,44 expected/0 unexpected/flaky/skipped/errors. Also decoded its retained earlier3/4 state report (one unexpected, SHA256 `38f332304c3f0464f2f4e8de44724591cd334ac14feba522bf6d25ee22dcda48`), consistent with the documented aborted-loader correction. Candidate earlier worker-setup/full-HTTP and other red reports remain under `.runtime/wcp022/`; none was overwritten or represented as an independent pass. Its older120/120 full HTTP run is candidate evidence at its stated source, not the scope of this independent74-test run.

The affected nine-file browser scope does not claim unrelated remaining browser files were rerun. No global coverage threshold, provider/hosting result or unrestricted format/stage support is claimed. Exact assessment classification does not supply manual placements or establish a complete pool-only WCTRS award workflow. Hosting/domain remain user-pending; no infrastructure was provisioned. Crawler and unrelated PostgreSQL5432/services were untouched.

## Runtime handoff

After all primary-build checks, stopped only the PID/source-verified primary review Node web/worker wrappers and their Node children. A conservative first shutdown guard stopped on Windows' ordinary hidden `conhost.exe`; no process was stopped then. Inspection identified the exact owned children, and the subsequent shutdown left console hosts alone (`handoff-shutdown-guard.log`).

Restarted unchanged candidate services using `.runtime/wcp022/start-runtime.ps1` and its private `runtime.env`. Candidate build ID `nj89TBqKpWvTaBDmRtVji` was compiled from final runtime checkpoint `2b2fa245be173118c2a635ea8efa1de01f8dcf82`; checked-out candidate `5a78b3f0c1f7041085c5c7ba834fc86e9d738f08` adds documentation/safe images and has identical runtime files to the tested integration. An initial web probe raced startup at two seconds; Next became ready in4.7seconds, and the readiness re-probe returned200 (`handoff-web-first-race.log`, `handoff-web-probe.log`). The separate producer-only worker probe completed a real job (`handoff-worker-probe.log`).

Exact observed candidate processes at handoff: web listener104936 under wrapper90204, worker wrapper107016; commands/source association are in `handoff-processes.log`. These IDs are observations, not durable liveness guarantees. Re-probe after handoff and inspect exact owned source/ports before restarting. No primary-sourced review web/worker is left for a later integration build to overwrite. Git source checks and `git diff --check` passed; tracker closure is left to the coordinator.
