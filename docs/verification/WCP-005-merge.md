# WCP-005 independent integration review

Reviewed and accepted on 2026-11-08 against published issue 05 selected through `tickets.json`, the canonical specification, ADR 0002, CONTEXT, frontend specification and execution contracts. This review initially withheld acceptance, then independently reproduced the correction before merging. The original rejection record remains unchanged in [WCP-005-review.md](WCP-005-review.md). Tracker closure and remote publication remain the coordinator's responsibility.

## Frozen source and integration

- Originally rejected source: `56fb53db80d508dc7ddafca663700179714dc8cd`; rejection evidence commit `580629534dceb3ceaea584abd3c4b079219dd6af`.
- Corrected reviewed source: `5a0fcd9a7ac7d698ae04beeeba6120771f76baf0` on `ticket/WCP-005`.
- Primary integration base: `6f690cda3c9dd8d2d62e9f51e08edb2391ceddfc`, already contained in the corrected candidate.
- No-fast-forward merge: `db14dc3e25bfb697556cddb90fba5de58e0ae06a` on `integration/world-curling-platform`.
- Primary and candidate were clean before integration. No conflicts or reviewer production-source changes were needed. Immediately after merging, `git diff --exit-code HEAD 5a0fcd9a7ac7d698ae04beeeba6120771f76baf0` passed: the integrated tree exactly matched the reviewed candidate.
- `git diff --check 6f690cd HEAD` passed. The earlier EOF whitespace findings were corrected. Accepted WCP-003 result/scoring/lineup/hammer/legacy source, WCP-006 entry/shared public source and existing migration bytes are unchanged against the primary base. No pending WCP-032 or WCP-018 source was imported. All inherited standard suites remain in the scripts.

## Acceptance and source review

Reviewed the scope/routing policy, transactional delegation and staff commands, guarded HTTP adapters, application responsibility/decision commands, immutable history migration, scoped workspaces/forms and domain/API/browser tests. Consulted the installed Next.js route-handler guide; no framework source was changed during review.

Scopes require geography, organizing organization, category and every proposed division's discipline to match. Empty dimension lists allow all values, named inclusion bypasses dimensions and named exclusion wins. One matching delegation selects one responsible authority/reviewer; zero or overlapping matches fall back to the organization's named World Curling administrator. Existing applications keep their recorded responsibility until an explicit change. Current responsible reviewers need a live matching grant for ordinary decisions. WC-only reassignment and overrides require reasons, preserve the single responsibility and append a versioned, attributed immutable snapshot. Decided admissions can be overridden; drafts still need submission. Admission, registration and ranking eligibility remain separate.

Delegations confer no organizer editing, staff authority, onward delegation or ranking publication. Organizers can grant/revoke scorekeeper access only for games belonging to their own event; they cannot escalate event/global roles. Commands recheck current authority under PostgreSQL locks. Queued-after-revocation commands and accepted scoring-receipt replays after revocation are denied. Resource, history, receipt and audit changes commit atomically; API checks exercise actual rollback and immutable history denial. Public projections remain unchanged and private workspaces return server-authorized resources rather than global browser-filtered lists.

The correction stores the exact serialized command before sending, in an actor-bound tab-local session journal. Related editing stays disabled while the result is uncertain, including after reload. Exact retry sends the original body/ID/version; positive reconciliation requires the original recorded identifiers/action/reason/history. A successful command whose read refresh fails retains its acknowledgement and reconciles without another mutation. A definitive initial validation rejection clears the unaccepted command so fields can be corrected. The server checks the optional retained-command actor header against the real authenticated actor; it does not treat that header as authority. Revocation receipt replay additionally requires current event authority and the original actor/reason. Legitimate independent overlapping grants remain allowed.

## Independent correction reproduction

Ran a separate Playwright/pg script adapted from the original independent reproduction, rather than relying only on the implementer's added test. It forwarded an actual grant to PostgreSQL, verified HTTP 200, and aborted only the browser acknowledgement. Grant and staff editing were disabled, and the journal retained the original serialized bytes and actor.

