import type { PublicDraw } from "@/modules/draws/draws";
import { selectedDrawPath } from "@/domain/draws";
type Props = {
  data: Pick<PublicDraw, "graph" | "seeds">;
  games?: PublicDraw["games"];
  selected?: string;
  view?: string;
  timezone?: string;
};
export function DrawPanel({
  data,
  games = [],
  selected = "",
  view = "bracket",
  timezone = "UTC",
}: Props) {
  const graph = data.graph;
  if (!graph) return null;
  const seed = data.seeds.find((s) => s.entryId === selected);
  const path = new Set(selectedDrawPath(graph, seed?.seed, selected, games));
  return (
    <>
      <p className="legend">
        Winner routes connect each round. A highlighted possible route depends
        on future results. Time is shown only after a session is assigned.
      </p>
      {graph.byes.length > 0 && (
        <section className="notice" aria-label="Structural byes">
          <h3>Structural byes</h3>
          <ul>
            {graph.byes.map((b) => (
              <li key={b.seed}>
                Seed {b.seed} ·{" "}
                {data.seeds.find((s) => s.seed === b.seed)?.name} enters{" "}
                {b.destination} directly. No played game or win.
              </li>
            ))}
          </ul>
        </section>
      )}
      <div
        className={`draw-graph ${view === "list" ? "draw-list" : ""}`}
        role="region"
        aria-label={
          view === "list"
            ? "Knockout game list"
            : "Knockout bracket, scroll horizontally on small screens"
        }
        tabIndex={view === "list" ? undefined : 0}
      >
        <div className="draw-rounds">
          {[1, 2, 3].map((round) => (
            <section
              className="draw-round"
              key={round}
              aria-label={
                round === 1
                  ? "Quarterfinals"
                  : round === 2
                    ? "Semifinals"
                    : "Final"
              }
            >
              <h3>
                {round === 1
                  ? "Quarterfinals"
                  : round === 2
                    ? "Semifinals"
                    : "Final"}
              </h3>
              {graph.games
                .filter((g) => g.round === round)
                .map((node) => {
                  const game = games.find((g) => g.id === node.id);
                  const actual =
                    game &&
                    (game.entryA === selected || game.entryB === selected);
                  const active = selected && path.has(node.key);
                  return (
                    <article
                      className={`bracket-game ${active ? "path-game" : ""}`}
                      key={node.id}
                      aria-label={`${node.key}${active ? (actual ? " · selected team" : " · possible route") : ""}`}
                    >
                      <p className="game-meta">
                        <strong>{node.key}</strong>
                        <span>
                          {game
                            ? game.state === "confirmed"
                              ? "Confirmed result"
                              : game.state === "live"
                                ? "Live · provisional"
                                : game.drawId
                                  ? "Scheduled"
                                  : "Not scheduled"
                            : "Preview"}
                        </span>
                      </p>
                      {(["a", "b"] as const).map((side) => {
                        const source = node[side],
                          entryId =
                            game?.[side === "a" ? "entryA" : "entryB"] ??
                            ("seed" in source
                              ? data.seeds.find((s) => s.seed === source.seed)
                                  ?.entryId
                              : null);
                        const name =
                          game?.[side === "a" ? "nameA" : "nameB"] ??
                          ("seed" in source
                            ? data.seeds.find((s) => s.seed === source.seed)
                                ?.name
                            : `Winner of ${source.winner}`);
                        const total =
                          game?.[side === "a" ? "totalA" : "totalB"];
                        return (
                          <div className="bracket-side" key={side}>
                            <span>
                              {entryId ? (
                                <a
                                  href={`/entries/${encodeURIComponent(entryId)}`}
                                >
                                  {name}
                                </a>
                              ) : (
                                <span>{name}</span>
                              )}
                              {game?.winnerEntryId === entryId && (
                                <span className="winner-label"> · Winner</span>
                              )}
                            </span>
                            <strong>
                              {total ??
                                (game?.state === "confirmed" ? "?" : "·")}
                            </strong>
                          </div>
                        );
                      })}
                      <p className="legend">
                        {game?.startsAt
                          ? `${new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(game.startsAt))} · ${timezone} · Sheet ${game.sheet}`
                          : "Time and sheet not scheduled"}
                      </p>
                      {active && (
                        <p className="path-label">
                          {actual ? "Selected team" : "Possible route"}
                        </p>
                      )}
                      {game?.attention && (
                        <p className="notice">
                          Organizer attention required. Actual participants and
                          results retained.
                        </p>
                      )}
                      {game ? (
                        <p>
                          <a href={`/games/${encodeURIComponent(game.id)}`}>
                            Open {node.key} game →
                          </a>
                        </p>
                      ) : null}
                      <p className="legend">
                        {graph.games
                          .filter((g) =>
                            [g.a, g.b].some(
                              (s) => "winner" in s && s.winner === node.key,
                            ),
                          )
                          .map((g) => (
                            <span key={g.key}>Winner → {g.key} </span>
                          ))}
                        {node.key === "F" ? "Winner → champion" : ""}
                      </p>
                    </article>
                  );
                })}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
