/** Shared public read projection: played games never inherit a later entry core. */
export function publicGameSideJoin(side: "a" | "b") {
  const suffix = side.toUpperCase();
  return `LEFT JOIN LATERAL (
    SELECT
      CASE WHEN g.state='scheduled' THEN current_entry.team_id ELSE retained.team_id END AS team_id,
      CASE WHEN g.state='scheduled' THEN coalesce(current_entry.display_name,g.slot_${side})
        ELSE coalesce(retained.display_name,CASE WHEN result.result->>'entry${suffix}'=g.entry_${side} THEN result.result->>'name${suffix}' END,g.slot_${side}) END AS display_name
    FROM (SELECT 1) singleton
    LEFT JOIN event_entry current_entry ON current_entry.id=g.entry_${side}
    LEFT JOIN LATERAL (SELECT result FROM game_result_version WHERE game_id=g.id ORDER BY version DESC LIMIT 1) result ON true
    LEFT JOIN LATERAL (SELECT entry_id,event_lineup_version FROM game_lineup_version WHERE game_id=g.id AND side='${side}' ORDER BY version DESC LIMIT 1) lineup ON true
    LEFT JOIN event_lineup_version retained ON retained.entry_id=g.entry_${side} AND retained.version=
      CASE WHEN result.result ? 'lineup${suffix}' THEN
        CASE WHEN result.result->>'entry${suffix}'=g.entry_${side} AND result.result->'lineup${suffix}'->>'entryId'=g.entry_${side}
          THEN (result.result->'lineup${suffix}'->>'eventLineupVersion')::integer END
        WHEN lineup.entry_id=g.entry_${side} THEN lineup.event_lineup_version END
  ) public_${side} ON true`;
}
export const publicGameIdentityJoins = `${publicGameSideJoin("a")} ${publicGameSideJoin("b")}`;
