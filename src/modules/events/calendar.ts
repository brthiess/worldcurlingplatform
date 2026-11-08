import { pool } from "@/db";
export async function publicCalendar() {
  const events = await pool.query(
    `SELECT e.id,e.name,e.starts_on::text AS "startsOn",e.ends_on::text AS "endsOn",e.location,e.city,e.country,e.venue,e.origin,e.registration_status AS "registrationStatus",s.name AS "seriesName" FROM event_edition e JOIN event_series s ON s.id=e.series_id WHERE e.published=true AND e.admission_status='approved' ORDER BY e.starts_on,e.id`,
  );
  const divisions = await pool.query(
    `SELECT d.id,d.event_id AS "eventId",d.name,d.discipline,d.ranking_status AS "rankingStatus" FROM division d JOIN event_edition e ON e.id=d.event_id WHERE e.published=true AND e.admission_status='approved' ORDER BY d.name,d.id`,
  );
  return {
    events: events.rows.map((e) => ({
      ...e,
      divisions: divisions.rows
        .filter((d) => d.eventId === e.id)
        .map(({ eventId: _, ...d }) => d),
    })),
  };
}
