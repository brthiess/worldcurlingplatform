# Schema review notes from the design interview

The original `world-curling-platform-schema-v0.3.md` remains an input proposal. These are consequential differences established in the interview, not executable migration instructions. Continue reconciling the schema after domain decisions settle.

## Team identity must change

Q44/Q47 and ADR 0006 replace the proposal's enduring `core.teams` identity across permanent core-player changes. Its core invariant that a team is stable while roster versions change must be revised: permanent core changes create a new team identity, while alternate/coach changes and temporary event/game substitutions do not. Reuse the same identity for an identical core-player set and discipline, across seasons or after a break. Season registration/eligibility records remain separate and may include alternates whose changes do not alter identity. Do not simply retain the old stable-team model under a renamed table, or use every registered roster member as an identity fingerprint.

Q49/Q52 allow automatic team creation/reuse from entries with known core membership and immediate public/scoring use, followed by World Curling administrative correction. Incomplete entries can remain provisional. Q50 explicitly defers lineage entirely; remove lineage features from the initial-offer implementation plan even though the original proposal contains continuity/lineage tables. Ranking entitlement and carryover still need traceable rule inputs without depending on a lineage feature.

## Explicit initial-offer scope differences

- WCTRS calculations only; Member Association calculations are excluded by Q43.
- Secure backups/restoration are excluded from the initial offer by Q11.
- Playoff-qualification tiebreak automation is excluded by Q38; organizers handle qualification choices.
- Assigned scorekeepers can confirm and correct results without an administrator approval gate (Q33/Q35). Audit/history remains required.
- Organizers can modify affected brackets as needed (Q36); do not require an administrator dispute-resolution case.
- Game lineups default to event lineups and scorekeepers record differences (Q37); no mandatory unchanged-lineup confirmation.
- Q41 preserves finalized snapshots while allowing corrections and revised organizer finalization. Approved ranking publications change only through a new World Curling approval.
- Payments require reservation/expiry, waitlist, discounts/waivers, external-payment distinction, and explicit full/partial test refunds (Q20/Q27/Q28); the proposal's simple payment rows need review against those behaviors.
- Event approval and amendment behavior are simpler than a generalized amendment-governance engine; see Q18's working default.
- Automatic event-derived creation/reuse and World Curling after-the-fact maintenance replace a team-manager-driven official-registration workflow (Q45/Q49/Q52).
- Player-controlled biography/handedness and administrator-approved account/profile claims need explicit support (Q53/Q54); profile photos retain the pending/private approval workflow.
- Partner clients may confirm/correct games when explicitly scoped, with separately granted organizer actions (Q57/Q58). API actors, scopes, credential rotation/revocation, and human/feed source selection need explicit design beyond generic source/audit rows.
