ALTER TABLE event_assessment ADD CONSTRAINT event_assessment_input_pair UNIQUE(id,digest);
ALTER TABLE event_assessment_result ADD CONSTRAINT event_assessment_result_exact_input FOREIGN KEY(assessment_id,input_digest) REFERENCES event_assessment(id,digest);
CREATE FUNCTION protect_wcp033_job_association() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.assessment_id<>OLD.assessment_id THEN RAISE EXCEPTION 'Calculation job input association is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fixed_calculation_job_input BEFORE UPDATE ON event_calculation_job FOR EACH ROW EXECUTE FUNCTION protect_wcp033_job_association();
CREATE FUNCTION protect_wcp033_revision_chain() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.version=1 AND NEW.replaces_id IS NOT NULL) OR (NEW.version>1 AND NOT EXISTS(SELECT 1 FROM event_assessment a WHERE a.id=NEW.replaces_id AND a.division_id=NEW.division_id AND a.version=NEW.version-1)) THEN RAISE EXCEPTION 'Assessment must directly replace its own division predecessor'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER direct_assessment_predecessor BEFORE INSERT ON event_assessment FOR EACH ROW EXECUTE FUNCTION protect_wcp033_revision_chain();
