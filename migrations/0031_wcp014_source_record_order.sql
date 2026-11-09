ALTER TABLE import_record ADD COLUMN ordinal integer CHECK(ordinal>0);
ALTER TABLE import_record ADD CONSTRAINT import_record_order UNIQUE(job_id,ordinal);
CREATE FUNCTION require_import_record_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.ordinal IS NULL THEN RAISE EXCEPTION 'An import record requires its frozen source ordinal'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER required_import_record_order BEFORE INSERT ON import_record FOR EACH ROW EXECUTE FUNCTION require_import_record_order();
