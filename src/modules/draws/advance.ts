import type { PoolClient } from "pg";
import { assignmentDecision, type DrawTerminal } from "@/domain/draws";
/** Called inside the result transaction after its immutable result/audit rows exist.
 * The caller holds the edition lock before game rows, serializing sibling routes. */
export async function advanceDraw(
  c: PoolClient,
  id: string,
  version: number,
  winner: string,
  participants: (string | null)[],
  auditId: string,
) {
  const node = (await c.query(
    "SELECT r.graph->'games' AS games,n.key FROM draw_node n JOIN competition_draw d ON d.division_id=n.division_id AND d.version=n.revision AND d.state='published' JOIN draw_revision r ON r.division_id=d.division_id AND r.version=d.version WHERE n.game_id=$1",
    [id],
  )).rows[0];
  const terminals = node?.games.find((g:{key:string})=>g.key===node.key)?.terminals as {winner?:DrawTerminal;loser?:DrawTerminal}|undefined;
  for (const route of ["winner","loser"] as const) {
    const terminal=terminals?.[route];
    if(!terminal)continue;
    const entry=route==="winner" ? winner : participants.find(e=>e && e!==winner)!;
    await c.query("INSERT INTO draw_terminal_result(upstream_game_id,result_version,route,entry_id,kind,label,place,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[id,version,route,entry,terminal.kind,terminal.label,terminal.place??null,auditId]);
  }
  const deps = (
    await c.query(
      "SELECT dep.*,g.state,g.entry_a,g.entry_b FROM game_assignment_dependency dep JOIN game g ON g.id=dep.downstream_game_id WHERE dep.upstream_game_id=$1 AND EXISTS(SELECT 1 FROM draw_node n JOIN competition_draw d ON d.division_id=n.division_id AND d.version=n.revision AND d.state='published' WHERE n.game_id=g.id) ORDER BY g.id FOR UPDATE OF g",
      [id],
    )
  ).rows;
  for (const dep of deps) {
    const expected =
      dep.route === "winner"
        ? winner
        : participants.find((e) => e && e !== winner)!;
    const previous = dep.side === "a" ? dep.entry_a : dep.entry_b;
    const decision = assignmentDecision(dep.state, previous, expected);
    if (decision === "unchanged") continue;
    if (decision === "assign") {
      await c.query(
        dep.side === "a"
          ? "UPDATE game SET entry_a=$2,version=version+1,updated_at=now() WHERE id=$1"
          : "UPDATE game SET entry_b=$2,version=version+1,updated_at=now() WHERE id=$1",
        [dep.downstream_game_id, expected],
      );
    } else {
      await c.query(
        "INSERT INTO game_assignment_attention(upstream_game_id,result_version,downstream_game_id,side,actual_entry_id,expected_entry_id,downstream_state) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          version,
          dep.downstream_game_id,
          dep.side,
          previous,
          expected,
          dep.state,
        ],
      );
    }
    await c.query(
      "INSERT INTO draw_assignment_revision(upstream_game_id,result_version,downstream_game_id,side,previous_entry_id,expected_entry_id,actual_entry_id,disposition,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        version,
        dep.downstream_game_id,
        dep.side,
        previous,
        expected,
        decision === "assign" ? expected : previous,
        decision === "assign" ? "assigned" : "preserved",
        auditId,
      ],
    );
  }
}
