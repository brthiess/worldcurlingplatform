# WCP-018 independent merge review

Reviewed 2026-11-08 and accepted for local integration. No blocking defect remained in the published scheduling slice. Tracker closure and pushing remain coordinator work.

## Exact source and integration

- Starting integration: `ea2bae94989259d0d141dab63c9e67b656944661`.
- Reviewed candidate: `e3df211d7d2a1561b497b5827bba8ba3bf0f264f`, clean `ticket/WCP-018` in `.worktrees/WCP-018`.
- Last functional commit: `7ad1c75d44c05934e147b965b81663165e47e313`; its diff to the candidate contains only the verification document and fourteen production screenshots.
- Conflict-free `git merge --no-ff e3df211d7d2a1561b497b5827bba8ba3bf0f264f` produced `a43169e390501b49b2b8ebbab3a09db5c66652eb`.
- Candidate and merge trees both equal `2ed26f00ee6acd2d43036cba81f946735d070f05`; `git diff --exit-code e3df211d7d2a1561b497b5827bba8ba3bf0f264f HEAD` passed before adding this review. No reviewer production changes were made.
- Accepted WCP-003/005/032 and news source remain present. Only `0019_wcp018_schedule_revisions.sql` was added to the accepted migration sequence. No pending WCP-008/027 implementation was imported.

Read the published issue, canonical specification and acceptance requirements, ticket/execution/tracker contracts, CONTEXT, frontend specification, relevant accepted authority/edition/lineup/result/identity ADRs, operator/API guide and implementation evidence.

## Independent checks

Candidate commands used its existing ignored environment: owned `wcp018`, application `3118`, unique news fixture `3218`, external media storage. The stopped retained production application was restarted with `npm start`; no environment files were copied. Real authentication limits and fixture-owned PostgreSQL pools remained enabled.

| Command / scope | Observed outcome |
|---|---|
| `npm test` in candidate | 50/50 domain tests passed, including literal DST fold/gap, seconds/milliseconds offset, Kathmandu/year boundary, actual-play state, chronological instant ordering and half-open overlap expectations. |
| `npm run typecheck`; `npm run worker:probe` in candidate | Passed generated types and real PostgreSQL pg-boss job handler/output. |
| `npx tsx --test --test-concurrency=1 tests/scheduling-api.test.ts tests/scoring-api.test.ts tests/results-api.test.ts tests/authority-api.test.ts` against candidate production | 25/25 passed, zero failures/skips, 75.6s. Retained `.runtime/wcp018-verification/merger-independent-api.txt`. |
| `npx playwright test tests/browser/scheduling.spec.ts --output=../../.runtime/wcp018-verification/merger-browser/results` with `PLAYWRIGHT_HTML_OUTPUT_DIR=../../.runtime/wcp018-verification/merger-browser/report` | 5/5 production Chromium workflows passed, zero failures/skips, 1.7m. Tokyo browser timezone; phone/tablet/desktop widths; strict nominal console/page/network checks, axe/overflow, keyboard assignment/conflict, loading/empty, genuine accepted-but-lost response/exact retry, real stale409, failed503 refresh, all-field unchanged-version reload and delayed-edition read. Retained `merger-independent-browser.txt` and complete `merger-browser/` under the same ignored evidence directory. |
| New owned `wcp018_merger_fresh`, process-local `DATABASE_URL`, `npm run db:migrate`, `npm run db:seed`, repeated migration/seed, then `npx tsx .runtime/wcp018-fresh-verify.ts` | All14 migrations applied, repeated migration hash validation and both seeds passed. Read and inspected the assertion script: all14 stored SHA-256 hashes match actual migration bytes; four public games/four draws/current draw-2; five core/six registered rotating-roster members. Original application environment was unaffected. |
| Integration `npm test` after merge | 50/50 passed. |
| Integration `npm run build`; `npm run typecheck` | Initial build compiled and passed its TypeScript stage, then failed page collection because this primary checkout has no `.env`/`DATABASE_URL`; retained `merger-integration-build.txt`. Reran with process-only fresh reviewer database URL, loopback application URL, unique generated build-only auth secret and local-file email adapter: optimized compile, TypeScript, page collection and all23 prerendered pages passed; separate generated-type check also passed. No guard/configuration source was changed. Logs: `merger-integration-build-configured.txt`, `merger-integration-types-configured.txt`. |
| Exact-tree diff and `git diff --check` | Passed before this documentation-only review commit. |

