# WCP-006 independent integration review

Reviewed and accepted on 2026-11-08 against published issue 06 selected through `tickets.json`, the canonical specification including P-01/P-03 and minimum safeguards, frontend specification, ADRs 0002/0004/0006 and the execution contracts. This review initially rejected an uncertain-create recovery defect, then independently verified its correction. Tracker closure and remote publication remain the coordinator's responsibility.

## Frozen inputs and integration

- First reviewed source: `421808474377cdc063fc22fe5487b8fc2b85c96e`, initially against integration `8e7a3a1`.
- Corrected source: `4f50650c849021c5d764c71fe73409a56971997e` on `ticket/WCP-006`, containing documentation-only integration tip `3402359`.
- No-fast-forward merge: `2c1ddaca84369333265dc8d9d175ed0bcbbd22c2` on `integration/world-curling-platform`.
- `git diff --exit-code HEAD 4f50650c849021c5d764c71fe73409a56971997e` passed immediately after merging: the merged tree exactly equals the independently reviewed candidate. No conflicts or implementation edits were needed.
- Between the first and corrected candidates, the only production-source change is Division's one-line disabled guard. Schema, commands, public projections, dependency manifests and accepted migration bytes are unchanged. The other changes are regression coverage, two synthetic screenshots, verification documentation and accepted integration documentation.

## Source and acceptance review

Read the identity/input domain, relational migration, transactional entry commands, shared roster read, authorization/HTTP adapters, organizer and public roster interfaces, inherited projection changes, domain/API/browser tests, candidate verification and API contract. Consulted the installed Next.js route-handler guide.

Identity uses discipline plus an unordered core-player set, guarded against duplicate player selections and unsupported disciplines. Four/five regular players and two-person mixed doubles have explicit cardinalities. Alternate/coach/name/position changes and temporary event substitutes remain outside that identity. Account-free and unresolved provisional people remain distinct records; matching names do not merge them. The actual API cases cover returning seasons, five cores versus an alternate, permanent changes, different disciplines, first-creation races and incomplete event lineups with a known core.

Commands recheck current global administrator or edition-organizer authority under transaction locks. Profile ownership, unrelated organizers, anonymous users and assigned scorekeepers do not gain manual-entry authority. Existing official season-roster amendments require global staff authority; an event-only edit cannot overwrite those records. No extra team approval gate, ranking entitlement, season-authority widening, lineage, self-entry or payment operation is introduced.

Every accepted entry version is immutable and tied to one atomic audit record and the exact season-roster version. Exact request replays are checked before version conflicts and after authorization; changed request reuse and stale competing writes return conflicts. Player/identity/roster changes roll back with an audit failure. Public entry reads enforce published/admitted events and select sport fields without actor/request IDs, digests, emails or account links. Approved-photo projection and inherited private-media boundaries remain intact.

The exported `readEventLineup(reader, entryId, version?)` remains a trusted read seam for WCP-003. It returns ordered declared/defaulted roster evidence and a recorded lineup version, with caller-owned authorization and transaction scope; it does not claim independently verified stone delivery or prebuild game overrides.

## Finding, correction and independent reproduction

The first candidate's new-entry form froze its fields and New/Edit actions after a committed POST lost its browser acknowledgement, but left Division enabled (`disabled={busy || editing}`). Changing Division called `changed()`, discarded the uncertain command and re-enabled editing. A second create then returned `409 Entry already exists`, disabled Save and offered no reload because the browser still considered this a new entry. The original persisted entry remained version 1. This was reproduced against the real production application; acceptance and merge were withheld.

The corrected guard is `disabled={busy || editing || !!retry}`. The new regression forwards an actual create to PostgreSQL, verifies 201/version 1, aborts only the browser response, checks all editing controls, attempts another authorized division, retries the same command and checks one original entry/version. The existing update-loss regression now also checks the full editing-control set. No server/schema change was required.

For independent correction verification, restarted the corrected retained production build on `127.0.0.1:3106` using owned `wcp006_final` and ran a separate Playwright script, rather than merely trusting the added test. Actual result: **106 editing controls disabled**, Division disabled, attempted selection of another authorized division timed out, original Prairie selection retained and Retry remained available. Retry sent byte-identical command bodies, recovered the original entry ID at version 1/Prairie, returned 404 for version 2 and left exactly one uniquely named workspace entry. Entry-name editing resumed after acknowledgement. Both the original failing reproduction and corrected independent script remain ignored under the candidate's `.runtime/`; no sessions or credentials are committed.

