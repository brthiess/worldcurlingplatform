-- Additive observations. No default rows or rewrites of old result/finalization JSON.
CREATE TABLE game_sporting_version (
 game_id text NOT NULL REFERENCES game(id),
 version integer NOT NULL CHECK(version>0),
 entry_a text NOT NULL REFERENCES event_entry(id),
 entry_b text NOT NULL REFERENCES event_entry(id),
 evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='object' AND evidence->>'ruleset'='world-curling-2026'),
 audit_id text NOT NULL REFERENCES audit_record(id) DEFERRABLE INITIALLY DEFERRED,
 PRIMARY KEY(game_id,version),
 CHECK(entry_a<>entry_b)
);
CREATE FUNCTION protect_game_sporting_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Sporting evidence versions are immutable'; END $$;
CREATE TRIGGER immutable_game_sporting_version BEFORE UPDATE OR DELETE ON game_sporting_version FOR EACH ROW EXECUTE FUNCTION protect_game_sporting_version();
