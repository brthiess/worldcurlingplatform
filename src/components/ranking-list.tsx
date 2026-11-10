import {
  pointsLabel,
  type PublicRankingList,
  type comparePublication,
} from "@/domain/ranking-publication";
export function RankingList({
  data,
  comparison,
}: {
  data: PublicRankingList;
  comparison?: ReturnType<typeof comparePublication>;
}) {
  return (
    <div className="publication-rows" aria-label="Ranking list">
      <div className="ranking-columns" aria-hidden="true">
        <span>Rank</span>
        <span>Subject / contributions</span>
        <span>Points</span>
      </div>
      {data.rows.map((row) => {
        const old =
          comparison?.rows.find((x) => x.subjectId === row.subjectId) ??
          (row.previousRank !== undefined
            ? {
                movement: row.movement ?? null,
                previousTotal: row.previousTotal ?? null,
              }
            : undefined);
        return (
          <article
            key={row.subjectId}
            className="publication-row"
            id={`subject-${row.subjectId}`}
          >
            <div className="ranking-position">
              <strong>{row.rank}</strong>
              {old && (
                <small>
                  {old.movement === null
                    ? "New"
                    : old.movement === 0
                      ? "No move"
                      : `${old.movement > 0 ? "↑" : "↓"} ${Math.abs(old.movement)}`}
                </small>
              )}
            </div>
            <div>
              <h3>{row.href ? <a href={row.href}>{row.name}</a> : row.name}</h3>
              <details>
                <summary>Points & event contributions for {row.name}</summary>
                <dl className="publication-totals">
                  <dt>Starting entitlement</dt>
                  <dd>{pointsLabel(row.starting)}</dd>
                  <dt>Weighted carryover</dt>
                  <dd>{pointsLabel(row.carryover)}</dd>
                  <dt>Counting events</dt>
                  <dd>{pointsLabel(row.eventTotal)}</dd>
                </dl>
                {!row.contributions.length ? (
                  <p>No event contributions in this approved total.</p>
                ) : (
                  <ul className="publication-contributions">
                    {row.contributions.map((a) => (
                      <li key={a.id}>
                        <strong>{a.label}</strong>
                        <span>
                          {a.date} · {a.counted ? "Counted" : "Not counted"} ·{" "}
                          {pointsLabel(a.points)} points
                        </span>
                        {a.reason && <small>{a.reason}</small>}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </div>
            <div className="ranking-points">
              <strong>{pointsLabel(row.total)}</strong>
              {old && (
                <small>
                  Previous:{" "}
                  {old.previousTotal === null
                    ? "New subject"
                    : pointsLabel(old.previousTotal)}
                </small>
              )}
            </div>
          </article>
        );
      })}
      {comparison && comparison.removed.length > 0 && (
        <details>
          <summary>
            Subjects no longer listed ({comparison.removed.length})
          </summary>
          <ul>
            {comparison.removed.map((x) => (
              <li key={x.subjectId}>
                {x.name} · previous rank {x.rank} · {pointsLabel(x.total)}{" "}
                points
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
