CREATE FUNCTION guard_import_evidence_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status text;
BEGIN
 SELECT status INTO current_status FROM import_job WHERE id=NEW.job_id FOR SHARE;
 IF current_status='staged' THEN RAISE EXCEPTION 'Frozen import evidence cannot be appended'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER frozen_import_record_insert BEFORE INSERT ON import_record FOR EACH ROW EXECUTE FUNCTION guard_import_evidence_insert();
CREATE TRIGGER frozen_import_issue_insert BEFORE INSERT ON import_issue FOR EACH ROW EXECUTE FUNCTION guard_import_evidence_insert();
