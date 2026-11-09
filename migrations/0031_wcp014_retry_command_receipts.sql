CREATE TABLE import_command (
 request_id text PRIMARY KEY,
 job_id text NOT NULL REFERENCES import_job(id),
 actor_id text NOT NULL REFERENCES auth_user(id),
 command_digest text NOT NULL CHECK(command_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_import_command BEFORE UPDATE OR DELETE ON import_command FOR EACH ROW EXECUTE FUNCTION protect_import_evidence();
