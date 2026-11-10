CREATE TABLE overall_ranking_run (
 id text PRIMARY KEY, discipline text NOT NULL CHECK(discipline IN ('men_four','women_four')),
 effective_date date NOT NULL, version integer NOT NULL CHECK(version>0), replaces_id text REFERENCES overall_ranking_run(id),
 manifest_contents text NOT NULL CHECK(jsonb_typeof(manifest_contents::jsonb)='object'), manifest_digest text NOT NULL CHECK(manifest_digest ~ '^[a-f0-9]{64}$'),
 result_contents text NOT NULL CHECK(jsonb_typeof(result_contents::jsonb)='object'), result_digest text NOT NULL CHECK(result_digest ~ '^[a-f0-9]{64}$'),
 actor_id text NOT NULL REFERENCES auth_user(id), audit_id text NOT NULL UNIQUE REFERENCES audit_record(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(discipline,effective_date,version)
);
CREATE TABLE overall_ranking_receipt (
 actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL, command_digest text NOT NULL,
 run_id text NOT NULL REFERENCES overall_ranking_run(id), action text NOT NULL CHECK(action IN ('calculate','replay')),
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,request_id)
);
CREATE FUNCTION preserve_wcp034_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Overall draft evidence is immutable'; END $$;
CREATE TRIGGER immutable_overall_ranking_run BEFORE UPDATE OR DELETE ON overall_ranking_run FOR EACH ROW EXECUTE FUNCTION preserve_wcp034_evidence();
CREATE TRIGGER immutable_overall_ranking_receipt BEFORE UPDATE OR DELETE ON overall_ranking_receipt FOR EACH ROW EXECUTE FUNCTION preserve_wcp034_evidence();
