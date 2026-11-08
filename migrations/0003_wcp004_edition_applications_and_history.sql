CREATE TABLE organizing_organization (id text PRIMARY KEY, name text NOT NULL, approval_administrator_id text NOT NULL REFERENCES auth_user(id));
CREATE TABLE organization_organizer (organization_id text NOT NULL REFERENCES organizing_organization(id), user_id text NOT NULL REFERENCES auth_user(id), PRIMARY KEY(organization_id,user_id));
ALTER TABLE event_series ADD COLUMN organization_id text REFERENCES organizing_organization(id);
ALTER TABLE event_edition ADD COLUMN organization_id text REFERENCES organizing_organization(id);
ALTER TABLE event_edition ADD COLUMN city text NOT NULL DEFAULT '';
ALTER TABLE event_edition ADD COLUMN country text NOT NULL DEFAULT '';
ALTER TABLE event_edition ADD COLUMN admission_status text NOT NULL DEFAULT 'draft' CHECK(admission_status IN ('draft','submitted','approved','rejected'));
UPDATE event_edition SET admission_status='approved' WHERE published=true;
ALTER TABLE event_edition ADD CONSTRAINT public_admission_matches CHECK(published=(admission_status='approved'));
ALTER TABLE event_edition ADD COLUMN responsible_administrator_id text REFERENCES auth_user(id);
ALTER TABLE event_edition ADD COLUMN registration_status text NOT NULL DEFAULT 'closed' CHECK(registration_status IN ('closed','open'));
ALTER TABLE event_edition ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version > 0);
ALTER TABLE division ADD COLUMN ranking_status text NOT NULL DEFAULT 'unresolved' CHECK(ranking_status IN ('unresolved','eligible','ineligible'));
CREATE TABLE event_application_history (
  id text PRIMARY KEY REFERENCES audit_record(id), event_id text NOT NULL REFERENCES event_edition(id), version integer NOT NULL,
  actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL, command_digest text NOT NULL,
  action text NOT NULL, reason text NOT NULL DEFAULT '', snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(event_id,version), UNIQUE(actor_id,request_id)
);
CREATE FUNCTION wcp004_preserve_application_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Application history is immutable'; END $$;
CREATE TRIGGER preserve_application_history BEFORE UPDATE OR DELETE ON event_application_history FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
