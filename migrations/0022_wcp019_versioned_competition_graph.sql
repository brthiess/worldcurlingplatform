-- Stable games belong to a division independently of their optional schedule.
ALTER TABLE game ADD COLUMN division_id text REFERENCES division(id);
UPDATE game g SET division_id=ds.division_id FROM draw_session ds WHERE ds.id=g.draw_id;
ALTER TABLE game ALTER COLUMN division_id SET NOT NULL;
ALTER TABLE game ALTER COLUMN draw_id DROP NOT NULL;
CREATE FUNCTION wcp019_game_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE scope_id text;
BEGIN
 IF NEW.draw_id IS NOT NULL THEN
  SELECT division_id INTO scope_id FROM draw_session WHERE id=NEW.draw_id;
  IF NEW.division_id IS NULL THEN NEW.division_id=scope_id; END IF;
  IF NEW.division_id IS DISTINCT FROM scope_id THEN RAISE EXCEPTION 'Game and session division must match' USING ERRCODE='23514'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM event_entry WHERE id IN(NEW.entry_a,NEW.entry_b) AND division_id<>NEW.division_id)
 OR (NEW.entry_a IS NOT NULL AND NEW.entry_a=NEW.entry_b) THEN
  RAISE EXCEPTION 'Distinct game participants must belong to its division' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER game_scope BEFORE INSERT OR UPDATE ON game FOR EACH ROW EXECUTE FUNCTION wcp019_game_scope();

CREATE TABLE draw_template_version (
 id text NOT NULL, version integer NOT NULL CHECK(version>0), definition jsonb NOT NULL,
 PRIMARY KEY(id,version)
);
INSERT INTO draw_template_version VALUES('application-single8-seeded-v1',1,'{"family":"single_knockout","fieldSizes":[6,8],"seedOrder":[1,8,4,5,2,7,3,6],"bronze":false,"sixEntryByes":[1,2],"revision":"v1"}');
CREATE TABLE competition_draw (
 division_id text PRIMARY KEY REFERENCES division(id), version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 state text NOT NULL DEFAULT 'empty' CHECK(state IN('empty','preview','published'))
);
CREATE TABLE draw_revision (
 division_id text NOT NULL REFERENCES competition_draw(division_id), version integer NOT NULL CHECK(version>0),
 state text NOT NULL CHECK(state IN('preview','published')),
 template_id text NOT NULL, template_version integer NOT NULL,
 graph jsonb NOT NULL, actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL,
 command jsonb NOT NULL, response jsonb NOT NULL, reason text NOT NULL,
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(division_id,version), UNIQUE(division_id,actor_id,request_id),
 FOREIGN KEY(template_id,template_version) REFERENCES draw_template_version(id,version)
);
CREATE TABLE draw_seed (
 division_id text NOT NULL, revision integer NOT NULL, seed integer NOT NULL CHECK(seed BETWEEN 1 AND 8),
 entry_id text NOT NULL REFERENCES event_entry(id), entry_version integer NOT NULL, name text NOT NULL,
 PRIMARY KEY(division_id,revision,seed), UNIQUE(division_id,revision,entry_id),
 FOREIGN KEY(division_id,revision) REFERENCES draw_revision(division_id,version)
);
CREATE TABLE draw_node (
 division_id text NOT NULL, revision integer NOT NULL, key text NOT NULL,
 round integer NOT NULL CHECK(round>0), game_id text NOT NULL,
 PRIMARY KEY(division_id,revision,key), UNIQUE(division_id,revision,game_id),
 FOREIGN KEY(division_id,revision) REFERENCES draw_revision(division_id,version)
);
CREATE TABLE draw_slot (
 division_id text NOT NULL, revision integer NOT NULL, node_key text NOT NULL, side text NOT NULL CHECK(side IN('a','b')),
 seed integer, source_node text, route text CHECK(route IN('winner','loser')),
 PRIMARY KEY(division_id,revision,node_key,side),
 FOREIGN KEY(division_id,revision,node_key) REFERENCES draw_node(division_id,revision,key),
 FOREIGN KEY(division_id,revision,seed) REFERENCES draw_seed(division_id,revision,seed),
 FOREIGN KEY(division_id,revision,source_node) REFERENCES draw_node(division_id,revision,key),
 CHECK((seed IS NOT NULL AND source_node IS NULL AND route IS NULL) OR (seed IS NULL AND source_node IS NOT NULL AND route IS NOT NULL)),
 CHECK(node_key<>source_node)
);
CREATE TABLE draw_assignment_revision (
 upstream_game_id text NOT NULL, result_version integer NOT NULL,
 downstream_game_id text NOT NULL REFERENCES game(id), side text NOT NULL CHECK(side IN('a','b')),
 previous_entry_id text REFERENCES event_entry(id), expected_entry_id text NOT NULL REFERENCES event_entry(id),
 actual_entry_id text REFERENCES event_entry(id), disposition text NOT NULL CHECK(disposition IN('assigned','preserved')),
 audit_id text NOT NULL REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(upstream_game_id,result_version,downstream_game_id,side),
 FOREIGN KEY(upstream_game_id,result_version) REFERENCES game_result_version(game_id,version)
);
CREATE TRIGGER immutable_draw_template BEFORE UPDATE OR DELETE ON draw_template_version FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
CREATE TRIGGER immutable_draw_revision BEFORE UPDATE OR DELETE ON draw_revision FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
CREATE TRIGGER immutable_draw_seed BEFORE UPDATE OR DELETE ON draw_seed FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
CREATE TRIGGER immutable_draw_node BEFORE UPDATE OR DELETE ON draw_node FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
CREATE TRIGGER immutable_draw_slot BEFORE UPDATE OR DELETE ON draw_slot FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
CREATE TRIGGER immutable_draw_assignment BEFORE UPDATE OR DELETE ON draw_assignment_revision FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
