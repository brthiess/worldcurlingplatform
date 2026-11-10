# WCP-034 independent integration verification

Independent verification completed on **2026-11-10 UTC**. Recommend coordinator acceptance of the bounded four-player overall draft slice, with the limitations below. The coordinator owns tracker closure; this report does not close the ticket.

Final reviewed code/test checkpoint is **`f701dcc5af5a079f22baf9c479cdcb44c8185971`**, integrated into both candidate and primary. It contains formally accepted upstream `0fa404e488861cc64a42435946b952cf8b34fd70`, the combined product merge `337ca11a9423131f4cdedd0fb99c821ec9720264`, coordinator diagnostic metadata through `02962465`, and approved fixture repair `9431190` cherry-picked as `f701dcc`. No pending WCP-014/WCP-017 product source was imported. Subsequent changes are this report and inspected synthetic PNGs only.

## Final checks and provenance

Private evidence root: `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp034-review-independent/repaired-merge-20261109/`.

| Check | Actual result and scope |
| --- | --- |
| Complete selected PostgreSQL/HTTP integration union | **107/107**, 17 complete files, zero failures/skips/cancellations, **414.601s**; `api-complete.log`. The previously failing full-universe overall case passed in 24.168s. |
| Complete selected production Chromium integration union | **85/85**, 16 complete files, zero unexpected/flaky/skipped cases and no report errors, **918.151s**; `browser-complete.log`, `browser.json`, `browser/`, `browser-results/`. Every result and exact file inventory was read from JSON; the packed HTML ZIP was separately decoded and CRC-checked. |
| Standard domain evidence retained with exact provenance | Prior independent **109/109**, zero failures/skips/cancellations, 4.470s. The repair changes one API fixture only; all domain tests and their product/fixture dependencies are byte-identical. `prior-evidence-provenance.json` retains the original evidence hash rather than relabelling it as a new run. |
| Candidate/primary production builds retained with exact provenance | Both passed 41-route generation on the unchanged product bytes. Build IDs remain candidate `7eWWqTz597sD6KCUszZ8O`, primary `tJwoMVq9SB5pRSWxQuSIz`. Original complete logs are in sibling `final-merge-20261109/`; the provenance JSON verifies both actual retained build IDs and current engine manifests. |
| Current primary standalone TypeScript | Passed after the API-test repair; `typecheck-primary-current.log`. Primary used process-only configuration and has no `.env`. No primary-sourced app or worker was started. |
| Two new owned databases | `wcp034_repaired_20261109_api` and `wcp034_repaired_20261109_browser` each passed **27 actual migration-file hashes**, migrate/seed/migrate/seed, identical row/content hashes for **all 72 public tables** after repeat, and a real worker probe. Separate `api/browser-fresh*.json` and logs retain the snapshots; no existing database was reset. |
| Post-suite database cleanup | Both schemas exactly match their pre-suite catalogs: **47 triggers, 429 constraints, 15 functions**, no fault-injection residue, **zero orphan ranking headers**, one global demo administrator grant. `catalog-*-before/after.json` and `*-catalog-after.log` retain the actual definitions. |
| Identity correction after a ready overall run | Prior independent actual mixed probe remains valid for identical product bytes: ready **102 = 27 + 75**; factual entry correction v1→2; old pending overall source rejected 409; refreshed sporting source dirty/new draft blocked; original overall manifest/result, event-award bytes and old lineup unchanged. `../final-merge-20261109/identity-overall-cross.log` and its script are retained; no new execution is implied. |
| Detached runtime and worker | Producer-only processes observed the separate long-lived worker complete exact probe output before API, after the database switch and after browser completion. Public event 200/four private anonymous 401 passed. Final proof at `2026-11-10T00:09:20.644Z` observed job `988475c1-5738-434e-aefa-b5780eb8dba6`; `browser-final-runtime-proof.log`. The final handoff reprobe is retained separately. |

All commands used explicit project-local **Node 20.19.0/npm 10.8.2**, with process-only PATH changes. Actual app, worker, API runner/test child, Playwright runner and both browser-worker groups had their executable paths inspected. Runtime configuration reads the existing private candidate configuration and overrides only owned process values; no credential file was copied. PostgreSQL13 remains the owned loopback instance on 55431; web 3134/news 3234 are isolated from other tickets.

