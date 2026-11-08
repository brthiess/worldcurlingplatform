CREATE TABLE ranking_record (
 id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('rules','season')),
 registration_id text UNIQUE REFERENCES season_registration(id), version integer NOT NULL CHECK(version>0),
 CHECK((kind='season')=(registration_id IS NOT NULL))
);
CREATE TABLE ranking_revision (
 record_id text NOT NULL REFERENCES ranking_record(id), version integer NOT NULL CHECK(version>0),
 state text NOT NULL CHECK(state IN ('draft','reviewed')), data jsonb NOT NULL,
 readiness jsonb, rule_record_id text, rule_version integer,
 registration_id text, roster_version integer,
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), actor_id text NOT NULL REFERENCES auth_user(id),
 request_id text NOT NULL, command_digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(record_id,version), UNIQUE(actor_id,request_id),
 FOREIGN KEY(rule_record_id,rule_version) REFERENCES ranking_revision(record_id,version),
 FOREIGN KEY(registration_id,roster_version) REFERENCES season_roster_version(registration_id,version),
 CHECK((rule_record_id IS NULL)=(rule_version IS NULL)),
 CHECK((registration_id IS NULL)=(roster_version IS NULL)),
 CHECK((registration_id IS NULL)=(rule_record_id IS NULL)),
 CHECK(registration_id IS NULL OR state='draft' OR (readiness->>'complete')::boolean IS TRUE)
);
CREATE FUNCTION preserve_wcp032_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Ranking source and input revisions are immutable'; END $$;
CREATE TRIGGER immutable_ranking_revision BEFORE UPDATE OR DELETE ON ranking_revision FOR EACH ROW EXECUTE FUNCTION preserve_wcp032_evidence();
