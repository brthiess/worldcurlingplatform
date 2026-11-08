---
title: World Curling Platform - Proposed Database Schema
version: 0.3.1-draft
date: 2026-11-06
status: Design proposal; not executable migrations
database: PostgreSQL
authoritative_data_owner: World Curling
deployment_assumption: Standalone platform with its own canonical PostgreSQL database and APIs
scope: Event and team registration, all common competition formats, live line scores, WCTRS calculation, audit, snapshots, historical imports
---

# World Curling Platform - Proposed Database Schema

> **How to use this document with an AI coding agent:** Treat this file as a proposed *logical data contract*, not as an already implemented schema. Preserve the domain identities, foreign-key relationships, lifecycle rules, immutability requirements, and ownership boundaries. Ask about unresolved decisions before generating production migrations. **Assume this is a completely standalone platform:** no pre-existing registration, administration, or rankings service is available.

## 1. Confirmed product decisions

1. **Canonical owner:** World Curling owns all authoritative data, and the proposed platform creates and operates its own people, team, event registration, competition, ranking, approval, and audit records.
2. **Rankings:** The platform must implement a full, versioned, reproducible WCTRS ranking calculation engine, including team and individual player point ownership.
3. **Competition formats:** Support common curling formats: round robin, groups, single/double/triple knockout, Swiss/Schenkel-style pairing, Page playoffs, qualification/crossover matches, placement games, and hybrids.
4. **Historical coverage:** Retain all available past events, teams, players, games, line scores, results, rankings, and original source/provenance. Missing historical fields remain unknown, not invented.
5. **Database:** One canonical PostgreSQL database within a modular monolith initially. The logical schemas below separate code ownership and permissions, not necessarily deployments or databases.
6. **No dependencies on existing administrative platforms:** The proposal includes self-service registration, accounts, admin review, scoring, ranking operations, and public APIs end to end. Historical imports and third-party live-score feeds are optional integrations.

### Internal domain responsibilities

| Domain | Responsible module inside this platform | Consumers |
|---|---|---|
| People, organizations, teams, rosters | Core identity and team module | Registration, scoring, ranking, public site |
| Event applications, approvals, entries | Registration and governance modules | Scoring, ranking, public site |
| Draws, games, end scores, official results | Competition module | Ranking, public site |
| WCTRS calculations and published runs | Ranking module | Public site, administration |
| Public score/bracket/ranking projections | Public platform (derived/read-only) | Fans |
| Historical import records and provenance | Optional integration/import module | All domains |

Each module writes its own authoritative tables within one PostgreSQL database. Internal relationships should use real foreign keys and ACID transactions. The platform exposes its own public and administrative APIs. Optional external services may supply data or consume events, but none is required for the normal registration, scoring, approval, or ranking workflows.

## 2. Global conventions

- Names use snake_case; logical PostgreSQL schemas are `core`, `registration`, `competition`, `ranking`, `governance`, `integration`.
- `id uuid PK` unless a table is specifically described as a composite-key join.
- Foreign keys are denoted `FK -> schema.table(id)`; nullability is explicit where important.
- Mutable entities have `created_at timestamptz`, `updated_at timestamptz`, and usually `version integer` for optimistic concurrency, even if not repeated in every table definition.
- Use `timestamptz` for instants, `date` for competition calendar dates, and IANA names such as `America/Edmonton` for venue time zones.
- Use `numeric(18,6)` or an equivalently safe decimal representation for points and intermediate ranking calculations; the **ruleset** specifies published rounding, not the database floating-point type.
- Use `text` with constrained status values (CHECK or lookup table), not open-ended status strings.
- Use `jsonb` for original imports, ruleset parameters, snapshot manifests, and optional metadata; **not** in place of core relational keys or game scores.
- Historical/published records are append-only or superseded; never silently rewritten.
- Optional external source IDs never replace internal UUIDs. `integration.entity_mappings` maps them.
- Personally sensitive information and pending player photos are restricted; do not expose them from public endpoints or indiscriminately duplicate them into audit payloads.
- Avoid hard deletes for official sport records. Use lifecycle statuses and audited corrections.

## 3. Core identities and team-season model

### Tables

