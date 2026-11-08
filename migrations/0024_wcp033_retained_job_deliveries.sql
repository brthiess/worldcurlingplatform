CREATE TABLE event_calculation_delivery (
 id text PRIMARY KEY, assessment_id text NOT NULL REFERENCES event_assessment(id), queue_id uuid NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('failed','completed','blocked')), error text,
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_event_calculation_delivery BEFORE UPDATE OR DELETE ON event_calculation_delivery FOR EACH ROW EXECUTE FUNCTION preserve_wcp033_evidence();
CREATE TRIGGER preserve_event_calculation_job BEFORE DELETE ON event_calculation_job FOR EACH ROW EXECUTE FUNCTION preserve_wcp033_evidence();
