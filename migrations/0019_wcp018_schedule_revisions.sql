ALTER TABLE event_edition ADD COLUMN schedule_version integer NOT NULL DEFAULT 0 CHECK(schedule_version>=0);
ALTER TABLE draw_session ADD COLUMN duration_minutes integer NOT NULL DEFAULT 120 CHECK(duration_minutes BETWEEN 15 AND 1440);
CREATE TABLE schedule_revision (
 event_id text NOT NULL REFERENCES event_edition(id), version integer NOT NULL CHECK(version>0),
 actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL,
 command jsonb NOT NULL, before_state jsonb NOT NULL, response jsonb NOT NULL,
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,version), UNIQUE(event_id,actor_id,request_id)
);
CREATE TRIGGER immutable_schedule_revision BEFORE UPDATE OR DELETE ON schedule_revision FOR EACH ROW EXECUTE FUNCTION wcp003_preserve_evidence();
