CREATE TABLE news_source (
 id text PRIMARY KEY, publisher text NOT NULL CHECK(length(publisher) BETWEEN 1 AND 100), feed_url text NOT NULL UNIQUE,
 approved boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 approved_by text REFERENCES auth_user(id), approved_at timestamptz,
 last_attempt_at timestamptz,last_success_at timestamptz,last_error text,
 CHECK(NOT approved OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
CREATE TABLE news_item (
 id text PRIMARY KEY, source_id text NOT NULL REFERENCES news_source(id), original_url text NOT NULL UNIQUE,
 title text NOT NULL, publisher text NOT NULL, published_at timestamptz NOT NULL, excerpt text NOT NULL,
 hidden boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1, fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE news_audit (
 id text PRIMARY KEY, actor_id text NOT NULL REFERENCES auth_user(id), action text NOT NULL,
 resource_id text NOT NULL, reason text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE news_fetch_attempt (
 id text PRIMARY KEY,source_id text NOT NULL REFERENCES news_source(id),job_id text NOT NULL,
 state text NOT NULL CHECK(state IN('succeeded','failed','skipped')),item_count integer NOT NULL DEFAULT 0,
 error text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION protect_news_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'News history is immutable'; END $$;
CREATE TRIGGER immutable_news_audit BEFORE UPDATE OR DELETE ON news_audit FOR EACH ROW EXECUTE FUNCTION protect_news_history();
CREATE TRIGGER immutable_news_fetch_attempt BEFORE UPDATE OR DELETE ON news_fetch_attempt FOR EACH ROW EXECUTE FUNCTION protect_news_history();
CREATE INDEX news_item_public ON news_item(published_at DESC) WHERE NOT hidden;
