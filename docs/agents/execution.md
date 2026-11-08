# Implementation execution

Started 2026-11-08 under the user's explicit implementation authorization.

- Workflow: `C:/Users/brthi/.codex/skills/implement-spec/SKILL.md`.
- Authoritative requirements: `.scratch/world-curling-platform/spec.md`.
- Task graph: `.scratch/world-curling-platform/tickets.json`; execute published `issues/`, never archived drafts.
- Integration branch: `integration/world-curling-platform`.
- Concurrency: at most three implementers, each a fresh-context agent on a separate branch/worktree based on the current integration tip. A separate merger verifies and integrates each completed slice.
- Closure: mark a published issue and graph entry completed only after acceptance evidence is reviewed and its commit integrated. Unverified implementations remain in progress. External-input blockers affect only dependent work.
- Evidence: `docs/verification/WCP-NNN.md`, plus machine-readable execution state. Preserve commands, outcomes, failures, limitations and browser artifact paths. Never commit credentials.
- Curling Crawler: read-only initial import source; no source changes or crawler runtime dependency.

## Agreed test seams

The parent specification's Testing Decisions already authorizes domain public interfaces, real PostgreSQL-backed HTTP/application workflows and browser interaction as seams. Use meaningful independent expected values and red-before-green vertical slices. The upstream TDD skill is at https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/tdd/SKILL.md (read 2026-11-08); its tests.md and mocking.md references apply. No Skill invocation tool exists in this runtime, so read and apply the skill text directly.

## Environment observations

The starting folder contained planning/tracker documents and no application or Git repository. Git was initialized after read-only review. Sandboxed Git/npm fail on parent-directory access; reviewed escalated shell commands work. Node is 20.19.0; PostgreSQL 13 binaries/service are installed; Docker's daemon was unavailable at preflight. Prefer a dedicated project-local PostgreSQL cluster/database rather than modifying unrelated databases. No hosted domain, provider credentials, repository remote or reviewed hosting quote has been supplied.
