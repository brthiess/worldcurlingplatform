"use client";
import { useEffect, useState } from "react";
import {
  emptySportingEvidence,
  type SportingEvidence,
  type Side,
  type Placement,
  type LSD,
} from "@/domain/disciplines";
import { canonicalEntryCommand } from "@/domain/entries";
import { AuthorityRecovery, useAuthorityCommand } from "./authority-command";
import { SportingEvidenceView } from "./sporting-evidence";
import type { Command } from "@/modules/scoring/commands";
import type { End } from "@/domain/scoring";
type Game = {
  id: string;
  actorId: string;
  version: number;
  discipline: string;
  state: string;
  scoringSource: string;
  nameA: string;
  nameB: string;
  ends: End[];
  endHammer: ("a" | "b" | null)[];
  sporting?: SportingEvidence;
  results: { result: { outcome: string; winnerEntryId: string } }[];
};
export function SportingEditor({
  game,
  disabled,
  onApplied,
  onBusy,
}: {
  game: Game;
  disabled: boolean;
  onApplied: () => Promise<void>;
  onBusy: (v: boolean) => void;
}) {
  const [draft, setDraft] = useState<SportingEvidence>(
      () => game.sporting ?? emptySportingEvidence(),
    ),
    [dirty, setDirty] = useState(false),
    [reason, setReason] = useState(""),
    [players, setPlayers] = useState<{ id: string; name: string }[]>([]),
    [error, setError] = useState(""),
    [loadingPlayers, setLoadingPlayers] = useState(false),
    [playersLoaded, setPlayersLoaded] = useState(false),
    [notice, setNotice] = useState(""),
    [open, setOpen] = useState(false);
  const path = `/api/v1/games/${game.id}/scoring`;
  const recovery = useAuthorityCommand(
    `wcp-sporting:${game.actorId}:${game.id}`,
    game.actorId,
    async () => {
      await onApplied();
      setDirty(false);
    },
    async (saved) => {
      if (saved.actorId !== game.actorId || saved.path !== path) return false;
      const body = JSON.parse(saved.body),
        r = await fetch(
          path + "?requestId=" + encodeURIComponent(body.requestId),
          { headers: { "X-WCP-Actor": game.actorId }, cache: "no-store" },
        );
      if (!r.ok) return false;
      const receipt = await r.json();
      if (
        !receipt ||
        receipt.actorId !== game.actorId ||
        receipt.path !== saved.path ||
        canonicalEntryCommand(receipt.command) !==
          canonicalEntryCommand(body) ||
        receipt.response.version !== body.expectedVersion + 1 ||
        receipt.response.requestId !== body.requestId
      )
        return false;
      await onApplied();
      setDirty(false);
      return true;
    },
  );
  useEffect(() => {
    onBusy(dirty || !!recovery.pending || recovery.busy);
  }, [dirty, recovery.pending, recovery.busy, onBusy]);
  useEffect(() => {
    if (!dirty && !recovery.pending)
      setDraft(game.sporting ?? emptySportingEvidence());
  }, [game.version, dirty, recovery.pending]);
  async function loadPlayers() {
    setLoadingPlayers(true);
    try {
      const r = await fetch("/api/v1/public/players");
      if (!r.ok) throw Error();
      const v = await r.json();
      setPlayers(v.players ?? v);
      setPlayersLoaded(true);
      setError("");
    } catch {
      setError(
        "Players could not be loaded. Close and reopen measurements to retry.",
      );
    } finally {
      setLoadingPlayers(false);
    }
  }
  function change(next: Partial<SportingEvidence>) {
    setDraft((d) => ({ ...d, ...next }));
    setDirty(true);
  }
  function observation(side: Side, i: number, next: Partial<LSD>) {
    change({
      lsd: {
        ...draft.lsd,
        [side]: draft.lsd[side].map((p, j) =>
          j === i
            ? {
                ...p,
                unit: p.unit ?? "cm",
                ...next,
                rotation: i === 0 ? "cw" : "ccw",
              }
            : p,
        ),
      },
    });
  }
  const locked = disabled || recovery.locked || game.scoringSource !== "manual";
  function playerSelect(
    value: string | null,
    onChange: (id: string) => void,
    label: string,
  ) {
    return (
      <label key={label}>
        {label}
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Not recorded</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <section aria-label="Record sporting evidence">
      <details
        open={open}
        onToggle={(e) => {
          setOpen(e.currentTarget.open);
          if (e.currentTarget.open && !players.length) void loadPlayers();
        }}
      >
        <summary>Measurements, placement and observed participation</summary>
        <p role="status">
          {dirty
            ? "Unsent sporting evidence edit · save to record these observations"
            : "Showing accepted sporting evidence"}
        </p>
        {loadingPlayers && <p role="status">Loading player choices…</p>}
        {playersLoaded && !players.length && (
          <p>
            No player records are available for measurements or observed
            participation.
          </p>
        )}
        <SportingEvidenceView
          evidence={game.sporting}
          names={{ a: game.nameA, b: game.nameB }}
          ends={game.ends}
          hammers={game.endHammer}
        />
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button
          type="button"
          disabled={recovery.locked || disabled}
          onClick={async () => {
            try {
              await onApplied();
              setNotice(
                "Accepted sporting version reloaded. Your draft is retained; compare before saving.",
              );
            } catch {
              setError(
                "Accepted sporting evidence could not be refreshed. Your draft is retained.",
              );
            }
          }}
        >
          Reload accepted sporting version
        </button>
        <p>
          Record facts separately from the core, season, event and game lineups.
          {game.discipline === "mixed_doubles"
            ? "Mixed doubles uses two players, no alternate, five deliveries plus the positioned stone."
            : "Four-player observed participation has three or four players; timed absence and alternate eligibility remain official determinations."}{" "}
          No gender is inferred from player records.
        </p>
        <form
          className="form-card"
          onSubmit={(e) => {
            e.preventDefault();
            const result = game.results[0]?.result;
            if (game.state === "confirmed" && !result) {
              setError(
                "Correct the legacy result first to record an explicit outcome and winner.",
              );
              return;
            }
            const command: Command = {
              requestId: crypto.randomUUID(),
              expectedVersion: game.version,
              action: game.state === "confirmed" ? "correct" : "evidence",
              hammer: null,
              sporting: {
                ...draft,
                participation: {
                  a: {
                    ...draft.participation.a,
                    playerIds: draft.participation.a.playerIds.filter(Boolean),
                  },
                  b: {
                    ...draft.participation.b,
                    playerIds: draft.participation.b.playerIds.filter(Boolean),
                  },
                },
              },
              ...(result && game.state === "confirmed"
                ? {
                    outcome: result.outcome as Command["outcome"],
                    winnerEntryId: result.winnerEntryId,
                    reason,
                    ends: game.ends,
                    endHammer: game.endHammer,
                  }
                : {}),
            };
            void recovery.submit(path, command, "Sporting evidence saved.");
          }}
        >
          <fieldset disabled={locked}>
            <legend>Profile and observations</legend>
            <label>
              Regulation ends
              <select
                value={draft.regulationEnds}
                disabled={game.state !== "scheduled"}
                onChange={(e) =>
                  change({ regulationEnds: Number(e.target.value) as 8 | 10 })
                }
              >
                <option value={8}>8 ends</option>
                {game.discipline !== "mixed_doubles" && (
                  <option value={10}>10 ends</option>
                )}
              </select>
            </label>
            <label>
              Competition stage / measurement source context
              <input
                value={draft.stage}
                maxLength={500}
                required
                onChange={(e) => change({ stage: e.target.value })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.lsdRequired}
                onChange={(e) => change({ lsdRequired: e.target.checked })}
              />{" "}
              LSD required for this game/stage
            </label>
            {(["a", "b"] as const).map((side) => (
              <fieldset key={side}>
                <legend>
                  {side === "a" ? game.nameA : game.nameB} measurements
                </legend>
                {draft.lsd[side].map((p, i) => (
                  <fieldset key={i}>
                    <legend>
                      LSD {i + 1} ·{" "}
                      {i === 0 ? "clockwise" : "counter-clockwise"} · side{" "}
                      {side.toUpperCase()}
                    </legend>
                    <label>
                      Observation {side.toUpperCase()} {i + 1}
                      <select
                        value={p.kind}
                        onChange={(e) =>
                          observation(side, i, {
                            kind: e.target.value as LSD["kind"],
                          })
                        }
                      >
                        <option value="unknown">Unknown</option>
                        <option value="measured-centre">
                          Measured to centre
                        </option>
                        <option value="measured-edge">
                          Measured nearest edge
                        </option>
                        <option value="assigned-maximum">
                          Rule assigned maximum
                        </option>
                      </select>
                    </label>
                    {p.kind !== "unknown" && (
                      <>
                        {playerSelect(
                          p.playerId,
                          (id) => observation(side, i, { playerId: id }),
                          `LSD player ${side.toUpperCase()} ${i + 1}`,
                        )}
                        {p.kind !== "assigned-maximum" ? (
                          <>
                            <label>
                              Raw distance {side.toUpperCase()} {i + 1}
                              <input
                                type="number"
                                min={0}
                                step="any"
                                required
                                value={p.value ?? ""}
                                onChange={(e) =>
                                  observation(side, i, {
                                    value:
                                      e.target.value === ""
                                        ? null
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Distance unit {side.toUpperCase()} {i + 1}
                              <select
                                value={p.unit ?? "cm"}
                                onChange={(e) =>
                                  observation(side, i, {
                                    unit: e.target.value as LSD["unit"],
                                  })
                                }
                              >
                                <option value="cm">cm</option>
                                <option value="mm">mm</option>
                                <option value="m">m</option>
                              </select>
                            </label>
                          </>
                        ) : (
                          <label>
                            Assignment reason {side.toUpperCase()} {i + 1}
                            <input
                              required
                              value={p.reason}
                              maxLength={500}
                              onChange={(e) =>
                                observation(side, i, { reason: e.target.value })
                              }
                            />
                          </label>
                        )}
                        <label>
                          LSD source {side.toUpperCase()} {i + 1}
                          <input
                            required
                            value={p.source}
                            maxLength={500}
                            onChange={(e) =>
                              observation(side, i, { source: e.target.value })
                            }
                          />
                        </label>
                      </>
                    )}
                  </fieldset>
                ))}
                <label>
                  DSC evidence {side.toUpperCase()}
                  <select
                    value={draft.dsc[side].kind}
                    onChange={(e) =>
                      change({
                        dsc: {
                          ...draft.dsc,
                          [side]: {
                            ...draft.dsc[side],
                            kind: e.target.value as "unknown" | "sourced",
                          },
                        },
                      })
                    }
                  >
                    <option value="unknown">Unknown</option>
                    <option value="sourced">
                      Sourced aggregate (individual LSDs may be incomplete)
                    </option>
                  </select>
                </label>
                {draft.dsc[side].kind === "sourced" && (
                  <>
                    <label>
                      DSC centre distance cm {side.toUpperCase()}
                      <input
                        type="number"
                        min={0}
                        max={199.6}
                        step="any"
                        required
                        value={draft.dsc[side].valueCm ?? ""}
                        onChange={(e) =>
                          change({
                            dsc: {
                              ...draft.dsc,
                              [side]: {
                                ...draft.dsc[side],
                                valueCm:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              },
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      DSC source {side.toUpperCase()}
                      <input
                        required
                        maxLength={500}
                        value={draft.dsc[side].source}
                        onChange={(e) =>
                          change({
                            dsc: {
                              ...draft.dsc,
                              [side]: {
                                ...draft.dsc[side],
                                source: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </label>
                  </>
                )}
                <label>
                  Actual participation {side.toUpperCase()}
                  <select
                    value={draft.participation[side].kind}
                    onChange={(e) =>
                      change({
                        participation: {
                          ...draft.participation,
                          [side]: {
                            ...draft.participation[side],
                            kind: e.target.value as "unknown" | "observed",
                          },
                        },
                      })
                    }
                  >
                    <option value="unknown">
                      Unknown (lineup is not proof)
                    </option>
                    <option value="observed">Observed players</option>
                  </select>
                </label>
                {draft.participation[side].kind === "observed" && (
                  <>
                    {Array.from(
                      { length: game.discipline === "mixed_doubles" ? 2 : 4 },
                      (_, i) =>
                        playerSelect(
                          draft.participation[side].playerIds[i] ?? "",
                          (id) => {
                            const ids = [
                              ...draft.participation[side].playerIds,
                            ];
                            ids[i] = id;
                            change({
                              participation: {
                                ...draft.participation,
                                [side]: {
                                  ...draft.participation[side],
                                  playerIds: ids,
                                },
                              },
                            });
                          },
                          `Observed player ${side.toUpperCase()} ${i + 1}`,
                        ),
                    )}
                    <label>
                      Participation source {side.toUpperCase()}
                      <input
                        required
                        value={draft.participation[side].source}
                        maxLength={500}
                        onChange={(e) =>
                          change({
                            participation: {
                              ...draft.participation,
                              [side]: {
                                ...draft.participation[side],
                                source: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </label>
                  </>
                )}
              </fieldset>
            ))}
            {game.discipline === "mixed_doubles" && (
              <fieldset>
                <legend>
                  Mixed doubles placement (A guard / B house stone)
                </legend>
                {Array.from(
                  { length: Math.max(8, game.ends.length) },
                  (_, i) => {
                    const p = draft.placements[i] ?? {
                      decider: null,
                      choice: null,
                      powerPlay: false,
                      blankReason: "unknown",
                    };
                    const update = (v: Partial<Placement>) =>
                      change({
                        placements: Array.from(
                          { length: Math.max(draft.placements.length, i + 1) },
                          (_, j) =>
                            j === i
                              ? { ...p, ...v }
                              : (draft.placements[j] ?? null),
                        ),
                      });
                    return (
                      <details key={i}>
                        <summary>Placement end {i + 1}</summary>
                        <label>
                          Decision owner end {i + 1}
                          <select
                            value={p.decider ?? ""}
                            onChange={(e) =>
                              update({
                                decider: (e.target.value ||
                                  null) as Side | null,
                              })
                            }
                          >
                            <option value="">Unknown</option>
                            <option value="a">{game.nameA}</option>
                            <option value="b">{game.nameB}</option>
                          </select>
                        </label>
                        <label>
                          Chosen position end {i + 1}
                          <select
                            value={p.choice ?? ""}
                            onChange={(e) =>
                              update({
                                choice: (e.target.value || null) as
                                  | "A"
                                  | "B"
                                  | null,
                              })
                            }
                          >
                            <option value="">Unknown</option>
                            <option value="A">
                              A · guard · delivers first
                            </option>
                            <option value="B">B · house stone · hammer</option>
                          </select>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={p.powerPlay}
                            onChange={(e) =>
                              update({ powerPlay: e.target.checked })
                            }
                          />
                          Power play end {i + 1}
                        </label>
                        <label>
                          Blank reason end {i + 1}
                          <select
                            value={p.blankReason}
                            onChange={(e) =>
                              update({
                                blankReason: e.target
                                  .value as Placement["blankReason"],
                              })
                            }
                          >
                            <option value="unknown">
                              Unknown / not a blank
                            </option>
                            <option value="ordinary">Ordinary blank</option>
                            <option value="equal-measure">
                              Equal measure blank
                            </option>
                          </select>
                        </label>
                      </details>
                    );
                  },
                )}
              </fieldset>
            )}
            {game.state === "confirmed" && (
              <label>
                Sporting correction reason
                <input
                  required
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <button disabled={!dirty} type="submit">
              {game.state === "confirmed"
                ? "Save sporting correction"
                : "Save sporting evidence"}
            </button>
          </fieldset>
        </form>
        <AuthorityRecovery state={recovery} label="sporting evidence" />
      </details>
    </section>
  );
}
