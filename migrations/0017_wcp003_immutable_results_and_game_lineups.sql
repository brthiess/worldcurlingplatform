CREATE TABLE game_lineup_version (
  game_id text NOT NULL REFERENCES game(id), version integer NOT NULL CHECK(version>0), side text NOT NULL CHECK(side IN ('a','b')),
  entry_id text NOT NULL REFERENCES event_entry(id), event_lineup_version integer,
  mode text NOT NULL CHECK(mode IN ('defaulted','difference')), members jsonb NOT NULL,
  PRIMARY KEY(game_id,version,side),
  FOREIGN KEY(entry_id,event_lineup_version) REFERENCES event_lineup_version(entry_id,version)
);
CREATE TABLE game_result_version (
  game_id text NOT NULL REFERENCES game(id), version integer NOT NULL CHECK(version>0),
  actor_id text NOT NULL REFERENCES auth_user(id), confirmed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), result jsonb NOT NULL,
  audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), PRIMARY KEY(game_id,version)
);
CREATE FUNCTION wcp003_preserve_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Recorded game evidence is immutable'; END $$;
CREATE TRIGGER immutable_game_results BEFORE UPDATE OR DELETE ON game_result_version FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
CREATE TRIGGER immutable_game_lineups BEFORE UPDATE OR DELETE ON game_lineup_version FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
-- Stored routes are populated by competition-draw work. This is the small contract
-- needed to retain played participants and flag corrections, not a repair engine.
CREATE TABLE game_assignment_dependency (
  upstream_game_id text NOT NULL REFERENCES game(id), downstream_game_id text NOT NULL REFERENCES game(id),
  side text NOT NULL CHECK(side IN ('a','b')), route text NOT NULL CHECK(route IN ('winner','loser')),
  PRIMARY KEY(downstream_game_id,side), CHECK(upstream_game_id<>downstream_game_id)
);
CREATE TABLE game_assignment_attention (
  upstream_game_id text NOT NULL, result_version integer NOT NULL,
  downstream_game_id text NOT NULL REFERENCES game(id), side text NOT NULL CHECK(side IN ('a','b')),
  actual_entry_id text REFERENCES event_entry(id), expected_entry_id text NOT NULL REFERENCES event_entry(id),
  downstream_state text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(upstream_game_id,result_version,downstream_game_id,side),
  FOREIGN KEY(upstream_game_id,result_version) REFERENCES game_result_version(game_id,version)
);
CREATE TRIGGER immutable_assignment_attention BEFORE UPDATE OR DELETE ON game_assignment_attention FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
