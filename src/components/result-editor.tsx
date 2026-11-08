"use client";
import { useEffect, useRef, useState } from "react";
import type { Command } from "@/modules/scoring/commands";
import type { End } from "@/domain/scoring";
import type { Outcome, DifferenceMember } from "@/domain/results";
import type { PublicGame } from "@/modules/public/scores";
import type { GameLineup } from "@/modules/scoring/lineups";
import { GameResultHistory, LineupEvidence } from "./game-result-history";
type Game = {
  id: string;
  actorId: string;
  entryA: string;
  entryB: string;
  nameA: string;
  nameB: string;
  version: number;
  state: string;
  ends: End[];
  endHammer: ("a" | "b" | null)[];
  scoringSource: string;
  lineupA: GameLineup | null;
  lineupB: GameLineup | null;
  results: PublicGame["results"];
  attention: { downstreamGameId: string }[];
};
type Draft = {
  outcome: Outcome;
  winnerEntryId: string;
  reason: string;
  ends: End[];
  endHammer: ("a" | "b" | null)[];
  lineups: Partial<Record<"a" | "b", DifferenceMember[]>>;
  editing: boolean;
};
const draftFor = (g: Game): Draft => ({
  outcome: (g.results[0]?.result.outcome as Outcome) ?? "normal",
  winnerEntryId: g.results[0]?.result.winnerEntryId ?? "",
  reason: "",
  ends: g.ends,
  endHammer: g.endHammer,
  lineups: {},
  editing: g.state !== "confirmed",
});
export function ResultEditor({
  game,
  disabled,
  onApplied,
  onBusy,
}: {
  game: Game;
  disabled: boolean;
  onApplied: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => draftFor(game)),
    [version, setVersion] = useState(game.version),
    [status, setStatus] = useState("saved"),
    [pending, setPending] = useState<Command | null>(null),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const sending = useRef(false),
    key = `result-draft:${game.actorId}:${game.id}`;
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw);
        setDraft({
          ...draftFor(game),
          ...stored.draft,
          endHammer: Array.from(
            { length: stored.draft.ends.length },
            (_, i) => stored.draft.endHammer?.[i] ?? game.endHammer[i] ?? null,
          ),
        });
        setVersion(stored.version);
        setPending(stored.pending);
        setStatus(stored.pending ? "uncertain" : stored.status);
      }
    } catch {
      setError("Browser recovery unavailable; keep this screen open.");
    }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ draft, version, pending, status }),
        );
      } catch {
        setError("Browser recovery unavailable; keep this screen open.");
      }
  }, [draft, version, pending, status, ready, key]);
  useEffect(() => {
    onBusy(status !== "saved");
  }, [status, onBusy]);
  useEffect(() => {
    if (ready && status === "saved") {
      setVersion(game.version);
      setDraft(draftFor(game));
    }
  }, [game.version, ready]);
  const locked =
    disabled ||
    ["saving", "uncertain", "conflict"].includes(status) ||
    game.scoringSource !== "manual";
  function change(next: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...next }));
    setStatus("unsent");
    setError("");
  }
  async function send(action: Command["action"], extra: Partial<Command> = {}) {
    if (sending.current) return;
    const command = pending ?? {
      requestId: crypto.randomUUID(),
      expectedVersion: version,
      hammer: null,
      action,
      ...(action === "confirm" || action === "correct"
        ? {
            outcome: draft.outcome,
            winnerEntryId: draft.winnerEntryId,
            reason: draft.reason,
            ...(action === "correct"
              ? {
                  ends: draft.ends,
                  endHammer: draft.endHammer,
                  lineups: draft.lineups,
                }
              : {}),
          }
        : {}),
      ...extra,
    };
    sending.current = true;
    setPending(command);
    setStatus("saving");
    setError("");
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          draft,
          version,
          pending: command,
          status: "uncertain",
        }),
      );
    } catch {}
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(`/api/v1/games/${game.id}/scoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
        signal: controller.signal,
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status >= 500) throw Error();
        setStatus("conflict");
        setError(data.error);
        return;
      }
      setPending(null);
      setVersion(data.version);
      setStatus("saved");
      if (command.action === "confirm" || command.action === "correct")
        setDraft((d) => ({ ...d, editing: false }));
      try {
        await onApplied();
      } catch {
        setError(
          "Save acknowledged. Reload accepted game to view its current result.",
        );
      }
    } catch {
      setStatus("uncertain");
      setError(
        "The server may have accepted this request. Retry the same result request to confirm.",
      );
    } finally {
      clearTimeout(timeout);
      sending.current = false;
    }
  }
  async function reload() {
    try {
      await onApplied();
      const r = await fetch(`/api/v1/games/${game.id}/scoring`, {
        cache: "no-store",
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setVersion(data.version);
      setPending(null);
      setStatus("unsent");
      setError(
        "Accepted version loaded. Your result draft is retained; compare before saving.",
      );
    } catch {
      setError("Accepted result could not be loaded. Your draft is retained.");
    }
  }
  async function loadPlayers() {
    try {
      const r = await fetch("/api/v1/public/players");
      if (!r.ok) throw Error();
      const data = await r.json();
      setPlayers(data.players ?? data);
    } catch {
      setError(
        "Players could not be loaded. Retry opening lineup differences.",
      );
    }
  }
  function lineup(side: "a" | "b") {
    const current = side === "a" ? game.lineupA : game.lineupB;
    const rows =
      draft.lineups[side] ??
      current?.members
        .filter((m) => m.role !== "coach")
        .slice(0, 5)
        .map((m) => ({ playerId: m.playerId, position: m.position })) ??
      [];
    return (
      <fieldset disabled={locked}>
        <legend>
          {side === "a" ? game.nameA : game.nameB} game difference
        </legend>
        <p>
          Record only a difference. Leaving this closed uses the event lineup
          automatically.
        </p>
        {rows.map((m, i) => (
          <div key={i} className="lineup-edit">
            <label htmlFor={`game-player-${side}-${i}`}>
              Player {i + 1} · side {side.toUpperCase()}
            </label>
            <select
              id={`game-player-${side}-${i}`}
              value={m.playerId}
              onChange={(e) =>
                change({
                  lineups: {
                    ...draft.lineups,
                    [side]: rows.map((r, j) =>
                      j === i ? { ...r, playerId: e.target.value } : r,
                    ),
                  },
                })
              }
            >
              <option value="">Choose player</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label>
              Position {i + 1} · side {side.toUpperCase()}
              <input
                maxLength={60}
                value={m.position}
                onChange={(e) =>
                  change({
                    lineups: {
                      ...draft.lineups,
                      [side]: rows.map((r, j) =>
                        j === i ? { ...r, position: e.target.value } : r,
                      ),
                    },
                  })
                }
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                change({
                  lineups: {
                    ...draft.lineups,
                    [side]: rows.filter((_, j) => j !== i),
                  },
                })
              }
            >
              Remove player {i + 1} · side {side.toUpperCase()}
            </button>
          </div>
        ))}
        {rows.length < 5 && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              change({
                lineups: {
                  ...draft.lineups,
                  [side]: [...rows, { playerId: "", position: "" }],
                },
              })
            }
          >
            Add game player · side {side.toUpperCase()}
          </button>
        )}
        {game.state !== "confirmed" && (
          <button
            type="button"
            disabled={draft.lineups[side] === undefined}
            onClick={() => void send("lineup", { side, members: rows })}
          >
            Save lineup difference · side {side.toUpperCase()}
          </button>
        )}
      </fieldset>
    );
  }
  return (
    <section aria-label="Game result" className="result-editor">
      <h2>Game result</h2>
      <p className="notice">
        {game.results.length > 1 || game.results[0]?.result.correction
          ? `Corrected final · ${game.results[0].result.outcome}`
          : game.state === "confirmed"
            ? `Final · ${game.results[0]?.result.outcome ?? "legacy result"}`
            : game.state === "scheduled"
              ? "Provisional · scheduled game"
              : "Provisional · live scores"}
      </p>
      {game.attention.length > 0 && (
        <p role="status" className="notice">
          Organizer attention required: affected assignments{" "}
          {game.attention.map((a) => a.downstreamGameId).join(", ")}. Recorded
          participants and results are preserved.
        </p>
      )}
      <details>
        <summary>Current lineup evidence</summary>
        <LineupEvidence name={game.nameA} lineup={game.lineupA} />
        <LineupEvidence name={game.nameB} lineup={game.lineupB} />
      </details>
      {error && (
        <p role="alert" aria-label="Result error" className="error">
          {error}
        </p>
      )}
      <p role="status">
        {status === "saved"
          ? `Result ready · accepted version ${version}`
          : status === "unsent"
            ? "Unsent result edit · retained in this tab"
            : status === "saving"
              ? "Saving result · waiting for acknowledgement"
              : status === "uncertain"
                ? "Uncertain result · retry required"
                : "Result not applied · review accepted version"}
      </p>
      {!draft.editing && (
        <button
          type="button"
          disabled={locked}
          onClick={() => change({ editing: true })}
        >
          Correct confirmed result
        </button>
      )}
      {draft.editing && (
        <form
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            void send(game.state === "confirmed" ? "correct" : "confirm");
          }}
        >
          <fieldset disabled={locked}>
            <legend>
              {game.state === "confirmed" ? "Correct result" : "Confirm result"}
            </legend>
            <label htmlFor="result-outcome">Result outcome</label>
            <select
              id="result-outcome"
              value={draft.outcome}
              onChange={(e) => change({ outcome: e.target.value as Outcome })}
            >
              <option value="normal">
                Normal · winner from complete score
              </option>
              <option value="conceded">Conceded · retain played scores</option>
              <option value="forfeit">Forfeit · no invented final score</option>
            </select>
            <label htmlFor="result-winner">Result winner</label>
            <select
              id="result-winner"
              required
              value={draft.winnerEntryId}
              onChange={(e) => change({ winnerEntryId: e.target.value })}
            >
              <option value="">Choose winner</option>
              <option value={game.entryA}>{game.nameA}</option>
              <option value={game.entryB}>{game.nameB}</option>
            </select>
            <label htmlFor="result-reason">Result reason</label>
            <textarea
              id="result-reason"
              maxLength={500}
              required={
                game.state === "confirmed" || draft.outcome !== "normal"
              }
              value={draft.reason}
              onChange={(e) => change({ reason: e.target.value })}
            />
            <p className="muted">
              {game.state === "confirmed"
                ? "Corrections need a reason. The original result stays available; no second approval is required."
                : "Upcoming ends become not played on confirmation. Unknown scores are never filled in."}
            </p>
            {game.state === "confirmed" && (
              <details>
                <summary>Correct line score</summary>
                {draft.ends.map((end, i) => (
                  <fieldset key={i}>
                    <legend>End {i + 1}</legend>
                    <label>
                      Corrected end {i + 1} state
                      <select
                        value={end.state}
                        onChange={(e) =>
                          change({
                            ends: draft.ends.map((r, j) =>
                              j === i
                                ? {
                                    state: e.target.value as End["state"],
                                    a: e.target.value === "played" ? 0 : null,
                                    b: e.target.value === "played" ? 0 : null,
                                  }
                                : r,
                            ),
                          })
                        }
                      >
                        <option value="played">Played</option>
                        <option value="unknown">Unknown</option>
                        <option value="unplayed">Not played</option>
                      </select>
                    </label>
                    {end.state === "played" &&
                      (["a", "b"] as const).map((side) => (
                        <label key={side}>
                          {side === "a" ? game.nameA : game.nameB} corrected end{" "}
                          {i + 1}
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={8}
                            required
                            value={end[side] ?? ""}
                            onChange={(e) =>
                              change({
                                ends: draft.ends.map((r, j) =>
                                  j === i
                                    ? {
                                        ...r,
                                        [side]:
                                          e.target.value === ""
                                            ? null
                                            : Number(e.target.value),
                                      }
                                    : r,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    <label htmlFor={`corrected-hammer-${i}`}>
                      Corrected end {i + 1} hammer
                    </label>
                    <select
                      id={`corrected-hammer-${i}`}
                      value={draft.endHammer[i] ?? "unknown"}
                      onChange={(e) =>
                        change({
                          endHammer: draft.endHammer.map((h, j) =>
                            j === i
                              ? e.target.value === "unknown"
                                ? null
                                : (e.target.value as "a" | "b")
                              : h,
                          ),
                        })
                      }
                    >
                      <option value="unknown">Not recorded</option>
                      <option value="a">{game.nameA}</option>
                      <option value="b">{game.nameB}</option>
                    </select>
                  </fieldset>
                ))}
                {draft.ends.length < 20 && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      change({
                        ends: [
                          ...draft.ends,
                          { state: "unplayed", a: null, b: null },
                        ],
                        endHammer: [...draft.endHammer, null],
                      })
                    }
                  >
                    Add correction end
                  </button>
                )}
              </details>
            )}
            <details
              onToggle={(e) => {
                if (e.currentTarget.open && !players.length) void loadPlayers();
              }}
            >
              <summary>Record lineup differences</summary>
              {lineup("a")}
              {lineup("b")}
            </details>
            <button type="submit">
              {game.state === "confirmed"
                ? "Save correction"
                : "Confirm result"}
            </button>
          </fieldset>
        </form>
      )}
      {status === "uncertain" && (
        <button type="button" onClick={() => void send(pending!.action)}>
          Retry same result request
        </button>
      )}
      {status === "conflict" && (
        <button type="button" onClick={() => void reload()}>
          Review accepted result version
        </button>
      )}
      {(status === "unsent" || status === "conflict") && (
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setDraft(draftFor(game));
            setVersion(game.version);
            setPending(null);
            setStatus("saved");
            setError("");
          }}
        >
          Discard result draft
        </button>
      )}
      <GameResultHistory results={game.results} />
    </section>
  );
}