```text
core.people
  id uuid PK
  given_name text
  family_name text
  display_name text NOT NULL
  profile_photo_asset_id uuid NULL FK -> governance.media_assets.id
  status text NOT NULL
  created_at timestamptz

core.users
  id uuid PK
  person_id uuid NULL UNIQUE FK -> core.people.id
  email text UNIQUE
  status text NOT NULL
  created_at timestamptz

core.auth_identities
  id uuid PK
  user_id uuid NOT NULL FK -> core.users.id
  identity_provider text NOT NULL
  provider_subject text NOT NULL
  UNIQUE(identity_provider, provider_subject)

core.organizations
  id uuid PK
  parent_organization_id uuid NULL FK -> core.organizations.id
  name text NOT NULL
  organization_type text NOT NULL  -- world_curling, member_association, organizer, club, etc.
  country_code text NULL
  status text NOT NULL

core.person_affiliations
  id uuid PK
  person_id uuid NOT NULL FK -> core.people.id
  organization_id uuid NOT NULL FK -> core.organizations.id
  affiliation_type text NOT NULL
  valid_from date NOT NULL
  valid_to date NULL

core.seasons
  id uuid PK
  name text NOT NULL UNIQUE  -- e.g. 2026-2027
  starts_on date NOT NULL
  ends_on date NOT NULL

core.teams
  id uuid PK
  stable_name text NOT NULL
  discipline text NOT NULL
  status text NOT NULL
  created_at timestamptz

core.team_seasons
  id uuid PK
  team_id uuid NOT NULL FK -> core.teams.id
  season_id uuid NOT NULL FK -> core.seasons.id
  display_name text NOT NULL
  status text NOT NULL
  UNIQUE(team_id, season_id)

core.team_roster_versions
  id uuid PK
  team_season_id uuid NOT NULL FK -> core.team_seasons.id
  revision integer NOT NULL
  valid_from timestamptz NOT NULL
  valid_to timestamptz NULL
  approval_status text NOT NULL
  approved_by_user_id uuid NULL FK -> core.users.id
  UNIQUE(team_season_id, revision)

core.team_roster_members
  id uuid PK
  roster_version_id uuid NOT NULL FK -> core.team_roster_versions.id
  person_id uuid NOT NULL FK -> core.people.id
  nominal_position text NULL  -- skip, third, second, lead; not immutable game throw order
  roster_role text NOT NULL  -- regular, alternate, coach, etc. as applicable
  UNIQUE(roster_version_id, person_id, roster_role)

core.team_continuity_decisions
  id uuid PK
  from_team_season_id uuid NOT NULL FK -> core.team_seasons.id
  to_team_season_id uuid NOT NULL FK -> core.team_seasons.id
  decision_type text NOT NULL  -- continuation, new_team, split, merge, exception
  rule_version_id uuid NULL FK -> ranking.rule_versions.id
  review_case_id uuid NULL FK -> governance.review_cases.id
  decided_at timestamptz NULL
  rationale text NOT NULL

core.point_allocation_declarations
  id uuid PK
  team_season_id uuid NOT NULL FK -> core.team_seasons.id
  roster_version_id uuid NOT NULL FK -> core.team_roster_versions.id
  declaration_version integer NOT NULL
  status text NOT NULL
  submitted_at timestamptz NULL
  approved_at timestamptz NULL
  review_case_id uuid NULL FK -> governance.review_cases.id

core.point_allocation_members
  declaration_id uuid NOT NULL FK -> core.point_allocation_declarations.id
  person_id uuid NOT NULL FK -> core.people.id
  percentage numeric(9,6) NOT NULL
  PRIMARY KEY(declaration_id, person_id)

core.role_assignments
  id uuid PK
  user_id uuid NOT NULL FK -> core.users.id
  role_code text NOT NULL  -- world_admin, event_organizer, scorekeeper, results_official, team_manager, player
  organization_id uuid NULL FK -> core.organizations.id
  event_id uuid NULL FK -> registration.events.id
  division_id uuid NULL FK -> registration.event_divisions.id
  granted_by_user_id uuid NULL FK -> core.users.id
  valid_from timestamptz NOT NULL
  revoked_at timestamptz NULL
```

### Core invariants

- A `person` exists independently of an authenticated `user`. Imported historical players do not require logins.
- A `team` is a stable identity; a `team_season` is its season-specific competitive identity. Team continuity **must be decided**, not inferred solely from a name or a percentage of matching players.
- Roster versions preserve the registered team at each relevant date. Actual players in one event are separately frozen in `registration.event_entry_players`.
- On-ice participation can differ from nominal roster positions and is recorded in `competition.game_player_participation`.
- An approved point-allocation declaration must have valid members and percentages summing to exactly 100% according to the applicable rules. Use decimal-safe transactional validation.
- Role assignments are explicitly scoped. A volunteer at Event A is not automatically authorized to edit Event B.
- Team-season lineage can be many-to-many over time to accommodate splits/merges; any ranking entitlement derived from it must be traceable to an approved decision.

## 4. Event series, approvals, registration, venues

### Tables

```text
registration.event_series
  id uuid PK
  name text NOT NULL
  organizing_organization_id uuid NULL FK -> core.organizations.id
  external_slug text NULL

registration.events
  id uuid PK
  event_series_id uuid NULL FK -> registration.event_series.id
  season_id uuid NOT NULL FK -> core.seasons.id
  organizer_organization_id uuid NOT NULL FK -> core.organizations.id
  venue_id uuid NULL FK -> registration.venues.id
  display_name text NOT NULL
  starts_on date NOT NULL
  ends_on date NOT NULL
  time_zone text NOT NULL
  lifecycle_status text NOT NULL
  approved_application_id uuid NULL FK -> registration.event_applications.id
  published_at timestamptz NULL

registration.event_divisions
  id uuid PK
  event_id uuid NOT NULL FK -> registration.events.id
  name text NOT NULL
  discipline text NOT NULL  -- four_player, mixed_doubles, wheelchair, etc.
  category text NOT NULL  -- men, women, mixed, junior, open, etc.
  maximum_entries integer NULL
  regulation_ends integer NOT NULL
  ranking_eligible boolean NOT NULL
  lifecycle_status text NOT NULL
  format_template_version_id uuid NULL FK -> competition.format_template_versions.id

registration.venues
  id uuid PK
  name text NOT NULL
  city text NULL
  region text NULL
  country_code text NULL
  time_zone text NOT NULL
  latitude numeric(10,7) NULL
  longitude numeric(10,7) NULL

registration.ice_sheets
  id uuid PK
  venue_id uuid NOT NULL FK -> registration.venues.id
  label text NOT NULL
  UNIQUE(venue_id, label)

registration.event_sessions
  id uuid PK
  event_id uuid NOT NULL FK -> registration.events.id
  label text NULL
  starts_at timestamptz NOT NULL
  ends_at timestamptz NULL

registration.event_applications
  id uuid PK
  applicant_user_id uuid NOT NULL FK -> core.users.id
  applicant_organization_id uuid NOT NULL FK -> core.organizations.id
  existing_event_id uuid NULL FK -> registration.events.id  -- for amendments
  proposed_event_series_id uuid NULL FK -> registration.event_series.id
  review_case_id uuid NULL FK -> governance.review_cases.id
  status text NOT NULL
  submitted_at timestamptz NULL
  resulting_event_id uuid NULL FK -> registration.events.id

registration.event_application_revisions
  id uuid PK
  application_id uuid NOT NULL FK -> registration.event_applications.id
  revision integer NOT NULL
  proposed_fields jsonb NOT NULL  -- application draft, not canonical event structure
  submitted_by_user_id uuid NOT NULL FK -> core.users.id
  created_at timestamptz NOT NULL
  UNIQUE(application_id, revision)

registration.event_staff_assignments
  id uuid PK
  event_id uuid NOT NULL FK -> registration.events.id
  user_id uuid NOT NULL FK -> core.users.id
  assignment_role text NOT NULL
  assigned_by_user_id uuid NOT NULL FK -> core.users.id
  valid_from timestamptz NOT NULL
  valid_to timestamptz NULL

registration.event_entries
  id uuid PK
  division_id uuid NOT NULL FK -> registration.event_divisions.id
  team_season_id uuid NULL FK -> core.team_seasons.id
  representing_organization_id uuid NULL FK -> core.organizations.id
  display_name text NOT NULL
  seed integer NULL
  registration_status text NOT NULL
  registered_at timestamptz NOT NULL
  accepted_at timestamptz NULL
  roster_locked_at timestamptz NULL
  version integer NOT NULL

registration.event_entry_players
  id uuid PK
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  person_id uuid NOT NULL FK -> core.people.id
  roster_revision integer NOT NULL
  display_name_at_event text NOT NULL
  nominal_position text NULL
  roster_role text NOT NULL
  valid_from timestamptz NOT NULL
  valid_to timestamptz NULL

registration.entry_payments
  id uuid PK
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  amount numeric(14,2) NOT NULL
  currency_code text NOT NULL
  payment_status text NOT NULL
  provider_reference text NULL  -- do not store raw card data
  paid_at timestamptz NULL
  refund_amount numeric(14,2) NULL

registration.eligibility_cases
  id uuid PK
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  case_type text NOT NULL  -- roster exception, injury, replacement, etc.
  review_case_id uuid NOT NULL FK -> governance.review_cases.id
  outcome text NULL
  applicable_from date NULL
  applicable_to date NULL
```

