ALTER TABLE game_lineup_version ADD COLUMN audit_id text REFERENCES audit_record(id) DEFERRABLE INITIALLY DEFERRED;
-- Earlier experimental records remain unchanged. New revisions must link to
-- their actual audit; the deferred FK permits the one atomic command transaction.
ALTER TABLE game_lineup_version ADD CONSTRAINT game_lineup_has_audit CHECK(audit_id IS NOT NULL) NOT VALID;
