# Local issue tracker

Use local Markdown issues for the specification and ticket workflow. The user has not named an external issue destination; no remote issues are created.

- Feature directory: `.scratch/world-curling-platform/`.
- Canonical parent specification: `spec.md`, issue ID `WCP-SPEC-001`.
- Root `SPEC.md` is a navigation pointer; keep one canonical specification body.
- Issue metadata includes ID, title, type, labels, and date. The parent spec uses `type: spec` and `labels: [ready-for-agent]`, as required by the invoked to-spec skill.
- `ready-for-agent` means the specification can feed ticket decomposition. A parent specification is not an instruction to implement the entire platform in one agent run. Future implementation automation must select implementation tickets and exclude `type: spec` parents.
- The user approved the 47-ticket breakdown and explicitly authorized publication on 2026-11-07. Active execution sources are `tickets.md`, `tickets.json`, `ticket-traceability.md`, and one issue per file under `issues/<NN>-<slug>.md`.
- All 47 published tickets use `status: ready-for-agent` and `labels: [ready-for-agent]`. Their blocker edges still gate execution; only WCP-001 is initially unblocked. No ticket is complete merely because it is published.
- Preserve the approved ticket IDs and direct blockers; work any ticket whose blockers are completed, not only the next numerical file. The proposal and `ticket-drafts/` files are review archives, not the implementation polling source.
- Do not modify or close the parent specification when publishing tickets. Each implementation ticket carries feature-specific unit, real-database/API, and frontend acceptance criteria from the parent.

## Implementation execution (authorized 2026-11-08)

The user subsequently authorized implementing all 47 published tickets with `/implement-spec`. Earlier statements restricting a planning/documentation update do not limit this later implementation authorization.

Run `python scripts/tickets.py status` to inspect the current dependency frontier. `validate` checks all 47 published issue IDs/statuses, retained acceptance sections and the acyclic blocker graph. The coordinator uses `start WCP-NNN`, `block WCP-NNN --reason ...`, and `complete WCP-NNN --commit <integrated-sha> --evidence docs/verification/WCP-NNN.md`. Completion requires manual review of actual evidence first; the command verifies the commit is integrated and records the evidence pointer. Preserve blocker edges and acceptance criteria. `in-progress` and `blocked` are execution states; `completed` closes an implementation issue. Do not close the parent spec.

Use `docs/agents/execution.md` and `.scratch/world-curling-platform/execution-state.json` to resume. A ticket with implementation but missing required verification remains open. External prerequisites block only affected tickets; continue the rest of the frontier.

The upstream skill normally receives tracker configuration from `/setup-matt-pocock-skills`. This local configuration records the supported local tracker option for this workspace without installing additional skills or publishing externally. A future tracker migration should preserve the issue ID and canonical decision record rather than create competing specification copies.