### Registration invariants

- An `event_series` identifies a recurring tournament; each `event` is a dated edition. Do not overwrite old editions when organizers apply for next season.
- A division owns its competition format, eligibility, entries, result certification, and ranking applicability. One event can contain divisions with different formats.
- Event applications and their revisions are proposals. Only approved revisions become canonical event fields; updates to approved events may need new review.
- A championship entry may represent a member association rather than a conventional tour team. An `event_entry` may reference a `team_season`, a `representing_organization`, or both, subject to entry policy.
- One active registration per `team_season`/division unless explicitly supported by an administrative exception; canceled/superseded registrations do not permanently block re-entry.
- `event_entry_players` records historical roster revisions. The version certified with an event is included in the immutable result snapshot.
- Payments are optional by event policy; never store payment-card secrets in these tables.

## 5. Competition formats, draws, scoring, standings, finalization

### Tables

```text
competition.format_templates
  id uuid PK
  name text NOT NULL
  format_family text NOT NULL  -- round_robin, knockout, swiss, page, hybrid

competition.format_template_versions
  id uuid PK
  template_id uuid NOT NULL FK -> competition.format_templates.id
  revision integer NOT NULL
  parameters jsonb NOT NULL  -- validated generation options
  rules_code_version text NOT NULL
  created_at timestamptz NOT NULL
  UNIQUE(template_id, revision)

competition.stages
  id uuid PK
  division_id uuid NOT NULL FK -> registration.event_divisions.id
  stage_order integer NOT NULL
  name text NOT NULL
  stage_type text NOT NULL  -- pool, knockout, qualifier, playoff, placement
  format_template_version_id uuid NULL FK -> competition.format_template_versions.id

competition.stage_groups
  id uuid PK
  stage_id uuid NOT NULL FK -> competition.stages.id
  name text NOT NULL  -- Pool A, Pool B, A Event, B Event, C Event
  group_type text NOT NULL

competition.stage_entries
  id uuid PK
  stage_group_id uuid NOT NULL FK -> competition.stage_groups.id
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  initial_seed integer NULL
  UNIQUE(stage_group_id, event_entry_id)

competition.draw_versions
  id uuid PK
  division_id uuid NOT NULL FK -> registration.event_divisions.id
  revision integer NOT NULL
  status text NOT NULL  -- draft, published, superseded
  published_by_user_id uuid NULL FK -> core.users.id
  published_at timestamptz NULL
  supersedes_draw_version_id uuid NULL FK -> competition.draw_versions.id
  UNIQUE(division_id, revision)

competition.games
  id uuid PK
  division_id uuid NOT NULL FK -> registration.event_divisions.id
  stage_id uuid NOT NULL FK -> competition.stages.id
  stage_group_id uuid NULL FK -> competition.stage_groups.id
  draw_version_id uuid NOT NULL FK -> competition.draw_versions.id
  session_id uuid NULL FK -> registration.event_sessions.id
  ice_sheet_id uuid NULL FK -> registration.ice_sheets.id
  scheduled_at timestamptz NULL
  started_at timestamptz NULL
  completed_at timestamptz NULL
  status text NOT NULL
  version integer NOT NULL

competition.game_slots
  id uuid PK
  game_id uuid NOT NULL FK -> competition.games.id
  slot_number smallint NOT NULL  -- 1 or 2
  event_entry_id uuid NULL FK -> registration.event_entries.id
  resolved_from_rule_id uuid NULL FK -> competition.advancement_rules.id
  UNIQUE(game_id, slot_number)

competition.advancement_rules
  id uuid PK
  draw_version_id uuid NOT NULL FK -> competition.draw_versions.id
  source_game_id uuid NULL FK -> competition.games.id
  source_group_id uuid NULL FK -> competition.stage_groups.id
  source_outcome text NULL  -- winner or loser for game source
  source_standing_rank integer NULL  -- for group ranking source
  destination_type text NOT NULL  -- game_slot, qualified, eliminated, manual_review
  destination_game_slot_id uuid NULL FK -> competition.game_slots.id
  destination_stage_id uuid NULL FK -> competition.stages.id
  qualifier_label text NULL

competition.game_ends
  id uuid PK
  game_id uuid NOT NULL FK -> competition.games.id
  end_number integer NOT NULL  -- includes extra ends, no end_1 ... end_10 columns
  is_extra_end boolean NOT NULL
  hammer_entry_id uuid NULL FK -> registration.event_entries.id
  status text NOT NULL  -- in_progress, completed, corrected
  UNIQUE(game_id, end_number)

competition.game_end_scores
  id uuid PK
  game_end_id uuid NOT NULL FK -> competition.game_ends.id
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  points integer NOT NULL
  UNIQUE(game_end_id, event_entry_id)

competition.game_score_events
  id uuid PK
  game_id uuid NOT NULL FK -> competition.games.id
  game_end_id uuid NULL FK -> competition.game_ends.id
  actor_user_id uuid NULL FK -> core.users.id
  event_sequence bigint NOT NULL
  idempotency_key text NOT NULL
  expected_game_version integer NULL
  before_json jsonb NOT NULL
  after_json jsonb NOT NULL
  correction_reason text NULL
  occurred_at timestamptz NOT NULL
  UNIQUE(game_id, event_sequence)
  UNIQUE(idempotency_key)

competition.game_result_versions
  id uuid PK
  game_id uuid NOT NULL FK -> competition.games.id
  revision integer NOT NULL
  slot_1_final_score integer NULL  -- supports legacy results without end scores
  slot_2_final_score integer NULL
  winner_entry_id uuid NULL FK -> registration.event_entries.id
  termination_type text NOT NULL  -- normal, conceded, forfeit, abandoned, etc.
  verification_status text NOT NULL
  verified_at timestamptz NULL
  supersedes_result_id uuid NULL FK -> competition.game_result_versions.id
  source_completeness text NOT NULL  -- line_scores, final_score_only, unknown
  UNIQUE(game_id, revision)

competition.game_result_signoffs
  id uuid PK
  result_version_id uuid NOT NULL FK -> competition.game_result_versions.id
  signer_user_id uuid NOT NULL FK -> core.users.id
  decision text NOT NULL
  signed_at timestamptz NOT NULL

competition.game_player_participation
  id uuid PK
  game_id uuid NOT NULL FK -> competition.games.id
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  person_id uuid NOT NULL FK -> core.people.id
  first_end integer NULL
  last_end integer NULL
  participation_status text NOT NULL  -- verified, declared, unknown

competition.tiebreak_measurements
  id uuid PK
  division_id uuid NOT NULL FK -> registration.event_divisions.id
  stage_id uuid NULL FK -> competition.stages.id
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  measurement_type text NOT NULL  -- DSC, LSD, etc.
  numeric_value numeric(18,6) NULL
  unit text NULL
  source_reference text NULL
  measured_at timestamptz NULL

competition.standings_runs
  id uuid PK
  stage_id uuid NOT NULL FK -> competition.stages.id
  rules_code_version text NOT NULL
  source_draw_version_id uuid NOT NULL FK -> competition.draw_versions.id
  calculated_at timestamptz NOT NULL
  status text NOT NULL

competition.standings_positions
  run_id uuid NOT NULL FK -> competition.standings_runs.id
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  rank integer NULL
  wins integer NOT NULL
  losses integer NOT NULL
  ties integer NOT NULL
  tiebreak_details jsonb NULL
  PRIMARY KEY(run_id, event_entry_id)

competition.event_result_snapshots
  id uuid PK
  division_id uuid NOT NULL FK -> registration.event_divisions.id
  revision integer NOT NULL
  frozen_snapshot jsonb NOT NULL  -- entries, roster versions, verified results, final places, relevant rules
  content_sha256 text NOT NULL
  created_by_user_id uuid NOT NULL FK -> core.users.id
  created_at timestamptz NOT NULL
  supersedes_snapshot_id uuid NULL FK -> competition.event_result_snapshots.id
  UNIQUE(division_id, revision)

competition.event_finalizations
  id uuid PK
  division_id uuid NOT NULL FK -> registration.event_divisions.id
  result_snapshot_id uuid NOT NULL FK -> competition.event_result_snapshots.id
  finalized_by_user_id uuid NOT NULL FK -> core.users.id
  finalized_at timestamptz NOT NULL
  status text NOT NULL  -- official, reopened, superseded
  correction_reason text NULL

competition.event_placements
  result_snapshot_id uuid NOT NULL FK -> competition.event_result_snapshots.id
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  placement integer NOT NULL
  placement_group text NULL  -- equal-third, quarterfinalist, etc.
  PRIMARY KEY(result_snapshot_id, event_entry_id)
```