## Evidence and commands

All commands used reviewed Windows Git/npm execution. Database mutations were confined to owned `wcp006_final` or the newly created review database `wcp006_merge_review` on the project's loopback PostgreSQL instance at port 55431. No unrelated ticket database, crawler or hosted service was changed.

| Independent check | Actual result |
|---|---|
| Initial candidate `npm run test:coverage` | 24 tests passed, zero skipped/cancelled/todo. Entries domain: 95.78% lines, 74.63% branches, 100% functions. Overall reported 96.84% lines / 94.28% branches, including tests. |
| Initial candidate `npm run typecheck` | Passed. |
| Initial candidate `npm run worker:probe` | Real PostgreSQL pg-boss job completed and expected handler output verified. |
| Initial candidate `npm run db:migrate` on `wcp006_final` | Up to date; checked applied migration hashes. |
| Fresh review setup | Created empty owned `wcp006_merge_review`; full migrate and seed passed, followed by migrate and seed again. Ledger listed all eight checked-in migrations in sorted order, with `0012`, `0013` then new `0014`. Original accepted migration files are unmodified. |
| Initial candidate complete production `npm run test:api` | **28/28 passed**, 132.633 seconds, including all seven entry workflows and inherited account/application/profile/photo/scoring suites. Real authentication throttle headers were honored through existing bounded helpers. |
| Corrected independent production retry reproduction | Passed with the exact identity/version/no-duplicate observations above. |
| Merged integration `npm test` | **24/24 passed**, no failures/skipped/cancelled/todo. |
| Merged integration `npm run typecheck` | Passed. |
| Merged integration `npm run build` | Production compile, TypeScript and all 18 static pages passed; inherited and new entry/team routes emitted. Next.js reported its existing ignored parent-directory lockfile warning outside this Git repository. |
| Merged tree and whitespace | Candidate tree equality passed; `git diff --check 3402359` passed. |

The server/schema/API code did not change in the correction, so the independent complete 28-test HTTP run and fresh setup evidence remain applicable. The implementer additionally records a corrected affected entry-API 7/7 run and corrected domain/type/build/worker checks. Those are distinguished from this reviewer's own executions. Broad HTTP suites and screenshot-generating browser fixtures were not redundantly rerun after the one-line client correction.

Independently decoded the corrected ignored `playwright-report/index.html` embedded ZIP and read `report.json`: **29 total, 29 expected, zero unexpected/flaky/skipped, no errors**, duration **159.643 seconds**. Every test has one result and no annotations. All eight files are present: applications 4, entries 5, history 2, photos 1, profiles 2, scores 5, scoring 9 and timezone 1. `.last-run.json` agrees. The prior complete report was independently decoded as 28/28 before the correction; the added create-loss test accounts for the increase.

Visually inspected all original eight safe roster/control screenshots at phone/tablet/desktop widths and both new phone frozen/recovered captures in `assets/WCP-006/`. The public views clearly separate event version 2, absent regular core membership and season version 1, label a provisional guest and preserve event/division navigation. New captures show frozen Division/New/Edit/form controls with Retry available, followed by the recovered saved original entry with editing restored. Synthetic sport records only are retained; no passwords, private mail, authentication trace or uploaded originals are committed.

## Limits retained

Acceptance is local PostgreSQL/production Next.js/Chromium evidence, not hosted acceptance. Domain/provider credentials and hosting remain pending under WCP-045. Inherited photos use the controlled local adapter; no hosted delivery claim is made. The primary checkout's build reads the candidate's ignored environment through process-scoped `DOTENV_CONFIG_PATH`; no environment, secret or runtime data was copied.

Coverage percentages do not establish SQL, browser or every malformed-input branch. Exhaustive malformed bodies/text limits, every browser engine, in-flight entry revocation, duplicate-person/factual correction tooling and advanced official roster policy remain outside this slice's demonstrated checks. Shared reads must continue to preserve lineup versions and unknown participation when later game-lineup work is integrated. No tracker closure or push occurred in this review.
