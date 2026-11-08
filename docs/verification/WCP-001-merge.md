# WCP-001 independent merge review

Reviewed and integrated on 2026-11-08 by a fresh merger against the published WCP-001 issue, canonical specification's applicable stories and testing decisions, frontend specification, and execution contracts. Decision: accepted for the narrow persisted-event/demo-session foundation slice. No material acceptance gap or merge conflict was found.

- Reviewed implementation: `f01f188ed33cc3ab606ab7ade638fe3256b0585a`.
- Reviewed ticket tip: `4304b15f019022dab27157e3be776b6a3fb90a82` (includes current integration ancestry).
- Prior integration tip: `7cfdbac`.
- Integration merge: `ac3405260bdd7b64deaac11464c4caf484fee2a0`, created with `git merge --no-ff ticket/WCP-001`.
- Implementation evidence: [WCP-001.md](WCP-001.md); reproduction and isolated/reset scenario: [setup.md](../setup.md).

## Acceptance assessment

| WCP-001 requirement | Evidence reviewed and conclusion |
|---|---|
| Narrow runtime, migrations, seed and harness | Inspected package scripts, both SQL migrations, migration checksum/transaction guard, repeatable transactional fictional seed, separate web/worker launchers and pg-boss probe. Schema is limited to this slice. Setup and implementation record document real PostgreSQL 13 migration/seed repetitions and a separately created fresh database. |
| Persisted public event/game and honest state | Inspected explicit PostgreSQL public projections, event/game routes, score rendering and literal fixtures. Known 3–2 live totals, unknown totals, played zero, unknown/upcoming/unplayed ends, result labels and venue clock are represented distinctly. Implementation record reports application and PostgreSQL restart checks preserving data. |
| Real scoped sessions and private data boundary | Inspected Better Auth database sessions, disabled public registration, fresh grant reads, role/resource policy, assigned workspace filtering, public projection fields and transactional administrator-only grant/audit command. Three HTTP tests use actual sign-in cookies and routes, covering four personas, forged/signed-out cookies, same/other-event and same/other-game checks, denied role grants and cross-origin denial. No persistence mocks are used. |
| Focused domain units | Five behavior tests contain explicit independent expectations for active/latest/next/empty and overlapping draws; four score-cell states; administrator, organizer, assigned scorekeeper, reviewer and ungranted policy decisions. Reviewed recorded red/green failures and narrow coverage/gap disclosure. |
| Minimal real worker | Probe starts pg-boss worker and producer against PostgreSQL, awaits the completed persisted job, and compares handler output with its independently supplied probe ID. Implementation record reports repeated successful probe runs. |
| Usable responsive frontend | Inspected component/CSS, seven browser tests, retained report and all five actual committed screenshots: phone/tablet/desktop scores, phone assigned workspace and stale scores. Score columns/totals remain aligned and readable, hierarchy and actions are clear, and the stale view retains scores with retry. Tests cover keyboard skip/focus, selection persistence, browser back, empty/upcoming/missing states, real loading/offline/retry, scorekeeper sign-in/out, axe and page errors. |

## Verification provenance and merge checks

The implementation record reports 5 passing domain tests, 3 passing real PostgreSQL/HTTP tests, successful typecheck/production build, repeated worker probes and a final full dependency audit with zero vulnerabilities. Commands, corrections and limits are preserved there. These recorded results were reviewed against their actual test/implementation sources; this merger did not rerun those suites or recreate their earlier red states.

The retained local Playwright HTML archive was independently decoded and inspected. Its `report.json` contains **7 expected passes**, **0 unexpected**, **0 flaky**, **0 skipped**, **no report errors**, and duration **12019.041 ms**. Its cases match the committed browser sources, including explicit venue-time behavior in an Asia/Tokyo browser and immediate default-draw restoration on back navigation. `test-results/.last-run.json` also reports `passed` with no failed tests. The five public fictional-data PNGs were individually opened and visually reviewed; they remain committed under `assets/WCP-001/` when the worktree is removed.

Before merging, `git diff --check integration/world-curling-platform...ticket/WCP-001` and integration-ancestor verification passed. After the conflict-free merge, `git diff --check HEAD^1 HEAD` passed and `git diff --exit-code ticket/WCP-001 HEAD` confirmed that the merged tree exactly equals the reviewed candidate. No application change or conflict resolution occurred, so no affected suite required another run. Only this review document was added afterward. The live production app on port 3100 and isolated PostgreSQL instance on port 55431 were left running with their data untouched.

## Actual limits

This accepts WCP-001 only. It does not verify a complete bracket, score editing/progression, imported history, ranking/payment/identity rules, hosted service/provider delivery, seven full offer demonstrations or exhaustive authentication, grant retry/conflict, outage or worker shutdown/retry races. Only the scorekeeper persona has a separately recorded browser sign-in; the other personas have HTTP/session enforcement evidence. Coverage percentages in the implementation record apply to the initial domain seam, not API/database/browser coverage. Earlier restart, clean-database, unit/API/build/audit results are implementer-recorded evidence; the merger independently inspected sources, screenshots, retained browser results and merge integrity without mutating the scenario or repeating passed checks.

Ticket closure, graph/execution-state updates, push and PR management remain with the coordinator. No canonical requirement or blocker edge was changed by this merge review.
