"use client";
import { useEffect, useState, useRef } from "react";
import { saveTransition, type SaveState } from "@/domain/save-state";
import { validateEnd, type End } from "@/domain/scoring";
import type { Command } from "@/modules/scoring/commands";
import { ResultEditor } from "./result-editor";
import type { GameLineup } from "@/modules/scoring/lineups";
import type { PublicGame } from "@/modules/public/scores";
type Game = {
  id: string;
  entryA: string;
  entryB: string;
  lineupA: GameLineup | null;
  lineupB: GameLineup | null;
  results: PublicGame["results"];
  attention: { downstreamGameId: string }[];
  actorId: string;
  nameA: string;
  nameB: string;
  sheet: string;
  drawNumber: number;
  state: string;
  version: number;
  scoringSource: string;
  hammer: "a" | "b" | null;
  hammerEnd: number | null;
  endHammer: ("a" | "b" | null)[];
  totalA: number | null;
  totalB: number | null;
  ends: End[];
  history: {
    version: number;
    action: string;
    actorId: string;
    createdAt: string;
  }[];
};
type Edit = {
  endNumber: number;
  state: End["state"];
  a: string;
  b: string;
  hammer: "a" | "b" | null;
};
export function ScoringEditor({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null>(null),
    [edit, setEdit] = useState<Edit>({
      endNumber: 1,
      state: "played",
      a: "0",
      b: "0",
      hammer: null,
    });
  const [save, setSave] = useState<SaveState>("saved"),
    [error, setError] = useState(""),
    [online, setOnline] = useState(true),
    [pending, setPending] = useState<Command | null>(null),
    [baseVersion, setBaseVersion] = useState(0),
    [ready, setReady] = useState(false);
  const key = useRef(""),
    sending = useRef(false);
  const [resultBusy, setResultBusy] = useState(false);
  const url = `/api/v1/games/${encodeURIComponent(gameId)}/scoring`;
  async function read() {
    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    return data as Game;
  }
  useEffect(() => {
    let alive = true;
    const connection = () => setOnline(navigator.onLine);
    connection();
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    void read()
      .then((g) => {
        if (!alive) return;
        setGame(g);
        setBaseVersion(g.version);
        key.current = `scoring-draft:${g.actorId}:${gameId}`;
        const first = g.ends[0];
        setEdit({
          endNumber: 1,
          state: first.state,
          a: String(first.a ?? 0),
          b: String(first.b ?? 0),
          hammer: g.endHammer[0] ?? null,
        });
        try {
          const raw = sessionStorage.getItem(key.current);
          if (raw) {
            const stored = JSON.parse(raw);
            if (stored.save !== "saved" || stored.pending) {
              setEdit(stored.edit);
              setBaseVersion(stored.baseVersion);
              setPending(stored.pending);
              setSave(
                stored.pending
                  ? "uncertain"
                  : stored.save === "saved"
                    ? "saved"
                    : "unsent",
              );
            }
          }
        } catch {
          setError(
            "Browser draft recovery is unavailable; keep this screen open.",
          );
        }
        setReady(true);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
    // Game identity owns this editor and its draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(
        key.current,
        JSON.stringify({ edit, pending, save, baseVersion }),
      );
    } catch {
      setError("Browser draft storage is unavailable; keep this screen open.");
    }
  }, [edit, pending, save, baseVersion, ready]);
  function change(next: Partial<Edit>) {
    setEdit((e) => ({ ...e, ...next }));
    setSave((s) => saveTransition(s, "edit"));
    setError("");
  }
  function chooseEnd(n: number) {
    const e = game!.ends[n - 1] ?? { state: "upcoming", a: null, b: null };
    change({
      endNumber: n,
      state: e.state === "upcoming" ? "played" : e.state,
      a: String(e.a ?? 0),
      b: String(e.b ?? 0),
      hammer: game!.endHammer[n - 1] ?? null,
    });
  }
  async function send(action: Command["action"]) {
    if (sending.current) return;
    let command = pending;
    if (!command) {
      try {
        command = {
          requestId: crypto.randomUUID(),
          expectedVersion: baseVersion,
          action,
          hammer: edit.hammer,
        };
        if (action === "end") {
          command.endNumber = edit.endNumber;
          command.end = validateEnd({
            state: edit.state,
            a: edit.state === "played" && edit.a !== "" ? Number(edit.a) : null,
            b: edit.state === "played" && edit.b !== "" ? Number(edit.b) : null,
          });
        }
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    sending.current = true;
    setPending(command);
    setSave((s) => saveTransition(s, "send"));
    setError("");
    // Persist before sending: an interrupted response must retain the exact request.
    try {
      sessionStorage.setItem(
        key.current,
        JSON.stringify({
          edit,
          pending: command,
          save: "uncertain",
          baseVersion,
        }),
      );
    } catch {}
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
        signal: controller.signal,
      });
      const result = await r.json();
      if (!r.ok) {
        if (r.status >= 500) throw new Error(result.error);
        setSave((s) => saveTransition(s, "conflict"));
        setError(result.error);
        return;
      }
      setSave((s) => saveTransition(s, "acknowledged"));
      setPending(null);
      setBaseVersion(result.version);
      try {
        setGame(await read());
      } catch {
        setError(
          "Save acknowledged. Accepted game could not be refreshed; try reloading its version.",
        );
      }
    } catch {
      setSave((s) => saveTransition(s, "interrupted"));
      setError(
        "The server may have accepted this request. Retry the same request to confirm; your edit is retained.",
      );
    } finally {
      clearTimeout(timeout);
      sending.current = false;
    }
  }
  async function reload() {
    try {
      const g = await read();
      setGame(g);
      setBaseVersion(g.version);
      setPending(null);
      setSave((s) => saveTransition(s, "reload"));
      setError(
        "Accepted version loaded. Your edit is retained; compare it before saving.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const locked =
    save === "saving" ||
    save === "uncertain" ||
    save === "conflict" ||
    resultBusy;
  return (
    <main id="main" className="workspace">
      <a href="/admin">← Your workspace</a>
      <p className="eyebrow">Assigned scoring</p>
      <h1>Live score entry</h1>
      <p role="status">
        {online
          ? "Connection available · saves require acknowledgement"
          : "Connection interrupted · no automatic synchronization"}
      </p>
      {error && (
        <p role="alert" aria-label="Score entry error" className="error">
          {error}
        </p>
      )}
      {!game && !error && <p role="status">Loading assigned game…</p>}
      {!game && error && (
        <button onClick={() => window.location.reload()}>
          Retry loading game
        </button>
      )}
      {game && (
        <>
          <h2>
            {game.nameA} vs {game.nameB}
          </h2>
          <p>
            Game {game.id} · Draw {game.drawNumber} · Sheet {game.sheet} ·{" "}
            {game.state}
          </p>
          <p>
            Accepted total: {game.totalA ?? "?"} – {game.totalB ?? "?"} ·
            version {game.version}
          </p>
          <p role="status" className="notice">
            {save === "saved"
              ? `Saved · version ${baseVersion}`
              : save === "unsent"
                ? "Unsent edit · retained in this browser tab"
                : save === "saving"
                  ? "Saving · waiting for acknowledgement"
                  : save === "uncertain"
                    ? "Uncertain · request needs confirmation"
                    : "Edit not applied · accepted scores must be checked"}
          </p>
          <form
            className="form-card scoring-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send("end");
            }}
          >
            <fieldset
              disabled={
                locked ||
                game.scoringSource !== "manual" ||
                game.state === "confirmed"
              }
            >
              <legend>
                {game.state === "scheduled"
                  ? "Start game"
                  : game.state === "confirmed"
                    ? "Confirmed live scores"
                    : "Record or correct a live end"}
              </legend>
              <label htmlFor="hammer">Known hammer (selected end)</label>
              <select
                id="hammer"
                value={edit.hammer ?? "unknown"}
                onChange={(e) =>
                  change({
                    hammer:
                      e.target.value === "unknown"
                        ? null
                        : (e.target.value as "a" | "b"),
                  })
                }
              >
                <option value="unknown">Not recorded</option>
                <option value="a">{game.nameA}</option>
                <option value="b">{game.nameB}</option>
              </select>
              {game.state === "live" && (
                <>
                  <label htmlFor="end">End</label>
                  <select
                    id="end"
                    value={edit.endNumber}
                    onChange={(e) => chooseEnd(Number(e.target.value))}
                  >
                    {Array.from({ length: 20 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                        {i >= 8 ? " · further end" : ""}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="end-state">End state</label>
                  <select
                    id="end-state"
                    value={edit.state}
                    onChange={(e) =>
                      change({ state: e.target.value as End["state"] })
                    }
                  >
                    <option value="played">Played (0–0 is a blank)</option>
                    <option value="unknown">Score unknown</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="unplayed">Not played</option>
                  </select>
                  {edit.state === "played" && (
                    <div className="score-inputs">
                      <div>
                        <label htmlFor="points-a">{game.nameA} points</label>
                        <input
                          id="points-a"
                          inputMode="numeric"
                          type="number"
                          min="0"
                          max="8"
                          step="1"
                          required
                          value={edit.a}
                          onChange={(e) => change({ a: e.target.value })}
                        />
                      </div>
                      <div>
                        <label htmlFor="points-b">{game.nameB} points</label>
                        <input
                          id="points-b"
                          inputMode="numeric"
                          type="number"
                          min="0"
                          max="8"
                          step="1"
                          required
                          value={edit.b}
                          onChange={(e) => change({ b: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                  <p className="muted">
                    Only one side can score. A blank is played 0–0; unknown and
                    upcoming have no points.
                  </p>
                </>
              )}
            </fieldset>
            {game.scoringSource !== "manual" ? (
              <p>Manual scoring is not the active source.</p>
            ) : game.state === "scheduled" ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => void send("start")}
              >
                Start game
              </button>
            ) : game.state === "live" ? (
              <button type="submit" disabled={locked || save === "saved"}>
                Save end
              </button>
            ) : (
              <p>This result is confirmed. Live end entry is closed.</p>
            )}
            {save === "uncertain" && (
              <button
                className="secondary"
                type="button"
                onClick={() => void send(pending?.action ?? "end")}
              >
                Retry same request
              </button>
            )}
            {save !== "saving" && save !== "uncertain" && (
              <button
                className="secondary"
                type="button"
                onClick={() => void reload()}
              >
                Reload accepted version
              </button>
            )}
          </form>
          <p>
            <a href={`/games/${gameId}`}>Open public game →</a>
          </p>
          <ResultEditor
            game={game}
            disabled={save !== "saved"}
            onBusy={setResultBusy}
            onApplied={async () => {
              const g = await read();
              setGame(g);
              setBaseVersion(g.version);
            }}
          />
          <h2>Accepted history</h2>
          <ul className="workspace-list">
            {game.history.slice(0, 3).map((h) => (
              <li key={h.version}>
                Version {h.version} · {historyLabel(h.action)} · {h.actorId} ·{" "}
                {new Date(h.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
          {game.history.length > 3 && (
            <details>
              <summary>
                Earlier {game.history.length - 3} accepted changes
              </summary>
              <ul className="workspace-list">
                {game.history.slice(3).map((h) => (
                  <li key={h.version}>
                    Version {h.version} · {historyLabel(h.action)} · {h.actorId}{" "}
                    · {new Date(h.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!game.history.length && <p>No scoring commands accepted yet.</p>}
        </>
      )}
    </main>
  );
}
function historyLabel(action: string) {
  return (
    (
      {
        game_started: "Game started",
        end_saved: "End saved",
        result_confirmed: "Result confirmed",
        result_corrected: "Result corrected",
        game_lineup_recorded: "Game lineup recorded",
      } as Record<string, string>
    )[action] ?? action
  );
}
