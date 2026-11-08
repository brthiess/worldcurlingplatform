CREATE TABLE player (
 id text PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 origin text NOT NULL CHECK(origin IN ('fictional_demo','operated','historical_import')),
 biography text NOT NULL DEFAULT '' CHECK(length(biography)<=500),
 handedness text CHECK(handedness IN ('left','right')), version integer NOT NULL DEFAULT 0 CHECK(version>=0)
);
CREATE TABLE player_account_link (
 player_id text PRIMARY KEY REFERENCES player(id), user_id text NOT NULL UNIQUE REFERENCES auth_user(id),
 linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE player_claim (
 id text PRIMARY KEY, player_id text NOT NULL REFERENCES player(id), user_id text NOT NULL REFERENCES auth_user(id),
 message text NOT NULL CHECK(length(message) BETWEEN 10 AND 1000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_by text REFERENCES auth_user(id), reviewed_at timestamptz,
 reason text CHECK(length(reason) BETWEEN 5 AND 1000),
 CHECK((status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND reason IS NULL) OR
 (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND reason IS NOT NULL))
);
CREATE UNIQUE INDEX player_claim_one_pending ON player_claim(user_id,player_id) WHERE status='pending';
CREATE TABLE player_profile_history (
 id text PRIMARY KEY, player_id text NOT NULL REFERENCES player(id), actor_id text NOT NULL REFERENCES auth_user(id),
 version integer NOT NULL, biography text NOT NULL, handedness text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(player_id,version)
);
CREATE FUNCTION preserve_player_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'Player decision and profile history is immutable'; END $$;
CREATE TRIGGER immutable_player_profile_history BEFORE UPDATE OR DELETE ON player_profile_history FOR EACH ROW EXECUTE FUNCTION preserve_player_history();
CREATE FUNCTION preserve_player_claim() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Claims cannot be deleted'; END IF;
 IF OLD.status<>'pending' OR NEW.id<>OLD.id OR NEW.player_id<>OLD.player_id OR NEW.user_id<>OLD.user_id OR NEW.message<>OLD.message OR NEW.created_at<>OLD.created_at OR NEW.status='pending' THEN RAISE EXCEPTION 'Claim history is immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER immutable_player_claim BEFORE UPDATE OR DELETE ON player_claim FOR EACH ROW EXECUTE FUNCTION preserve_player_claim();
