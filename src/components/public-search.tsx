"use client";
import { useEffect, useState } from "react";
import { PublicLink, usePublicFilters } from "./public-context";
import { FavoriteButton, useFavorites } from "./favorites";
import type { Favorite } from "@/domain/discovery";
type Result = Favorite & { name: string; description: string };
export function PublicSearch() {
  const { filters, change } = usePublicFilters(),
    { favorites, toggle, warning } = useFavorites();
  const [data, setData] = useState<Result[] | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch("/api/v1/public/calendar", { cache: "no-store" }),
        fetch("/api/v1/public/teams", { cache: "no-store" }),
        fetch("/api/v1/public/players", { cache: "no-store" }),
      ]);
      if (responses.some((r) => !r.ok)) throw new Error();
      const [calendar, teams, players] = await Promise.all(
        responses.map((r) => r.json()),
      );
      setData([
        ...calendar.events.map(
          (e: {
            id: string;
            name: string;
            location: string;
            startsOn: string;
            origin: string;
          }) => ({
            kind: "event",
            id: e.id,
            name: e.name,
            description: `${e.startsOn} · ${e.location} · ${e.origin === "fictional_demo" ? "Fictional demonstration" : e.origin === "historical_import" ? "Imported historical record" : "Newly operated event"}`,
          }),
        ),
        ...teams.map(
          (t: {
            id: string;
            name: string;
            discipline: string;
            core: { name: string }[];
          }) => ({
            kind: "team",
            id: t.id,
            name: t.name,
            description: `${t.discipline} · core: ${t.core.map((p) => p.name).join(", ")}`,
          }),
        ),
        ...players.map(
          (p: {
            id: string;
            name: string;
            origin: string;
            identityStatus: string;
          }) => ({
            kind: "player",
            id: p.id,
            name: p.name,
            description: `${p.identityStatus} identity · ${p.origin === "fictional_demo" ? "Fictional demonstration" : p.origin === "historical_import" ? "Imported historical record" : "Sport record"}`,
          }),
        ),
      ]);
      setError("");
    } catch {
      setError("Search records could not be refreshed.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const q = (filters.q ?? "").trim().toLowerCase(),
    only = filters.favorites === "1";
  const shown = (data ?? []).filter(
    (r) =>
      (!only || favorites.some((f) => f.kind === r.kind && f.id === r.id)) &&
      (!filters.kind || r.kind === filters.kind) &&
      `${r.name} ${r.description}`.toLowerCase().includes(q),
  );
  const missing = favorites.filter(
    (f) => data && !data.some((r) => r.kind === f.kind && r.id === f.id),
  );
  return (
    <main id="main">
      <p className="eyebrow">Public discovery</p>
      <h1>Search &amp; favorites</h1>
      <p>
        Search admitted events, core-composition teams and known players.
        Favorites stay in this browser without an account or synchronization.
      </p>
      <form className="calendar-filters" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="discovery-query">
            Search events, teams and players
          </label>
          <input
            id="discovery-query"
            value={filters.q ?? ""}
            onChange={(e) => change({ q: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="discovery-kind">Record type</label>
          <select
            id="discovery-kind"
            value={filters.kind ?? ""}
            onChange={(e) => change({ kind: e.target.value })}
          >
            <option value="">All records</option>
            <option value="event">Events</option>
            <option value="team">Teams</option>
            <option value="player">Players</option>
          </select>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={only}
            onChange={(e) => change({ favorites: e.target.checked ? "1" : "" })}
          />{" "}
          Favorites only
        </label>
        <button
          className="secondary"
          type="button"
          onClick={() => change({ q: "", kind: "", favorites: "" })}
        >
          Clear search
        </button>
      </form>
      {warning && (
        <p className="notice" role="status">
          {warning}
        </p>
      )}
      {error && (
        <p className="error" role="status">
          {data ? "Showing last loaded records. " : ""}
          {error}{" "}
          <button className="secondary" onClick={() => void load()}>
            Retry search
          </button>
        </p>
      )}
      {!data && !error && <p role="status">Loading public records…</p>}
      {data && (
        <>
          <p role="status">{shown.length} records found</p>
          <ul className="workspace-list">
            {shown.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <p className="eyebrow">{r.kind}</p>
                <h2>
                  <PublicLink
                    href={`/${r.kind === "event" ? "events" : r.kind === "team" ? "teams" : "players"}/${r.id}`}
                  >
                    {r.name}
                  </PublicLink>
                </h2>
                <p className="muted">{r.description}</p>
                <FavoriteButton kind={r.kind} id={r.id} />
              </li>
            ))}
          </ul>
          {!shown.length && (
            <p className="empty">
              {only
                ? "No saved favorites match this search."
                : "No public records match this search."}
            </p>
          )}
          {only &&
            missing.map((f) => (
              <div className="notice" key={`${f.kind}-${f.id}`}>
                Saved {f.kind} record unavailable · {f.id}. Its identity has not
                been replaced.{" "}
                <button className="secondary" onClick={() => toggle(f)}>
                  Remove unavailable favorite
                </button>
              </div>
            ))}
          <button
            className="secondary"
            onClick={() => void load()}
            aria-disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh search"}
          </button>
        </>
      )}
    </main>
  );
}