### Competition invariants

1. All fixtures refer to `registration.event_entries`, never directly to current team names or mutable current rosters.
2. A format template **generates** a draw; the actual game graph is stored as versioned relational rows. `advancement_rules` handles winners, losers, pool ranks, qualifiers, and elimination.
3. Triple knockout: losers from A can enter B, from B can enter C, and from C are eliminated; exact routes and qualifiers come from the stored draw, not merely `loss_count`.
4. A completed end has two valid participant scores. Both zero represents a blank end. Nonnegative point limits follow the competition's discipline/rules, not one hardcoded universal maximum.
5. Result totals can be derived from available end scores; historical final-score-only records are valid without fabricated ends.
6. `game_score_events` and the authoritative end score update commit together. Enforce expected version/idempotency to avoid concurrent score overwrites.
7. Published draw revisions and verified result revisions are retained. A correction that affects downstream started games **requires official conflict resolution**, not silent bracket rewrites.
8. For eligibility, participation may be declared or unknown; do not treat unknown historical attendance as confirmed compliance.
9. Standings are calculation outputs, not equivalent to WCTRS world rankings. Tiebreak algorithms are versioned by competition policy and include relevant measured inputs.
10. Division finalization requires required games to be verified and final placements/eligibility decisions resolved. Frozen snapshots are immutable. Corrections create superseding snapshots/finalizations.

