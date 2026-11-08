ALTER TABLE division ADD COLUMN entry_season text CHECK(entry_season ~ '^20[0-9]{2}-[0-9]{2}$'), ADD COLUMN entry_season_version integer NOT NULL DEFAULT 0 CHECK(entry_season_version>=0);
CREATE TABLE team_representation (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES auth_user(id), registration_id text NOT NULL REFERENCES season_registration(id),
 actions text[] NOT NULL CHECK(cardinality(actions)>0 AND actions <@ ARRAY['submit','amend','withdraw','payment']::text[]),
 created_by text NOT NULL REFERENCES auth_user(id), created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, revocation_reason text
);
CREATE TABLE team_representation_command (
 actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL, command jsonb NOT NULL,
 audit_id text NOT NULL UNIQUE REFERENCES authority_history(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,request_id)
);
CREATE TRIGGER preserve_representation_command BEFORE UPDATE OR DELETE ON team_representation_command FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
CREATE FUNCTION wcp008_preserve_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Representation grants are retained'; END IF;
 IF OLD.revoked_at IS NOT NULL OR NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id OR NEW.registration_id<>OLD.registration_id OR NEW.actions<>OLD.actions OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at OR NEW.revoked_at IS NULL OR NEW.revocation_reason IS NULL THEN RAISE EXCEPTION 'Representation scope is immutable; revoke and grant separately'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_representation_grant BEFORE UPDATE OR DELETE ON team_representation FOR EACH ROW EXECUTE FUNCTION wcp008_preserve_grant();
ALTER TABLE event_lineup_version ADD COLUMN representation_grant_id text REFERENCES team_representation(id), ADD COLUMN represented_season text;
