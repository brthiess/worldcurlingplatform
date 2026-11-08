"use client";
import { useEffect, useState, useRef } from "react";
import { venueFields } from "@/domain/scheduling";
import type { ScheduleSnapshot } from "@/modules/scheduling/schedule";
type Data = ScheduleSnapshot & {
  history?: {
    version: number;
    createdAt: string;
    reason: string;
    action: string;
  }[];
};
function time(instant: string, zone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(instant));
}
export function ScheduleWorkbench() {
  const loadSequence = useRef(0);
  const [acceptedFormRevision, setAcceptedFormRevision] = useState(0);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]),
    [eventId, setEventId] = useState(""),
    [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<unknown>(null),
    [stale, setStale] = useState(false),
    [sessionId, setSessionId] = useState(""),
    [gameId, setGameId] = useState("");
  async function load(id: string) {
    const sequence = ++loadSequence.current;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/v1/events/${encodeURIComponent(id)}/schedule`,
        { cache: "no-store" },
      );
      const next = await r.json();
      if (sequence !== loadSequence.current) return;
      if (!r.ok) throw new Error(next.error);
      setData(next);
      setAcceptedFormRevision((revision) => revision + 1);
      setError("");
      setStale(false);
      setPending(null);
      setStatus("Loaded accepted schedule.");
    } catch (e) {
      if (sequence === loadSequence.current)
        setError((e as Error).message || "Schedule could not be loaded.");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const r = await fetch("/api/v1/entries", { cache: "no-store" });
        const w = await r.json();
        if (!r.ok) throw new Error(w.error);
        const list = [
          ...new Map<string, { id: string; name: string }>(
            w.divisions.map((d: { eventId: string; eventName: string }) => [
              d.eventId,
              { id: d.eventId, name: d.eventName },
            ]),
          ).values(),
        ];
        if (!active) return;
        setEvents(list);
        const id =
          new URLSearchParams(window.location.search).get("event") ??
          list[0]?.id ??
          "";
        if (list.some((e) => e.id === id)) {
          setEventId(id);
          await load(id);
        } else {
          if (list.length)
            setError(
              "This edition is outside your editable scope. Choose an assigned edition.",
            );
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function save(command: unknown) {
    setBusy(true);
    setPending(command);
    setError("");
    setStatus("Saving schedule…");
    try {
      const r = await fetch(
        `/api/v1/events/${encodeURIComponent(eventId)}/schedule`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        },
      );
      const next = await r.json();
      if (!r.ok) {
        if (r.status < 500) {
          setPending(null);
          setStale(r.status === 409);
        }
        throw new Error(next.error);
      }
      setData(next);
      setAcceptedFormRevision((revision) => revision + 1);
      setPending(null);
      setStale(false);
      setStatus(
        `Saved schedule revision ${next.version}. ${next.conflicts.length ? `${next.conflicts.length} known conflict(s) need attention.` : "No known conflicts; review player coverage."}`,
      );
    } catch (e) {
      setError((e as Error).message || "Save could not be confirmed.");
      setStatus("Schedule save is unconfirmed.");
    } finally {
      setBusy(false);
    }
  }
  function submit(
    event: React.FormEvent<HTMLFormElement>,
    action: "session" | "assign",
  ) {
    event.preventDefault();
    if (!data) return;
    const f = new FormData(event.currentTarget);
    const base = {
      requestId: crypto.randomUUID(),
      expectedVersion: data.version,
      reason: String(f.get("reason")),
      action,
    };
    void save(
      action === "session"
        ? {
            ...base,
            session: {
              id: sessionId || crypto.randomUUID(),
              divisionId: String(f.get("division")),
              number: Number(f.get("number")),
              localStart: String(f.get("local")),
              utcOffset: String(f.get("offset")),
              durationMinutes: Number(f.get("duration")),
            },
          }
        : {
            ...base,
            gameId: String(f.get("game")),
            drawId: String(f.get("draw")),
            sheet: String(f.get("sheet")),
          },
    );
  }
  const session = data?.draws.find((d) => d.id === sessionId),
    fields =
      session && data
        ? venueFields(session.startsAt, data.event.timezone)
        : { local: "", offset: "" };
  const game = data?.games.find((g) => g.id === gameId) ?? data?.games[0];
  return (
    <main id="main" className="workspace schedule-workbench">
      <p className="eyebrow">Organizer operations</p>
      <h1>Draw scheduling</h1>
      <p>
        <a href="/admin">← Your workspace</a>
      </p>
      <p>
        Assign existing games to sessions and sheets. Times use the venue
        timezone and an explicit UTC offset.
      </p>
      {events.length > 0 && (
        <div className="calendar-filters">
          <div>
            <label htmlFor="schedule-event">Event edition</label>
            <select
              id="schedule-event"
              value={eventId}
              disabled={busy || !!pending}
              onChange={(e) => {
                setEventId(e.target.value);
                setData(null);
                setSessionId("");
                setGameId("");
                void load(e.target.value);
              }}
            >
              <option value="" disabled>
                Choose an assigned edition
              </option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {loading && <p role="status">Loading stored schedule…</p>}
      {error && (
        <div className="error" role="alert">
          {data ? "Showing the last accepted schedule. " : ""}
          {error}
          {!data && (
            <p>
              <a href="/admin">Sign in with an authorized organizer account</a>{" "}
              <button
                className="secondary"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </p>
          )}
        </div>
      )}
      {status && <p role="status">{status}</p>}
      {!!pending && !busy && (
        <div className="notice">
          <p>
            The save could not be confirmed. Retry the same request to recover
            its receipt safely.
          </p>
          <button onClick={() => void save(pending)}>Retry same save</button>
        </div>
      )}
      {stale && (
        <p className="notice">
          Your edit was not applied. Reload the accepted schedule before
          editing.
        </p>
      )}
      {!loading && !events.length && !error && (
        <p className="empty">
          No editable editions are assigned to this account.
        </p>
      )}
      {data && (
        <>
          <section className="roster-section">
            <h2>{data.event.name}</h2>
            <p>
              {data.event.venue} · Venue timezone:{" "}
              <strong>{data.event.timezone}</strong> · Schedule revision{" "}
              {data.version}
            </p>
            <button
              className="secondary"
              disabled={busy || !!pending || loading}
              onClick={() => void load(eventId)}
            >
              Reload accepted schedule
            </button>{" "}
            <a href={`/events/${eventId}`}>Public scores and schedule →</a>
            <p className="legend">
              A scheduled time passing never marks a game played. Moving
              sessions preserves actual participants, scores and frozen
              lineup/result evidence.
            </p>
          </section>
          <div className="schedule-forms">
            <section>
              <h2>Session time</h2>
              <label className="field-label" htmlFor="edit-session">
                Session to edit
              </label>
              <select
                id="edit-session"
                value={sessionId}
                disabled={busy || !!pending}
                onChange={(e) => setSessionId(e.target.value)}
              >
                <option value="">New session</option>
                {data.draws.map((d) => (
                  <option key={d.id} value={d.id}>
                    {data.divisions.find((v) => v.id === d.divisionId)?.name} ·
                    Draw {d.number}
                  </option>
                ))}
              </select>
              <form
                className="form-card"
                key={`${sessionId}-${acceptedFormRevision}`}
                onSubmit={(e) => submit(e, "session")}
                onChange={() => setStatus("Unsaved schedule edit.")}
              >
                <fieldset disabled={busy || !!pending || stale || loading}>
                  <legend>
                    {session ? "Revise session" : "Create session"}
                  </legend>
                  <label htmlFor="session-division">Division</label>
                  <select
                    id="session-division"
                    name="division"
                    defaultValue={session?.divisionId ?? data.divisions[0]?.id}
                    aria-readonly={!!session}
                    onChange={(e) => {
                      if (session) e.target.value = session.divisionId;
                    }}
                  >
                    {data.divisions
                      .filter((d) => !session || d.id === session.divisionId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                  <label htmlFor="session-number">Draw number</label>
                  <input
                    id="session-number"
                    name="number"
                    type="number"
                    min={1}
                    max={100000}
                    required
                    defaultValue={session?.number}
                  />
                  <label htmlFor="session-local">Venue date and time</label>
                  <input
                    id="session-local"
                    name="local"
                    type="datetime-local"
                    required
                    defaultValue={fields.local}
                  />
                  <label htmlFor="session-offset">UTC offset</label>
                  <input
                    id="session-offset"
                    name="offset"
                    placeholder="-06:00"
                    pattern={"[+\\-][0-9]{2}:[0-9]{2}"}
                    required
                    defaultValue={fields.offset}
                    aria-describedby="offset-help"
                  />
                  <p id="offset-help" className="legend">
                    Schedule edits use minute precision. Offset must match{" "}
                    {data.event.timezone} on this date. At a repeated
                    daylight-saving hour, choose the intended occurrence
                    explicitly.
                  </p>
                  <label htmlFor="session-duration">Duration in minutes</label>
                  <input
                    id="session-duration"
                    name="duration"
                    type="number"
                    min={15}
                    max={1440}
                    required
                    defaultValue={session?.durationMinutes ?? 120}
                  />
                  <label htmlFor="session-reason">Revision reason</label>
                  <input
                    id="session-reason"
                    name="reason"
                    maxLength={500}
                    required
                  />
                  <button type="submit" disabled={!data.divisions.length}>
                    Save session
                  </button>
                </fieldset>
              </form>
            </section>
            <section>
              <h2>Game assignment</h2>
              {!data.games.length ? (
                <p className="empty">
                  No existing games in this edition. Games are prepared
                  separately.
                </p>
              ) : (
                <form
                  key={acceptedFormRevision}
                  className="form-card"
                  onSubmit={(e) => submit(e, "assign")}
                  onChange={() => setStatus("Unsaved schedule edit.")}
                >
                  <fieldset disabled={busy || !!pending || stale || loading}>
                    <legend>Assign an existing game</legend>
                    <label htmlFor="assignment-game">Game</label>
                    <select
                      id="assignment-game"
                      name="game"
                      value={game?.id ?? ""}
                      onChange={(e) => setGameId(e.target.value)}
                    >
                      {data.games.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nameA} vs {g.nameB} · {g.state}
                        </option>
                      ))}
                    </select>
                    <div key={game?.id}>
                      <label htmlFor="assignment-draw">Target session</label>
                      <select
                        id="assignment-draw"
                        name="draw"
                        defaultValue={game?.drawId}
                      >
                        {data.draws
                          .filter((d) => d.divisionId === game?.divisionId)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              Draw {d.number} ·{" "}
                              {time(d.startsAt, data.event.timezone)}
                            </option>
                          ))}
                      </select>
                      <label htmlFor="assignment-sheet">Sheet</label>
                      <input
                        id="assignment-sheet"
                        name="sheet"
                        maxLength={16}
                        pattern={"[A-Za-z0-9 \\-]+"}
                        defaultValue={game?.sheet}
                        required
                      />
                    </div>
                    <label htmlFor="assignment-reason">Revision reason</label>
                    <input
                      id="assignment-reason"
                      name="reason"
                      maxLength={500}
                      required
                    />
                    <button type="submit">Save game assignment</button>
                  </fieldset>
                </form>
              )}
              <section className="roster-section">
                <h2>Known conflicts</h2>
                <p>
                  Overlapping intervals include their start and exclude their
                  end. All declared/defaulted playing members, including five
                  rotating regulars, are scheduling evidence; coaches are
                  excluded. This does not prove stone delivery.
                </p>
                {data.conflicts.length ? (
                  <ul className="schedule-conflicts">
                    {data.conflicts.map((c, i) => (
                      <li key={i}>
                        <strong>
                          {c.kind === "sheet"
                            ? `Sheet ${c.resource}`
                            : c.kind === "entry"
                              ? "Entry overlap"
                              : `Declared player overlap · ${data.games.find((g) => g.playerNames[c.resource])?.playerNames[c.resource] ?? c.resource}`}
                        </strong>
                        <ul>
                          {c.gameIds.map((id) => {
                            const g = data.games.find((g) => g.id === id)!;
                            return (
                              <li key={id}>
                                <a href={`/games/${id}`}>
                                  {g.nameA} vs {g.nameB}
                                </a>{" "}
                                ·{" "}
                                {
                                  data.divisions.find(
                                    (d) => d.id === g.divisionId,
                                  )?.name
                                }
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    No known sheet, entry or player overlaps. Unknown lineups
                    remain unchecked.
                  </p>
                )}
              </section>
            </section>
          </div>
          <section className="roster-section">
            <h2>Stored sessions and assignments</h2>
            {!data.draws.length ? (
              <p className="empty">No sessions scheduled yet.</p>
            ) : (
              <ol className="schedule-list">
                {data.draws.map((d) => (
                  <li key={d.id}>
                    <div>
                      <h3>
                        {
                          data.divisions.find((v) => v.id === d.divisionId)
                            ?.name
                        }{" "}
                        · Draw {d.number}
                      </h3>
                      <p>
                        {time(d.startsAt, data.event.timezone)} ·{" "}
                        {data.event.timezone} · {d.durationMinutes} minutes ·{" "}
                        {d.state}
                      </p>
                      <button
                        className="secondary"
                        disabled={busy || !!pending}
                        onClick={() => {
                          setSessionId(d.id);
                          document.getElementById("edit-session")?.focus();
                        }}
                      >
                        Edit draw {d.number}
                      </button>
                    </div>
                    <ul>
                      {data.games
                        .filter((g) => g.drawId === d.id)
                        .map((g) => (
                          <li key={g.id}>
                            <a href={`/games/${g.id}`}>
                              {g.nameA} vs {g.nameB}
                            </a>{" "}
                            · Sheet {g.sheet} · {g.state}
                            <p className="legend">{g.coverage}</p>
                          </li>
                        ))}
                    </ul>
                    {!data.games.some((g) => g.drawId === d.id) && (
                      <p>No games assigned.</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <details className="roster-section">
            <summary>Schedule revision history</summary>
            {data.history ? (
              <ol>
                {data.history.map((h) => (
                  <li key={h.version}>
                    Revision {h.version} · {h.reason} ·{" "}
                    {time(h.createdAt, data.event.timezone)}{" "}
                    {data.event.timezone}
                  </li>
                ))}
              </ol>
            ) : (
              <p>Reload the accepted schedule to read revision history.</p>
            )}
          </details>
        </>
      )}
    </main>
  );
}