## 6. Rankings, SFM, individual entitlements, history

### Tables

```text
ranking.lists
  id uuid PK
  name text NOT NULL
  ranking_system text NOT NULL  -- WCTRS, association_world_rankings, other
  discipline text NOT NULL
  category text NOT NULL  -- men, women, mixed_doubles, etc.
  series_type text NULL  -- overall, champion, elite, challenger
  subject_type text NOT NULL  -- team_season, person, organization
  status text NOT NULL

ranking.subjects
  id uuid PK
  subject_type text NOT NULL
  team_season_id uuid NULL FK -> core.team_seasons.id
  person_id uuid NULL FK -> core.people.id
  organization_id uuid NULL FK -> core.organizations.id
  -- exactly one subject FK is non-null and matches subject_type

ranking.rule_versions
  id uuid PK
  ranking_list_id uuid NOT NULL FK -> ranking.lists.id
  season_id uuid NULL FK -> core.seasons.id
  version_label text NOT NULL
  effective_from date NOT NULL
  effective_to date NULL
  parameters jsonb NOT NULL  -- thresholds, rollovers, caps, point tables, tie-break settings
  implementation_code_sha text NOT NULL
  source_document_uri text NULL
  approved_at timestamptz NULL

ranking.event_assessments
  id uuid PK
  division_id uuid NOT NULL FK -> registration.event_divisions.id
  rule_version_id uuid NOT NULL FK -> ranking.rule_versions.id
  pre_event_ranking_run_id uuid NULL FK -> ranking.calculation_runs.id
  ranking_cutoff_date date NOT NULL
  event_category text NOT NULL
  number_of_eligible_entries integer NOT NULL
  calculated_sfm numeric(18,6) NULL
  approved_sfm numeric(18,6) NULL
  factors jsonb NOT NULL
  status text NOT NULL
  revision integer NOT NULL

ranking.event_assessment_inputs
  id uuid PK
  assessment_id uuid NOT NULL FK -> ranking.event_assessments.id
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  source_ranking_subject_id uuid NULL FK -> ranking.subjects.id
  source_ranking_run_id uuid NULL FK -> ranking.calculation_runs.id
  source_rank integer NULL
  contribution numeric(18,6) NOT NULL
  details jsonb NULL  -- necessary for mixed doubles player contribution explanations

ranking.event_point_awards
  id uuid PK
  result_snapshot_id uuid NOT NULL FK -> competition.event_result_snapshots.id
  event_entry_id uuid NOT NULL FK -> registration.event_entries.id
  assessment_id uuid NOT NULL FK -> ranking.event_assessments.id
  rule_version_id uuid NOT NULL FK -> ranking.rule_versions.id
  placement integer NULL
  raw_points numeric(18,6) NOT NULL
  eligible boolean NOT NULL
  calculation_breakdown jsonb NOT NULL
  revision integer NOT NULL
  supersedes_award_id uuid NULL FK -> ranking.event_point_awards.id

ranking.point_adjustments
  id uuid PK
  ranking_subject_id uuid NOT NULL FK -> ranking.subjects.id
  source_event_point_award_id uuid NULL FK -> ranking.event_point_awards.id
  adjustment_type text NOT NULL  -- penalty, correction, appeal, exception
  point_delta numeric(18,6) NOT NULL
  reason text NOT NULL
  review_case_id uuid NOT NULL FK -> governance.review_cases.id
  effective_on date NOT NULL
  approved_at timestamptz NULL

ranking.player_point_entitlements
  id uuid PK
  person_id uuid NOT NULL FK -> core.people.id
  team_season_id uuid NOT NULL FK -> core.team_seasons.id
  season_id uuid NOT NULL FK -> core.seasons.id
  allocation_declaration_id uuid NULL FK -> core.point_allocation_declarations.id
  rule_version_id uuid NOT NULL FK -> ranking.rule_versions.id
  points numeric(18,6) NOT NULL
  calculated_at timestamptz NOT NULL
  revision integer NOT NULL

ranking.season_carryovers
  id uuid PK
  from_team_season_id uuid NULL FK -> core.team_seasons.id
  to_team_season_id uuid NOT NULL FK -> core.team_seasons.id
  continuity_decision_id uuid NULL FK -> core.team_continuity_decisions.id
  rule_version_id uuid NOT NULL FK -> ranking.rule_versions.id
  points numeric(18,6) NOT NULL
  reason text NOT NULL
  effective_on date NOT NULL

ranking.calculation_runs
  id uuid PK
  ranking_list_id uuid NOT NULL FK -> ranking.lists.id
  rule_version_id uuid NOT NULL FK -> ranking.rule_versions.id
  as_of_date date NOT NULL  -- sport-effective date of rankings
  input_cutoff_at timestamptz NOT NULL
  calculated_at timestamptz NOT NULL
  published_at timestamptz NULL  -- what fans could see at this time
  status text NOT NULL  -- draft, reviewed, published, superseded
  origin text NOT NULL  -- calculated, imported_official, imported_unverified
  engine_code_sha text NULL
  input_manifest_sha256 text NULL
  output_sha256 text NULL
  supersedes_run_id uuid NULL FK -> ranking.calculation_runs.id

ranking.run_inputs
  id uuid PK
  calculation_run_id uuid NOT NULL FK -> ranking.calculation_runs.id
  input_type text NOT NULL  -- result_snapshot, event_award, carryover, prior_run, etc.
  input_id uuid NOT NULL  -- typed reference resolved and validated by ranking engine
  input_content_sha256 text NOT NULL

ranking.positions
  calculation_run_id uuid NOT NULL FK -> ranking.calculation_runs.id
  ranking_subject_id uuid NOT NULL FK -> ranking.subjects.id
  rank integer NOT NULL
  current_season_points numeric(18,6) NOT NULL
  prior_season_weighted_points numeric(18,6) NOT NULL
  total_points numeric(18,6) NOT NULL
  tiebreak_details jsonb NULL
  PRIMARY KEY(calculation_run_id, ranking_subject_id)

ranking.position_contributions
  id uuid PK
  calculation_run_id uuid NOT NULL FK -> ranking.calculation_runs.id
  ranking_subject_id uuid NOT NULL FK -> ranking.subjects.id
  event_point_award_id uuid NULL FK -> ranking.event_point_awards.id
  point_adjustment_id uuid NULL FK -> ranking.point_adjustments.id
  season_carryover_id uuid NULL FK -> ranking.season_carryovers.id
  raw_points numeric(18,6) NOT NULL
  weight numeric(18,6) NOT NULL
  effective_points numeric(18,6) NOT NULL
  is_counted boolean NOT NULL
  exclusion_reason text NULL
  -- exactly one source FK is non-null

ranking.challenges
  id uuid PK
  ranking_subject_id uuid NOT NULL FK -> ranking.subjects.id
  challenged_run_id uuid NULL FK -> ranking.calculation_runs.id
  challenged_award_id uuid NULL FK -> ranking.event_point_awards.id
  filed_by_user_id uuid NOT NULL FK -> core.users.id
  filed_at timestamptz NOT NULL
  review_case_id uuid NOT NULL FK -> governance.review_cases.id
  reason text NOT NULL
```

