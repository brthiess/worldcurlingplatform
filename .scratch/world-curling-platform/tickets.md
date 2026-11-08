# Published implementation tickets

**Status:** 47 local tickets published as `ready-for-agent` on 2026-11-07 following explicit user approval.

Parent: [WCP-SPEC-001](spec.md). [Machine-readable graph](tickets.json). [Story/check traceability](ticket-traceability.md).

## Execution rules

- Start with ticket 01. It is the only initially unblocked ticket.
- Every ticket is labelled ready-for-agent; its blockers still have to be completed before work starts. Work any unblocked frontier rather than treating the numbers as a mandatory serial queue.
- Keep the parent specification out of implementation polling. It remains unchanged and is not a single work order.
- Unit-testing, real PostgreSQL/API, frontend-quality, and verification-evidence requirements remain in every issue. Testing and polish are part of each slice, not a deferred final phase.
- Published issues under `issues/` are the execution source. The proposal and drafts are retained only as the approved review archive.
- Publication does not mark any task complete or claim any application tests have passed.

## Tickets

1. **[01: Open a persisted event and sign in with scoped demo roles](issues/01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md)** — **Blocked by:** None — can start immediately. **Delivers:** Run the application locally, read one seeded event and game from PostgreSQL, and sign in as scoped administrator, organizer, scorekeeper, or read-only reviewer.

2. **[02: Save live end scores from a mobile scorekeeper screen](issues/02-save-live-end-scores-from-a-mobile-scorekeeper-screen.md)** — **Blocked by:** [01](issues/01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md). **Delivers:** An assigned scorekeeper starts a four-player game, saves or corrects an end, and sees the accepted change on the live homepage and game view.

3. **[03: Confirm results and make ordinary auditable corrections](issues/03-confirm-results-and-make-ordinary-auditable-corrections.md)** — **Blocked by:** [02](issues/02-save-live-end-scores-from-a-mobile-scorekeeper-screen.md). **Delivers:** The assigned scorekeeper confirms a result, records a lineup difference or ordinary correction without admin approval, and fans see the correct final state and history.

