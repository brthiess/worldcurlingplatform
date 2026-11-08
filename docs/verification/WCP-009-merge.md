# WCP-009 independent merge review

Reviewed final candidate `62c63082c99125fafb0ccc37f1bc268a1217c313` on `ticket/WCP-009`, from accepted integration `10890b19865cdc85b36db6d4e37cd1283b4f08a7`. The combined application source is `52814168d9d1a8247768150a6a8e8a506850a790`; subsequent changes are browser selectors, evidence and safe screenshots. Accepted WCP-019 is included. No pending WCP-020/033 implementation was imported. The reviewer made no product changes.

Applied the implement-spec review workflow and read AGENTS, execution/ticket/tracker/research guidance, published issue09, canonical requirements, CONTEXT, relevant authority/edition/roster/core/persistence ADRs, frontend specification, installed Next route-handler guidance, registration/draw API contracts, implementation records and actual retained logs/reports. An earlier independent phase-one review of `440a883` deliberately withheld overall acceptance until the accepted WCP-019 union was implemented; its detailed note remains at ignored `.runtime/wcp009-merge/phase1-review.md`.

## Independent verification

Final tests used owned native PostgreSQL13 on loopback55431, database `wcp009`, production app3109 and candidate's ignored configuration. API and browser fixture suites were sequential, source stayed frozen, and real authentication throttling remained enabled. Reviewer started the existing combined production build and stopped it after the browser run. Complete independent logs, HTML/results and private artifacts are retained outside the disposable worktree at `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp009-merge/`.

| Boundary | Actual result |
| --- | --- |
| Complete merged domain | **64/64 passed**, zero failures/skips, 2.25s. Includes mode/prerequisite/deadline/capacity rules, generic family/complete-field policy and accepted six/eight-entry draw domain cases. `union-domain.log`. No new coverage percentage inferred. |
| Final affected PostgreSQL/API | **43/43 passed**, zero failures/skips, **141.80s**. All seven draw cases, five new registration/draw cases, nine registration cases, ten finalization cases and affected entry/concurrency/scheduling files ran without filtering. `union-api.log`. |
| Final affected production browser | **17/17 passed**, zero failures/skips, **3.5minutes**, local Chromium. Complete registration/draw, draw, registration and finalization browser files ran together, including the previously ambiguous stale-publication assertion. `union-browser.log`. |
| Independent fresh combined database | Created owned `wcp009_merge_union_fresh`; all **19** migrations and seed passed. Recorded every public table's sorted-row SHA256, repeated migrate/seed and compared **all59 public tables unchanged**. Every migration filename/checksum matched its ledger. Aggregate before/after `6d8580879a06e13789d6ccaebe213131793562e4fdc5613090da9a1a8cb42e24`. `union-fresh.log`, `union-fresh-manifest.json`, reproducible `verify-union-fresh.mjs`. This is an independent database fingerprint, not the implementer's distinct seeded database hash. |
| Primary production build/typecheck | `npm run build` and standalone `npm run typecheck` passed after merge. The known warning about a package lock outside this Git repository remains; compilation, TypeScript and static/dynamic route generation completed. `primary-build.log`, `primary-types.log`. |
| Primary worker/migration ledger | `npm run worker:probe` completed a real PostgreSQL/pg-boss job and verified handler output. `npm run db:migrate` verified applied files and reported migrations up to date. `primary-worker.log`, `primary-migrate.log`. |
| Integration consistency | Merge `0aaf60a2c4b2761d279beebdddb64639da5ea347` retains exact candidate `62c63082c99125fafb0ccc37f1bc268a1217c313`. Tracked primary/candidate trees matched immediately after merge; whitespace check and candidate status were clean. Only this report and the bounded coverage inventory follow. Primary still has no `.env`; checks used process-scoped `DOTENV_CONFIG_PATH` pointing to the owned candidate configuration. |

Exact final affected commands, in the candidate worktree:

```powershell
node --import tsx --test --test-concurrency=1 tests/registration-draw-api.test.ts tests/registration-api.test.ts tests/draws-api.test.ts tests/finalization-api.test.ts tests/entries.api.test.ts tests/entries-concurrency-api.test.ts tests/scheduling-api.test.ts
npx playwright test tests/browser/registration-draw.spec.ts tests/browser/draws.spec.ts tests/browser/registration.spec.ts tests/browser/finalization.spec.ts --output=../../.runtime/wcp009-merge/union-browser/test-results
```

`PLAYWRIGHT_HTML_OUTPUT_DIR` retained the independent HTML at `union-browser/playwright-report/index.html`, SHA256 **`2f8b3d40b2b53df4b2c52fb39e55348c4a10c7eeaefaa46531bd5886ceebc6b3`**. `.last-run.json` records passed with no failed tests. This is a complete **affected17-case** run, not the complete application browser suite. Tests regenerated six tracked WCP-009 images; independent copies are retained at `union-browser/images/`, original candidate bytes were restored and candidate status confirmed clean.

## Reviewed behavior and safeguards

