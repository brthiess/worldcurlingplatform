"use client";
import { useEffect, useState, useCallback } from "react";
import type { PublicDraw } from "@/modules/draws/draws";
import { DrawPanel } from "./draw-panel";
export function BracketView({ eventId }: { eventId: string }) {
  const [data, setData] = useState<PublicDraw | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(""),
    [view, setView] = useState("bracket"),
    [updated, setUpdated] = useState<Date | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const query = new URLSearchParams(window.location.search);
        let division = query.get("division");
        if (!division) {
          const r = await fetch(
            `/api/v1/public/events/${encodeURIComponent(eventId)}`,
            { cache: "no-store", signal },
          );
          if (!r.ok) throw new Error("Event is not available.");
          const e = await r.json();
          division = e.selectedDivisionId;
          if (!division)
            throw new Error("Select a division from the event scores page.");
        }
        const r = await fetch(
          `/api/v1/public/divisions/${encodeURIComponent(division!)}/draw`,
          { cache: "no-store", signal },
        );
        if (r.status === 404) {
          setData(null);
          setError("No published competition draw for this division yet.");
          return;
        }
        if (!r.ok) throw new Error("The draw could not be refreshed.");
        const next: PublicDraw = await r.json();
        if (next.division.eventId !== eventId)
          throw new Error("This division does not belong to this event.");
        setData(next);
        setError("");
        setUpdated(new Date());
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [eventId],
  );
  useEffect(() => {
    const controller = new AbortController();
    const sync = () => {
      const p = new URLSearchParams(window.location.search);
      setSelected(p.get("entry") ?? "");
      setView(p.get("view") === "list" ? "list" : "bracket");
    };
    sync();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 8000);
    window.addEventListener("popstate", sync);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("popstate", sync);
    };
  }, [load]);
  function choose(key: string, value: string) {
    const url = new URL(window.location.href);
    value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    window.history.pushState({}, "", url);
    key === "entry" ? setSelected(value) : setView(value);
  }
  const next = data?.games.find(
    (g) =>
      g.state !== "confirmed" &&
      (g.entryA === selected || g.entryB === selected),
  );
  return (
    <main id="main">
      <p className="eyebrow">Competition draw</p>
      <h1>Single knockout bracket</h1>
      <p>
        <a
          href={`/events/${encodeURIComponent(eventId)}${data ? "?division=" + encodeURIComponent(data.divisionId) : ""}`}
        >
          ← Event scores and schedule
        </a>
      </p>
      {error && (
        <p className={data ? "error" : "empty"} role="status">
          {data
            ? "Connection interrupted. Showing the last successful draw. "
            : ""}
          {error}{" "}
          <button className="secondary" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {!data && loading && !error && (
        <p className="loading" role="status">
          Loading stored competition draw…
        </p>
      )}
      {data && (
        <>
          <h2>
            {data.division.eventName} · {data.division.name}
          </h2>
          {data.division.origin === "fictional_demo" && (
            <p className="notice">
              Fictional demonstration. These entries and results are review
              fixtures.
            </p>
          )}
          <p className="legend">
            Published revision {data.version} · Template {data.template},
            version {data.templateVersion}. Last successful update{" "}
            {updated
              ? new Intl.DateTimeFormat("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: data.division.timezone,
                  timeZoneName: "short",
                }).format(updated)
              : "awaiting update"}{" "}
            · {data.division.timezone}.
          </p>
          <div className="draw-controls">
            <div>
              <label htmlFor="follow-entry">Follow a team</label>
              <select
                id="follow-entry"
                value={selected}
                onChange={(e) => choose("entry", e.target.value)}
              >
                <option value="">All teams</option>
                {data.seeds.map((s) => (
                  <option key={s.entryId} value={s.entryId}>
                    {s.seed}. {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div role="group" aria-label="Draw view">
              <button
                className="secondary"
                aria-pressed={view === "bracket"}
                onClick={() => choose("view", "bracket")}
              >
                Bracket
              </button>
              <button
                className="secondary"
                aria-pressed={view === "list"}
                onClick={() => choose("view", "list")}
              >
                Game list
              </button>
            </div>
          </div>
          {selected && (
            <p className="notice">
              {next ? (
                <>
                  <a href={`/games/${next.id}`}>
                    Next known assignment: {next.key} · {next.nameA} vs{" "}
                    {next.nameB}
                  </a>
                  {next.startsAt ? "" : " · Time not scheduled"}
                </>
              ) : (
                "No further participant assignment is known for this team."
              )}
            </p>
          )}
          <DrawPanel
            data={data}
            games={data.games}
            selected={selected}
            view={view}
            timezone={data.division.timezone}
          />
          <details>
            <summary>Published revision history</summary>
            <ol>
              {data.history.map((r) => (
                <li key={r.version}>
                  Revision {r.version} · {new Date(r.createdAt).toISOString()} ·{" "}
                  {r.state}
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </main>
  );
}
