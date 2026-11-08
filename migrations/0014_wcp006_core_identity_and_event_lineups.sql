ALTER TABLE player ADD COLUMN identity_status text NOT NULL DEFAULT 'identified' CHECK(identity_status IN ('identified','provisional'));
CREATE TABLE team (
 id text PRIMARY KEY, discipline text NOT NULL CHECK(discipline IN ('men_four','women_four','mixed_doubles')),
 core_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE team_core_member (team_id text NOT NULL REFERENCES team(id), player_id text NOT NULL REFERENCES player(id), PRIMARY KEY(team_id,player_id));
CREATE TABLE season_registration (
 id text PRIMARY KEY, team_id text NOT NULL REFERENCES team(id), season text NOT NULL CHECK(season ~ '^20[0-9]{2}-[0-9]{2}$'),
 version integer NOT NULL CHECK(version>0), UNIQUE(team_id,season)
);
CREATE TABLE season_roster_version (
 registration_id text NOT NULL REFERENCES season_registration(id), version integer NOT NULL CHECK(version>0),
 display_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), actor_id text NOT NULL REFERENCES auth_user(id),
 PRIMARY KEY(registration_id,version)
);
CREATE TABLE season_roster_member (
 registration_id text NOT NULL, version integer NOT NULL, player_id text NOT NULL REFERENCES player(id),
 role text NOT NULL CHECK(role IN ('core','alternate','coach')), position text NOT NULL,
 PRIMARY KEY(registration_id,version,player_id), FOREIGN KEY(registration_id,version) REFERENCES season_roster_version(registration_id,version)
);
ALTER TABLE event_entry ADD COLUMN team_id text REFERENCES team(id), ADD COLUMN season_registration_id text REFERENCES season_registration(id), ADD COLUMN version integer NOT NULL DEFAULT 0 CHECK(version>=0);
CREATE TABLE event_lineup_version (
 entry_id text NOT NULL REFERENCES event_entry(id), version integer NOT NULL CHECK(version>0),
 team_id text REFERENCES team(id), registration_id text REFERENCES season_registration(id), registration_version integer,
 display_name text NOT NULL, core_known boolean NOT NULL, status text NOT NULL CHECK(status IN ('declared','provisional')),
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), actor_id text NOT NULL REFERENCES auth_user(id),
 request_id text NOT NULL, command_digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(entry_id,version), UNIQUE(actor_id,request_id),
 FOREIGN KEY(registration_id,registration_version) REFERENCES season_roster_version(registration_id,version),
 CHECK((registration_id IS NULL AND registration_version IS NULL) OR (registration_id IS NOT NULL AND registration_version IS NOT NULL))
);
CREATE TABLE event_lineup_core (
 entry_id text NOT NULL, version integer NOT NULL, player_id text NOT NULL REFERENCES player(id),
 PRIMARY KEY(entry_id,version,player_id), FOREIGN KEY(entry_id,version) REFERENCES event_lineup_version(entry_id,version)
);
CREATE TABLE event_lineup_member (
 entry_id text NOT NULL, version integer NOT NULL, ordinal integer NOT NULL CHECK(ordinal>=0), player_id text NOT NULL REFERENCES player(id),
 role text NOT NULL CHECK(role IN ('core','alternate','coach','substitute')), position text NOT NULL,
 participation text NOT NULL CHECK(participation IN ('declared','defaulted')),
 PRIMARY KEY(entry_id,version,player_id), UNIQUE(entry_id,version,ordinal), FOREIGN KEY(entry_id,version) REFERENCES event_lineup_version(entry_id,version)
);
CREATE FUNCTION preserve_wcp006_roster() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Team core and roster version history is immutable'; END $$;
CREATE TRIGGER immutable_team BEFORE UPDATE OR DELETE ON team FOR EACH ROW EXECUTE FUNCTION preserve_wcp006_roster();
CREATE TRIGGER immutable_team_core BEFORE UPDATE OR DELETE ON team_core_member FOR EACH ROW EXECUTE FUNCTION preserve_wcp006_roster();
CREATE TRIGGER immutable_season_version BEFORE UPDATE OR DELETE ON season_roster_version FOR EACH ROW EXECUTE FUNCTION preserve_wcp006_roster();
CREATE TRIGGER immutable_season_member BEFORE UPDATE OR DELETE ON season_roster_member FOR EACH ROW EXECUTE FUNCTION preserve_wcp006_roster();
CREATE TRIGGER immutable_event_version BEFORE UPDATE OR DELETE ON event_lineup_version FOR EACH ROW EXECUTE FUNCTION preserve_wcp006_roster();
CREATE TRIGGER immutable_event_core BEFORE UPDATE OR DELETE ON event_lineup_core FOR EACH ROW EXECUTE FUNCTION preserve_wcp006_roster();
CREATE TRIGGER immutable_event_member BEFORE UPDATE OR DELETE ON event_lineup_member FOR EACH ROW EXECUTE FUNCTION preserve_wcp006_roster();
