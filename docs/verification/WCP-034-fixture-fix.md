# WCP-034 ranking-subject fixture repair

2026-11-09 UTC. Isolated repair on `fix/WCP-034-ranking-fixture`, based on exact pending candidate `337ca11a9423131f4cdedd0fb99c821ec9720264`. This base was specifically authorized for the integration fixture repair. No primary integration merge, WCP-017/WCP-014 product source, tracker changes, acceptance changes or ticket closure is included.

## Defect and correction

The identity API collision fixture directly inserted a version-1 season `ranking_record` without a revision or audit. The full-universe overall reader subsequently encountered an unreadable subject. The supported ranking-input writer already commits header, revision and audit atomically; no application/schema fallback or migration was needed.

The fixture now creates a rules **draft** and an incomplete season **draft** through the authenticated `/api/v1/ranking-inputs` command, pinned to the target registration/roster version. It records no point contributions, source-backed eligibility, allocations or reviewed approval. Assertions require HTTP-readable identical draft content, one immutable history revision, incomplete saved/current readiness and null starting input, plus a real revision linked to the administrator/request/digest and `ranking_season_draft` audit. The collision must identify that exact ranking record and leave its draft unchanged. All original person/team/entry/ranking-subject collision, no-partial-change, replay, authority, history and lock-barrier assertions remain.

## Retained red and green evidence

Private artifacts and reproducible process-only wrapper: project `.runtime/wcp034-fixturefix/`. No reports, runtime configuration, media, credentials or mail are committed. The original failed database `wcp034_final_20261109_api` was never connected to or modified by this repair; its independent evidence remains under `.runtime/wcp034-review-independent/final-merge-20261109/`.

- `red-source.diff`, `red-source-hash.json`, `red-test.log`: added the staff GET assertion while retaining the original SQL stub. Actual regression: **404 != 200**, “Collision ranking subject must be readable through the staff API”. This intentional targeted run had 1 failure and 9 name-filtered cases; it is not a full-file result.
- `wcp034_fixturefix_20261109_red` remains intact. `red-data-proof.json` records orphan `eb8b6658-6176-4089-bde8-3faac8758695`, registration `581bafac-67ba-405a-9eca-67754fdaeb27`, version 1, **zero revisions and zero audits**. No orphan was deleted.
- `wcp034_fixturefix_20261109_green` was created separately. Both databases ran migrate/seed/migrate/seed and matched all **27 actual migration-file SHA-256 values** (`red/green-fresh.log`, `red/green-migrations.json`). No new migration was introduced.
- `green-api.log`: complete three-file API run passed **15/15**, zero failures/skips/cancellations, 20.371s. After a receipt-assertion cleanup, `green-final-api.log` passed the same complete scope **15/15**, zero failures/skips/cancellations, 26.052s: all 10 identity-correction cases, all 4 ranking-input cases and the overall case. API fixtures ran sequentially with per-file PostgreSQL pool lifetimes and inherited bounded real-429 handling. Source was frozen during each suite.
- The overall case successfully reads the **full current subject universe**, calculates immutable contributions, retries and replays, without filtering away the collision subject. `green-data-proof.json` records **zero orphan headers**, two retained valid incomplete collision drafts from the two runs, and 18 event/overall manifests. Both persisted engines report `node: v20.19.0`, match the actual source fingerprints and occur in final compiled chunks. See `green-data-proof-final.log`.
- `domain.log`: standard inherited domain suite **109/109**, zero failures/skips/cancellations, 3.005s. `types-final.log`: standalone `tsc --noEmit` passed. `build-final.log`: production build passed, including 41-route generation. The earlier build/typecheck logs remain retained.
- `green-runtime-proof.log` and `green-handoff-reprobe.log`: public event HTTP200/private overall HTTP401 and a completed runtime-probe job submitted by a **producer only**, proving the separate long-lived worker consumed it. This is not a claim that `worker:probe` leaves a consumer running.

Pinned runtime for web, worker and tests: `C:/Users/brthi/Projects/world-curling-platform-2/.runtime/toolchains/node-v20.19.0-win-x64/node.exe` (Node20.19.0), bundled npm10.8.2 (`npm-version.log`). Process-only PATH prepending and explicit executable invocation were used. `green-owned-processes.json` records actual web/worker descendants; `actual-node-processes.jsonl` records the runner and each actual test child. `verified-source.json` records tested identity fixture SHA-256 `1830771995970b6dc845b7396da7db8d0b4085feb638c74a8274a708fc7c58da` against the stated base. Windows parent-path EPERM required reviewed escalated commands.

One private-wrapper startup failed because Windows ESM imports require a file URL. `setup-failure-test.log` and `setup-failure-web.err` retain that setup failure; it is not counted as the behavioral red. The wrapper was corrected and actual HTTP readiness established before the retained regression run.

## Commands and restart/handoff

From this worktree, prepend the pinned toolchain directory to **process-only** PATH and invoke its explicit `node.exe` on `../../.runtime/wcp034-fixturefix/run.mjs`:

```text
fresh red             # creates owned red DB only if absent; already preserved
build red
web red               # hidden detached process; wait for real public HTTP200
red red               # targeted pre-fix regression, preserved source diff required
fresh green           # creates owned green DB only if absent; already preserved
web green             # hidden detached process, port3154
worker green          # separate hidden detached long-lived worker
runtime green         # producer-only worker and HTTP boundary proof
green green           # full identity + ranking-inputs + overall API files, sequential
domain green
build green
types green
proof green           # read-only receipt/orphan/manifest/compiled-engine evidence
```

The wrapper reads existing `.worktrees/WCP-034/.env` directly into its process, overrides only the owned database/3154 web/3254 news/media values and never copies that file. Media is outside the disposable worktree under `.runtime/wcp034-fixturefix/`; these scopes create no account mail. Runtime/report paths remain outside the worktree. Start detached helpers using `Start-Process -WindowStyle Hidden`; retain new log names rather than overwriting these reports. Never recreate/reset preserved databases to reproduce a pass. Create another uniquely owned `wcp034_fixturefix` database if a fresh replay is required and update the private wrapper deliberately.

Only owned runtime descendants were stopped after the successful handoff reprobe. `shutdown.json` records their exact executables and confirms port3154 has no listener. Other active apps/ports, PostgreSQL5432/service and crawler were untouched. Re-probe/restart from this exact source/config before any later runtime use; historical success is not continued liveness.

This is focused fixture verification only. A distinct merger still owns the complete failed **107-case API union** and planned **85-browser** combined scope, independent review, integration and acceptance. No browser completion, WCP-034 acceptance or closure is claimed here. Hosting/domain remain pending.