4. **[04: Submit and approve next year's event onto the calendar](issues/04-submit-and-approve-next-year-s-event-onto-the-calendar.md)** — **Blocked by:** [01](issues/01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md). **Delivers:** An organizer submits a dated edition with divisions; a World Curling administrator reviews it and lists the approved event publicly.

5. **[05: Delegate event approval and assign scoped event staff](issues/05-delegate-event-approval-and-assign-scoped-event-staff.md)** — **Blocked by:** [04](issues/04-submit-and-approve-next-year-s-event-onto-the-calendar.md). **Delivers:** World Curling grants scoped approval or event duties, and the correct reviewer or scorekeeper sees only the work assigned to them.

6. **[06: Manually enter teams and resolve core-composition identities](issues/06-manually-enter-teams-and-resolve-core-composition-identities.md)** — **Blocked by:** [04](issues/04-submit-and-approve-next-year-s-event-onto-the-calendar.md). **Delivers:** An organizer selects a team or assembles existing/new players into an entry; known core membership creates or reuses the right team and appears publicly.

7. **[07: Correct mistaken player selections and flag identity collisions](issues/07-correct-mistaken-player-selections-and-flag-identity-collisions.md)** — **Blocked by:** [06](issues/06-manually-enter-teams-and-resolve-core-composition-identities.md). **Delivers:** World Curling staff fix an ordinary player/entry identity mistake, while collisions remain visible issues instead of partial merges.

8. **[08: Grant team-season representatives self-entry authority](issues/08-grant-team-season-representatives-self-entry-authority.md)** — **Blocked by:** [06](issues/06-manually-enter-teams-and-resolve-core-composition-identities.md). **Delivers:** World Curling grants a representative team-season authority and that person can submit or amend an entry for that team while organizers retain manual entry.

9. **[09: Open division entries with capacity and expiring holds](issues/09-open-division-entries-with-capacity-and-expiring-holds.md)** — **Blocked by:** [08](issues/08-grant-team-season-representatives-self-entry-authority.md). **Delivers:** An organizer opens a configured division in open, reviewed or invitation-only mode, and entrants receive the correct acceptance/reservation state.

10. **[10: Record entry charges, waivers and external payments](issues/10-record-entry-charges-waivers-and-external-payments.md)** — **Blocked by:** [09](issues/09-open-division-entries-with-capacity-and-expiring-holds.md). **Delivers:** Staff and entrants see an accurate amount due with explicit discounts, waivers or externally received payments, independent of online provider processing.

11. **[11: Withdraw entries and invite replacements from the waitlist](issues/11-withdraw-entries-and-invite-replacements-from-the-waitlist.md)** — **Blocked by:** [10](issues/10-record-entry-charges-waivers-and-external-payments.md). **Delivers:** Authorized staff or representatives withdraw an entry, release its place appropriately and explicitly invite a waitlisted replacement.

12. **[12: Create accounts, approve player claims and edit profiles](issues/12-create-accounts-approve-player-claims-and-edit-profiles.md)** — **Blocked by:** [01](issues/01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md). **Delivers:** A visitor registers, requests control of an existing player, receives World Curling approval and edits biography/handedness through the working site.

13. **[13: Review private photo submissions and publish approved images](issues/13-review-private-photo-submissions-and-publish-approved-images.md)** — **Blocked by:** [12](issues/12-create-accounts-approve-player-claims-and-edit-profiles.md). **Delivers:** A linked player uploads a replacement, sees review status, and an administrator publishes only the exact reviewed image.

14. **[14: Stage a representative read-only Curling Crawler import](issues/14-stage-a-representative-read-only-curling-crawler-import.md)** — **Blocked by:** [03](issues/03-confirm-results-and-make-ordinary-auditable-corrections.md), [07](issues/07-correct-mistaken-player-selections-and-flag-identity-collisions.md). **Delivers:** An administrator runs and inspects a staged import from a consistent export of the confirmed Curling Crawler project without changing its archive.

15. **[15: Approve historical batches and rerun imports safely](issues/15-approve-historical-batches-and-rerun-imports-safely.md)** — **Blocked by:** [14](issues/14-stage-a-representative-read-only-curling-crawler-import.md). **Delivers:** An administrator approves a reviewed batch and its historical events/results become publicly browseable with truthful origin and completeness.

16. **[16: Browse historical imported ranking editions](issues/16-browse-historical-imported-ranking-editions.md)** — **Blocked by:** [15](issues/15-approve-historical-batches-and-rerun-imports-safely.md). **Delivers:** Readers and administrators select dated historical ranking observations without pretending they were recalculated by this platform.

17. **[17: Connect event, game, team and player discovery with favorites](issues/17-connect-event-game-team-and-player-discovery-with-favorites.md)** — **Blocked by:** [03](issues/03-confirm-results-and-make-ordinary-auditable-corrections.md), [06](issues/06-manually-enter-teams-and-resolve-core-composition-identities.md), [12](issues/12-create-accounts-approve-player-claims-and-edit-profiles.md). **Delivers:** Fans search the event archive and move between actual event/game/team/player pages while preserving useful context and browser favorites.

18. **[18: Schedule draw sessions and show known conflicts](issues/18-schedule-draw-sessions-and-show-known-conflicts.md)** — **Blocked by:** [03](issues/03-confirm-results-and-make-ordinary-auditable-corrections.md), [06](issues/06-manually-enter-teams-and-resolve-core-composition-identities.md). **Delivers:** An organizer assigns existing games to draw sessions/sheets, sees known clashes, and fans can browse the resulting schedule and draws.

19. **[19: Preview and run a single-knockout draw through public views](issues/19-preview-and-run-a-single-knockout-draw-through-public-views.md)** — **Blocked by:** [18](issues/18-schedule-draw-sessions-and-show-known-conflicts.md). **Delivers:** An organizer configures one documented single-knockout template, previews/publishes its persisted draw and sees confirmed results resolve future slots.

20. **[20: Run the main 16-team triple-knockout demonstration](issues/20-run-the-main-16-team-triple-knockout-demonstration.md)** — **Blocked by:** [19](issues/19-preview-and-run-a-single-knockout-draw-through-public-views.md). **Delivers:** The main four-player demo operates a real 16-team triple-knockout draw with visible A/B/C routes, explicit qualifiers and next-game assignments.

21. **[21: Run one documented double-knockout configuration](issues/21-run-one-documented-double-knockout-configuration.md)** — **Blocked by:** [19](issues/19-preview-and-run-a-single-knockout-draw-through-public-views.md). **Delivers:** An organizer selects and publishes one bounded double-knockout profile and fans follow its stored advancement paths.

22. **[22: Run pooled round robin with basic public standings](issues/22-run-pooled-round-robin-with-basic-public-standings.md)** — **Blocked by:** [19](issues/19-preview-and-run-a-single-knockout-draw-through-public-views.md). **Delivers:** An organizer publishes one documented round-robin/pool configuration and fans see its games and basic standings.

23. **[23: Run a documented Page-playoff draw](issues/23-run-a-documented-page-playoff-draw.md)** — **Blocked by:** [19](issues/19-preview-and-run-a-single-knockout-draw-through-public-views.md). **Delivers:** An organizer supplies the manual seeds for one documented Page-playoff profile and its stored routes produce the expected final.

24. **[24: Generate and score bounded Swiss/Schenkel pairings](issues/24-generate-and-score-bounded-swiss-schenkel-pairings.md)** — **Blocked by:** [19](issues/19-preview-and-run-a-single-knockout-draw-through-public-views.md). **Delivers:** An organizer runs one documented Swiss/Schenkel configuration, reviews each pairing round and scores the published games.

25. **[25: Select qualifiers and run a pooled-to-Page stage combination](issues/25-select-qualifiers-and-run-a-pooled-to-page-stage-combination.md)** — **Blocked by:** [22](issues/22-run-pooled-round-robin-with-basic-public-standings.md), [23](issues/23-run-a-documented-page-playoff-draw.md). **Delivers:** An organizer manually resolves qualifiers/seeds from the supported pools into Page playoffs and makes ordinary auditable bracket edits.

26. **[26: Score mixed doubles and record required measurements](issues/26-score-mixed-doubles-and-record-required-measurements.md)** — **Blocked by:** [03](issues/03-confirm-results-and-make-ordinary-auditable-corrections.md), [06](issues/06-manually-enter-teams-and-resolve-core-composition-identities.md). **Delivers:** A mixed-doubles division can be entered and scored through the same working UI with its applicable scoring, participation and measurement profile.

27. **[27: Finalize division results and preserve revised snapshots](issues/27-finalize-division-results-and-preserve-revised-snapshots.md)** — **Blocked by:** [03](issues/03-confirm-results-and-make-ordinary-auditable-corrections.md), [06](issues/06-manually-enter-teams-and-resolve-core-composition-identities.md). **Delivers:** An organizer finalizes a completed division, later accepts an ordinary correction and finalizes its revision without losing the original snapshot.

28. **[28: Collect an entry fee with sandbox Checkout and verified events](issues/28-collect-an-entry-fee-with-sandbox-checkout-and-verified-events.md)** — **Blocked by:** [10](issues/10-record-entry-charges-waivers-and-external-payments.md). **Delivers:** An authorized entrant pays a held entry through central sandbox Checkout and the application confirms the correct charge/place from verified provider state.

29. **[29: Issue and track full or partial sandbox refunds](issues/29-issue-and-track-full-or-partial-sandbox-refunds.md)** — **Blocked by:** [28](issues/28-collect-an-entry-fee-with-sandbox-checkout-and-verified-events.md). **Delivers:** Authorized staff request a full or partial sandbox refund and entrants/staff see its truthful transaction status and remaining balance.

30. **[30: Provision a scoped scoring feed and switch active sources](issues/30-provision-a-scoped-scoring-feed-and-switch-active-sources.md)** — **Blocked by:** [03](issues/03-confirm-results-and-make-ordinary-auditable-corrections.md). **Delivers:** World Curling provisions a feed that scores/confirms/corrects its designated game, and authorized staff switch between that feed and manual scoring.

31. **[31: Submit event, entry and finalization commands through partner APIs](issues/31-submit-event-entry-and-finalization-commands-through-partner-apis.md)** — **Blocked by:** [27](issues/27-finalize-division-results-and-preserve-revised-snapshots.md), [30](issues/30-provision-a-scoped-scoring-feed-and-switch-active-sources.md). **Delivers:** An explicitly authorized partner can submit permitted event/entry data and finalize assigned divisions through the same domain behavior used by the UI.

32. **[32: Review official rosters, WCTRS sources and starting entitlements](issues/32-review-official-rosters-wctrs-sources-and-starting-entitlements.md)** — **Blocked by:** [06](issues/06-manually-enter-teams-and-resolve-core-composition-identities.md). **Delivers:** World Curling staff inspect and maintain versioned seasonal registration, allocation and sourced starting-input records with visible ranking-readiness issues.

33. **[33: Calculate four-player event assessments and point awards](issues/33-calculate-four-player-event-assessments-and-point-awards.md)** — **Blocked by:** [27](issues/27-finalize-division-results-and-preserve-revised-snapshots.md), [32](issues/32-review-official-rosters-wctrs-sources-and-starting-entitlements.md). **Delivers:** An administrator calculates and reviews a four-player event's field strength and awards from a frozen result snapshot and sourced historical inputs.

34. **[34: Calculate four-player overall WCTRS draft lists](issues/34-calculate-four-player-overall-wctrs-draft-lists.md)** — **Blocked by:** [33](issues/33-calculate-four-player-event-assessments-and-point-awards.md). **Delivers:** World Curling reviews complete men's/women's overall draft rankings with counted/excluded awards, ownership and dated carryover explanations.

35. **[35: Calculate Champion, Elite and Challenger series drafts](issues/35-calculate-champion-elite-and-challenger-series-drafts.md)** — **Blocked by:** [34](issues/34-calculate-four-player-overall-wctrs-draft-lists.md). **Delivers:** Administrators select and inspect the applicable men's/women's 2026-27 series drafts separately from overall rankings.

36. **[36: Calculate mixed-doubles field strength and event awards](issues/36-calculate-mixed-doubles-field-strength-and-event-awards.md)** — **Blocked by:** [26](issues/26-score-mixed-doubles-and-record-required-measurements.md), [34](issues/34-calculate-four-player-overall-wctrs-draft-lists.md). **Delivers:** Administrators assess a mixed-doubles event using its pair/player and required four-player ranking inputs and inspect its award breakdown.

37. **[37: Calculate mixed-doubles pair and individual draft lists](issues/37-calculate-mixed-doubles-pair-and-individual-draft-lists.md)** — **Blocked by:** [36](issues/36-calculate-mixed-doubles-field-strength-and-event-awards.md). **Delivers:** World Curling reviews the supported mixed-doubles pair, female-player and male-player draft rankings with independent contributions and history.

38. **[38: Approve and publish complete dated WCTRS lists](issues/38-approve-and-publish-complete-dated-wctrs-lists.md)** — **Blocked by:** [34](issues/34-calculate-four-player-overall-wctrs-draft-lists.md). **Delivers:** A World Curling administrator compares and approves a complete dated list, and public rankings expose that exact approved publication.

39. **[39: Audit ranking history and approve a direct replacement](issues/39-audit-ranking-history-and-approve-a-direct-replacement.md)** — **Blocked by:** [38](issues/38-approve-and-publish-complete-dated-wctrs-lists.md). **Delivers:** An ordinary result correction leads to revised finalization, a directly affected draft and an approved replacement, while administrators can audit both publications.

40. **[40: Show team win-loss records and title counts](issues/40-show-team-win-loss-records-and-title-counts.md)** — **Blocked by:** [17](issues/17-connect-event-game-team-and-player-discovery-with-favorites.md), [27](issues/27-finalize-division-results-and-preserve-revised-snapshots.md). **Delivers:** Fans inspect the first minimum analytics view: supported team win/loss records and titles with explicit sample and result coverage.

41. **[41: Chart approved rank and points history with contributions](issues/41-chart-approved-rank-and-points-history-with-contributions.md)** — **Blocked by:** [16](issues/16-browse-historical-imported-ranking-editions.md), [17](issues/17-connect-event-game-team-and-player-discovery-with-favorites.md), [38](issues/38-approve-and-publish-complete-dated-wctrs-lists.md). **Delivers:** Fans compare approved ranking/points history and inspect contributing events across calculated publications and honestly labelled imported history.

42. **[42: Show blank and steal rates from known end data](issues/42-show-blank-and-steal-rates-from-known-end-data.md)** — **Blocked by:** [17](issues/17-connect-event-game-team-and-player-discovery-with-favorites.md). **Delivers:** Fans use the minimum scoring-pattern view to inspect blank and steal rates computed from suitable observed ends.

43. **[43: Show observed win rates by end, margin and hammer](issues/43-show-observed-win-rates-by-end-margin-and-hammer.md)** — **Blocked by:** [17](issues/17-connect-event-game-team-and-player-discovery-with-favorites.md). **Delivers:** Fans inspect the minimum situational analytics view using actual comparable game states and known final outcomes.

44. **[44: Aggregate approved curling news into working source links](issues/44-aggregate-approved-curling-news-into-working-source-links.md)** — **Blocked by:** [01](issues/01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md). **Delivers:** Staff configure approved external feeds and fans browse concise news cards that open the original publisher.

45. **[45: Host the working review environment on the supplied domain](issues/45-host-the-working-review-environment-on-the-supplied-domain.md)** — **Blocked by:** [01](issues/01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md). **Delivers:** The implemented application runs as web/worker/PostgreSQL services with a reviewer-accessible HTTPS domain and configured provider adapters.

46. **[46: Verify and record the fan, approval, scoring and entry demos](issues/46-verify-and-record-the-fan-approval-scoring-and-entry-demos.md)** — **Blocked by:** [05](issues/05-delegate-event-approval-and-assign-scoped-event-staff.md), [11](issues/11-withdraw-entries-and-invite-replacements-from-the-waitlist.md), [17](issues/17-connect-event-game-team-and-player-discovery-with-favorites.md), [20](issues/20-run-the-main-16-team-triple-knockout-demonstration.md), [25](issues/25-select-qualifiers-and-run-a-pooled-to-page-stage-combination.md), [29](issues/29-issue-and-track-full-or-partial-sandbox-refunds.md), [45](issues/45-host-the-working-review-environment-on-the-supplied-domain.md). **Delivers:** Record reproducible hosted D-01 through D-04 using the 16-team main event, real persisted interactions and scoped personas.

47. **[47: Verify remaining demos and assemble the reviewed offer](issues/47-verify-remaining-demos-and-assemble-the-reviewed-offer.md)** — **Blocked by:** [13](issues/13-review-private-photo-submissions-and-publish-approved-images.md), [21](issues/21-run-one-documented-double-knockout-configuration.md), [24](issues/24-generate-and-score-bounded-swiss-schenkel-pairings.md), [31](issues/31-submit-event-entry-and-finalization-commands-through-partner-apis.md), [35](issues/35-calculate-champion-elite-and-challenger-series-drafts.md), [37](issues/37-calculate-mixed-doubles-pair-and-individual-draft-lists.md), [39](issues/39-audit-ranking-history-and-approve-a-direct-replacement.md), [40](issues/40-show-team-win-loss-records-and-title-counts.md), [41](issues/41-chart-approved-rank-and-points-history-with-contributions.md), [42](issues/42-show-blank-and-steal-rates-from-known-end-data.md), [43](issues/43-show-observed-win-rates-by-end-margin-and-hammer.md), [44](issues/44-aggregate-approved-curling-news-into-working-source-links.md), [46](issues/46-verify-and-record-the-fan-approval-scoring-and-entry-demos.md). **Delivers:** Record D-05 through D-07 and the partner companion, rerun the agreed supporting capability checks and deliver a coherent hosted offer package.

## Approval and verification

[Approval record](ticket-publication.md) records the user's publication instruction. [Publication validation](ticket-publication-validation.md) verifies labels, dependencies, preserved acceptance criteria, local links, and the unchanged parent digest.
