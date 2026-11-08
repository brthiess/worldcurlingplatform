# WCP-027 independent review — rejected pending receipt authority fix

**Historical rejection resolved:** corrected receipt validation and the accepted WCP-008 union were independently verified and integrated. See [WCP-027 final merge acceptance](WCP-027-merge.md). The red finding and overlapping-run limitations below remain unchanged as historical evidence.

Reviewed candidate `52000f7216a22e73556154f9b0c2cf0874e585b9` from `ticket/WCP-027` against accepted integration `bc8d47ce184e2c5b24fbc2a425650d8cec1dc26a`. The primary merge checkpoint is `75cc3afa1005eb3b7b0f31b5fdb6c1219a663d4e`; its tree and the candidate tree are both `e8af39107a3fad34cb7c5e8f700cc1352edfc213`. This merge is **not acceptance**. The ticket must remain open; the original implementer owns the correction and a fresh independent review is required.

## Blocking finding: exact receipt replay bypasses locked association recheck

`src/modules/competition/finalization.ts` reads a division's edition, waits for that edition's SHARE lock, then authorizes the initially read edition. Receipt lookup and the successful early return occur before the lower locks and the later division-edition association check. A completed command replay can consequently return its version and digest after the division has moved into an edition outside the caller's current organizer scope. Current authority before replay is part of the documented command contract; the matching-digest new-command regression does not exercise this receipt branch.

The independent real PostgreSQL/production HTTP harness at ignored `.runtime/wcp027-merge/replay-authority.ts` reconstructed an existing receipt's exact original command. A baseline replay returned 200. A real PostgreSQL edition UPDATE barrier then held the exact replay, the division moved into an unrelated edition without a grant for this organizer, and the barrier released. The replay returned **200**, while the organizer's current detail GET returned **403**. The harness expected rejection (409) and exited nonzero. The receipt return was:

```json
{"divisionId":"final-browser-09ea4f5a-2c17-4cf1-aa99-65f6aad56bfe","version":1,"digest":"d24f2184d47fa0a4fb734f14acbe8803839ecc73377c9b887970f99e50565771"}
```

The mutable fixture division's original edition association was restored in `finally`; immutable snapshots/results were untouched. Raw output is retained at `.runtime/wcp027-merge/replay-authority-red.log`.

**Execution limitation:** this diagnostic harness overlapped the independently running browser suite on the same runtime/database and selected a completed browser fixture. This violated the sequential fixture contract. Preserve the observed red and source finding as diagnostic evidence; neither the overlapping harness nor that browser run is clean acceptance evidence. The implementer must add a dedicated receipt fixture/barrier regression and run it sequentially, followed by independent re-verification. No source fix was made by the merger.

## Independently reproduced checks before the diagnostic overlap

All checks used owned loopback PostgreSQL 13 on 55431. Production runtime 3127 was initially down and was restarted from the candidate's existing production build, with ignored owned configuration. No crawler or hosted environment was modified.

| Command / boundary | Actual result |
| --- | --- |
| Candidate `npm test` | 53/53 domain tests passed, 2.19s. |
| Candidate `npx tsx --test --test-concurrency=1 tests/finalization-api.test.ts tests/scheduling-api.test.ts tests/entries.api.test.ts tests/results-api.test.ts tests/scoring-api.test.ts tests/ranking-inputs.api.test.ts tests/authority-api.test.ts` | 43/43 real PostgreSQL/HTTP tests passed, 144.06s. Includes immutable original/replacement/other-division evidence, unused-entry exclusion, recursive public privacy projection, audit rollback, scheduling deadlock barrier and matching-digest new-command edition-move barrier. This suite lacks the exact-receipt barrier above. |
| Independent ignored `fresh-review.mjs` harness | New owned `wcp027_merge_fresh_20261108`: all 15 migrations applied, seed passed, repeat migration checksums and repeat seed passed. |
| Primary `npm run build` | Passed production compile, types and page generation. Process-scoped `DOTENV_CONFIG_PATH` pointed to candidate `.env`; no configuration copied into primary. Next emitted its inherited outside-repository package-lock warning. |
| Primary `npm run typecheck` | Passed against production-generated types. |
| Primary `npm run worker:probe` | Real PostgreSQL/pg-boss job and handler output passed. |
| `git diff --check`, candidate/primary tree comparison | Passed; exact tree identity recorded above. |

Independent logs and scripts are preserved under `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp027-merge/` and intentionally ignored. No credentials are committed.

## Browser/report and visual review scope

The independent command was `npx playwright test tests/browser/finalization.spec.ts tests/browser/scheduling.spec.ts tests/browser/entries.spec.ts tests/browser/ranking-inputs.spec.ts tests/browser/scores.spec.ts tests/browser/scoring.spec.ts tests/browser/history.spec.ts tests/browser/timezone.spec.ts tests/browser/authority-recovery.spec.ts`, with report/results redirected to `.runtime/wcp027-merge/playwright-report` and `test-results`. It finished **35/35 passed in 3.8m**, including both finalization workflows; log `affected-browser.log`. Because of the diagnostic overlap above, this is **not clean acceptance evidence** despite its green test result. The run is finished and runtime ownership can return to the original implementer.

Actually opened and inspected all five committed synthetic screenshots: phone/tablet/desktop review, phone public original with expanded frozen lineups, phone recovered finalization. Text, placements/history and distinct public-projection/private-snapshot digest labels are readable without visible clipping; no password/inbox/authentication trace appears in these committed assets.

Read the actual retained implementer reports/logs, rather than accepting claimed counts: the earlier complete API run passed 53/53; the earlier complete browser run was 46/48 with two scoring-assignment fixture failures; the first post-scheduling affected browser run was 27/35 with eight old-fixture-era failures. Their failed reports remain retained. The final implementer affected run was 43/43 API and 35/35 browser. Its HTML hash was independently recomputed as `06325295996e94bd5aa40f3e4a5472c48f9e085ae3b483ad144575dd745ecfa9`. None substitutes for the missing receipt-path regression.

Inspected the published issue 27, authoritative spec, CONTEXT/ADRs, frontend/execution contracts, actual implementation/tests/migration and installed Next page/route guides. Recursive public scalar/sporting allowlists preserve separate canonical public bytes/digest and the opaque original snapshot reference. Ordinary corrections, exact historical bytes, played participant filtering and separate scoped ranking readiness are present. No pending WCP-008 or WCP-019 source was imported. After this blocking fix, WCP-008's merger still owns the combined entry/finalizer real lock-barrier check; whichever of WCP-019/finalization integrates second owns a real required-unscheduled-game finalization regression once nullable draw assignment exists.
