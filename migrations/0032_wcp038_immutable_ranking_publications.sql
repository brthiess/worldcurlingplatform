CREATE TABLE ranking_publication (
 id text PRIMARY KEY,
 list_key text NOT NULL,
 list_definition jsonb NOT NULL CHECK(jsonb_typeof(list_definition)='object'),
 effective_date date NOT NULL, version integer NOT NULL CHECK(version>0),
 previous_id text REFERENCES ranking_publication(id),
 replaces_id text REFERENCES ranking_publication(id),
 producer text NOT NULL, producer_record_id text NOT NULL,
 private_contents text NOT NULL CHECK(jsonb_typeof(private_contents::jsonb)='object'),
 private_digest text NOT NULL CHECK(private_digest ~ '^[a-f0-9]{64}$'),
 public_contents text NOT NULL CHECK(jsonb_typeof(public_contents::jsonb)='object'),
 public_digest text NOT NULL CHECK(public_digest ~ '^[a-f0-9]{64}$'),
 actor_id text NOT NULL REFERENCES auth_user(id),
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id),
 published_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(list_key,version), UNIQUE(producer,producer_record_id)
);
CREATE TABLE ranking_publication_receipt (
 actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL,
 command_digest text NOT NULL CHECK(command_digest ~ '^[a-f0-9]{64}$'),
 publication_id text NOT NULL REFERENCES ranking_publication(id),
 action text NOT NULL CHECK(action IN ('approve','replay')),
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,request_id)
);
CREATE FUNCTION preserve_wcp038_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Ranking publication evidence is immutable'; END $$;
CREATE TRIGGER immutable_ranking_publication BEFORE UPDATE OR DELETE ON ranking_publication FOR EACH ROW EXECUTE FUNCTION preserve_wcp038_evidence();
CREATE TRIGGER immutable_ranking_publication_receipt BEFORE UPDATE OR DELETE ON ranking_publication_receipt FOR EACH ROW EXECUTE FUNCTION preserve_wcp038_evidence();
