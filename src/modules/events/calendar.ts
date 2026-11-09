import { pool } from "@/db";
import {
  eventStatus,
  filterEvents,
  type EventFilters,
} from "@/domain/discovery";
export async function publicCalendar(filters: EventFilters = {}) {
  const events = await pool.query(
    `SELECT e.id,e.name,e.starts_on::text AS "startsOn",e.ends_on::text AS "endsOn",e.location,e.city,e.country,e.venue,e.timezone,e.origin,e.registration_status AS "registrationStatus",s.name AS "seriesName" FROM event_edition e JOIN event_series s ON s.id=e.series_id WHERE e.published=true AND e.admission_status='approved' ORDER BY e.starts_on,e.id`,
  );
  const divisions = await pool.query(
    `SELECT d.id,d.event_id AS "eventId",d.name,d.discipline,d.ranking_status AS "rankingStatus",ARRAY(SELECT g.state FROM game g WHERE g.division_id=d.id) AS states FROM division d JOIN event_edition e ON e.id=d.event_id WHERE e.published=true AND e.admission_status='approved' ORDER BY d.name,d.id`,
  );
  return {
    events: filterEvents(
      events.rows.map((e) => ({
        ...e,
        status: eventStatus(
          divisions.rows
            .filter(
              (d) =>
                d.eventId === e.id &&
                (!filters.division || d.id === filters.division) &&
                (!filters.discipline || d.discipline === filters.discipline),
            )
            .flatMap((d) => d.states),
          e.startsOn,
          e.endsOn,
          new Intl.DateTimeFormat("en-CA", {
            timeZone: e.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date()),
        ),
        divisions: divisions.rows
          .filter((d) => d.eventId === e.id)
          .map(({ eventId: _, states, ...d }) => ({
            ...d,
            status: eventStatus(
              states,
              e.startsOn,
              e.endsOn,
              new Intl.DateTimeFormat("en-CA", {
                timeZone: e.timezone,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date()),
            ),
          })),
      })),
      filters,
    ),
  };
}
