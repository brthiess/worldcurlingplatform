# WCP-013 independent integration review

Reviewed and accepted on 2026-11-08 against the published issue 13, authoritative specification (including media/privacy and testing boundaries), frontend specification and execution contracts. No material acceptance gap was found. Tracker closure and remote publication remain the coordinator's responsibility.

## Frozen inputs and integration

- Integration base: `45e076820aa59ade0f90dcfaf11c47b18146d61f`.
- Reviewed source: `210dc44bd6afbe3fc53c6d0bbe63163318b59ae8` on `ticket/WCP-013`, including the final acceptance checkpoint `75b0cd4`.
- No-fast-forward merge: `a899f2e93dab08c4855e01514ede46a685d111cb` on `integration/world-curling-platform`.
- Immediately after merging, `git diff --exit-code HEAD 210dc44bd6afbe3fc53c6d0bbe63163318b59ae8` passed: the integration tree exactly matched the reviewed source. No conflict resolution or implementation change was needed.
- The subsequent review commit adds this record and removes two surplus blank lines at `package.json` EOF, resolving the sole `git diff --check` finding. All inherited suites, controls and applied migration bytes are preserved.

## Source and evidence review

Read the domain processor/policies, filesystem adapter, transaction module, every photo route, shared profile command guard, public player projection, upload/review UI, immutable schema triggers, API/domain/browser tests and candidate verification record. Consulted the installed Next.js route-handler guide, including asynchronous route parameters.

The current database session, approved ownership and global administrator grant are enforced server-side; ownership and reviewer authority are rechecked under transactional locks. Private preview/history access is scoped to the submitting account or current global administrator. Public reads serve only the player's current approved asset. Pending/rejected replacements leave that reference intact; previously replaced assets become inaccessible through the public route.

Actual Sharp decoding checks type against content, rejects malformed/truncated, small, excessive-pixel and animated input, strips metadata, rotates and re-encodes bounded PNG output. Storage uses exclusive creation and synced file writes before metadata insertion. Every preview/public read and new review checks the immutable SHA256. Review commands bind both the digest and current public asset ID. Final retries must match decision, reviewer and reason. Database triggers prevent asset metadata modification/deletion and changes to final submission history. Decision, public reference and audit share one transaction.

Inspected all six committed synthetic comparison/public screenshots at phone 360, tablet 768 and desktop 1440 widths. The phone comparison stacks images and wraps the fingerprint; larger layouts compare them side by side. Reason/decision controls are readable, and the public screenshots display the approved orange fixture with a fictional-demo label. No real portraits or private originals are retained as review artifacts.

Independently decoded the candidate's ignored `playwright-report/index.html` embedded ZIP and read its `report.json`: **24 total, 24 expected, zero unexpected/flaky/skipped, no errors**, duration 145.002 seconds. It contains the photo lifecycle plus applications (4), history (2), profiles (2), scores (5), scoring (9) and timezone (1). `.last-run.json` agrees. Browser evidence includes interrupted upload recovery, loaded-before/after comparison gating and refresh recovery, rejection feedback, retained public photo and subsequent replacement, responsive overflow/axe checks and keyboard upload focus. This review reused that complete production browser evidence rather than repeating screenshot-generating fixture mutations.

## Independent commands and checks

Run from the frozen candidate worktree using its own `wcp013` database and production app on `127.0.0.1:3113`, unless stated otherwise:

| Check | Result |
|---|---|
| `npm test` | 20/20 domain tests passed, including actual PNG/JPEG/WebP processing and invalid image/size/pixel/frame inputs. |
| `npm run typecheck` | Passed. |
| `npm start` | Restarted the retained production build on assigned port 3113; ready. |
| `npm run test:api` | 21/21 tests passed, 11 top-level workflows plus 10 scoring subtests, 131.861 seconds. Actual authentication rate limits were honored through the bounded retry helper. |
| `npm run worker:probe` | PostgreSQL-backed pg-boss job and handler output passed. |
| Fresh owned database ledger inspection | Queried `wcp013_fresh.schema_migration`; all seven names and SHA256 values match the actual checked-in migration files. Candidate records the full fresh migrate/seed/repeat path; this review independently checked the resulting ledger without resetting its fixtures. |
| Integration `npm ci` | Passed: 81 packages installed, zero reported vulnerabilities. Existing `cron-parser` v4 maintenance deprecation was reported. |
| Integration `npm run build` | Passed with `DOTENV_CONFIG_PATH` scoped to the candidate's ignored `.env`; all routes generated, including photo and inherited scoring/application routes. An initial unconfigured primary-checkout attempt compiled/typechecked but stopped at page-data collection because `DATABASE_URL` was absent. No configuration or credential file was copied. Next also reports that it ignores an unrelated parent-directory lockfile outside this Git repository. |
| Final diff integrity | `git diff --check 45e076820aa59ade0f90dcfaf11c47b18146d61f` passed after the EOF whitespace cleanup. The review commit changes only this record and those blank lines. |

The independently rerun photo HTTP lifecycle proves owner/organizer/private access denial, public pending/rejected denial, malformed image/type/oversize rejection, request-content conflict, one pending request, wrong digest denial, exact preview/public byte equality, immutable decision replay, retained old public image, later replacement, concurrent submissions/decisions, attempted metadata mutation denial and private/approved disk substitution failing closed. Its controlled PostgreSQL audit-trigger exception rolls back both decision and public reference, with normal retry succeeding. Sibling account, application and scoring transaction checks also passed together.

## Limits retained

Acceptance is local with a real controlled filesystem adapter at `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/wcp013-media`, outside the disposable candidate checkout, not hosted object-storage delivery. Hosting, provider credentials, domain/TLS and hosted email remain user-pending under WCP-045. No Render selection/provisioning, push, tracker mutation or hosted R2 claim occurred in this review.

Windows storage inherits operator ACLs; POSIX permissions are requested. Failed database commits may leave private unreachable orphan files. Automatic garbage collection, multi-host storage, backup/disaster recovery and exceptional repair are outside this slice. Corrupt/missing bytes fail closed and require operator repair. The streaming size guard was reviewed, while the retained HTTP oversize test supplies content length. Coverage is focused domain behavior, real PostgreSQL/API and Chromium acceptance; it does not establish every decoder, OS, browser or provider branch. The primary checkout must receive its own appropriate outside-checkout media-root configuration before serving uploads; the candidate's runtime configuration was not copied into it.
