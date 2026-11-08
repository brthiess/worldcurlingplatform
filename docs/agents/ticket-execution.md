# Ticket implementer contract

The coordinator supplies one published ticket ID, worktree, branch, database and port. Use a fresh context and modify only that worktree. Read `AGENTS.md`, `docs/agents/execution.md`, `docs/agents/issue-tracker.md`, the assigned issue under `.scratch/world-curling-platform/issues/`, the authoritative `spec.md`, relevant ADRs/CONTEXT and frontend specification. Never use archived drafts as execution sources. Consult `docs/agents/research-index.md` when relevant.

## Work

1. Confirm `git symbolic-ref --short HEAD` is the assigned branch and merge the current local `integration/world-curling-platform` before starting. Do not reset away user work. The coordinator starts a ticket only when its direct blockers are reviewed/integrated/completed.
2. Apply the upstream TDD skill (pointer in `execution.md`) directly; this runtime has no Skill invocation tool. Its approved seams are already agreed in the parent spec: domain public interfaces, real PostgreSQL/HTTP and browser workflows. Use one failing behavior test then minimal implementation, repeated in vertical slices. Explicit independent expected values; no persistence mocks or arbitrary coverage threshold.
3. Implement only the assigned end-to-end slice. Browser and partner adapters share authorized domain commands. Preserve transaction/audit, version/idempotency, privacy and immutable-history safeguards. Do not solve the deferred exceptional recovery engines or add excluded features.
4. Use the assigned isolated database/PORT. Never run mutating tests against another active ticket's database or the crawler. Read source crawler snapshots only as documented. Add migrations with unique descriptive filenames; never edit already-applied migration contents. Merge sibling migrations carefully.
5. All visible controls must work with persistent data. Verify mobile/tablet/desktop, keyboard focus, honest loading/empty/error/stale states and browser console/network behavior. Inspect actual screenshots. Read installed Next.js guides required by AGENTS.md before writing framework code.
6. Commit self-consistent checkpoints clearly labelled when verification is incomplete; tell the coordinator their SHA for pushing. Do not commit `.env`, runtime data, provider credentials, node_modules or private review assets. The user authorized ongoing pushes to the configured remote.
7. Record actual commands/results/failures/fixes and coverage gaps in `docs/verification/WCP-NNN.md`, with durable screenshot paths. Run applicable inherited suites plus substantive new tests, real PostgreSQL/API checks, typecheck/build and browser acceptance. No test/build pass substitutes for another required layer. Keep provider checks honest; a missing credential may block that check while unaffected local work proceeds.
8. Before reporting done, merge the latest integration tip into the ticket branch, resolve conflicts and rerun affected checks. Commit final work and report SHA, verification pointer, actual checks and limitations. Leave tracker status/closure to the coordinator/merger.

## Environment

Git/npm/Node entry scripts can fail in the Windows sandbox while resolving `C:/Users/brthi`. Reviewed `exec_command` calls with `sandbox_permissions: require_escalated` have worked. Git is 2.20 in that environment (`symbolic-ref --short HEAD`, not `branch --show-current`). Avoid destructive cross-shell operations. Use native PowerShell literal paths and verify workspace containment before recursive deletion/moving.

PostgreSQL 13 binaries are installed under `C:/Program Files/PostgreSQL/13/bin`. WCP-001 established an isolated local instance on loopback port 55431, with data under the project's ignored `.runtime/wcp001`. Inspect its setup record before using it; create a separate database per ticket. Docker's daemon was unavailable at preflight. Do not alter the existing unrelated Windows PostgreSQL service/databases. Hosted credentials/domain inputs are separate from local acceptance.

The coordinator reviews/merges and pushes completed work, closes only verified tickets and continues the unblocked graph with at most three implementers. Report genuine blockers without inventing successful checks.
