# Approved ticket breakdown (review archive)

**Status:** approved by the user and published on 2026-11-07. Use the [published tickets](tickets.md) for execution; the draft links below preserve the reviewed breakdown.

Parent: [WCP-SPEC-001](spec.md). Source SHA-256: `045B46988225B6C8C0020B23C8C5D4EAA8E2E1916256148A0FDA26B5DA8673FD`.

The parent is unchanged. This proposal uses its latest accepted scope: the 16-team four-player triple-knockout main demo, men's/women's four-player and mixed doubles, five regular rotating members as core versus a designated alternate, staff-granted team-season authority, complete calculated-publication evidence, and the four P-05 analytics views. It preserves the six exceptional-scenario deferrals and their minimum safeguards.

## How the slices work

- 47 approved tickets, one published issue per file with its reviewed draft retained. Numbers are in dependency order; they are not a requirement to execute every ticket serially.
- Each implementation slice owns a narrow working path through data, authorized commands/APIs, usable UI, and tests. The first includes only the bootstrap needed for a persisted page and scoped demo sign-in; there is no separate build-all-schema or build-all-frontend phase.
- Every slice carries concrete unit, real-database/API, and frontend criteria. Verification tickets rerun the existing suites and record the workflows; they do not postpone feature testing or polish until the end.
- Direct blockers are genuine prerequisites, with redundant transitive edges removed. After 01, the scoring, application, profile, news and hosting branches can proceed independently as their inputs permit.
- The designated crawler remains the read-only historical source. Import tickets translate a consistent export; they do not operate or modify the crawler.
- Published issues are ready-for-agent; retained drafts are review archives. The parent spec remains an input, not an implementation job.

## Numbered breakdown

1. **[01: Open a persisted event and sign in with scoped demo roles](ticket-drafts/01-open-a-persisted-event-and-sign-in-with-scoped-demo-roles.md)** — **Blocked by:** none. **Delivers:** Run the application locally, read one seeded event and game from PostgreSQL, and sign in as scoped administrator, organizer, scorekeeper, or read-only reviewer.

2. **[02: Save live end scores from a mobile scorekeeper screen](ticket-drafts/02-save-live-end-scores-from-a-mobile-scorekeeper-screen.md)** — **Blocked by:** 01. **Delivers:** An assigned scorekeeper starts a four-player game, saves or corrects an end, and sees the accepted change on the live homepage and game view.

3. **[03: Confirm results and make ordinary auditable corrections](ticket-drafts/03-confirm-results-and-make-ordinary-auditable-corrections.md)** — **Blocked by:** 02. **Delivers:** The assigned scorekeeper confirms a result, records a lineup difference or ordinary correction without admin approval, and fans see the correct final state and history.

