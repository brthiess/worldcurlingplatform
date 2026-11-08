-- Fee revisions only: the opened capacity, format and admission contract is immutable.
CREATE TABLE division_fee_version (
 division_id text NOT NULL REFERENCES division_registration(division_id), version integer NOT NULL CHECK(version>0),
 fee_minor integer NOT NULL CHECK(fee_minor BETWEEN 0 AND 100000000),
 currency text NOT NULL CHECK(currency IN ('CAD','USD','EUR','GBP','CHF','JPY','KWD')),
 payment_terms text NOT NULL CHECK(length(trim(payment_terms))>0), reason text NOT NULL CHECK(length(trim(reason))>0),
 actor_id text REFERENCES auth_user(id), audit_id text REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(division_id,version)
);
INSERT INTO division_fee_version(division_id,version,fee_minor,currency,payment_terms,reason,created_at)
 SELECT division_id,1,fee_minor,currency,payment_terms,'Original immutable opened fee terms',opened_at FROM division_registration
 WHERE currency IN ('CAD','USD','EUR','GBP','CHF','JPY','KWD') AND fee_minor BETWEEN 0 AND 100000000;
CREATE TABLE entry_charge (
 entry_id text PRIMARY KEY REFERENCES event_entry(id), division_id text NOT NULL,
 fee_version integer NOT NULL, fee_minor integer NOT NULL CHECK(fee_minor BETWEEN 0 AND 100000000),
 currency text NOT NULL CHECK(currency IN ('CAD','USD','EUR','GBP','CHF','JPY','KWD')),
 payment_terms text NOT NULL CHECK(length(trim(payment_terms))>0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(division_id,fee_version) REFERENCES division_fee_version(division_id,version), UNIQUE(entry_id,division_id)
);
-- Previous admissions can be priced only from their retained original terms, never a new fee revision.
INSERT INTO entry_charge(entry_id,division_id,fee_version,fee_minor,currency,payment_terms)
 SELECT e.id,e.division_id,1,f.fee_minor,f.currency,f.payment_terms FROM event_entry e JOIN division_fee_version f ON f.division_id=e.division_id AND f.version=1 WHERE e.admission_version>0;
CREATE TABLE entry_charge_credit (
 id text PRIMARY KEY, entry_id text NOT NULL, division_id text NOT NULL, version integer NOT NULL CHECK(version>1),
 kind text NOT NULL CHECK(kind IN ('discount','waiver','external_receipt')),
 amount_minor integer NOT NULL CHECK(amount_minor BETWEEN 1 AND 100000000), currency text NOT NULL,
 reason text NOT NULL CHECK(length(trim(reason))>0), external_reference text,
 actor_id text NOT NULL REFERENCES auth_user(id), audit_id text NOT NULL UNIQUE REFERENCES audit_record(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(entry_id,division_id) REFERENCES entry_charge(entry_id,division_id), UNIQUE(entry_id,version),
 CHECK((kind='external_receipt' AND external_reference IS NOT NULL AND length(trim(external_reference))>0) OR (kind<>'external_receipt' AND external_reference IS NULL))
);
CREATE UNIQUE INDEX external_receipt_once_per_division ON entry_charge_credit(division_id,external_reference) WHERE kind='external_receipt';
CREATE TABLE entry_charge_command (
 actor_id text NOT NULL REFERENCES auth_user(id), request_id text NOT NULL, division_id text NOT NULL REFERENCES division(id),
 entry_id text REFERENCES event_entry(id), command jsonb NOT NULL, result jsonb NOT NULL,
 audit_id text NOT NULL UNIQUE REFERENCES audit_record(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(actor_id,request_id)
);
CREATE TRIGGER immutable_division_fee_version BEFORE UPDATE OR DELETE ON division_fee_version FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
CREATE TRIGGER immutable_entry_charge BEFORE UPDATE OR DELETE ON entry_charge FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
CREATE TRIGGER immutable_entry_charge_credit BEFORE UPDATE OR DELETE ON entry_charge_credit FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
CREATE TRIGGER immutable_entry_charge_command BEFORE UPDATE OR DELETE ON entry_charge_command FOR EACH ROW EXECUTE FUNCTION wcp004_preserve_application_history();
