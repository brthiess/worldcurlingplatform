-- Self-entry authorization records a submission; capacity/admission belongs to WCP-009.
ALTER TABLE event_entry ADD COLUMN entry_admission text NOT NULL DEFAULT 'organizer_recorded' CHECK(entry_admission IN ('organizer_recorded','submitted_pending'));