The complete 304-file source/test/config aggregate stayed **`d10c58830fe604dd72bc5a610b7a21f65bccd77298eadf0db3e250235020e6d6`** during both suites. Relative to the earlier combined checkpoint, the only changed record is `tests/identity-corrections.api.test.ts`, SHA256 `1830771995970b6dc845b7396da7db8d0b4085feb638c74a8274a708fc7c58da`, exactly matching approved `9431190`. All other runtime, schema, domain and browser bytes match. Candidate/primary source equality, current source inventories and the original evidence hashes are retained in `prior-evidence-provenance.json` and `source-*.json`.

Actual source identities, including Node 20.19.0, match the compiled chunks: overall **`0f55fd8f491e3ff2b0b47daa17b10cd508949b775c9d85a58353cd0391e91cc1`**/16 files and event **`71662bffab65c0411ecf6c3d2c64840431a13f2f16ab21c5a0ef9ce0f732c718`**/17 files. Both inventories include the extracted canonical and finalization-command dependencies. These are hashes of actual bytes, not Git-title or version-label substitutes.

Browser HTML SHA256: `16dae3d26527d3488cf3a9727d4e92d8626fb75b97fe650256a40187033e2c97`. JSON SHA256: `eb3328bff8b9821e57a0e214836d93e9910fdb3c74aa73c5ef65011025524c4c`. `browser-reviewed-summary.json` enumerates all 85 passed results; `html-packed-reviewed-summary.json` independently confirms 85 expected/16 files. An initial report-inspector format assumption was corrected to the observed script-tag ZIP; its separate diagnostic log remains and is not a product-test failure.

## Exact selected scope

These are complete **selected integration unions**, not the entire standard commands. The standard API command retains 26 files; the browser project retains 26 files. No inherited test/coverage/API entry was removed.

The API union combines the accepted fifteen-file identity/financial/pool/scoring/history scope with ranking-inputs and overall:

```text
tests/draws-api.test.ts                 tests/entries-concurrency-api.test.ts
tests/entries.api.test.ts               tests/event-assessments.api.test.ts
tests/finalization-api.test.ts          tests/identity-corrections.api.test.ts
tests/overall-rankings.api.test.ts      tests/payments-api.test.ts
tests/pools-api.test.ts                 tests/profiles-api.test.ts
tests/ranking-inputs.api.test.ts        tests/registration-api.test.ts
tests/registration-draw-api.test.ts     tests/representation-api.test.ts
tests/scheduling-api.test.ts            tests/scoring-api.test.ts
tests/triple-draws-api.test.ts
```

The browser union adds overall to the accepted fifteen-file shared-workflow scope and includes both additional event/finalization recovery regressions:

```text
authority-recovery.spec.ts    draws.spec.ts             entries.spec.ts
event-assessments.spec.ts     finalization.spec.ts      identity-corrections.spec.ts
overall-rankings.spec.ts      payments.spec.ts          pools.spec.ts
registration-draw.spec.ts     registration.spec.ts      representation.spec.ts
scheduling.spec.ts           scores.spec.ts            scoring.spec.ts
triple-draws.spec.ts
```

`scope-inventory.json` lists every selected and omitted file. The omitted nine API and ten browser files keep their own dated ticket evidence; unrelated account/photo/news/application/history presentation is not relabelled as newly verified. The selected union covers every direct consumer of the extracted canonical/finalization helpers and all shared authority-command workbenches. It exercises public finalization privacy, current factual identity/source associations, financial receipts, ownership/readiness, scoring, pools/draws, rollback, lock barriers, frozen history and ranking calculations. Fixtures used real PostgreSQL/HTTP and sequential browser workflows, owned pool lifetimes and bounded actual 429 waits; no persistence mock or arbitrary coverage target was introduced.

Run from the candidate with the pinned executable and process-only PATH:

```text
node .runtime/repaired-review-command.mjs api api
node .runtime/repaired-review-command.mjs browser browser
```

The private command helper retains the literal file arguments and unique report destinations. Reproduction helpers are copied to the evidence directory's `restart-scripts/`; restore them to the candidate `.runtime/` location before use if needed, preserving their relative imports. Never overwrite retained reports or recreate a preserved database to obtain a pass.

