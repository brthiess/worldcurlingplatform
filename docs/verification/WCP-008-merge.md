# WCP-008 independent merge review

**WCP-008 is independently accepted within its published boundary.** This review concerns WCP-008 only. **WCP-027 remains open/rejected for its known exact-receipt division-association authorization defect**, documented in [WCP-027-review.md](WCP-027-review.md). A passing existing suite does not test or resolve that defect.

## Source and boundary

Independently reviewed candidate `b90847ad98816171908f3400bb0e06ed78377696`, published issue 08, canonical spec P-02/P-03 and testing decisions, CONTEXT, ADRs 0002/0004/0006, execution contracts, source and actual retained reports. The candidate's complete implementer evidence at `.runtime/wcp008-verification/final-3fc66e6/reports/` was read: 51 domain, 54 API and 56 browser passes, production build, real worker and 16-migration fresh/repeat setup. Those are historical candidate checks, not claims about the later union.

The primary remained read-only during phase one. After explicit lock grant, integration `01ddb5e79a2b4805c201904281ca19cdefaa8416` (including the explicitly rejected/open WCP-027 source) was merged into the candidate. Candidate union `0536bf7` and primary merge `f002478843622aae36a2c52f6fc1343b380d2273` have identical trees. Conflicts were limited to test-script lists and the shared retained-command component: both representation and finalization test suites, allowed paths and receipt descriptions are preserved. No pending WCP-019 implementation was imported.

The reviewed WCP-008 boundary checks current exact account/team/registration season/action authority before replay, denies profile-only control and changed permanent cores, preserves event-only substitutes and immutable lineup versions, and records actor/grant/on-behalf-of season in atomic audit/history. Staff-only entry-season configuration is explicit, versioned and audited. Representative submission is `submitted_pending`; acceptance/capacity/payment remain unresolved. Current staff status protects global setup data and raw command receipts after same-session revocation. Tab-local actor-bound serialized retries survive reload and cannot apply an old command as another current account.

## Independent execution

All runtime checks used owned application 3108, fixture origin 3208, loopback PostgreSQL 13 on 55431, local-file mail and outside-worktree media. No crawler writes or hosted/provider actions occurred. The primary intentionally retains no `.env`; its build/typecheck used process-scoped `DOTENV_CONFIG_PATH` pointing to the owned candidate configuration.

| Scope | Actual result | Evidence |
| --- | --- | --- |
| Phase-one candidate domain | 51/51 passed | Tool execution; candidate `npm test`. |
| Phase-one candidate PostgreSQL/API | 2/2 passed: representation and scheduling barrier | `merge008-phase1-api.log`. Initial attempt encountered an absent production server (`fetch failed`); restarting only owned 3108 and repeating passed. |
| Phase-one candidate production browser | 5/5 passed, 2.5m | `merge008-phase1-browser.log`, `merge008-phase1-browser-html`, `merge008-browser-results`. |
| Union fresh setup | All 17 migrations, seed, repeat checksums and seed passed on new `wcp008_merge_01` | `merge008-union-fresh.log`; ignored `merge008-fresh.mjs`. Accepted original checksums were unchanged. |
| Union domain coverage | 54/54 passed; representation 100% lines/branches/functions | `merge008-union-domain-coverage.log`. Overall 97.47% lines, 91.98% branches, 99.33% functions. |
| Union production build/typecheck | Candidate and primary both passed | `merge008-union-{build,typecheck}.log`, `primary-{build,typecheck}.log`. |
| Union worker | Real pg-boss job/handler output passed | `merge008-union-worker.log`. |
| New two-order PostgreSQL race | 2/2 passed; seven unrelated file cases explicitly skipped in this focused run | `merge008-union-entry-finalization-races.log`; also retained in the complete API command. |
| Complete union PostgreSQL/API | 63/63 passed, 0 skipped/failed, 350.1s | `merge008-union-api-full.log`; `npm run test:api`, with all inherited suites and both new races. The known WCP-027 receipt defect is absent from this checked-in test suite and remains open. |
| Affected union production browser | 20/20 passed, 6.4m; API fixtures finished before browser began | `merge008-union-browser.log`, `merge008-union-browser-html`, `merge008-union-browser-results`. Command: `npx playwright test tests/browser/representation.spec.ts tests/browser/entries.spec.ts tests/browser/finalization.spec.ts tests/browser/authority.spec.ts tests/browser/authority-recovery.spec.ts --output=.runtime/reports/merge008-union-browser-results`, with a separate HTML output directory. This is the affected subset, not the complete browser suite. |

## Entry/finalization race

The new cases in `tests/finalization-api.test.ts` use actual organizer sessions, an isolated future-dated finalization fixture and real PostgreSQL row barriers, observing both wait edges with `pg_blocking_pids` before releasing the barrier. No database/session/persistence mock or timing-only concurrency assertion is used. Owned pools/barriers are released.

- **Amendment first:** hold division UPDATE, wait for amendment (edition SHARE → entry UPDATE → division SHARE), then observe finalizer waiting on the amendment's entry. Release: amendment 200, stale finalization 409, no snapshot/audit created by rejection. A freshly reviewed finalization freezes the exact current entry/lineup version 2.
- **Finalization first:** hold division SHARE, observe finalizer (edition SHARE → entries SHARE → division UPDATE) waiting, then amendment waiting on finalizer's entry. Release: both 200. Snapshot 1 retains original version 1 bytes; current source reports version 2 and dirty. A reviewed revision captures version 2, retains snapshot 1 unchanged, and exact finalization/amendment retries create no extra history/audit versions.

These cases cover compatibility of the currently combined source. **The eventual WCP-027 receipt-path fix must merge accepted WCP-008 and rerun both races after its lock/replay reordering.** They do not establish that the known WCP-027 receipt defect is fixed.

## Visual review, retained evidence and limits

Actually opened and inspected committed desktop staff, phone representative, tablet staff and revoked-recovery screenshots, plus fresh union phone uncertain-entry, phone recovered-finalization and desktop representation-staff screenshots. The staff form has usable width/stacking, the phone entry context is readable, and uncertain/revoked commands visibly freeze editing while preserving explicit unresolved admission/payment state. The independent browser checks also exercise axe, keyboard, current-account mismatch, exact bytes, stale metadata and recoverable failures.

Private reports are preserved outside the disposable worktree under `.runtime/wcp008-verification/merge-0536bf7/`. The candidate's reports remain separately under `.worktrees/WCP-008/.runtime/reports/`. Configuration/secrets are not included in the report archive or committed assets. Historical full browser reports are retained separately from the focused review runs. No full-union browser-suite claim is made. Chromium only; optional malformed-input/editing permutations and exhaustive grant/revoke races remain bounded gaps. Revocation during an already-authorized workspace read remains the documented candidate limitation; writes and receipt access check current authority. Hosting/domain/provider credentials remain user-pending.

The archived union HTML report SHA-256 is `9e1e05496d2242cb8308c267633c72edcf8ac753811e9bc1b3c41523d14b5bde`. Candidate source remained clean throughout execution; primary/candidate source trees matched, and `git diff --check` passed. The final review commit adds only this document after tested primary `f002478`. Tracker closure/push remain with the coordinator; WCP-027's rejected receipt path remains open.
