# WCP-004 independent merge review

Reviewed on 2026-11-08. Phase 1 was read-only while another merger owned the primary workspace. The coordinator then explicitly released the primary workspace and authorized the navigation correction and sequential WCP-004 merge. No tracker closure, push, Render action, or unreviewed scoring merge was performed.

## Source and integration integrity

- Original reviewed candidate: `d16d2e12fd503ff963d5770cee2158c3202b4192` on `ticket/WCP-004`, clean at review start.
- Integration base: `59962b56664cbb05d0260677374e599da1fea620`, including the verified WCP-012 account/profile slice and worktree metadata.
- Final production-verified candidate: `fe6812af70e6cbe94f9fc4574b9764a450be0640` (`fix(WCP-004): retain division context in upcoming draw links`). This adds only the focused public navigation correction and browser regression to the original candidate.
- Sequential no-fast-forward merge: `8453b097b8d5bdeb6943e319285aa9a5cc0e78d5`. Its parents are the integration base and final candidate above. The merge had no conflicts.
- `git diff --exit-code HEAD ticket/WCP-004` passed immediately after merge. Both trees were `aa5ec668e2e9ac4b6433558891015b8bc2cffaf8`; the integration source is exactly the production-tested candidate. This review document is the only subsequent change.
- Account/profile modules and their account API, profile API/domain/browser suites have no changes relative to the integration base. Package scripts preserve all inherited and application suites; API files remain serial. Public navigation retains Events, Players, account and workspace links. No WCP-002 scoring implementation was included.

## Independent review

Read the execution/ticket/tracker contracts, published issue 4, authoritative specification and frontend requirements, CONTEXT and relevant ADRs. Inspected the application domain, migration, transaction commands, session/origin adapter, calendar and event/game projections, workbench, navigation and actual test sources, plus `WCP-004.md` and `event-applications.md`.

No blocking findings in the narrow slice. Essential organization/name/date/location/division validation permits an unconfirmed venue. New edition/division identifiers preserve the earlier edition. The named responsible administrator alone can approve/reject with current authority; delegated/reassigned approval remains WCP-005. Admission, registration and ranking eligibility remain separately persisted. Ordinary edits preserve approval and immutable version snapshots with attributed audit rows. Request/resource locks, digest-checked retry identifiers and reviewed versions protect duplicate/stale/concurrent commands; audit failures roll the transaction back. Public reads exclude unapproved records and private history. Multi-division editions require explicit score context, including game permalinks. Entries, registration-opening policy and ranking determination remain later work.

Visually inspected all six retained WCP-004 screenshots (360px phone, 768px tablet, 1440px desktop). They show readable application/review/history/calendar controls, explicit state labels and the combined account/player/event navigation. Decoded the original retained Playwright HTML report: 13 expected tests, no failures, flaky outcomes or skips, 95.7 seconds. The independent final run below replaced that ignored report with the 14-test result.

Read-only PostgreSQL probes against isolated `wcp004` found 33 editions at phase-1 review (20 approved, 9 draft, 4 submitted), all registration states closed; 103 application history records, 72 later-version snapshots, and zero mismatched audit actor/resource/action attributions. The immutable-history trigger was present and the deliberate test failure trigger was absent. Only the five baseline games remained, confirming the temporary application API draw/game fixtures had been cleaned up.

## Navigation correction and actual checks

The initial review found one small issue: the upcoming-draw anchor contained only `?draw=...`, so a separate-tab navigation could lose the selected division. The corrected URL includes the selected division and the click handler allows native Control/Meta/Shift/Alt behavior. Ordinary click selection continues through the existing history handler. Read the installed Next 16.4.5 linking/navigation and server/client guides before editing.

| Check | Actual result |
|---|---|
| `npm test` in isolated candidate worktree | **11 passed** during phase 1, including application and inherited profile/domain behavior. |
| `npx playwright test tests/browser/history.spec.ts -g 'upcoming draw'` against original production build | **Expected red:** link was `?draw=draw-3`, not `?division=prairie-men&draw=draw-3`. |
| `npm run build` after the correction | Passed compile, TypeScript, page generation and production routes. |
| `npm start` at `127.0.0.1:3104` | Served the rebuilt production app against isolated `wcp004`. |
| `npx playwright test tests/browser/history.spec.ts` | **2 passed** in 3.3 seconds: back restoration and following the corrected URL in a separate page. |
| `npm run test:browser` with strengthened native Control-click regression | **14 passed** in 1.5 minutes (retained report duration 91.8 seconds), no unexpected/flaky/skipped outcomes or report errors. Includes every application, account/profile, score, history and timezone browser test. |
| Final native-link behavior | Real Control-click opens a separate tab on the expected division/draw with its scheduled team; ordinary click preserves division and selects the same draw. |
| Read-only sporting check after browser tests | Five baseline games unchanged: confirmed game 1 remains 6–3; live game 2 remains 3–2; game 3 remains unknown; game 4 and unrelated game remain scheduled. Zero publication/admission mismatches. |
| `git diff --check`, source/merge comparison | Passed; exact tested candidate tree integrated. |

The combined scorekeeper browser test waited through the enabled authentication throttle (52.8 seconds); no auth bypass was introduced. Browser application/profile scenarios persist synthetic records as designed. The four WCP-012 tracked screenshots regenerated by its browser tests were restored to their accepted integration versions after the run. The production process started for this review was stopped afterward; PostgreSQL and scenario sport data were left intact.

## Limits

The original phase-1 HTTP probe found port 3104 stopped; it was not treated as a passing check. Phase 2 started the existing production app and rebuilt before acceptance. The original nine real PostgreSQL/API checks, repeated migration/seed checks and worker probe are recorded in `WCP-004.md`; they were reviewed with their substantive test source but not redundantly rerun here. Phase 2 changed only the client link and a read-only navigation regression. Build supplied the fresh TypeScript check; no separate fresh typecheck/coverage run is claimed.

The new navigation case uses the seeded division with real persisted draws; the existing application API test independently covers a two-division edition and division-specific game projection. Browser verification remains Chromium; Meta/Shift/Alt variants are permitted by the handler but only native Control-click was exercised. Original documented malformed-body, revocation timing/configuration, date/timezone and provider/hosting limitations still apply. No delegation, entry/registration, ranking engine, hosted delivery or deployment acceptance is claimed.