Immutable opening terms require capacity, entry requirements, fee/payment terms and documented format. Open/reviewed/invited states, zero-fee acceptance and unpaid holds are distinct from lineup readiness, payment collection and ranking eligibility. Database-clock expiry releases capacity immediately; audited materialization and later capacity commands preserve that release. Actual competing paid/zero-fee requests cannot overbook. Current exact team-season submit rights, revocation and locked edition association are checked before receipt replay; historical held receipts after expiry/replacement remain read-only and cannot restore capacity.

Capacity writers take edition UPDATE before lower rows and capture `clock_timestamp()` after waits. Entry writers preserve edition SHARE -> per-division admission advisory lock -> entry UPDATE -> division SHARE. The actual two-amendment barrier observes the wait chain, returns200/409 and leaves one accepted known-team entry plus one accepted null-team entry. Known canonical teams cannot occupy two active places; unresolved identities remain separate without name inference. Linked state/audit/receipt persistence and immutable terms/receipts are verified, including rollback after an injected persistence failure. All ten finalization cases and both actual entry/finalizer race orders remain passing.

The central `readDrawFieldEntries` projection now retains `teamId` and requires accepted admission for configured divisions independently of submission origin. Unconfigured organizer-recorded legacy fixtures retain their previous behavior. Fresh preview/publication requires the registered/operated family to match and the selected set to cover every current accepted entry. The full current field is read under edition UPDATE; both admission-only loss and a newly accepted peer block publication without rewriting the preview. All five nonaccepted states are exercised without lineup-version changes. Six/eight actual accepted entries under capacity16 publish successfully, preserving six-entry structural byes. Capacity is a ceiling. Exact historical receipts are checked before fresh field policy and are not reinterpreted after later changes. Opening registration also rejects existing unscheduled games by required `game.division_id`. Existing played participants/results are not filtered or rewritten.

Opened the three committed configured public PNGs and all three corresponding independently generated PNGs. Phone360 uses a readable five-game list with two explicit structural byes; tablet768 and desktop1440 bracket controls/content are contained and readable. Unknown schedule times remain explicit, and no played win is invented for a bye. Configured positive cases verify keyboard seed traversal, axe0 and no page/console/server errors; registration responsive cases verify page overflow and the separate admission/payment/roster/ranking messages. The earlier phase-one review also opened all four original registration/public-pending PNGs and three independent registration captures.

## Preserved prior evidence and limits

Earlier independent phase-one checks passed57 domain,27 affected API (all ten finalizations/current nine registration cases),6 focused production browser, types and worker; the actual original fresh database matched18 migration checksums/all52 table hashes `90ddffc04682e291e33c255556e45057d3ce32cc4fbb137a94103340b952489a`. These earlier scopes are not relabelled as final union results.

Read actual implementation logs: phase-one full API71/71 before its later known-team guard; affected26/26 and current registration9/9 afterward; full production browser**59/63**, followed by corrected registration/representation**10/10**. The full report remains a failed historical run. Its HTML hash `6e818615c3de508142f805bf8c5f50afd087eb872ae2b78227f21c67ed31b82b` and the affected hash `a6d23e2f421b2f4b7637ec722a065d8c74caa132c4f28f79ea27d58d9ce12382` were independently verified in phase one.

For the combined source, read the implementation's43/43 affected API and fresh19/repeat-seed59-table log (`272cb8d07f2e655ad8946cd5701be1f78b968569a9824149868a0407f3dcba2f`). Original browser3/5 and16/17 failures observed the intended server errors but used ambiguous global-alert/current-versus-history locators. Selector-only corrections retained exact rejection messages and state assertions. The final stale case1/1 exercised both admission loss and new-peer rejection. Verified retained union HTML hashes under `.runtime/wcp009/`:

- `browser-union-focused/playwright-report/index.html` (3/5): `363da75b5ad729e3f8ab6b2f42505b711989256b9882be5f37a06cb2fa9e9763`.
- `browser-union-affected/playwright-report/index.html` (16/17): `62b8d9537fc174a82cf996a683df079637d740789d6d1f1c5c57276df96f5361`.
- `browser-union-stale-final/playwright-report/index.html` (1/1): `2d55d644fb40448e6c11959b4263cc3ef39ac0e508afb1cb4598b5b8cdff4976`.

No full final-source application API/browser rerun or new API/browser coverage percentage is claimed. The original interrupted development reload-loop observation remains documented; this review verified production behavior and does not claim a cause or fix for that development-only observation.

## Acceptance boundary

**Accepted locally for WCP-009**, including its required accepted WCP-019 union. No outstanding product finding remains. Coordinator owns tracker closure, subsequent tickets and push; this reviewer changed no tracker status.

This accepts configured capacity/admission/expiry and the six/eight-entry single-knockout family/complete-field seam. Provider checkout/settlement, fee exceptions, withdrawal/replacement, waitlist promotion, automatic late-payment recovery, future engines, lineage and comprehensive exceptional recovery remain separate slices. No hosted/domain/provider provisioning, Docker operation, credential copy or crawler write occurred. Review app3109 is stopped; no review test remains active.
