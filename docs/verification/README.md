# Verification evidence

Each implemented ticket gets `WCP-NNN.md` recording its requirements, commit, exact commands and results, independent expected values, meaningful uncovered branches, PostgreSQL/API checks and frontend/browser evidence. Include failed checks and their resolution. Screenshots/recordings may remain under ignored `test-results/` with durable local paths; do not commit private provider credentials or session tokens.

Status vocabulary:

- Planned: specified but no implementation evidence.
- Implemented: behavior exists but some required acceptance check is pending.
- Verified: all checks required by that ticket were actually run and reviewed, with evidence.
- Blocked: a concrete external prerequisite prevents the next action; record exactly which check it affects.

No current ticket is verified merely because a branch exists, the unit suite passes, or the production build succeeds. Hosting, configured provider sandbox behavior and the seven workflow recordings have separate acceptance gates.
