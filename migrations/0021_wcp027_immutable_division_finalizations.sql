CREATE TABLE division_finalization (
 division_id text NOT NULL REFERENCES division(id), version integer NOT NULL CHECK(version>0),
 replaces_version integer, source_digest text NOT NULL CHECK(source_digest ~ '^[0-9a-f]{64}$'),
 contents text NOT NULL CHECK(jsonb_typeof(contents::jsonb)='object'),
 digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$'),
 actor_id text NOT NULL REFERENCES auth_user(id), finalized_by text NOT NULL,
 request_id text NOT NULL, command_digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), audit_id text NOT NULL UNIQUE REFERENCES audit_record(id),
 PRIMARY KEY(division_id,version), UNIQUE(actor_id,request_id),
 FOREIGN KEY(division_id,replaces_version) REFERENCES division_finalization(division_id,version),
 CHECK((version=1 AND replaces_version IS NULL) OR (version>1 AND replaces_version=version-1))
);
CREATE FUNCTION preserve_wcp027_finalization() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Division finalization snapshots are immutable'; END $$;
CREATE TRIGGER immutable_division_finalization BEFORE UPDATE OR DELETE ON division_finalization FOR EACH ROW EXECUTE FUNCTION preserve_wcp027_finalization();
