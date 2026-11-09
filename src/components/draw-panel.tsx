import { POOL_TEMPLATE } from "@/domain/pools";
import type { PublicDraw } from "@/modules/draws/draws";
import { selectedDrawPath, sourceLabel, TRIPLE_TEMPLATE } from "@/domain/draws";
type Props = {
  data: Pick<PublicDraw, "graph" | "seeds">;
  games?: PublicDraw["games"];
  selected?: string;
  view?: string;
  timezone?: string;
  onlySelected?: boolean;
  pool?: string;
};
export function DrawPanel({
  data,
  games = [],
  selected = "",
  view = "bracket",
  timezone = "UTC",
  onlySelected = false,
  pool = "",
}: Props) {
  const graph = data.graph;
  if (!graph) return null;
  const seed = data.seeds.find((s) => s.entryId === selected);
  const path = new Set(selectedDrawPath(graph, seed?.seed, selected, games));
  const triple = graph.template === TRIPLE_TEMPLATE;
  const pooled = graph.template === POOL_TEMPLATE;
  const visible = graph.games.filter(
    (g) =>
      (!pool || g.group === pool) &&
      (!onlySelected || !selected || path.has(g.key)),
  );
  const routeHref = (id: string) =>
    visible.some((g) => g.id === id) ? `#draw-node-${id}` : `/games/${id}`;
  const groups = (triple ? ["A", "B", "C", "P"] : ["1", "2", "3"]).filter(
    (group) =>
      visible.some((g) =>
        triple ? g.stage === group : g.round === Number(group),
      ),
  );
  const title = (group: string) =>
    triple
      ? {
          A: "A path · unbeaten",
          B: "B path · one loss",
          C: "C path · last qualification chance",
          P: "Playoffs · single knockout",
        }[group]
      : pooled
        ? `Round ${group}`
        : { 1: "Quarterfinals", 2: "Semifinals", 3: "Final" }[group];
  return (
    <>
      <p className="legend">
        {pooled
          ? "Each team plays the other three teams in its pool once. Playoff selection remains manual."
          : triple
            ? "Winner and loser route links connect A, B, C and playoffs. Qualification and elimination are separate destinations."
            : "Winner routes connect each round."}{" "}
        {!pooled && "A highlighted possible route depends on future results. "}
        Time is shown only after a session is assigned.
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
            ? pooled
              ? "Pool game list"
              : "Knockout game list"
            : "Knockout bracket, scroll horizontally on small screens"
        }
        tabIndex={view === "list" ? undefined : 0}
      >
        <div className={`draw-rounds ${triple ? "triple-rounds" : ""}`}>
          {groups.map((group) => (
            <section
              className="draw-round"
              key={group}
              aria-label={title(group)}
            >
              <h3>{title(group)}</h3>
              {visible
                .filter((g) =>
                  triple ? g.stage === group : g.round === Number(group),
                )
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
                      id={`draw-node-${node.id}`}
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
                            : sourceLabel(source));
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
                              {entryId && game?.winnerEntryId === entryId && (
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
                      {triple && (
                        <p className="route-sources">
                          {(["a", "b"] as const).map((side) => {
                            const s = node[side];
                            if ("seed" in s)
                              return (
                                <span key={side}>
                                  {side.toUpperCase()} ← Seed {s.seed}{" "}
                                </span>
                              );
                            const upstream = graph.games.find(
                              (g) =>
                                g.key === ("winner" in s ? s.winner : s.loser),
                            )!;
                            return (
                              <a key={side} href={routeHref(upstream.id)}>
                                {side.toUpperCase()} ← {sourceLabel(s)}{" "}
                              </a>
                            );
                          })}
                        </p>
                      )}
                      <p
                        role="group"
                        className="legend route-connectors"
                        aria-label={`${node.key} outcome routes`}
                      >
                        {graph.games.flatMap((g) =>
                          (["a", "b"] as const).flatMap((side) => {
                            const s = g[side];
                            const route =
                              "winner" in s && s.winner === node.key
                                ? "Winner"
                                : "loser" in s && s.loser === node.key
                                  ? "Loser"
                                  : null;
                            return route
                              ? [
                                  <a key={g.key + side} href={routeHref(g.id)}>
                                    {route} →{" "}
                                    {"winner" in s && s.qualifier
                                      ? `${s.qualifier} → `
                                      : ""}
                                    {g.key}.{side.toUpperCase()}
                                  </a>,
                                ]
                              : [];
                          }),
                        )}
                        {node.terminals?.loser && (
                          <span
                            className={
                              node.terminals.loser.kind === "eliminated"
                                ? "elimination-route"
                                : "placement-route"
                            }
                          >
                            Loser → {node.terminals.loser.label}
                            {node.terminals.loser.place
                              ? ` · Place ${node.terminals.loser.place}`
                              : ""}
                          </span>
                        )}
                        {node.terminals?.winner?.kind === "placed" && (
                          <span className="qualification-route">
                            Winner → Champion · Place 1
                          </span>
                        )}
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
