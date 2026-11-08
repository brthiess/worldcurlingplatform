CREATE TABLE division_registration (
 division_id text PRIMARY KEY REFERENCES division(id), version integer NOT NULL CHECK(version>0),
 mode text NOT NULL CHECK(mode IN ('open','reviewed','invited')), capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 256),
 requirements text NOT NULL CHECK(length(trim(requirements))>0), fee_minor integer NOT NULL CHECK(fee_minor>=0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 payment_terms text NOT NULL CHECK(length(trim(payment_terms))>0), payment_window_minutes integer NOT NULL CHECK(payment_window_minutes BETWEEN 1 AND 43200),
 format text NOT NULL, format_notes text NOT NULL CHECK(length(trim(format_notes))>0), opened_at timestamptz NOT NULL
);
ALTER TABLE event_entry ADD COLUMN admission_state text NOT NULL DEFAULT 'pending' CHECK(admission_state IN ('pending','invited','held','accepted','expired','waitlisted')),
 ADD COLUMN admission_version integer NOT NULL DEFAULT 0 CHECK(admission_version>=0),
 ADD COLUMN reservation_deadline timestamptz,
 ADD CONSTRAINT admission_deadline CHECK((admission_state='held' AND reservation_deadline IS NOT NULL) OR (admission_state<>'held' AND reservation_deadline IS NULL));
CREATE INDEX wcp009_capacity ON event_entry(division_id,admission_state,reservation_deadline);
CREATE TABLE registration_command (
 actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL, division_id text NOT NULL REFERENCES division(id),
 entry_id text REFERENCES event_entry(id), command jsonb NOT NULL, result jsonb NOT NULL,
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,request_id)
);
CREATE TRIGGER immutable_registration_command BEFORE UPDATE OR DELETE ON registration_command FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
CREATE TRIGGER immutable_registration_terms BEFORE UPDATE OR DELETE ON division_registration FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
