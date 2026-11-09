-- Entry-local factual evidence; historical cores, rosters and awards remain immutable.
CREATE TABLE identity_correction (
 id text PRIMARY KEY, actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL,
 entry_id text NOT NULL REFERENCES event_entry(id), reviewed_version integer NOT NULL CHECK(reviewed_version>0),
 from_player_id text NOT NULL REFERENCES player(id), to_player_id text NOT NULL REFERENCES player(id),
 reason text NOT NULL, source text NOT NULL, body_text text NOT NULL, command_digest text NOT NULL,
 outcome text NOT NULL CHECK(outcome IN('applied','issue')), evidence jsonb NOT NULL,
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actor_id,request_id), CHECK(from_player_id<>to_player_id)
);
CREATE TRIGGER immutable_identity_correction BEFORE UPDATE OR DELETE ON identity_correction FOR EACH ROW EXECUTE FUNCTION preserve_wcp006_roster();
