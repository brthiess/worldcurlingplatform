# WCP-019 independent merge review

Review started 2026-11-08 from clean integration `ee3e9c675a7c80527164e5d452962781229ffddf`. Candidate `ticket/WCP-019` is `18b46550d9b5c52844d1ca9bb23be7bdc65cff8e`; its tested runtime is `7f6f7af4ef360bdd57a9afa7568f4613e216a9b2`. The intervening changes are documentation only. The accepted integration base is an ancestor. No pending WCP-009 or WCP-033 implementation was imported.

Read the implement-spec workflow, AGENTS, execution/tracker/research pointers, published issue19, canonical specification and accepted product decisions, CONTEXT, authority/scorekeeper ADRs, frontend specification, installed Next route-handler guide, `docs/draws.md`, implementation evidence and actual retained reports. Reviewed the graph/domain, migration, field provider, transaction/authorization/receipt paths, scoring advancement, nullable-session adaptations, public allowlist and browser recovery code. No product change was made by this reviewer.

## Independently reproduced evidence

Owned fresh database **`wcp019_merge_review`**, PostgreSQL13 on loopback55431; isolated production app **3129**, news fixture origin3229. The ignored private configuration is `.runtime/wcp019-merge/review.env`. Complete logs, HTML/results and private traces are outside the disposable worktree at `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp019-merge/`. API and browser fixture suites ran sequentially. Actual authentication throttles stayed enabled. Primary commands use process-scoped `DOTENV_CONFIG_PATH`; no `.env` was copied into primary.

| Boundary | Actual result |
| --- | --- |
| Fresh migration/seed and repeat | All **18** checked-in migrations, seed, repeat migration and repeat seed passed. All applied SHA256 values matched the files. Six demo entries, no invented demo games. Complete public-table fingerprint before/after repeat was identical: `2669c5fa3cf11ab8d9dce055edfa7bf0519527c4af5bd2c9e9f8688137d652ed`. |
| Accepted migration preservation | Migration0022 SHA256 remains `e517ad810d549e916a63efe2f0d45ad7017a4028300fcd16098c686ce6bd6a64`; no applied migration was changed. |
| Complete domain coverage command | **60/60 passed**, zero failures/skips. Draw domain100% lines/functions,97.5% branches. Literal six/eight-entry graph, byes, identity, elimination/actual paths and assignment decisions were inspected. |
| Final-source affected API union | **43/43 passed**, zero failures/skips, **201.05s**. All seven draw cases plus all ten finalization cases and the affected entries, representation, scheduling, results and scoring files ran without filtering. |
| Final-source affected production browser union | **36/36 passed**, zero failures/skips, **5.6minutes**, local Chromium. Includes all five draw cases and complete affected finalization, entry, representation, scheduling, result and scoring browser files. Normal draw flows assert no page/console/5xx errors, keyboard navigation, axe and containment at360/768/1440px. Tokyo-browser fixed-time assertions require the explicit Regina clock. |
| Independent nullable-session SQL probe | Legacy inserts supplying only a session derive its division; unscheduling retains division. Missing division is rejected23502; cross-division session/participant writes are rejected23514. Every probe mutation was rolled back. |
| Primary production build and standalone typecheck | `npm run build` and `npm run typecheck` passed after merge. The build retained the known warning about an outside-repository parent package-lock; compilation, TypeScript and generated routes/page output completed. |
| Primary worker and applied migrations | `npm run worker:probe` completed an actual PostgreSQL-backed pg-boss job and verified handler output. `npm run db:migrate` verified the applied files and reported migrations up to date. |
| Integration consistency | Merge `7d8a441c7fb70a95874dfb171dd725795341b077` retains candidate `18b46550d9b5c52844d1ca9bb23be7bdc65cff8e`. The tracked primary/candidate trees matched after merge; `git diff --check` passed. Only this independent report and the bounded coverage inventory follow. |

Exact affected API command, in the candidate worktree:

```powershell
node node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 tests/finalization-api.test.ts tests/draws-api.test.ts tests/scheduling-api.test.ts tests/entries.api.test.ts tests/entries-concurrency-api.test.ts tests/representation-api.test.ts tests/results-api.test.ts tests/scoring-api.test.ts
```

Exact affected browser command, after the API process completed:

