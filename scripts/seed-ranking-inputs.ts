import type { PoolClient } from "pg";
import { coreIdentity } from "../src/domain/entries";
/** Fictional review scenario only. Repeat seed preserves every operated roster/evidence revision. */
export async function seedRankingInputs(c: PoolClient) {
  const ids = [
    "demo-rank-skip",
    "demo-rank-third",
    "demo-rank-front-a",
    "demo-rank-front-b",
    "demo-rank-front-c",
  ];
  for (const [i, id] of [...ids, "demo-rank-alternate"].entries())
    await c.query(
      "INSERT INTO player(id,name,origin) VALUES($1,$2,'fictional_demo') ON CONFLICT DO NOTHING",
      [
        id,
        [
          "Avery Demo",
          "Blair Demo",
          "Casey Demo",
          "Drew Demo",
          "Emery Demo",
          "Finley Demo",
        ][i],
      ],
    );
  await c.query(
    "INSERT INTO team(id,discipline,core_key) VALUES('demo-ranking-five','men_four',$1) ON CONFLICT DO NOTHING",
    [coreIdentity("men_four", ids)],
  );
  for (const id of ids)
    await c.query(
      "INSERT INTO team_core_member VALUES('demo-ranking-five',$1) ON CONFLICT DO NOTHING",
      [id],
    );
  const old = await c.query(
    "SELECT id FROM season_registration WHERE id='demo-ranking-season'",
  );
  if (!old.rowCount) {
    await c.query(
      "INSERT INTO season_registration VALUES('demo-ranking-season','demo-ranking-five','2026-27',1)",
    );
    await c.query(
      "INSERT INTO season_roster_version(registration_id,version,display_name,actor_id) VALUES('demo-ranking-season',1,'Demo rotating five','demo-administrator')",
    );
    for (const [i, id] of [...ids, "demo-rank-alternate"].entries())
      await c.query(
        "INSERT INTO season_roster_member VALUES('demo-ranking-season',1,$1,$2,$3)",
        [
          id,
          i === 5 ? "alternate" : "core",
          i === 5 ? "Designated alternate" : "Regular rotation",
        ],
      );
  }
}