### Ranking invariants

1. **Rankings are reproducible:** rule version, code SHA, input manifests, specific event snapshots, point ownership, and all included/excluded contributions must be recoverable.
2. A published `calculation_run` and its `positions`, `run_inputs`, and `position_contributions` are immutable. Corrections create a new run using `supersedes_run_id`.
3. Distinguish `as_of_date` from `published_at`. This supports both "what is the corrected ranking for November 3?" and "what did the public actually see on November 3?".
4. A pre-event SFM assessment references the **specific historical ranking run** required by the rules at that cutoff (for current WCTRS, rankings as of the Tuesday prior to the event), never today's ranks.
5. WCTRS overall, series, men's/women's team, mixed doubles pair, mixed doubles individual player, and member-association ranking systems are separate `ranking.lists` with potentially different rules.
6. Do not store a manually editable `teams.current_points` as the source of truth. Points are derived from official awards, approved allocations/entitlements, continuity rules, penalties, date weights, and per-run counting rules.
7. A points adjustment requires an approved case and a reason. Never hide manual overrides inside a total.
8. Historical imported ranking snapshots may be marked `imported_official` without claiming full calculation reproducibility when source data is incomplete.
9. Use `numeric`, deterministic tie-breaking, fixed ruleset versions, and explicit rounding policies. Store reasons when events are excluded from counting totals.
10. Events published later, or corrected later, may create a new ranking version for an earlier effective date; preserve the original publication history.

## 7. Approvals, media, auditing

### Tables

```text
governance.review_cases
  id uuid PK
  case_type text NOT NULL  -- event_application, photo, eligibility, ranking_challenge, adjustment
  status text NOT NULL
  opened_by_user_id uuid NOT NULL FK -> core.users.id
  opened_at timestamptz NOT NULL
  resolved_at timestamptz NULL

governance.review_decisions
  id uuid PK
  review_case_id uuid NOT NULL FK -> governance.review_cases.id
  reviewer_user_id uuid NOT NULL FK -> core.users.id
  decision text NOT NULL  -- approved, rejected, changes_requested, etc.
  reason text NULL
  decided_at timestamptz NOT NULL

governance.media_assets
  id uuid PK
  object_storage_key text NOT NULL
  content_sha256 text NOT NULL
  mime_type text NOT NULL
  bytes bigint NOT NULL
  uploaded_by_user_id uuid NULL FK -> core.users.id
  visibility text NOT NULL  -- private_pending, approved_public, private
  created_at timestamptz NOT NULL

governance.profile_photo_requests
  id uuid PK
  person_id uuid NOT NULL FK -> core.people.id
  submitted_by_user_id uuid NOT NULL FK -> core.users.id
  proposed_asset_id uuid NOT NULL FK -> governance.media_assets.id
  review_case_id uuid NOT NULL FK -> governance.review_cases.id
  status text NOT NULL
  submitted_at timestamptz NOT NULL

governance.audit_log
  id uuid PK
  actor_user_id uuid NULL FK -> core.users.id
  actor_service text NULL
  action text NOT NULL
  entity_type text NOT NULL
  entity_id uuid NOT NULL
  request_id text NULL
  occurred_at timestamptz NOT NULL
  before_json jsonb NULL
  after_json jsonb NULL
  reason text NULL
  source_system text NULL
  metadata jsonb NULL
```

### Governance invariants

