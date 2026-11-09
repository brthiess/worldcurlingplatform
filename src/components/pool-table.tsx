import type { PublicDraw } from "@/modules/draws/draws";
export function PoolTable({
  pool,
}: {
  pool: PublicDraw["pools"][number] | undefined;
}) {
  if (!pool) return <p>No published pool standings.</p>;
  return (
    <>
      <h3>Pool {pool.key} standings</h3>
      <p className="legend">
        Confirmed results only. Equal records remain tied; seed order only
        stabilizes display. Playoff qualifiers and seeds require manual
        selection. This profile has no playoff stage.
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label={`Pool ${pool.key} standings`}
        tabIndex={0}
      >
        <table>
          <caption>
            Pool {pool.key} · W wins, L losses, T ties, P played
          </caption>
          <thead>
            <tr>
              <th scope="col">Team</th>
              <th scope="col">
                <abbr title="Played">P</abbr>
              </th>
              <th scope="col">
                <abbr title="Wins">W</abbr>
              </th>
              <th scope="col">
                <abbr title="Losses">L</abbr>
              </th>
              <th scope="col">
                <abbr title="Ties">T</abbr>
              </th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {pool.rows.map((r) => (
              <tr key={r.entryId}>
                <th scope="row">
                  <a href={`/entries/${encodeURIComponent(r.entryId)}`}>
                    {r.name}
                  </a>
                </th>
                <td>{r.played}</td>
                <td>{r.wins}</td>
                <td>{r.losses}</td>
                <td>{r.ties}</td>
                <td>
                  {r.tied ? "Tied record" : ""}
                  {r.pending
                    ? `${r.tied ? " · " : ""}${r.pending} pending`
                    : ""}
                  {!r.pending && !r.tied ? "Complete" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="legend">
        Pending includes unfinished or unresolved results; unknown scores never
        become a played 0–0 tie. The current scoring profile confirms a decisive
        winner and does not accept drawn games.
      </p>
    </>
  );
}
