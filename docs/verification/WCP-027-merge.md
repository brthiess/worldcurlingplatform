# WCP-027 independent merge acceptance

Accepted corrected candidate `ab139bd7252b8b74545d7f957349148a8136310a` (runtime/source `40d8cf392848554311fc586448e96807af890389`) into `integration/world-curling-platform` at merge `057cd6a52529ea21f3875b1c45a561a90acff8b0`. Accepted WCP-008 integration `aaf657ccc8e10baa465ac7f790a4f2bb3b0cc5c3` is included. The merge had no conflicts; candidate and primary trees both equal `4ea45b6b5baf4d36743317b1e100ed53ff2ac4c4`. Changes following that tested tree are this review and the historical review's resolution pointer only. Tracker closure and push remain with the coordinator.

The earlier [independent rejection](WCP-027-review.md) remains preserved. Its exact-receipt authority finding is resolved by source `74087e5` and the dedicated regression. Its overlapping diagnostic/browser execution remains **nonacceptance** and is never substituted for the later clean checks below.

## Reviewed behavior and correction

Read the published issue27, authoritative spec, CONTEXT/ADRs, frontend/execution contracts, actual implementation/migration/tests, installed Next page/route guides and retained reports. Verified independent per-division canonical immutable contents/digests, atomic audit, organizer placements/rules/entry and lineup references, ordinary ungated scorekeeper correction and direct replacement retaining the original bytes. Recorded sporting participants exclude unused entry declarations. Ranking eligibility/approval remain separate; organizers receive only scoped issue summaries and current reviewed-input readiness.

The public response uses recursive scalar/sporting allowlists through selected/history/source, nested result/lineup data and serialized public contents. Public bytes have their own canonical projection digest; `snapshotDigest` identifies the unchanged private original. Actual real API assertions check recursive private-field exclusion, both digest meanings and unchanged private evidence.

Current authority now precedes **every** receipt return. Finalization locks edition SHARE, existing entries SHARE, then division UPDATE and checks the locked edition association before receipt lookup. It validates new-command version/source freshness afterward, preserving valid original-body retries after later scoring corrections. Entry amendments use compatible edition SHARE → existing entry UPDATE → division SHARE order with association rechecks. Scheduler edition UPDATE remains first. No lower lock was moved before the edition lock.

The combined real PostgreSQL barriers establish:

- Scheduler-first commits its schedule; queued stale finalization returns409 with no partial snapshot or deadlock.
- A queued new command carrying an exact matching post-move digest returns409 after an unauthorized edition move; current organizer GET403 and version0 prove freshness is not authority.
- A queued saved exact receipt returns409 after the same scope change; current GET403, original bytes/digest/audit ID and one-version/one-audit counts remain unchanged. Baseline, dirty-source and restored-scope exact retries return the original receipt200 without new history.
- Amendment-first returns amendment200/finalization409; the stale finalization leaves no snapshot. A fresh review can finalize version2 entry evidence.
- Finalization-first returns both200; frozen entry version1 remains exact, current version2 makes results dirty, and a fresh replacement preserves the original. Exact retries create no extra entry/finalization history or finalization audit.

## Independent final checks on the accepted union

Exclusive owned production runtime3127 / PostgreSQL `wcp027` on loopback55431. Runtime was down at readiness inspection and restarted from the existing candidate production build. API fixtures completed before browser fixtures started; no other fixture suite or diagnostic harness overlapped. Primary intentionally has no `.env`; build/type/worker/migration commands used process-scoped `DOTENV_CONFIG_PATH` pointing to the ignored owned candidate configuration.