- Pending photos are private; approval is required before changing the public profile photo reference.
- A review decision is append-only; do not erase rejected submissions or earlier decisions.
- Write audit records in the same transaction as the corresponding authoritative state change.
- Log both human and automated actors; capture correlation IDs and relevant reason/approval context.
- Redact passwords, tokens, sensitive personal data, raw payment details, and private attachments from generic audit JSON.
- Database permissions, backups, and retention policy should make official published data and audit history difficult to tamper with. Hash-chained archives can be added if formal tamper evidence is required.

## 8. External integration and historical imports

### Tables

```text
integration.sources
  id uuid PK
  code text NOT NULL UNIQUE  -- world_curling_results, curlingzone, gsoc, etc.
  name text NOT NULL
  source_type text NOT NULL

integration.import_batches
  id uuid PK
  source_id uuid NOT NULL FK -> integration.sources.id
  imported_at timestamptz NOT NULL
  source_archive_uri text NULL
  source_sha256 text NULL
  parser_version text NOT NULL
  status text NOT NULL
  record_count integer NULL

integration.source_records
  id uuid PK
  batch_id uuid NOT NULL FK -> integration.import_batches.id
  source_entity_type text NOT NULL
  external_id text NULL
  raw_payload jsonb NOT NULL
  raw_payload_sha256 text NOT NULL

integration.entity_mappings
  id uuid PK
  source_id uuid NOT NULL FK -> integration.sources.id
  entity_type text NOT NULL
  external_id text NOT NULL
  internal_id uuid NOT NULL
  UNIQUE(source_id, entity_type, external_id)

integration.record_provenance
  id uuid PK
  entity_type text NOT NULL
  entity_id uuid NOT NULL
  source_record_id uuid NOT NULL FK -> integration.source_records.id
  field_name text NULL
  verification_status text NOT NULL
  first_observed_at timestamptz NOT NULL

integration.data_quality_issues
  id uuid PK
  entity_type text NOT NULL
  entity_id uuid NOT NULL
  issue_type text NOT NULL  -- conflict, duplicate, unparseable, inconsistent, etc.
  severity text NOT NULL
  issue_status text NOT NULL
  details jsonb NULL

integration.identity_merge_decisions
  id uuid PK
  entity_type text NOT NULL
  retained_id uuid NOT NULL
  merged_id uuid NOT NULL
  review_case_id uuid NULL FK -> governance.review_cases.id
  rationale text NOT NULL
  decided_at timestamptz NOT NULL

integration.inbox_events
  id uuid PK
  source_id uuid NOT NULL FK -> integration.sources.id
  external_event_id text NOT NULL
  payload jsonb NOT NULL
  received_at timestamptz NOT NULL
  processed_at timestamptz NULL
  status text NOT NULL
  UNIQUE(source_id, external_event_id)

integration.outbox_events
  id uuid PK
  aggregate_type text NOT NULL
  aggregate_id uuid NOT NULL
  event_type text NOT NULL
  payload jsonb NOT NULL
  occurred_at timestamptz NOT NULL
  published_at timestamptz NULL
  publish_attempts integer NOT NULL

integration.sync_checkpoints
  id uuid PK
  source_id uuid NOT NULL FK -> integration.sources.id
  entity_type text NOT NULL
  cursor_value text NULL
  last_successful_sync_at timestamptz NULL
  UNIQUE(source_id, entity_type)
```

### Historical-data invariants

- Preserve raw records, source IDs, import batch details, and parser versions so migrations can be replayed and traced.
- Duplicate detection and human-reviewed identity merges must be reversible or fully auditable; do not merge players solely by matching names.
- A historical game with only a final score is valid. Missing line scores, unknown players, and incomplete rosters are **unknown**, not score zero or parsing failures.
- If historical ranking inputs are unavailable, preserve the originally published snapshot with a provenance flag rather than fabricating a reproducible calculation.
- Import jobs are idempotent. Re-importing the same source cannot duplicate official games or overwrite verified WCF records without a recorded resolution.
- Access/transfer rights for World Curling, CurlingZone, and other source datasets must be confirmed before historical migration.

## 9. Command flows and transaction boundaries

### Flow A: Organizer registers next year's event

1. Create `registration.event_applications` and a revision in `event_application_revisions`.
2. Submit and open `governance.review_cases`.
3. WCF admin records `governance.review_decisions`.
4. On approval, create/update canonical `registration.events` and `event_divisions` transactionally; link the approved application.
5. Publish `integration.outbox_events` and an audit entry.

### Flow B: Organizer registers a team

1. Resolve/create canonical `team`, `team_season`, and official roster version.
2. Create `registration.event_entries` and versioned `event_entry_players`.
3. Validate roster/eligibility and payment policy; record exemptions as needed.
4. Freeze an entry roster for official competition use; preserve subsequent authorized amendments.

### Flow C: Volunteer enters or corrects an end score

1. Verify the user has the relevant event/scorekeeper permission.
2. Check game `version` and request idempotency key.
3. Update `game_ends`/`game_end_scores` and append `game_score_events` in one transaction.
4. Recompute affected game totals and in-event standings/bracket projections.
5. Emit an outbox event for the public live view. After verification, corrections require elevated authorization and possibly a new result revision.

### Flow D: Complete triple knockout

1. Verify a `game_result_versions` row with signer evidence.
2. Resolve `advancement_rules` from the official draw version.
3. Propagate winner/loser to eligible future `game_slots`, or mark qualifier/eliminated.
4. If dependent future games are already active or verified, stop for official review rather than silently rewriting them.

### Flow E: Finalize a division and rank it

1. Validate required games, entries, eligibility decisions, placements, and signoffs.
2. Freeze `competition.event_result_snapshots` with hash and revision; append `event_finalizations`.
3. Calculate `ranking.event_assessments` and `event_point_awards`, preserving pre-event source ranking/SFM inputs.
4. Run `ranking.calculation_runs` with fully traceable input manifest and contributions.
5. Authorized WCF admin publishes the run; a later correction produces superseding result/award/ranking versions.

