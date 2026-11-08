"use client";
import { EventEntryLinks } from "@/components/public-rosters";
import { useEffect, useState, useCallback, useRef } from "react";
import type { PublicEvent, PublicGame } from "@/modules/public/scores";
import { scoreCell } from "@/domain/scores";
function venueTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(instant));
}
export function ScoreTable({ game }: { game: PublicGame }) {
  const ends = Math.max(game.endsA.length, game.endsB.length);
  return (
    <table
      className="score-table"
      aria-label={`${game.nameA} versus ${game.nameB} line score`}
    >
      <thead>
        <tr>
          <th scope="col">Team</th>
          {Array.from({ length: ends }, (_, i) => (
            <th key={i} scope="col">
              {i + 1}
            </th>
          ))}
          <th scope="col" className="total">
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {(["a", "b"] as const).map((side) => (
          <tr key={side}>
            <th scope="row">
              {side === "a" ? game.nameA : game.nameB}
              {game.hammer === side && (
                <span className="hammer">Hammer · end {game.hammerEnd}</span>
              )}
            </th>
            {(side === "a" ? game.endsA : game.endsB).map((score, i) => {
              const cell = scoreCell(score);
              return (
                <td
                  key={i}
                  aria-label={`End ${i + 1}: ${cell.label}`}
                  title={
                    game.endHammer[i]
                      ? `Hammer in end ${i + 1}: ${game.endHammer[i] === "a" ? game.nameA : game.nameB}`
                      : undefined
                  }
                >
                  {cell.text}
                </td>
              );
            })}
            <td
              className="total"
              aria-label={`${game.state === "scheduled" ? "Upcoming total" : (side === "a" ? game.totalA : game.totalB) === null ? "Total unknown" : "Total"}`}
            >
              {(side === "a" ? game.totalA : game.totalB) ??
                (game.state === "scheduled" ? "·" : "?")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function ScoresView({
  eventId = "prairie-2026",
  gameId,
}: {
  eventId?: string;
  gameId?: string;
}) {
  const [data, setData] = useState<PublicEvent | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const defaultDraw = useRef<string | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setRefreshing(true);
      try {
        const response = await fetch(
          gameId
            ? `/api/v1/public/games/${encodeURIComponent(gameId)}`
            : `/api/v1/public/events/${encodeURIComponent(eventId)}${new URLSearchParams(window.location.search).get("division") ? "?division=" + encodeURIComponent(new URLSearchParams(window.location.search).get("division")!) : ""}`,
          { cache: "no-store", signal },
        );
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "This event or game is not available."
              : "Scores could not be refreshed.",
          );
        const next: PublicEvent = await response.json();
        defaultDraw.current = next.selection.selected;
        setData(next);
        setUpdated(new Date());
        setError("");
        setSelected((current) => {
          const requested = new URLSearchParams(window.location.search).get(
            "draw",
          );
          return next.draws.some((d) => d.id === (current ?? requested))
            ? (current ?? requested)
            : next.selection.selected;
        });
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError")
          setError(error.message);
      } finally {
        setRefreshing(false);
      }
    },
    [eventId, gameId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = setInterval(() => void load(controller.signal), 8000);
    const pop = () =>
      setSelected(
        new URLSearchParams(window.location.search).get("draw") ??
          defaultDraw.current,
      );
    window.addEventListener("popstate", pop);
    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("popstate", pop);
    };
  }, [load]);
  function choose(id: string) {
    setSelected(id);
    const url = new URL(window.location.href);
    url.searchParams.set("draw", id);
    window.history.pushState({}, "", url);
  }
  const draw = data?.draws.find((d) => d.id === selected);
  const games =
    data?.games.filter((g) =>
      gameId ? g.id === gameId : g.drawId === selected,
    ) ?? [];
  const next = data?.draws.find((d) => d.id === data.selection.next);
  return (
    <main id="main">
      <p className="eyebrow">Competition centre</p>
      <h1>{gameId ? "Game details" : "Scores"}</h1>
      {gameId && (
        <a
          className="back"
          href={
            data
              ? `/events/${data.event.id}?${new URLSearchParams({ ...(data.selectedDivisionId ? { division: data.selectedDivisionId } : {}), ...(data.games[0]?.drawId ? { draw: data.games[0].drawId } : {}) })}`
              : "/events"
          }
        >
          ← Back to scores
        </a>
      )}
      {error && (
        <div className="error" role="status">
          {data
            ? "Connection interrupted. Showing the last successful scores. "
            : ""}
          {error}{" "}
          <button className="secondary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {!data && !error && (
        <div className="loading" role="status">
          Loading stored scores…
        </div>
      )}
      {data && (
        <>
          <div className="notice">
            <strong>
              {data.event.origin === "fictional_demo"
                ? "Fictional demonstration."
                : data.event.origin === "historical_import"
                  ? "Imported historical record."
                  : "Newly operated event."}
            </strong>{" "}
            {data.event.origin === "fictional_demo"
              ? "Teams, results and schedules are review fixtures."
              : "Edition details are maintained by the organizing authority."}{" "}
            This is an initial offer, not an official live service.
          </div>
          <section className="event" aria-label={data.event.name}>
            <div className="event-head">
              <div>
                <p className="eyebrow">{data.event.division}</p>
                <h2>
                  <a
                    href={`/events/${data.event.id}?${new URLSearchParams({ ...(data.selectedDivisionId ? { division: data.selectedDivisionId } : {}), ...(selected ? { draw: selected } : {}) })}`}
                  >
                    {data.event.name}
                  </a>
                </h2>
                <p className="muted">
                  {data.event.venue || "Venue not confirmed"} ·{" "}
                  {data.event.location}
                </p>
                <p className="muted">
                  {data.event.startsOn} – {data.event.endsOn} ·{" "}
                  {data.event.format}
                </p>
              </div>
              <span className="badge">
                {data.event.origin === "fictional_demo"
                  ? "Demo scenario"
                  : "Admitted edition"}
              </span>
            </div>
            {!gameId && (
              <div className="edition-divisions">
                <h3>Divisions</h3>
                <p>
                  Public admission: admitted · Registration:{" "}
                  {data.event.registrationStatus}
                </p>
                <ul className="division-links">
                  {data.divisions.map((d) => (
                    <li key={d.id}>
                      <a
                        aria-current={
                          d.id === data.selectedDivisionId ? "page" : undefined
                        }
                        href={`/events/${data.event.id}?division=${encodeURIComponent(d.id)}`}
                      >
                        {d.name} · scores
                      </a>
                      <span> · Ranking eligibility: {d.rankingStatus}</span>
                    </li>
                  ))}
                </ul>
                {!data.selectedDivisionId && (
                  <p>Select a division to view its competition.</p>
                )}
              </div>
            )}
            {!gameId && data.draws.length > 0 && (
              <div className="draw-toolbar">
                <span>
                  <strong>
                    {selected === data.selection.selected
                      ? data.selection.label
                      : "Selected draw"}
                  </strong>
                  {draw &&
                    ` · ${venueTime(draw.startsAt, data.event.timezone)}`}
                </span>
                <div>
                  <label htmlFor="draw-select">Draw</label>
                  <select
                    id="draw-select"
                    value={selected ?? ""}
                    onChange={(event) => choose(event.target.value)}
                  >
                    {data.draws.map((d) => (
                      <option value={d.id} key={d.id}>
                        Draw {d.number} · {d.state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="games">
              {games.map((game) => (
                <article className="game-card" key={game.id}>
                  <div className="game-meta">
                    <span>
                      Sheet {game.sheet} · {game.phase}
                    </span>
                    <span
                      className={`badge ${game.state === "live" ? "live" : ""}`}
                    >
                      {game.state === "live"
                        ? "Live · provisional"
                        : game.state === "confirmed"
                          ? "Confirmed result"
                          : "Scheduled"}
                    </span>
                  </div>
                  <ScoreTable game={game} />
                  <div className="game-bottom">
                    <span>
                      {gameId
                        ? venueTime(
                            data.draws.find((d) => d.id === game.drawId)!
                              .startsAt,
                            data.event.timezone,
                          )
                        : game.hammer === null
                          ? "Hammer not recorded"
                          : "Hammer shown above"}
                    </span>
                    {!gameId && (
                      <a href={`/games/${game.id}`}>Game details →</a>
                    )}
                  </div>
                  {gameId && (
                    <p className="legend">
                      Result state: {game.state}. Last score record:{" "}
                      {venueTime(game.updatedAt, data.event.timezone)}.
                    </p>
                  )}
                  {gameId && (
                    <p className="legend">
                      Recorded hammer:{" "}
                      {game.endHammer.some(Boolean)
                        ? game.endHammer
                            .map((side, i) =>
                              side
                                ? `End ${i + 1}: ${side === "a" ? game.nameA : game.nameB}`
                                : null,
                            )
                            .filter(Boolean)
                            .join(" · ")
                        : "No end-specific hammer recorded"}
                      .
                    </p>
                  )}
                </article>
              ))}
            </div>
            {!games.length && data.selectedDivisionId && (
              <p className="empty">
                {data.draws.length
                  ? "No games are scheduled for this draw yet."
                  : "No games have been scheduled for this division yet."}
              </p>
            )}
            {!gameId && next && (
              <div className="next-draw">
                <strong>Next: Draw {next.number}</strong>
                <span>{venueTime(next.startsAt, data.event.timezone)}</span>
                <a
                  href={`?${new URLSearchParams({ ...(data.selectedDivisionId ? { division: data.selectedDivisionId } : {}), draw: next.id })}`}
                  onClick={(event) => {
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    choose(next.id);
                  }}
                >
                  View upcoming games →
                </a>
              </div>
            )}
          </section>
          <p className="legend">
            Score key: <strong>0</strong> played zero · <strong>?</strong>{" "}
            unknown · <strong>·</strong> upcoming · <strong>—</strong> not
            played. Times use venue timezone:{" "}
            <strong>{data.event.timezone}</strong>.
          </p>
          <div className="refresh">
            <span role="status">
              {error
                ? "Stale scores"
                : updated
                  ? `Updated ${venueTime(updated.toISOString(), data.event.timezone)} · refreshes every 8 seconds`
                  : "Waiting for scores"}
            </span>
            <button
              className="secondary"
              onClick={() => {
                if (!refreshing) void load();
              }}
              aria-disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh scores"}
            </button>
          </div>
          {!gameId && (
            <EventEntryLinks
              eventId={data.event.id}
              divisionId={data.selectedDivisionId ?? undefined}
            />
          )}
        </>
      )}
    </main>
  );
}
