CREATE TABLE import_job (
 id text PRIMARY KEY,
 actor_id text NOT NULL REFERENCES auth_user(id),
 source_path text NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN ('queued','running','failed','staged')),
 attempts integer NOT NULL DEFAULT 0,
 source_records integer NOT NULL DEFAULT 0,
 evidence_records integer NOT NULL DEFAULT 0,
 unique_games integer NOT NULL DEFAULT 0,
 issue_count integer NOT NULL DEFAULT 0,
 manifest jsonb,
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE import_record (
 job_id text NOT NULL REFERENCES import_job(id),
 source_key text NOT NULL,
 kind text NOT NULL,
 source_line text NOT NULL,
 line_digest text NOT NULL,
 payload jsonb NOT NULL,
 preview jsonb,
 PRIMARY KEY(job_id,source_key)
);
CREATE TABLE import_issue (
 job_id text NOT NULL REFERENCES import_job(id),
 source_key text NOT NULL,
 code text NOT NULL,
 detail text NOT NULL,
 PRIMARY KEY(job_id,source_key,code),
 FOREIGN KEY(job_id,source_key) REFERENCES import_record(job_id,source_key)
);
CREATE TABLE import_attempt (
 id text PRIMARY KEY,
 job_id text NOT NULL REFERENCES import_job(id),
 actor_id text NOT NULL REFERENCES auth_user(id),
 action text NOT NULL,
 evidence jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION protect_import_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Import evidence is immutable'; END $$;
CREATE TRIGGER immutable_import_record BEFORE UPDATE OR DELETE ON import_record FOR EACH ROW EXECUTE FUNCTION protect_import_evidence();
CREATE TRIGGER immutable_import_issue BEFORE UPDATE OR DELETE ON import_issue FOR EACH ROW EXECUTE FUNCTION protect_import_evidence();
CREATE TRIGGER immutable_import_attempt BEFORE UPDATE OR DELETE ON import_attempt FOR EACH ROW EXECUTE FUNCTION protect_import_evidence();
CREATE FUNCTION protect_import_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR OLD.status='staged' OR NEW.id IS DISTINCT FROM OLD.id OR NEW.actor_id IS DISTINCT FROM OLD.actor_id OR NEW.source_path IS DISTINCT FROM OLD.source_path OR NEW.digest IS DISTINCT FROM OLD.digest OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Frozen import identity and contents cannot change';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_import_identity BEFORE UPDATE OR DELETE ON import_job FOR EACH ROW EXECUTE FUNCTION protect_import_job();