Switched the actual session to the reviewer while retaining the old admin screen, then clicked exact retry. The server returned **403 account changed**; the same bytes remained retained and editing stayed locked. Restored the administrator and reloaded the tab. Both form groups remained disabled, and the original command survived. Exact retry returned 200 with byte-identical content. Direct PostgreSQL counts and the real workspace confirmed **one grant, one authority-history record and one audit record**. A newly created matching application returned the intended `demo-reviewer`, exact delegation ID and authority name. The journal cleared after acknowledgement, editing resumed, and synthetic grant cleanup returned 200.

Ignored retained evidence in `.worktrees/WCP-005/`: `.runtime/merge005-grant-loss-corrected.mjs`, corresponding `.log`, and `.runtime/merge005-corrected-independent.png`. The original red script/log/cards remain separately retained. The first corrected invocation encountered an exited implementer-owned production process; restarting only this worktree's retained production build on port 3105 produced the passing result. This was a runtime prerequisite, not a suppressed product-test failure.

## Checks actually run by this reviewer

Reviewed Windows Git/npm execution was used. Database mutations were confined to assigned `wcp005_corrected_combined` or new merger-owned `wcp005_merge_corrected_review`, on project PostgreSQL `127.0.0.1:55431`. The app used port 3105 and configured news fixture origin 3205. Authentication throttling stayed enabled and bounded retry helpers honored its headers. No environment files, secrets or private media were copied.

| Independent check | Actual result |
|---|---|
| Corrected candidate `npm run test:coverage` | **38/38 passed**, zero failures/skips/cancelled/todo. Authority branches 97.14%, functions 100%; loaded-file aggregate 96.98% lines / 93.58% branches / 100% functions includes tests and erased declarations. |
| Corrected candidate `npm run typecheck` | Passed. |
| Corrected candidate `npm run worker:probe` | Real PostgreSQL-backed pg-boss job completed and expected handler output verified. |
| `node --import tsx --test --test-concurrency=1 tests/authority-api.test.ts tests/results-api.test.ts tests/scoring-api.test.ts` | **21/21 passed**, 73.299 seconds, zero skipped/cancelled/todo. Eight authority workflows, two result workflows and inherited scoring with ten subtests. Current authority, actor mismatch, exact/conflicting receipts, revoked-organizer replay denial, queued revocation, transaction rollback, immutable history, source/version checks, lineup/hammer/legacy and public-privacy assertions passed. |
| Independent original-defect correction script | Passed with reload, actor-switch denial, exact bytes, one grant/history/audit and intended new-application routing as described above. |
| `PLAYWRIGHT_HTML_REPORT=.runtime/merge005-corrected-independent-report npx playwright test tests/browser/authority-recovery.spec.ts --output=.runtime/merge005-corrected-independent-results` | **4/4 passed**, 12.499 seconds. Actual committed grant/assignment/revocation acknowledgement loss, responsibility reassignment/decided overrides, failed refresh reconciliation and definitive 400 correction. No test retries/skips/flaky results. |
| New empty `wcp005_merge_corrected_review`: migrate, seed, migrate, seed | All **12** checked-in migrations applied in lexical order, both unique 0017 files included. Repeated migration checked stored hashes and repeated seed passed. Independently compared every ledger SHA-256 with actual checked-in bytes. Seed counts: 2 editions, 5 games, 5 accounts. |
| Merged primary `npm test` | **38/38 passed**, no failures/skips/cancelled/todo. |
| Merged primary `npm run typecheck` / `npm run build` | Passed; production compile, TypeScript and all 22 static pages completed. Existing warning about the out-of-repository parent package-lock was emitted. Build used process-scoped `DOTENV_CONFIG_PATH` pointing to the existing candidate configuration. |
| Merged tree / whitespace / preserved source | Exact candidate tree equality and changed-range whitespace passed. Accepted results/scoring/entry/public/migration sources and original rejection record remained unchanged. |