4. **[04: Submit and approve next year's event onto the calendar](ticket-drafts/04-submit-and-approve-next-year-s-event-onto-the-calendar.md)** — **Blocked by:** 01. **Delivers:** An organizer submits a dated edition with divisions; a World Curling administrator reviews it and lists the approved event publicly.

5. **[05: Delegate event approval and assign scoped event staff](ticket-drafts/05-delegate-event-approval-and-assign-scoped-event-staff.md)** — **Blocked by:** 04. **Delivers:** World Curling grants scoped approval or event duties, and the correct reviewer or scorekeeper sees only the work assigned to them.

6. **[06: Manually enter teams and resolve core-composition identities](ticket-drafts/06-manually-enter-teams-and-resolve-core-composition-identities.md)** — **Blocked by:** 04. **Delivers:** An organizer selects a team or assembles existing/new players into an entry; known core membership creates or reuses the right team and appears publicly.

7. **[07: Correct mistaken player selections and flag identity collisions](ticket-drafts/07-correct-mistaken-player-selections-and-flag-identity-collisions.md)** — **Blocked by:** 06. **Delivers:** World Curling staff fix an ordinary player/entry identity mistake, while collisions remain visible issues instead of partial merges.

8. **[08: Grant team-season representatives self-entry authority](ticket-drafts/08-grant-team-season-representatives-self-entry-authority.md)** — **Blocked by:** 06. **Delivers:** World Curling grants a representative team-season authority and that person can submit or amend an entry for that team while organizers retain manual entry.

9. **[09: Open division entries with capacity and expiring holds](ticket-drafts/09-open-division-entries-with-capacity-and-expiring-holds.md)** — **Blocked by:** 08. **Delivers:** An organizer opens a configured division in open, reviewed or invitation-only mode, and entrants receive the correct acceptance/reservation state.

10. **[10: Record entry charges, waivers and external payments](ticket-drafts/10-record-entry-charges-waivers-and-external-payments.md)** — **Blocked by:** 09. **Delivers:** Staff and entrants see an accurate amount due with explicit discounts, waivers or externally received payments, independent of online provider processing.

11. **[11: Withdraw entries and invite replacements from the waitlist](ticket-drafts/11-withdraw-entries-and-invite-replacements-from-the-waitlist.md)** — **Blocked by:** 10. **Delivers:** Authorized staff or representatives withdraw an entry, release its place appropriately and explicitly invite a waitlisted replacement.

12. **[12: Create accounts, approve player claims and edit profiles](ticket-drafts/12-create-accounts-approve-player-claims-and-edit-profiles.md)** — **Blocked by:** 01. **Delivers:** A visitor registers, requests control of an existing player, receives World Curling approval and edits biography/handedness through the working site.

13. **[13: Review private photo submissions and publish approved images](ticket-drafts/13-review-private-photo-submissions-and-publish-approved-images.md)** — **Blocked by:** 12. **Delivers:** A linked player uploads a replacement, sees review status, and an administrator publishes only the exact reviewed image.

14. **[14: Stage a representative read-only Curling Crawler import](ticket-drafts/14-stage-a-representative-read-only-curling-crawler-import.md)** — **Blocked by:** 03, 07. **Delivers:** An administrator runs and inspects a staged import from a consistent export of the confirmed Curling Crawler project without changing its archive.

15. **[15: Approve historical batches and rerun imports safely](ticket-drafts/15-approve-historical-batches-and-rerun-imports-safely.md)** — **Blocked by:** 14. **Delivers:** An administrator approves a reviewed batch and its historical events/results become publicly browseable with truthful origin and completeness.

16. **[16: Browse historical imported ranking editions](ticket-drafts/16-browse-historical-imported-ranking-editions.md)** — **Blocked by:** 15. **Delivers:** Readers and administrators select dated historical ranking observations without pretending they were recalculated by this platform.

17. **[17: Connect event, game, team and player discovery with favorites](ticket-drafts/17-connect-event-game-team-and-player-discovery-with-favorites.md)** — **Blocked by:** 03, 06, 12. **Delivers:** Fans search the event archive and move between actual event/game/team/player pages while preserving useful context and browser favorites.

18. **[18: Schedule draw sessions and show known conflicts](ticket-drafts/18-schedule-draw-sessions-and-show-known-conflicts.md)** — **Blocked by:** 03, 06. **Delivers:** An organizer assigns existing games to draw sessions/sheets, sees known clashes, and fans can browse the resulting schedule and draws.

19. **[19: Preview and run a single-knockout draw through public views](ticket-drafts/19-preview-and-run-a-single-knockout-draw-through-public-views.md)** — **Blocked by:** 18. **Delivers:** An organizer configures one documented single-knockout template, previews/publishes its persisted draw and sees confirmed results resolve future slots.

20. **[20: Run the main 16-team triple-knockout demonstration](ticket-drafts/20-run-the-main-16-team-triple-knockout-demonstration.md)** — **Blocked by:** 19. **Delivers:** The main four-player demo operates a real 16-team triple-knockout draw with visible A/B/C routes, explicit qualifiers and next-game assignments.

21. **[21: Run one documented double-knockout configuration](ticket-drafts/21-run-one-documented-double-knockout-configuration.md)** — **Blocked by:** 19. **Delivers:** An organizer selects and publishes one bounded double-knockout profile and fans follow its stored advancement paths.

22. **[22: Run pooled round robin with basic public standings](ticket-drafts/22-run-pooled-round-robin-with-basic-public-standings.md)** — **Blocked by:** 19. **Delivers:** An organizer publishes one documented round-robin/pool configuration and fans see its games and basic standings.

23. **[23: Run a documented Page-playoff draw](ticket-drafts/23-run-a-documented-page-playoff-draw.md)** — **Blocked by:** 19. **Delivers:** An organizer supplies the manual seeds for one documented Page-playoff profile and its stored routes produce the expected final.

24. **[24: Generate and score bounded Swiss/Schenkel pairings](ticket-drafts/24-generate-and-score-bounded-swiss-schenkel-pairings.md)** — **Blocked by:** 19. **Delivers:** An organizer runs one documented Swiss/Schenkel configuration, reviews each pairing round and scores the published games.

25. **[25: Select qualifiers and run a pooled-to-Page stage combination](ticket-drafts/25-select-qualifiers-and-run-a-pooled-to-page-stage-combination.md)** — **Blocked by:** 22, 23. **Delivers:** An organizer manually resolves qualifiers/seeds from the supported pools into Page playoffs and makes ordinary auditable bracket edits.

26. **[26: Score mixed doubles and record required measurements](ticket-drafts/26-score-mixed-doubles-and-record-required-measurements.md)** — **Blocked by:** 03, 06. **Delivers:** A mixed-doubles division can be entered and scored through the same working UI with its applicable scoring, participation and measurement profile.

27. **[27: Finalize division results and preserve revised snapshots](ticket-drafts/27-finalize-division-results-and-preserve-revised-snapshots.md)** — **Blocked by:** 03, 06. **Delivers:** An organizer finalizes a completed division, later accepts an ordinary correction and finalizes its revision without losing the original snapshot.

28. **[28: Collect an entry fee with sandbox Checkout and verified events](ticket-drafts/28-collect-an-entry-fee-with-sandbox-checkout-and-verified-events.md)** — **Blocked by:** 10. **Delivers:** An authorized entrant pays a held entry through central sandbox Checkout and the application confirms the correct charge/place from verified provider state.

29. **[29: Issue and track full or partial sandbox refunds](ticket-drafts/29-issue-and-track-full-or-partial-sandbox-refunds.md)** — **Blocked by:** 28. **Delivers:** Authorized staff request a full or partial sandbox refund and entrants/staff see its truthful transaction status and remaining balance.

30. **[30: Provision a scoped scoring feed and switch active sources](ticket-drafts/30-provision-a-scoped-scoring-feed-and-switch-active-sources.md)** — **Blocked by:** 03. **Delivers:** World Curling provisions a feed that scores/confirms/corrects its designated game, and authorized staff switch between that feed and manual scoring.

31. **[31: Submit event, entry and finalization commands through partner APIs](ticket-drafts/31-submit-event-entry-and-finalization-commands-through-partner-apis.md)** — **Blocked by:** 27, 30. **Delivers:** An explicitly authorized partner can submit permitted event/entry data and finalize assigned divisions through the same domain behavior used by the UI.

32. **[32: Review official rosters, WCTRS sources and starting entitlements](ticket-drafts/32-review-official-rosters-wctrs-sources-and-starting-entitlements.md)** — **Blocked by:** 06. **Delivers:** World Curling staff inspect and maintain versioned seasonal registration, allocation and sourced starting-input records with visible ranking-readiness issues.

33. **[33: Calculate four-player event assessments and point awards](ticket-drafts/33-calculate-four-player-event-assessments-and-point-awards.md)** — **Blocked by:** 27, 32. **Delivers:** An administrator calculates and reviews a four-player event's field strength and awards from a frozen result snapshot and sourced historical inputs.

34. **[34: Calculate four-player overall WCTRS draft lists](ticket-drafts/34-calculate-four-player-overall-wctrs-draft-lists.md)** — **Blocked by:** 33. **Delivers:** World Curling reviews complete men's/women's overall draft rankings with counted/excluded awards, ownership and dated carryover explanations.

35. **[35: Calculate Champion, Elite and Challenger series drafts](ticket-drafts/35-calculate-champion-elite-and-challenger-series-drafts.md)** — **Blocked by:** 34. **Delivers:** Administrators select and inspect the applicable men's/women's 2026-27 series drafts separately from overall rankings.

36. **[36: Calculate mixed-doubles field strength and event awards](ticket-drafts/36-calculate-mixed-doubles-field-strength-and-event-awards.md)** — **Blocked by:** 26, 34. **Delivers:** Administrators assess a mixed-doubles event using its pair/player and required four-player ranking inputs and inspect its award breakdown.

37. **[37: Calculate mixed-doubles pair and individual draft lists](ticket-drafts/37-calculate-mixed-doubles-pair-and-individual-draft-lists.md)** — **Blocked by:** 36. **Delivers:** World Curling reviews the supported mixed-doubles pair, female-player and male-player draft rankings with independent contributions and history.

38. **[38: Approve and publish complete dated WCTRS lists](ticket-drafts/38-approve-and-publish-complete-dated-wctrs-lists.md)** — **Blocked by:** 34. **Delivers:** A World Curling administrator compares and approves a complete dated list, and public rankings expose that exact approved publication.

39. **[39: Audit ranking history and approve a direct replacement](ticket-drafts/39-audit-ranking-history-and-approve-a-direct-replacement.md)** — **Blocked by:** 38. **Delivers:** An ordinary result correction leads to revised finalization, a directly affected draft and an approved replacement, while administrators can audit both publications.

40. **[40: Show team win-loss records and title counts](ticket-drafts/40-show-team-win-loss-records-and-title-counts.md)** — **Blocked by:** 17, 27. **Delivers:** Fans inspect the first minimum analytics view: supported team win/loss records and titles with explicit sample and result coverage.

41. **[41: Chart approved rank and points history with contributions](ticket-drafts/41-chart-approved-rank-and-points-history-with-contributions.md)** — **Blocked by:** 16, 17, 38. **Delivers:** Fans compare approved ranking/points history and inspect contributing events across calculated publications and honestly labelled imported history.

42. **[42: Show blank and steal rates from known end data](ticket-drafts/42-show-blank-and-steal-rates-from-known-end-data.md)** — **Blocked by:** 17. **Delivers:** Fans use the minimum scoring-pattern view to inspect blank and steal rates computed from suitable observed ends.

43. **[43: Show observed win rates by end, margin and hammer](ticket-drafts/43-show-observed-win-rates-by-end-margin-and-hammer.md)** — **Blocked by:** 17. **Delivers:** Fans inspect the minimum situational analytics view using actual comparable game states and known final outcomes.

44. **[44: Aggregate approved curling news into working source links](ticket-drafts/44-aggregate-approved-curling-news-into-working-source-links.md)** — **Blocked by:** 01. **Delivers:** Staff configure approved external feeds and fans browse concise news cards that open the original publisher.

45. **[45: Host the working review environment on the supplied domain](ticket-drafts/45-host-the-working-review-environment-on-the-supplied-domain.md)** — **Blocked by:** 01. **Delivers:** The implemented application runs as web/worker/PostgreSQL services with a reviewer-accessible HTTPS domain and configured provider adapters.

46. **[46: Verify and record the fan, approval, scoring and entry demos](ticket-drafts/46-verify-and-record-the-fan-approval-scoring-and-entry-demos.md)** — **Blocked by:** 05, 11, 17, 20, 25, 29, 45. **Delivers:** Record reproducible hosted D-01 through D-04 using the 16-team main event, real persisted interactions and scoped personas.

47. **[47: Verify remaining demos and assemble the reviewed offer](ticket-drafts/47-verify-remaining-demos-and-assemble-the-reviewed-offer.md)** — **Blocked by:** 13, 21, 24, 31, 35, 37, 39, 40, 41, 42, 43, 44, 46. **Delivers:** Record D-05 through D-07 and the partner companion, rerun the agreed supporting capability checks and deliver a coherent hosted offer package.

## Unit-test and frontend carry-through

Each draft names its own meaningful unit cases and observable integration evidence. Ranking cases need independent expected values; tests of private implementation structure or trivial tests for a percentage do not qualify. PostgreSQL concurrency/atomicity and actual route/session checks remain integration work. Coverage reports must identify untested core branches.

Each UI slice includes responsive, keyboard/readability/state behavior and actual API data. The shared standard is scores-first, original and concise: no filler, fake live data, decorative statistics or dead controls. Final recording tickets require cross-flow phone/tablet/desktop inspection, but they do not replace the same checks on earlier slices.

## Main verification joins

- D-01 through D-04 are recorded in 46 after the main 16-team competition, organizer/entry/payment behavior, discovery, approval and hosted environment are complete.
- D-05 through D-07 and the sequential partner companion are recorded in 47. It also verifies the other accepted format profiles and four metric views and assembles coverage/setup/operator evidence.
- Ranking producer branches converge on the generic approved-publication contract. A later list does not block initial implementation of the overall publication flow.
- Public-domain/provider credentials are explicit external inputs to 45. They do not block local development or unrelated feature branches.

See [full traceability](ticket-traceability.md) and the [machine-readable graph](ticket-proposal.json).

## Approved breakdown review

The user approved the granularity and dependencies on 2026-11-07. The original review prompts were:

1. Does this granularity fit one fresh implementation context per slice, or should any ticket be split/merged?
2. Are the listed blockers genuine prerequisites, with any missing or unnecessary edges?
3. Are there any requested changes before these drafts become local ready-for-agent issues?

The invoked [to-tickets skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/to-tickets/SKILL.md) requires approval of the breakdown before publishing. The 47 approved issues are now published in the configured local issues directory as ready-for-agent; the parent was not modified or closed.