| Actual command / boundary | Result |
| --- | --- |
| Candidate `npx tsx --test --test-concurrency=1 tests/finalization-api.test.ts tests/scheduling-api.test.ts` | **14/14 passed**,0 failures/skips,**7.48s**. All10 finalization cases including both real entry orders, exact-receipt guard and all earlier scheduler/source/privacy/immutable/audit cases, plus4 scheduling cases. |
| Candidate `npx playwright test tests/browser/finalization.spec.ts tests/browser/authority-recovery.spec.ts` | **6/6 passed**,0 failures/skips,**1.4m**. Real finalization/correction/replacement and original history, three-width/axe/keyboard assertions, read/loading/empty/denied/stale states, lost acknowledgement/reload/exact retry, and all4 shared authority recovery cases including definitive validation rejection. Actual authentication throttles stayed enabled. |
| Primary `npm test` | **54/54 domain tests passed**,2.73s. |
| Primary `npm run build`; `npm run typecheck` | Production compile/generated routes/page output and standalone typecheck passed. Build retained the known outside-repository package-lock warning. |
| Primary `npm run worker:probe` | Real PostgreSQL/pg-boss job and actual handler output passed. |
| Primary `npm run db:migrate` | All17 applied migration checksums verified; migrations up to date. |
| Candidate ancestry, exact primary/candidate trees, `git diff --check` | Passed. No pending019/009 implementation source imported. |

The final14 APIs and6 browsers are targeted independent checks, **not** a full repeated API/browser suite. Logs, complete HTML/results and screenshots are retained at ignored `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp027-final-merge/`. Final independent HTML SHA-256: **`fa19cc6643f88d07a69706271aa93a14b8cb93caea2570dbedb40aeb487dff9d`**. The independent earlier clean correction-only8-API/2-browser run remains under `.runtime/wcp027-recheck/`; its startup-unavailable failure log remains separate from the later8/8 green.

## Retained implementer evidence and visual inspection

Read actual accepted008-union logs: all17 fresh migrations/seed/repeat checksums/repeat seed, incremental0020 migrations,54/54 domain tests, build/type/worker,14/14 APIs and16/16 affected browsers. Recomputed the complete union HTML hash as **`21e3e406f5a30510004d81e7a04fbb6a46d4cdc27785849d297f4f17847cdd48`** at `.runtime/wcp027-reports/40d8cf3-accepted008-receipt-union/`. Earlier independent fresh15/repeat/seed evidence remains valid for its explicitly earlier source and does not claim17 migrations.

The clean receipt-correction44-API/35-browser report remains separate at `.runtime/wcp027-reports/74087e5-receipt-correction/`, independently hash-checked as `0b750db23e30b58e8a02be52285d487737e1e381b49c4f84413b17e15542d176`. Original full53-API pass, full46/48 browser run with two assignment-fixture failures, dirty-fixture27/35 browser run with eight failures, corrected35-browser subset and all red barrier logs remain retained with their actual scopes. They have not been overwritten or relabeled as a complete current green suite.

Actually opened all five committed synthetic screenshots during initial review. Their historical provenance stays as recorded in [implementer evidence](WCP-027.md). Also opened current final independent desktop review, phone public original/expanded frozen lineups and phone recovered-finalization screenshots. Readable placements/history/frozen lineups and distinct projection/original digest labels have no visible clipping; no password/private inbox/authentication trace appears in those safe images. Private reports/traces remain ignored.

## Acceptance boundary and remaining work

No outstanding WCP-027 finding remains after the corrected receipt and accepted008 union checks. This accepts the published finalization slice; it grants no ranking publication/eligibility waiver, hosting acceptance or completion of D-07's later ranking-publication portion. Local Chromium only, no dedicated mixed-doubles finalization HTTP/browser fixture or forced grant-revocation race specific to finalization. Existing scoring revocation coverage and the verified current-authority/association barriers remain explicit evidence, not an exhaustive race claim.

The accepted schema currently requires every game to have a draw. Pending WCP-019 introduces nullable draw assignment and owns the actual required-unscheduled-game finalization regression/fix when that source integrates; it was not imported into this reviewed boundary. Comprehensive downstream repair and transitive ranking reassessment stay deferred. No crawler writes, hosted actions, tracker closure or push were performed by this reviewer.