The fresh ledger's WCP-005 `0015` hash remains `0c1b92700385c2e7a4d2a9eba366869b0acb6dc1d3bfdcf4c22768ddc59d052f`. Accepted news `0016` is `d241769596591e00c14922f4bf399ab393c073ba56528028954c4661e35f8b2c`; accepted result `0017_wcp003_immutable_results_and_game_lineups.sql` is `5c26eb5bb93f04c42bcada97b7fac366193c20cb5914c452a9b2244abaf0c0b2`, and `0017_wcp003_lineup_audit.sql` is `f5e1b6c929941e372e118cccf3e20f254a2ebadfe02ab935b0a3a2e97d273e93`. The earlier eight hashes also matched their actual files and original review values.

## Retained reports and visual evidence

Independently decoded each report's embedded ZIP, summary and detailed per-file results. All rows below have only single passed results with retry 0, zero errors and no annotations. These runs retain their actual scope and source context; none is relabeled as a new full combined run.

| Report under candidate worktree | Actual decoded outcome | SHA-256 |
|---|---|---|
| `playwright-report/index.html` — original rejected candidate's full run | 33/33 expected; zero unexpected/flaky/skipped; 294.284 seconds. Original hash unchanged. | `fc30cd5cbb3250f3dee6f7f0429e470526f99da36e35321d0f02b7999a1b1d9e` |
| `.runtime/wcp005-correction-affected-report/index.html` — corrected pre-results affected run | 14/14 expected; zero unexpected/flaky/skipped; 246.257 seconds. Applications 4, authority 4, recovery 4, news 2. | `26505527fffa42a3adbea035098aa08bc995b608f77944a761dec23facb85876` |
| `.runtime/wcp005-corrected-combined-report/index.html` — corrected final affected run | 26/26 expected; zero unexpected/flaky/skipped; 207.014 seconds. Applications 4, authority 4, recovery 4, results 5, scoring 9. | `67320cc49172217bb4930de3ddbd0146e041b97369befea2b913b9a364dbe1a1` |
| `.runtime/merge005-corrected-independent-report/index.html` — this reviewer's new recovery run | 4/4 expected; zero unexpected/flaky/skipped; 12.499 seconds. | `a03986a4b3b0a94bb45edf106e74de29e3a65411d9a7ce3c94018faf30718021` |

The prior review visually inspected all thirteen original safe screenshots at phone/tablet/desktop widths. This correction review additionally opened both new committed recovery screenshots: the phone retained-command explanation, original identifiers and exact retry/reconciliation controls are readable, followed by the recovered single scoped authority. Synthetic records only; no credentials/private originals were committed. The original review's scoped form/denied-state inspection and phone fieldset correction remain applicable. The final affected report includes the queue's rejected/v5 refresh assertions at every width.

The implementer also records corrected combined build/domain checks, 14 authority/news service/API/worker checks, final 21 affected API checks and the separately retained 14/26 browser runs. Those are distinguished from the independent executions above. This reviewer did not redundantly rerun every inherited account/photo/news/entry browser and API workflow after the narrow recovery correction; the earlier original review's full 34-API run, retained full browser run, accepted integration reviews and current affected checks are not interchangeable claims.

## Limits and handoff

Acceptance covers this scoped authority/staff slice and its correction. The journal survives reload in the same browser tab, not a different device or closed-tab offline synchronization. Operational command details can include an account email and reason, but contain no credentials. Current revocation can deny exact retry; unresolved retained commands stay frozen until exact retry or positive recorded-history reconciliation. Advanced delegation policy, automatic bulk rerouting and exceptional recovery engines remain deferred.

Chromium/local PostgreSQL/production Next.js evidence does not establish other-browser or hosted delivery. Domain and provider credentials remain pending under WCP-045. No crawler changes, hosted actions, tracker closure or push were performed by this reviewer. Primary mutation ownership is released to the coordinator at handoff after this evidence commit.