```powershell
node node_modules/@playwright/test/cli.js test tests/browser/draws.spec.ts tests/browser/finalization.spec.ts tests/browser/entries.spec.ts tests/browser/representation.spec.ts tests/browser/scheduling.spec.ts tests/browser/results.spec.ts tests/browser/scoring.spec.ts --output=C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp019-merge/browser-results
```

`PLAYWRIGHT_HTML_OUTPUT_DIR` directs the complete independent HTML to `.runtime/wcp019-merge/browser-report/index.html`, SHA256 **`056f566c69df4222b53fe6e135f89a2272d44f9cdb201c4e53ecc55963711a1c`**. `.last-run.json` records passed with no failed tests. All logs and results remain separate from the implementation's earlier reports. These are affected suites, not a repeated complete API/browser command.

The six-entry real lifecycle publishes five initially-unscheduled actual games, schedules only Q2 through the actual organizer command, confirms it, and receives **422** from premature finalization with five required games/four null sessions and no snapshot write. It then completes all five games, records exactly two played wins for the top-seed champion, finalizes all five with four null sessions preserved, and corrects an upstream result after downstream completion. Actual downstream participants/results and the old exact finalization contents/digest remain unchanged; attention/dirty state is set. The eight-entry persisted fixture separately verifies ordinary unstarted-slot correction.

Other actual HTTP checks include private previews; actor-bound commands; current grants and revoked scorekeeper receipt replay; exact draw request replay/conflict/stale behavior; edition-first barriers without lower locks while waiting; changed division association before both new commands and exact receipt replay; pending candidate exclusion, forged pending seeds and publication recheck without a lineup-version change; duplicate known team rejection at preview/publication while unresolved same-name entries remain valid; public allowlist; immutable graph evidence; and scheduling an initially-unscheduled published game. All inherited finalization authorization/source/receipt/audit and both real entry/finalization race orders passed.

## Retained prior evidence and review limits

Actually read the retained implementation logs under `.runtime/wcp019-reports/7f6f7af-final/`, including the initial53/55 browser pass with real overflow/locator failures, old-source finalization200-versus422, missing-validator domain red and duplicate-known-team HTTP reds, earlier complete56/56 API/browser, accepted-base41-API/36-browser union and final7-API/5-browser runs. Verified both reported HTML SHA256 values: `488c5fe21f7e3dbadfe7f0372bbad2800526a96651b9f49de4acdcae9118a75b` and `5900315df61ba03725e3e3a71f7dcc69b1e0d87a786dd2c710efbd739e8221a9`. These are distinct source/run scopes; the earlier complete suites are not claimed as final-source whole-suite passes.

The first independent SQL probe failed because its fixture omitted the existing required slot labels. The log `nullable-contract.log` is retained; the corrected fixture passed in `nullable-contract-green.log`. This was a review-harness error, not a product defect or a silently overwritten run.

Opened committed phone preview, desktop bracket and genuinely scheduled phone PNGs. Opened newly generated independent phone game, tablet advanced-list and desktop bracket PNGs. The screens visibly distinguish structural byes from played wins, possible routes from actual assignments, unresolved sources from winners, known versus unknown times, and explicit venue timezone. The inspected layouts contain their controls and readable score/history content without visible clipping. Public screenshots contain fictional sporting fixtures; private reports/auth traces remain ignored.

## Acceptance boundary

**Accepted locally for WCP-019.** No outstanding product finding remains from this independent review. The reviewed candidate is merged; the coordinator owns tracker closure and push. No tracker status was changed by this reviewer.

This accepts one documented six/eight-entry men's/women's four-player single-knockout profile. It does not complete the main sixteen-team triple-knockout demonstration or any other format family. The complete six-entry sporting lifecycle and one persisted eight-entry/unstarted-correction fixture are verified; every winner permutation, unrestricted editing, qualification tiebreak and comprehensive downstream repair are not claimed. Started/played downstream facts and frozen snapshots remain preserved with attention/dirty state.

The shared field provider currently implements accepted WCP-008's organizer-recorded versus pending-submission boundary and known-team identity. Future configured admission/capacity/format compatibility belongs to WCP-009 when accepted; no pending engine was imported, no capacity==8 rule was introduced, and unknown identities were not inferred from names. Local Chromium only; no hosted/domain/provider/crawler action, ranking publication, or complete final-source whole-suite API/browser rerun is claimed. Historical failures and their source-specific green follow-ups remain retained. The independent review production runtime remains on3129 with its owned database/configuration for coordinator inspection.