## Findings corrected and history retained

- The original independent overall/event/finalization review reproduced actual 409 followed by false reconciliation. Those original rejected scripts, PNGs, traces and logs remain under `.runtime/wcp034-review-independent/`; the corrected prior independent review is `review2/REVIEW.md`. Current 85-case browser evidence covers all three changed-body/wrong-path negatives and equivalent-original recovery with **zero POSTs to any endpoint**. Journals remain retained and editing locked on mismatch. Full actor/path/context/digest and run/assessment/version associations remain required.
- The first combined 107-case run remains **106 passes/1 failure**,394.943s, in `final-merge-20261109/api-combined.log`. An inherited identity collision fixture directly inserted a ranking header without any revision/audit. All eight overall-created records were valid; the full-universe workspace instead encountered orphan `dffc52e9-a703-4843-bfeb-494bf3b149f0`. The failed database `wcp034_final_20261109_api`, exact diagnosis and all creation/update receipts remain untouched. See [the dated integration finding](WCP-034-integration-findings.md).
- A fresh implementer established the actual HTTP404 red, then replaced the malformed stub with authenticated rules and incomplete season **drafts**, without inventing points or reviewed eligibility. The exact draft, revision, audit, request and collision are asserted. Approved test/documentation-only `9431190` is recorded in [the fixture repair](WCP-034-fixture-fix.md). The new complete 107-case run passed without orphan deletion, a narrowed universe, reordered/skipped cases or an application fallback.
- The accumulated 786-registration browser run remains **35pass/1timeout** with its trace analysis. The unchanged fresh 36-case pass and the later pre-007 **105-domain/72-API/51-browser** scope remain separate, as do the user-interrupted combined API scope and initial system Node 20.15 run. None is substituted for the current combined 107/85 results. The current ordinary whole-universe review passed in 16.5s at its original 180s limit; this is bounded fixture evidence, not production-scale performance acceptance.

The merger changed no product implementation to hide a finding. The earlier accepted-source merge had only additive package-script and recovery-path conflicts; every parent suite, overall/identity/financial command kind, both admin links, all three corrected private receipt projections and public WCP-027 projection were retained. Pure canonicalization preserves prior code-unit ordering and Date behavior; finalization preserves its exact whitelist/trim/order contract; financial locale normalization remains separate.

## Visual review and limits

Actual current PNGs were opened: all three conflicting-journal states; overall desktop/tablet/phone totals and phone action-scroll/focus; retained-command reload; identity collision and stale reload; pool phone standings; financial phone ledger. Exact fractions and **102 = 27 + 75** remain readable. The financial view shows 125−15−110=0 while correctly describing external receipts. The complete scope's keyboard, axe, ordinary console/network and state assertions passed.

All 20 regenerated tracked PNG changes were hash-verified into private `generated-assets/` before their accepted bytes were restored. Only eight inspected synthetic WCP-034 PNGs were added under [merged-2026-11-10](assets/WCP-034/merged-2026-11-10/): [desktop table](assets/WCP-034/merged-2026-11-10/desktop-table.png), [tablet table](assets/WCP-034/merged-2026-11-10/tablet-table.png), [phone table](assets/WCP-034/merged-2026-11-10/phone-table.png), [phone actions](assets/WCP-034/merged-2026-11-10/phone-actions.png), retained-command reload and the three conflict states. Reports, traces, environment files, mail and runtime media remain private.

The two accepted identity-display limitations remain in [review follow-ups](../agents/review-followups.md): prior 409 text may remain after a successful reload, and a reconciled collision issue needs entry reselection before another review. The first was observed again in the current stale-reload PNG. They were not silently fixed or described as perfect UI.

Scope remains private men's/women's four-player overall drafts. Inclusive date cutoffs, carryover tie comparisons and exact arithmetic remain explicit application interpretations, not official World Curling clarification. Required unknown ownership/eligibility, exhausted ties, unclear October 31 or penalty facts block readiness. No lineage, series/mixed-doubles/publication engine, transitive reassessment, exhaustive malformed-journal or hard-termination/outage recovery, Firefox/WebKit, hosted/domain or live provider payment/email delivery is claimed. Crawler and unrelated services/databases remained untouched. The coordinator performs closure only after reviewing this integrated evidence.
