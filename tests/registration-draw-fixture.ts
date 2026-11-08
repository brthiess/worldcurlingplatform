import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { drawFixtureEvent } from "./draws-fixture";
export const configuredDrawTerms = {
  mode: "open",
  capacity: 16,
  requirements: "Four-player event lineup; readiness assessed separately",
  feeMinor: 0,
  currency: "CAD",
  paymentTerms: "No entry fee",
  paymentWindowMinutes: 60,
  format: "single_knockout",
  formatNotes:
    "Six or eight actual entries in seeded single elimination; six has two structural byes; no bronze game",
};
export async function registrationDrawFixture(pool: Pool, count = 6) {
  const event = await drawFixtureEvent(pool),
    id = randomUUID(),
    suffix = id.slice(0, 8),
    entries: string[] = [];
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format,entry_season) VALUES($1,$2,$3,'men_four','single_knockout','2026-27')",
    [id, event.id, `Configured field ${suffix}`],
  );
  for (let i = 0; i < count; i++) {
    const entryId = randomUUID();
    entries.push(entryId);
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name,entry_admission) VALUES($1,$2,$3,$4)",
      [
        entryId,
        id,
        `Configured team ${i + 1} ${suffix}`,
        i % 2 ? "submitted_pending" : "organizer_recorded",
      ],
    );
  }
  return { id, entries, suffix, eventId: event.id, cleanup: event.cleanup };
}
