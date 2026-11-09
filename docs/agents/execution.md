# Implementation execution

Started 2026-11-08 under the user's explicit implementation authorization.

- Workflow: `C:/Users/brthi/.codex/skills/implement-spec/SKILL.md`.
- Authoritative requirements: `.scratch/world-curling-platform/spec.md`.
- Task graph: `.scratch/world-curling-platform/tickets.json`; execute published `issues/`, never archived drafts.
- Integration branch: `integration/world-curling-platform`.
- Remote (supplied by user during implementation): `https://github.com/brthiess/worldcurlingplatform.git`. Commit and push work as it progresses; verify remote ref SHAs. The initially empty remote now has the planning baseline on `main` and the integration branch. Local published issues remain the execution tracker.
- Concurrency: at most three implementers, each a fresh-context agent on a separate branch/worktree based on the current integration tip. A separate merger verifies and integrates each completed slice.
- Closure: mark a published issue and graph entry completed only after acceptance evidence is reviewed and its commit integrated. Unverified implementations remain in progress. External-input blockers affect only dependent work.
- Evidence: `docs/verification/WCP-NNN.md`, plus machine-readable execution state. Preserve commands, outcomes, failures, limitations and browser artifact paths. Never commit credentials.
- Curling Crawler: read-only initial import source; no source changes or crawler runtime dependency.
- Hosting direction (2026-11-08): user answered “Leave hosting pending” and domain “pending.” Keep WCP-045 blocked on those external inputs, make no Render workspace selection/provisioning, and continue local/unblocked work. Do not ask routine hosting questions again.
- Disk management: after independent acceptance, reproducible `node_modules` and `.next` directories may be reclaimed from inactive ticket worktrees. Source branches, verification records/screenshots, retained reports and runtime configuration remain available. Reinstall/build before attempting another runtime check there; a historical pass does not mean a server is still running. These generated artifacts were reclaimed from WCP-001, WCP-002, WCP-004, WCP-012 and WCP-013 on 2026-11-08.
- Further generated-only reclamation on 2026-11-08 covered inactive accepted WCP-003, WCP-005, WCP-006, WCP-008, WCP-018, WCP-027, WCP-032 and WCP-044 worktrees. Resolved targets were checked inside this workspace; source, reports, configuration and immutable runtime data were retained.

## Agreed test seams

The parent specification's Testing Decisions already authorizes domain public interfaces, real PostgreSQL-backed HTTP/application workflows and browser interaction as seams. Use meaningful independent expected values and red-before-green vertical slices. The upstream TDD skill is at https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/tdd/SKILL.md (read 2026-11-08); its tests.md and mocking.md references apply. No Skill invocation tool exists in this runtime, so read and apply the skill text directly.

## Environment observations

The starting folder contained planning/tracker documents and no application or Git repository. Git was initialized after read-only review. Sandboxed Git/npm fail on parent-directory access; reviewed escalated shell commands work. Node is 20.19.0; PostgreSQL 13 binaries/service are installed; Docker's daemon was unavailable at preflight. Prefer a dedicated project-local PostgreSQL cluster/database rather than modifying unrelated databases. No hosted domain, provider credentials or reviewed hosting quote has been supplied.

- Generated-only reclamation on2026-11-09 UTC covered inactive accepted WCP-009 and WCP-019 (`node_modules` and `.next`). All four resolved targets were checked inside the workspace, reparse points rejected, and old runtime listener ports confirmed inactive. Source, configuration, immutable data and verification reports remain. Reinstall/build before rerunning there.

- Generated-only reclamation on2026-11-09 UTC also covered inactive accepted WCP-020 and WCP-033 (`node_modules` and `.next`). All four absolute targets were checked inside this workspace with no reparse points, their web ports were inactive, and their owned PostgreSQL databases had no active connections. Source, configuration, immutable data and verification reports remain; reinstall/build before rerunning. The private `generated-cleanup-20261109.txt` records the operation.
