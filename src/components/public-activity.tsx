"use client";
import { useEffect, useState } from "react";
import { PublicLink } from "./public-context";
type Entry = {
  id: string;
  name: string;
  divisionId: string;
  divisionName: string;
  eventId: string;
  eventName: string;
  startsOn: string;
  endsOn: string;
  origin: string;
  evidence: string;
};
type Game = {
  id: string;
  nameA: string;
  nameB: string;
  totalA: number | null;
  totalB: number | null;
  state: string;
  phase: string;
  sheet: string;
  startsAt: string | null;
  updatedAt: string;
  timezone: string;
  divisionId: string;
  eventId: string;
  eventName: string;
};
type Activity = {
  entries: Entry[];
  teams?: { id: string; name: string }[];
  games?: Game[];
  nextGame?: Game | null;
};
const time = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value)) +
  " · " +
  timezone;
function Game({ game: g }: { game: Game }) {
  return (
    <li>
      <PublicLink href={`/games/${g.id}?division=${g.divisionId}`}>
        {g.nameA} vs {g.nameB}
      </PublicLink>
      <p>
        {g.state === "scheduled"
          ? "Upcoming · scores not yet recorded"
          : `${g.state} · ${g.totalA ?? "?"}–${g.totalB ?? "?"}`}{" "}
        · {g.phase}
      </p>
      <p className="muted">
        {g.sheet ? `Sheet ${g.sheet}` : "Sheet not assigned"} ·{" "}
        {g.startsAt ? time(g.startsAt, g.timezone) : "Time not scheduled"}. Last
        score record: {time(g.updatedAt, g.timezone)}
      </p>
      <PublicLink href={`/events/${g.eventId}?division=${g.divisionId}`}>
        {g.eventName}
      </PublicLink>
    </li>
  );
}
export function PublicActivity({
  kind,
  id,
}: {
  kind: "team" | "player";
  id: string;
}) {
  const [data, setData] = useState<Activity | null>(null),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await fetch(
        `/api/v1/public/activity?kind=${kind}&id=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error();
      setData(await r.json());
      setError("");
    } catch {
      setError("Known activity could not be refreshed.");
    }
  }
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, [kind, id]);
  return (
    <section className="roster-section">
      <h2>
        {kind === "player"
          ? "Known teams and event lineups"
          : "Games and event history"}
      </h2>
      {error && (
        <p className="error" role="status">
          {data ? "Showing last loaded activity. " : ""}
          {error}{" "}
          <button className="secondary" onClick={() => void load()}>
            Retry activity
          </button>
        </p>
      )}
      {!data && !error && <p role="status">Loading known activity…</p>}
      {data && (
        <>
          {kind === "player" && (
            <>
              <p className="muted">
                Core membership and declared event lineups are separate records.
                These associations do not verify actual game participation or
                stone delivery.
              </p>
              <ul>
                {data.teams?.map((t) => (
                  <li key={t.id}>
                    <PublicLink href={`/teams/${t.id}`}>{t.name}</PublicLink> ·
                    recorded core member
                  </li>
                ))}
              </ul>
              {!data.teams?.length && <p>No recorded core-team association.</p>}
            </>
          )}
          {kind === "team" && (
            <>
              <h3>Next known game</h3>
              {data.nextGame ? (
                <ul className="workspace-list">
                  <Game game={data.nextGame} />
                </ul>
              ) : (
                <p className="empty">
                  No next timed game is assigned to this core identity.
                  Unresolved slots are not known opponents.
                </p>
              )}
              <h3>Recorded games</h3>
              <ul className="workspace-list">
                {data.games?.map((g) => (
                  <Game key={g.id} game={g} />
                ))}
              </ul>
              {!data.games?.length && (
                <p className="empty">
                  No public games recorded for this core identity.
                </p>
              )}
            </>
          )}
          {kind === "player" && (
            <>
              <h3>Declared event lineups</h3>
              <ul className="workspace-list">
                {data.entries.map((e) => (
                  <li key={e.id}>
                    <PublicLink
                      href={`/entries/${e.id}?division=${e.divisionId}`}
                    >
                      {e.name}
                    </PublicLink>{" "}
                    · {e.evidence}
                    <p>
                      <PublicLink
                        href={`/events/${e.eventId}?division=${e.divisionId}`}
                      >
                        {e.eventName}
                      </PublicLink>{" "}
                      · {e.divisionName}
                    </p>
                    <p className="muted">
                      {e.startsOn} – {e.endsOn} ·{" "}
                      {e.origin === "fictional_demo"
                        ? "Fictional demonstration"
                        : e.origin === "historical_import"
                          ? "Imported historical record"
                          : "Newly operated event"}
                    </p>
                  </li>
                ))}
              </ul>
              {!data.entries.length && (
                <p className="empty">
                  No public event lineup records are available.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
