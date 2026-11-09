CREATE TABLE event_assessment (
 id text PRIMARY KEY, division_id text NOT NULL REFERENCES division(id), version integer NOT NULL CHECK(version>0),
 replaces_id text REFERENCES event_assessment(id), finalization_version integer NOT NULL,
 rules_id text NOT NULL, rules_version integer NOT NULL,
 contents text NOT NULL CHECK(jsonb_typeof(contents::jsonb)='object'), digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 engine text NOT NULL, actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL, command_digest text NOT NULL,
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(division_id,version), UNIQUE(actor_id,request_id),
 FOREIGN KEY(division_id,finalization_version) REFERENCES division_finalization(division_id,version),
 FOREIGN KEY(rules_id,rules_version) REFERENCES ranking_revision(record_id,version)
);
CREATE TABLE event_calculation_job (
 assessment_id text PRIMARY KEY REFERENCES event_assessment(id), queue_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('queued','running','failed','blocked','completed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0), error text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE event_assessment_result (
 assessment_id text PRIMARY KEY REFERENCES event_assessment(id), input_digest text NOT NULL CHECK(input_digest ~ '^[a-f0-9]{64}$'),
 contents text NOT NULL CHECK(jsonb_typeof(contents::jsonb)='object'), digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE event_calculation_receipt (
 actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL,
 assessment_id text NOT NULL REFERENCES event_assessment(id), command_digest text NOT NULL,
 queue_id uuid NOT NULL, audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,request_id)
);
CREATE FUNCTION preserve_wcp033_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Event assessment evidence is immutable'; END $$;
CREATE TRIGGER immutable_event_assessment BEFORE UPDATE OR DELETE ON event_assessment FOR EACH ROW EXECUTE FUNCTION preserve_wcp033_evidence();
CREATE TRIGGER immutable_event_assessment_result BEFORE UPDATE OR DELETE ON event_assessment_result FOR EACH ROW EXECUTE FUNCTION preserve_wcp033_evidence();
CREATE TRIGGER immutable_event_calculation_receipt BEFORE UPDATE OR DELETE ON event_calculation_receipt FOR EACH ROW EXECUTE FUNCTION preserve_wcp033_evidence();