### Flow F: Player requests a new photo

1. Upload a private `media_asset` and open `profile_photo_requests` plus a review case.
2. WCF administrator approves/rejects; append immutable decision/audit records.
3. Only approval updates `core.people.profile_photo_asset_id` and public asset visibility.

## 10. Lifecycle state machines

```text
event_application: draft -> submitted -> under_review -> approved | rejected | changes_requested
event_division: registration -> scheduled -> in_progress -> results_pending -> finalized
game: scheduled -> live -> result_submitted -> verified
profile_photo_request: pending -> approved | rejected
ranking_run: draft -> reviewed -> published -> superseded
```

Exceptional reopen/correction actions require explicit authority, reason, audit event, and a new immutable revision. Do not implement them as arbitrary backwards status changes.

## 11. Essential indexes and database-level checks

1. `competition.games(division_id, scheduled_at, status)`; `competition.game_ends(game_id, end_number)` unique.
2. `competition.game_slots(game_id, slot_number)` unique, with CHECK slot number in (1,2).
3. `competition.game_end_scores(game_end_id, event_entry_id)` unique; scores nonnegative and restricted to actual participants.
4. `registration.event_entries(division_id, team_season_id)` partial unique for active registrations where team season is set, accounting for replacements/corrections.
5. `ranking.calculation_runs(ranking_list_id, as_of_date, published_at DESC)` for historical queries; uniqueness rules for published revisions enforced transactionally.
6. `ranking.positions(calculation_run_id, ranking_subject_id)` unique; WCTRS lists disallow unresolved ties per rule version.
7. `governance.audit_log(entity_type, entity_id, occurred_at DESC)` for audit queries.
8. `integration.entity_mappings(source_id, entity_type, external_id)` and `integration.inbox_events(source_id, external_event_id)` unique.
9. Transactional checks: valid entry within game division; exactly two scores for completed ends; at most one scoring team for a completed curling end; valid bracket source/destination types; no conflicting active game assignments; allocation declarations sum to 100%; official result snapshot contains certified data.
10. Add foreign keys, lifecycle constraints, and partial indexes in actual DDL. Do not rely only on application validation for correctness.

## 12. Acceptance tests for the future schema and engine

1. **Roster continuity:** Four-player team changes one member; historical event roster remains unchanged; entitlement/carryover decision is traceable.
2. **Team split:** Two players move to separate teams; point ownership and any allowed carryovers are explained without double counting.
3. **Mixed doubles:** Pair and individual ranking subjects can be calculated independently using versioned rules.
4. **Triple knockout:** Loss in A routes to B, loss in B routes to C, loss in C eliminates; qualifiers and playoff slots are correct.
5. **Other formats:** Round robin, pooled group ranking, Page playoffs, Swiss pairings, byes, and crossovers work under versioned rules.
6. **Concurrent scoring:** Two volunteers editing one end cannot silently overwrite each other.
7. **Historical result:** Game with final score but no ends imports successfully, and the UI correctly displays unknown line scores.
8. **Result correction:** Correcting a verified score produces audit history, a new result version, and safely handles already-started downstream bracket games.
9. **Event finalization:** Cannot finalize a division with unresolved required results or eligibility decisions.
10. **Ranking replay:** Same rule version and identical frozen input manifest generate identical point outputs and ordering.
11. **Historical ranking display:** The published-on-date view remains available after later corrections, separately from the corrected as-of-date view.
12. **Import idempotency:** Rerunning imports doesn't duplicate entities; ambiguous identity merges require review.
13. **Photo approval:** Pending assets remain private; rejection never changes the public photo.
14. **Permissions:** A volunteer can score only their authorized event; a team manager cannot publish WCTRS rankings.

## 13. Remaining decisions before executable migrations

- Select a user authentication method (local accounts, federated identity, or both), with account verification, recovery, and administrative access controls supplied by this platform.
- Finalize the internal module boundaries and API commands for registration, game certification, event finalization, and rankings publication. The competition module is the authoritative writer of games and results.
- Confirm the exact season, category, roster continuity, and ranking policy rulebooks to implement as historical versions, including special events and mixed doubles.
- Confirm if entry-fee collection/refund processing is in-scope initially or only recorded as metadata.
- Define historical source access and licensing, identity matching policy, and target data-quality thresholds.
- Decide which approved result signoffs are required before organizer finalization and before WCF ranking publication.
- Choose whether to compile common draw templates into a fixed, validated rule graph or expose advanced organizer configuration; either way, persisted games/advancements stay relational.

## 14. Sources consulted

- World Curling WCTRS overview: https://worldcurling.org/teamrankings/
- Four-player ranking calculation (2026-27): https://worldcurling.org/teamrankings/ranking-calculations-four-player/
- Mixed doubles ranking calculation: https://worldcurling.org/teamrankings/ranking-calculations-mixed-doubles/
- WCTRS Team and Player Eligibility Rules (2026-27): https://worldcurling.org/wp-content/uploads/2026/07/WCTRS-Team-and-Player-Eligibility-Rules-2026-2027.pdf
- World Curling Competition Formats and Qualification Criteria (October 2026): https://worldcurling.org/rules/
- World Curling historical results: https://results.worldcurling.org/Home/About

---

**Document status:** Proposed standalone-platform logical schema, v0.3.1. This is intentionally more comprehensive than a first migration. It should be reviewed with World Curling stakeholders, then transformed into executable PostgreSQL DDL, API contracts, validation rules, seed values, and automated tests. Do not treat table names as already approved by World Curling.
