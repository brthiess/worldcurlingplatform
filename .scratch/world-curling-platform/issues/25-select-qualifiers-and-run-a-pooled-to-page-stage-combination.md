---
id: WCP-025
number: 25
title: "Select qualifiers and run a pooled-to-Page stage combination"
parent: WCP-SPEC-001
type: implementation
status: ready-for-agent
labels: [ready-for-agent]
blocked_by: [WCP-022, WCP-023]
source_spec_sha256: 045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD
created: 2026-11-07
published: 2026-11-07
---

# 25: Select qualifiers and run a pooled-to-Page stage combination

**What to build:** An organizer manually resolves qualifiers/seeds from the supported pools into Page playoffs and makes ordinary auditable bracket edits.

**Blocked by:** [22: Run pooled round robin with basic public standings](22-run-pooled-round-robin-with-basic-public-standings.md); [23: Run a documented Page-playoff draw](23-run-a-documented-page-playoff-draw.md).

**Status:** ready-for-agent

## Parent and scope

[WCP-SPEC-001](../spec.md) is authoritative, including the later accepted P-01 through P-05 and exceptional-scenario safeguards. Earlier broader examples do not enlarge this ticket.

- Stories: US-008, US-009, US-010, US-039, US-041, US-042, US-094, US-095; substantial unit-testing requirement US-095 applies.
- Acceptance checks: T-01, T-04, T-06, T-09, T-12, T-14.
- Demo coverage: D-01, D-04, D-07.
- Specific product decisions: P-01.

## Acceptance criteria

- [ ] Document one supported stage combination and explicitly record qualifier/seed decisions; tied qualification does not require automated policy.
- [ ] Allow authorized organizer slot/path corrections without an administrator dispute case; retain draw and participant/result history.
- [ ] If a correction affects already-started downstream games, preserve played records and flag the assignments for attention; defer comprehensive continuation/repair automation.
- [ ] **Unit testing:** Test compatible stage/qualifier mapping, allowed ordinary edits, invalid slot/entry rejection and started-game safeguard classification.
- [ ] **Database/API verification:** Run pool results -> manual qualification -> playoffs and an ordinary correction through guarded commands, verifying preserved evidence and current public graph.
- [ ] **Frontend quality:** Make qualifier/seed selection and organizer edits clear, show updated fan brackets consistently, and expose affected-assignment warnings without a false automatic-repair claim.
- [ ] Record actual verification commands/results and relevant browser/screenshots or API evidence. Report meaningful uncovered branches or limitations; do not claim checks that were not run.

## Slice boundary

Deliver the narrow behavior through persistence, authorized API/domain commands, usable UI, and its tests together. Add only the supporting schema/runtime needed by this behavior; do not turn it into a layer-wide schema/API/UI task.

Keep excluded disciplines/metrics, lineage, live payments, backups/recovery, automatic qualification tiebreaks, and comprehensive exceptional-scenario recovery out of scope. Retain the parent spec's basic security, atomicity, immutable-history and ranking-correctness safeguards.

