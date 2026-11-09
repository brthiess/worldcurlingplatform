-- Extends the accepted graph without changing any applied migration bytes.
ALTER TABLE draw_seed DROP CONSTRAINT draw_seed_seed_check;
ALTER TABLE draw_seed ADD CONSTRAINT draw_seed_seed_check CHECK(seed BETWEEN 1 AND 16);
INSERT INTO draw_template_version VALUES('application-tko16-q8-233-v1',1,'{"family":"triple_knockout","fieldSizes":[16],"qualificationGames":33,"playoffGames":7,"qualifiers":{"A":2,"B":3,"C":3},"byes":[],"fixedPlayoffs":true,"bronze":false,"revision":"v1"}');
CREATE TABLE draw_terminal_result (
 upstream_game_id text NOT NULL, result_version integer NOT NULL,
 route text NOT NULL CHECK(route IN('winner','loser')),
 entry_id text NOT NULL REFERENCES event_entry(id),
 kind text NOT NULL CHECK(kind IN('qualified','eliminated','placed')),
 label text NOT NULL, place integer CHECK(place IN(1,2,3,5)),
 audit_id text NOT NULL REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(upstream_game_id,result_version,route),
 FOREIGN KEY(upstream_game_id,result_version) REFERENCES game_result_version(game_id,version),
 CHECK((kind='placed' AND place IS NOT NULL) OR (kind<>'placed' AND place IS NULL))
);
CREATE TRIGGER immutable_draw_terminal BEFORE UPDATE OR DELETE ON draw_terminal_result FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
