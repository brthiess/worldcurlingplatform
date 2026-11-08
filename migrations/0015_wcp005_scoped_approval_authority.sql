CREATE TABLE approval_delegation (
 id text PRIMARY KEY, authority_name text NOT NULL, reviewer_id text NOT NULL REFERENCES auth_user(id),
 scope jsonb NOT NULL, created_by text NOT NULL REFERENCES auth_user(id), created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz, revocation_reason text
);
ALTER TABLE event_edition ADD COLUMN approval_delegation_id text REFERENCES approval_delegation(id);
ALTER TABLE event_edition ADD COLUMN approval_authority_name text NOT NULL DEFAULT 'World Curling';
ALTER TABLE event_edition ADD COLUMN category text NOT NULL DEFAULT 'open';
CREATE TABLE authority_history (
 id text PRIMARY KEY REFERENCES audit_record(id), kind text NOT NULL, resource_id text NOT NULL,
 actor_id text NOT NULL REFERENCES auth_user(id), reason text NOT NULL, before_state jsonb, after_state jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER preserve_authority_history BEFORE UPDATE OR DELETE ON authority_history FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
