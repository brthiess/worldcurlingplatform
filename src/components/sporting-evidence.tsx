import {
  nextPlacementDecider,
  type SportingEvidence,
} from "@/domain/disciplines";
import type { End } from "@/domain/scoring";
export function SportingEvidenceView({
  evidence,
  names,
  ends = [],
  hammers = [],
}: {
  evidence?: SportingEvidence;
  names: { a: string; b: string };
  ends?: End[];
  hammers?: ("a" | "b" | null)[];
}) {
  if (!evidence)
    return <p>Measurements and observed participation not recorded.</p>;
  return (
    <section aria-label="Sporting evidence">
      <h3>Measurements and participation</h3>
      <p>
        World Curling 2026 · {evidence.regulationEnds} regulation ends ·{" "}
        {evidence.stage} · LSD{" "}
        {evidence.lsdRequired
          ? "required for this game/stage"
          : "not required for this game/stage"}
      </p>
      {(["a", "b"] as const).map((side) => {
        const pair = evidence.lsd[side],
          sum = pair.every((p) => p.centreCm !== null)
            ? pair[0].centreCm! + pair[1].centreCm!
            : null;
        return (
          <section key={side}>
            <h4>{names[side]}</h4>
            <ul>
              {pair.map((p, i) => (
                <li key={i}>
                  LSD {i + 1} · {i === 0 ? "clockwise" : "counter-clockwise"}:{" "}
                  {p.kind === "unknown" ? (
                    "unknown"
                  ) : (
                    <>
                      {p.centreCm} cm to centre · {p.kind} ·{" "}
                      <a href={`/players/${p.playerId}`}>Player record</a>
                      {p.kind.startsWith("measured")
                        ? ` · raw ${p.value} ${p.unit}`
                        : ""}{" "}
                      · {p.source}
                      {p.reason ? ` · ${p.reason}` : ""}
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p>
              LSD total: {sum === null ? "unknown" : `${sum} cm`}. DSC:{" "}
              {evidence.dsc[side].kind === "unknown"
                ? "unknown"
                : `${evidence.dsc[side].valueCm} cm · sourced aggregate · ${evidence.dsc[side].source}`}
            </p>
            <p>
              Actual participation:{" "}
              {evidence.participation[side].kind === "unknown"
                ? "unknown"
                : `observed · ${evidence.participation[side].source}`}
            </p>
            {evidence.participation[side].playerIds.map((id) => (
              <p key={id}>
                <a href={`/players/${id}`}>Observed player record</a>
              </p>
            ))}
          </section>
        );
      })}
      {evidence.placements.some(Boolean) && (
        <>
          <h4>Mixed doubles placement observations</h4>
          <ol>
            {evidence.placements.map((p, i) => {
              if (!p) return <li key={i}>End {i + 1}: unknown</li>;
              const next = ends[i]
                ? nextPlacementDecider(ends[i], hammers[i] ?? null, p)
                : null;
              return (
                <li key={i}>
                  End {i + 1}: decision{" "}
                  {p.decider ? names[p.decider] : "unknown"} · chosen position{" "}
                  {p.choice ?? "unknown"} · power play{" "}
                  {p.powerPlay ? "yes" : "no"} · blank reason {p.blankReason}.
                  Next decision {next ? names[next] : "unknown"}; next hammer
                  requires its own observation.
                </li>
              );
            })}
          </ol>
        </>
      )}
      <p className="muted">
        LSD delivery does not establish game participation. Recorded
        observations do not certify sporting eligibility or decide qualification
        ties.
      </p>
    </section>
  );
}