Independent browser report SHA-256: `e9501c2e8e65d1a15ec6e6440a29940a30396f11de9960cdcb2bb55d05ce6f6a`.

Reviewed transactions and SQL writes: edition schedule versions and immutable receipts/audits are atomic; current organizer/global authority is rechecked before receipt replay; stale/altered/concurrent edits fail safely; cross-division identifier updates are guarded. Session/time/sheet writes preserve game score/source versions, actual entries, hammer, result/lineup versions and downstream evidence. Private management reads are server-scoped; public reads add selected duration/state/assignment sport fields without management history or receipts. No optimizer, generator or repair engine was added.

Conflicts use half-open planned intervals across this edition's divisions, normalized sheets, known entries and declared/defaulted non-coach candidates including rotating five. Unresolved coaches do not degrade playing coverage; unknown playing identities/lineups remain explicit. This never proves stone delivery. Venue conversion requires explicit IANA timezone plus matching offset, validates fold/gap/calendar boundaries and ignores browser clock. Actual game evidence controls draw state even for future live or overdue unplayed sessions. Public controls use chronological stored sessions.

## Retained evidence audit

Decoded the embedded ZIP/JSON reports independently, verified their SHA-256 values, and read the full API log totals:

- Earlier full API runs passed40/40 before WCP-005 and48/48 after it. Final post-WCP-032 affected API run passed36/36. These are distinct scopes.
- Full40-browser report:39 passed/1 failure, specifically the loading fixture's released route/unroute race. Hash `898748eaab80f9cadc6e1518f7a3c482900757b3ee1651a60b57162c9ce7e914`.
- Full49-browser report:46 passed/3 failures, specifically all three nominal scheduling flows' strict console assertions exposing the invalid native Unicode-v offset pattern. Hash `d51f994830c6aeb5d9544937df0e28e2f3371a13d5649b80ec73a7b9f28b2e92`.
- Final affected20-browser report:20 passed, zero unexpected/flaky/skipped. Hash `38ba3d26b2d665b3bd73f6e07de9caec39e5c60b5ebf44c70b1fbf5b981e39b3`. Source now escapes native-pattern hyphens; independent five-browser acceptance re-exercised the corrected failures.
- The committed initial dev report has two JSON archive entries,3 expected tests, no attachments and no configured secret values. Its only broad authentication-marker matches are literal `process.env.DEMO_PASSWORD` source references, not credentials, cookies, tokens or authorization headers. Later detailed reports remain ignored.

Actually opened all fourteen final safe screenshots in `docs/verification/assets/WCP-018/`: session form, assignment form, draw controls and public schedule at all three widths, plus phone conflict and stale/recovered fields. Long public images were also inspected through readable top crops retained ignored under `merger-image-review/`. Labels/actions fit; timezone/offset/minute precision, evidence caveats, current draw/navigation, conflict and accepted reload fields are legible. Accumulated immutable fixtures explain long public lists and draw999; they are not production data claims.

## Limits

The final candidate's implementer evidence is full50 domain/build/types/worker/fresh14, affected36 APIs and affected20 browsers; independent review adds full50 units, scoped25 APIs, five scheduling browsers, types/worker and fresh14/repeat seed/hash assertions. Neither final affected run is labelled a new complete API/browser run. Earlier full failures remain preserved. Chromium only; no Firefox/WebKit, hosted/provider delivery or hosting/domain acceptance. No dedicated mixed-doubles HTTP/browser fixture, forced cross-edition identifier collision, broader multiwriter race, other-edition conflict analysis or verified stone-delivery coverage is claimed. Current-page uncertain retries preserve exact commands; offline/cross-device synchronization remains outside scope. No crawler, hosting, tracker or remote mutation occurred.
