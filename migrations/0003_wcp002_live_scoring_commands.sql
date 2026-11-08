ALTER TABLE game ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK(version >= 0);
ALTER TABLE game ADD COLUMN scoring_source text NOT NULL DEFAULT 'manual';
ALTER TABLE audit_record ADD COLUMN request_id text;
ALTER TABLE audit_record ADD COLUMN resource_version integer;
ALTER TABLE audit_record ADD COLUMN before_state jsonb;
ALTER TABLE audit_record ADD COLUMN after_state jsonb;
CREATE UNIQUE INDEX scoring_audit_request ON audit_record(actor_id,resource_id,request_id) WHERE request_id IS NOT NULL;
CREATE TABLE scoring_command (
  game_id text NOT NULL REFERENCES game(id), actor_id text NOT NULL REFERENCES auth_user(id),
  request_id text NOT NULL, command jsonb NOT NULL, response jsonb NOT NULL,
  audit_id text NOT NULL UNIQUE REFERENCES audit_record(id),
  PRIMARY KEY(game_id,actor_id,request_id)
);
