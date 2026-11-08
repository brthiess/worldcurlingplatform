import type { PublicGame } from "@/modules/public/scores";
import type { GameLineup } from "@/modules/scoring/lineups";
export function LineupEvidence({
  lineup,
  name,
}: {
  lineup: GameLineup | null;
  name: string;
}) {
  return (
    <section>
      <h4>
        {name} ·{" "}
        {lineup?.mode === "difference"
          ? "Declared game difference"
          : "Defaulted event lineup"}
      </h4>
      <p className="muted">
        {lineup?.eventLineupVersion
          ? `Event lineup version ${lineup.eventLineupVersion}.`
          : lineup?.mode === "difference"
            ? "No recorded event lineup reference."
            : "No recorded event lineup; players unknown."}{" "}
        Roster evidence does not verify who delivered stones.
      </p>
      {!!lineup?.members.length && (
        <ul>
          {lineup.members.map((m) => (
            <li key={m.playerId}>
              <a href={`/players/${m.playerId}`}>{m.name}</a>
              {m.position ? ` · ${m.position}` : ""}
              {m.role ? ` · ${m.role}` : ""} · {m.participation}
              {m.identityStatus === "provisional"
                ? " · provisional identity"
                : ""}
            </li>
          ))}
        </ul>
      )}
      {lineup?.mode === "difference" && !lineup.members.length && (
        <p>Game players unknown.</p>
      )}
    </section>
  );
}
export function GameResultHistory({
  results,
}: {
  results: PublicGame["results"];
}) {
  if (!results.length) return null;
  const latest = results[0];
  const record = (r: typeof latest) => (
    <div key={r.version} className="result-record">
      <p>
        <strong>
          Version {r.version} · {r.result.outcome}
        </strong>{" "}
        · Winner:{" "}
        {r.result.winnerEntryId === r.result.entryA
          ? r.result.nameA
          : r.result.nameB}{" "}
        · {r.result.totalA ?? "?"}–{r.result.totalB ?? "?"}
      </p>
      <p>
        Confirmed by {r.confirmedBy} ·{" "}
        <time dateTime={r.createdAt}>
          {new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 19)}{" "}
          UTC
        </time>
      </p>
      {r.result.reason && <p>Reason: {r.result.reason}</p>}
      <details>
        <summary>Line score and lineup evidence · version {r.version}</summary>
        <ol>
          {r.result.ends.map((e, i) => (
            <li key={i}>
              End {i + 1}: {e.state}
              {e.state === "played" ? ` · ${e.a}–${e.b}` : ""}
            </li>
          ))}
        </ol>
        <LineupEvidence name={r.result.nameA} lineup={r.result.lineupA} />
        <LineupEvidence name={r.result.nameB} lineup={r.result.lineupB} />
      </details>
    </div>
  );
  return (
    <section aria-label="Result history">
      <h3>Result history</h3>
      {record(latest)}
      {results.find((r) => r.result.legacyBefore)?.result.legacyBefore && (
        <details>
          <summary>Original unversioned result</summary>
          {(() => {
            const old = results.find((r) => r.result.legacyBefore)!.result
              .legacyBefore!;
            return (
              <>
                <p>
                  {old.nameA} {old.totalA ?? "?"}–{old.totalB ?? "?"}{" "}
                  {old.nameB}. Confirmation attribution: {old.attribution}.
                  Outcome, winner and original lineup reference were not
                  recorded.
                </p>
                <ol>
                  {old.ends.map((e, i) => (
                    <li key={i}>
                      End {i + 1}: {e.state}
                      {e.state === "played" ? ` · ${e.a}–${e.b}` : ""}
                    </li>
                  ))}
                </ol>
              </>
            );
          })()}
        </details>
      )}
      {results.length > 1 && (
        <details>
          <summary>Earlier result versions</summary>
          {results.slice(1).map(record)}
        </details>
      )}
    </section>
  );
}
