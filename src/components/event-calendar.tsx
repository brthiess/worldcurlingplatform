"use client";
import { useEffect, useState } from "react";
import { disciplines } from "@/domain/applications";
import { filterEvents } from "@/domain/discovery";
import { PublicLink, usePublicFilters } from "./public-context";
import { FavoriteButton } from "./favorites";
type CalendarEvent = {
  id: string;
  name: string;
  seriesName: string;
  location: string;
  startsOn: string;
  endsOn: string;
  origin: string;
  status: string;
  registrationStatus: string;
  divisions: {
    id: string;
    name: string;
    discipline: string;
    rankingStatus: string;
    status:string;
  }[];
};
export function EventCalendar() {
  const { filters: f, change } = usePublicFilters();
  const [events, setEvents] = useState<CalendarEvent[] | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [updated, setUpdated] = useState("");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/v1/public/calendar", { cache: "no-store" });
      if (!r.ok) throw new Error("The event calendar could not be refreshed.");
      setEvents((await r.json()).events);
      setError("");
      setUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, []);
  const dateError = !!f.from && !!f.to && f.from > f.to;
  const shown = filterEvents(events ?? [], f);
  return (
    <main id="main">
      <p className="eyebrow">Competition calendar and archive</p>
      <h1>Events</h1>
      <p className="muted">
        Admitted editions, with separate division and registration states.
        Status follows recorded play; elapsed time alone does not establish a
        live or completed competition.
      </p>
      {error && (
        <p className="error" role="status">
          {events ? "Showing the last loaded calendar. " : ""}
          {error}{" "}
          <button className="secondary" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      <form className="calendar-filters" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="event-search">Search events</label>
          <input
            id="event-search"
            value={f.q ?? ""}
            onChange={(e) => change({ q: e.target.value })}
            placeholder="Edition, series or city"
          />
        </div>
        <div>
          <label htmlFor="event-discipline">Discipline</label>
          <select
            id="event-discipline"
            value={f.discipline ?? ""}
            onChange={(e) =>
              change({ discipline: e.target.value, division: "" })
            }
          >
            <option value="">All disciplines</option>
            {Object.entries(disciplines).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="event-division">Division</label>
          <select
            id="event-division"
            value={f.division ?? ""}
            onChange={(e) => change({ division: e.target.value })}
          >
            <option value="">All divisions</option>
            {(events ?? []).flatMap((e) =>
              e.divisions
                .filter((d) => !f.discipline || d.discipline === f.discipline)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {e.name} · {d.name}
                  </option>
                )),
            )}
          </select>
        </div>
        <div>
          <label htmlFor="event-location">Location</label>
          <select
            id="event-location"
            value={f.location ?? ""}
            onChange={(e) => change({ location: e.target.value })}
          >
            <option value="">All locations</option>
            {[...new Set((events ?? []).map((e) => e.location))]
              .sort()
              .map((l) => (
                <option key={l}>{l}</option>
              ))}
          </select>
        </div>
        <div>
          <label htmlFor="event-status">Competition status</label>
          <select
            id="event-status"
            value={f.status ?? ""}
            onChange={(e) => change({ status: e.target.value })}
          >
            <option value="">All statuses</option>
            <option value="live">Live</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="unknown">Not established</option>
          </select>
        </div>
        <div>
          <label htmlFor="event-from">From date</label>
          <input
            id="event-from"
            type="date"
            value={f.from ?? ""}
            onChange={(e) => change({ from: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="event-to">Through date</label>
          <input
            id="event-to"
            type="date"
            value={f.to ?? ""}
            onChange={(e) => change({ to: e.target.value })}
          />
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() =>
            change({
              q: "",
              discipline: "",
              division: "",
              location: "",
              from: "",
              to: "",
              status: "",
            })
          }
        >
          Clear filters
        </button>
      </form>
      {dateError && (
        <p className="error" role="alert">
          Through date must be on or after the from date.
        </p>
      )}
      {loading && !events && (
        <p role="status" className="loading">
          Loading admitted editions…
        </p>
      )}
      {events && !dateError && (
        <>
          <p className="muted" role="status">
            {shown.length} {shown.length === 1 ? "edition" : "editions"} found
          </p>
          <ul className="calendar-list">
            {shown.map((e) => (
              <li key={e.id}>
                <div className="calendar-date">
                  <strong>{e.startsOn}</strong>
                  <span>to {e.endsOn}</span>
                </div>
                <div>
                  <p className="eyebrow">
                    {e.origin === "fictional_demo"
                      ? "Fictional demonstration"
                      : e.origin === "historical_import"
                        ? "Imported historical record"
                        : "Newly operated event"}{" "}
                    ·{" "}
                    {e.status === "unknown"
                      ? "Competition status not established"
                      : e.status}
                  </p>
                  <h2>
                    <PublicLink href={`/events/${e.id}`}>{e.name}</PublicLink>
                  </h2>
                  <p>
                    {e.location} · {e.seriesName}
                  </p>
                  <p className="muted">Registration: {e.registrationStatus}</p>
                  <FavoriteButton kind="event" id={e.id} />
                  <ul className="division-links">
                    {e.divisions
                      .filter(
                        (d) =>
                          (!f.discipline || d.discipline === f.discipline) &&
                          (!f.division || d.id === f.division),
                      )
                      .map((d) => (
                        <li key={d.id}>
                          <PublicLink href={`/events/${e.id}?division=${d.id}`}>
                            {d.name}
                          </PublicLink>
                          <span>
                            {" "}
                            ·{" "}
                            {
                              disciplines[
                                d.discipline as keyof typeof disciplines
                              ]
                            }{" "}
                            · Ranking: {d.rankingStatus}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
          {!shown.length && (
            <p className="empty">No admitted editions match these filters.</p>
          )}
          {!events.some((e) => e.origin === "historical_import") && (
            <p className="muted">
              No imported historical editions are available in this database.
            </p>
          )}
          <div className="refresh">
            <span role="status">
              {error ? "Stale calendar" : `Last successful update: ${updated}`}
            </span>
            <button
              className="secondary"
              onClick={() => void load()}
              aria-disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh calendar"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
