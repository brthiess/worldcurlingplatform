CREATE TABLE player_photo_asset (
 id text PRIMARY KEY, digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 byte_size integer NOT NULL CHECK(byte_size>0), width integer NOT NULL CHECK(width>0), height integer NOT NULL CHECK(height>0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE player_photo_submission (
 id text PRIMARY KEY, player_id text NOT NULL REFERENCES player(id), user_id text NOT NULL REFERENCES auth_user(id),
 asset_id text NOT NULL UNIQUE REFERENCES player_photo_asset(id), source_digest text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
 reason text, reviewed_by text REFERENCES auth_user(id), reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='pending' AND reason IS NULL AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status<>'pending' AND length(reason)>=5 AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX player_photo_pending ON player_photo_submission(player_id) WHERE status='pending';
ALTER TABLE player ADD COLUMN photo_asset_id text REFERENCES player_photo_asset(id);
CREATE FUNCTION protect_player_photo_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR TG_TABLE_NAME='player_photo_asset' THEN RAISE EXCEPTION 'Photo content/history is immutable'; END IF;
 IF OLD.status<>'pending' OR NEW.id<>OLD.id OR NEW.player_id<>OLD.player_id OR NEW.user_id<>OLD.user_id OR NEW.asset_id<>OLD.asset_id OR NEW.source_digest<>OLD.source_digest OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Photo content/history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_photo_asset BEFORE UPDATE OR DELETE ON player_photo_asset FOR EACH ROW EXECUTE FUNCTION protect_player_photo_history();
CREATE TRIGGER immutable_photo_submission BEFORE UPDATE OR DELETE ON player_photo_submission FOR EACH ROW EXECUTE FUNCTION protect_player_photo_history();
