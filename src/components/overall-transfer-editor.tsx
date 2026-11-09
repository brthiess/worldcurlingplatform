"use client";
import type { HistoricalTransfer } from "@/domain/overall-ranking-input";
import type { Source } from "@/domain/ranking-inputs";
import { OverallField } from "./overall-field";
export function OverallTransferEditor({
  value,
  players,
  sources,
  onChange,
}: {
  value: HistoricalTransfer[];
  players: string[];
  sources: Source[];
  onChange: (v: HistoricalTransfer[]) => void;
}) {
  const patch = (i: number, p: Partial<HistoricalTransfer>) =>
    onChange(value.map((v, j) => (j === i ? { ...v, ...p } : v)));
  return (
    <>
      <h4>Historical transfer ownership checks</h4>
      <p>
        Optional documentary checks of 2025–26 individual rights used in
        starting evidence. Cite the actual prior-season applicability decision;
        this year's publication does not prove a retroactive rule. Historical
        subtotals verify the reviewed entitlement and never create a current
        event award.
      </p>
      {value.map((v, i) => (
        <fieldset key={i}>
          <legend>Historical transfer {i + 1}</legend>
          <div className="overall-fields">
            <OverallField>
              Transfer owner
              <select
                value={v.playerId}
                onChange={(e) => patch(i, { playerId: e.target.value })}
              >
                <option value="">Choose official regular</option>
                {players.map((id) => (
                  <option key={id}>{id}</option>
                ))}
              </select>
            </OverallField>
            <OverallField>
              Transfer branch
              <select
                value={v.branch}
                onChange={(e) =>
                  patch(i, {
                    branch: e.target.value as HistoricalTransfer["branch"],
                  })
                }
              >
                <option value="pre-none">
                  Leaves before October31, no new team
                </option>
                <option value="pre-pre">
                  Leaves and joins before October31
                </option>
                <option value="pre-post">
                  Leaves before, joins after October31
                </option>
                <option value="post-none">
                  Leaves after October31, no new team
                </option>
                <option value="post-post">
                  Leaves and joins after October31
                </option>
              </select>
            </OverallField>
            <OverallField>
              Prior-season departure date
              <input
                type="date"
                value={v.leftOn}
                onChange={(e) => patch(i, { leftOn: e.target.value })}
              />
            </OverallField>
            <OverallField>
              Prior-season joining date
              <input
                type="date"
                value={v.joinedOn ?? ""}
                onChange={(e) => patch(i, { joinedOn: e.target.value || null })}
              />
            </OverallField>
            {(
              [
                ["Historical old played subtotal", "oldPlayed"],
                ["Historical new played subtotal", "newPlayed"],
                ["Historical old final total", "oldFinal"],
                ["Historical new final total", "newFinal"],
              ] as const
            ).map(([label, key]) => (
              <OverallField key={key}>
                {label}
                <input
                  value={v[key] ?? ""}
                  onChange={(e) => patch(i, { [key]: e.target.value || null })}
                />
              </OverallField>
            ))}
            {(
              [
                ["Historical amount source", "sourceId"],
                ["Prior-season applicability source", "applicabilitySourceId"],
              ] as const
            ).map(([label, key]) => (
              <OverallField key={key}>
                {label}
                <select
                  value={v[key]}
                  onChange={(e) => patch(i, { [key]: e.target.value })}
                >
                  <option value="">Unresolved source</option>
                  {sources.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.title || s.id}
                    </option>
                  ))}
                </select>
              </OverallField>
            ))}
            <OverallField>
              Historical transfer applicability rationale
              <textarea
                value={v.note}
                onChange={(e) => patch(i, { note: e.target.value })}
              />
            </OverallField>
          </div>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => i !== j))}
          >
            Remove historical transfer {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...value,
            {
              playerId: players[0] ?? "",
              season: "2025-26",
              branch: "pre-none",
              leftOn: "",
              joinedOn: null,
              oldPlayed: "0",
              newPlayed: "0",
              oldFinal: null,
              newFinal: null,
              sourceId: "",
              applicabilitySourceId: "",
              note: "",
            },
          ])
        }
      >
        Add historical ownership check
      </button>
    </>
  );
}
