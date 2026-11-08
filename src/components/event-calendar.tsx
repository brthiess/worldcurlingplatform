"use client";
import { useEffect, useState } from "react";
import { disciplines } from "@/domain/applications";
type CalendarEvent = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  location: string;
  origin: string;
  registrationStatus: string;
  seriesName: string;
  divisions: {
    id: string;
    name: string;
    discipline: string;
    rankingStatus: string;
  }[];
};
export function EventCalendar() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState(""),
    [discipline, setDiscipline] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [location, setLocation] = useState("");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/v1/public/calendar", { cache: "no-store" });
      if (!r.ok) throw new Error("The event calendar could not be refreshed.");
      const data = await r.json();
      setEvents(data.events);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const dateError = !!from && !!to && from > to;
  const shown = (events ?? []).filter(
    (e) =>
      (!search ||
        `${e.name} ${e.seriesName} ${e.location}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!discipline || e.divisions.some((d) => d.discipline === discipline)) &&
      (!location || e.location === location) &&
      (!from || e.endsOn >= from) &&
      (!to || e.startsOn <= to),
  );
  return (
    <main id="main">
      <p className="eyebrow">Competition calendar</p>
      <h1>Events</h1>
      <p className="muted">
        Admitted editions, with separate division and registration states.
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Edition, series or city"
          />
        </div>
        <div>
          <label htmlFor="event-discipline">Discipline</label>
          <select
            id="event-discipline"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
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
          <label htmlFor="event-location">Location</label>
          <select
            id="event-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
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
          <label htmlFor="event-from">From date</label>
          <input
            id="event-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="event-to">Through date</label>
          <input
            id="event-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            setSearch("");
            setDiscipline("");
            setFrom("");
            setTo("");
            setLocation("");
          }}
        >
          Clear filters
        </button>
      </form>
      {dateError && (
        <p className="error" role="alert">
          Through date must be on or after the from date.
        </p>
      )}
      {loading && (
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
                    · Admitted
                  </p>
                  <h2>
                    <a href={`/events/${e.id}`}>{e.name}</a>
                  </h2>
                  <p>
                    {e.location} · {e.seriesName}
                  </p>
                  <p className="muted">Registration: {e.registrationStatus}</p>
                  <ul className="division-links">
                    {e.divisions.map((d) => (
                      <li key={d.id}>
                        <a
                          href={`/events/${e.id}?division=${encodeURIComponent(d.id)}`}
                        >
                          {d.name}
                        </a>
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
        </>
      )}
    </main>
  );
}
