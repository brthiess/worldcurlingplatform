import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { readDrawFieldEntries } from "@/modules/entries/draw-field";
import {
  singleKnockout,
  SINGLE_TEMPLATE,
  type DrawSource,
} from "@/domain/draws";
export class DrawError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
type Graph = Omit<ReturnType<typeof singleKnockout>, "games"> & {
  games: (ReturnType<typeof singleKnockout>["games"][number] & {
    id: string;
  })[];
};
type Seed = { seed: number; entryId: string; version: number; name: string };
type DrawState = {
  divisionId: string;
  version: number;
  state: string;
  template: string;
  templateVersion: number;
  seeds: Seed[];
  graph: Graph | null;
};
async function scope(
  c: PoolClient,
  userId: string,
  divisionId: string,
  write = false,
) {
  let division = (
    await c.query(
      'SELECT d.id,d.name,d.event_id AS "eventId",d.discipline,e.name AS "eventName" FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.id=$1',
      [divisionId],
    )
  ).rows[0];
  if (!division) throw new DrawError("Division not found.", 404);
  // Event first, then division, games and entries: shares scheduling/scoring lock order.
  if (write) {
    await c.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      division.eventId,
    ]);
    const current = (
      await c.query(
        'SELECT d.id,d.name,d.event_id AS "eventId",d.discipline,e.name AS "eventName" FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.id=$1 FOR UPDATE OF d',
        [divisionId],
      )
    ).rows[0];
    if (!current || current.eventId !== division.eventId)
      throw new DrawError(
        "Division edition changed. Reload the current division before applying this command.",
        409,
      );
    division = current;
  }
  const grants = await c.query(
    "SELECT id FROM role_grant WHERE user_id=$1 AND ((role='administrator' AND event_id IS NULL AND game_id IS NULL) OR (role='organizer' AND event_id=$2 AND game_id IS NULL)) FOR SHARE",
    [userId, division.eventId],
  );
  if (!grants.rowCount)
    throw new DrawError(
      "Organizer authority for this edition is required.",
      403,
    );
  return division;
}
async function state(c: PoolClient, id: string): Promise<DrawState> {
  const row = (
    await c.query(
      "SELECT r.response FROM competition_draw d JOIN draw_revision r ON r.division_id=d.division_id AND r.version=d.version WHERE d.division_id=$1",
      [id],
    )
  ).rows[0];
  return (
    row?.response ?? {
      divisionId: id,
      version: 0,
      state: "empty",
      template: SINGLE_TEMPLATE,
      templateVersion: 1,
      seeds: [],
      graph: null,
    }
  );
}
export async function drawWorkspace(userId: string, id: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const division = await scope(c, userId, id);
    const data = await state(c, id);
    const entries = (await readDrawFieldEntries(c, id))
      .filter((e) => e.admitted)
      .map(({ id, name, version }) => ({ id, name, version }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const history = (
      await c.query(
        'SELECT version,state,reason,created_at AS "createdAt" FROM draw_revision WHERE division_id=$1 ORDER BY version DESC',
        [id],
      )
    ).rows;
    await c.query("COMMIT");
    return { ...data, actorId: userId, division, entries, history };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function saveDraw(userId: string, id: string, input: unknown) {
  const x = input as {
    requestId: string;
    expectedVersion: number;
    action: "preview" | "publish";
    seedEntryIds?: string[];
    reason: string;
  };
  if (
    !x ||
    typeof x.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(x.requestId) ||
    !Number.isSafeInteger(x.expectedVersion) ||
    x.expectedVersion < 0 ||
    !["preview", "publish"].includes(x.action) ||
    typeof x.reason !== "string" ||
    !x.reason.trim() ||
    x.reason.length > 500 ||
    /[<>\u0000-\u001f]/.test(x.reason)
  )
    throw new DrawError(
      "Provide request identifier, current version, action and a plain-text reason.",
    );
  if (
    x.action === "preview" &&
    (!Array.isArray(x.seedEntryIds) ||
      x.seedEntryIds.some(
        (e) => typeof e !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(e),
      ))
  )
    throw new DrawError("Choose distinct entry identifiers in seed order.");
  const command = {
    requestId: x.requestId,
    expectedVersion: x.expectedVersion,
    action: x.action,
    reason: x.reason.trim(),
    ...(x.action === "preview" ? { seedEntryIds: x.seedEntryIds } : {}),
  };
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const division = await scope(c, userId, id, true);
    const old = (
      await c.query(
        "SELECT response,command=$4::jsonb AS same FROM draw_revision WHERE division_id=$1 AND actor_id=$2 AND request_id=$3",
        [id, userId, x.requestId, JSON.stringify(command)],
      )
    ).rows[0];
    if (old) {
      if (!old.same)
        throw new DrawError(
          "Request identifier already used for a different command.",
          409,
        );
      await c.query("COMMIT");
      return old.response as DrawState;
    }
    const before = await state(c, id);
    if (before.version !== x.expectedVersion)
      throw new DrawError(
        "Draw changed. Reload the accepted version before applying your edit.",
        409,
      );
    if (before.state === "published")
      throw new DrawError(
        "This draw is published. Its stored graph and seed history are preserved.",
        409,
      );
    if (!["men_four", "women_four"].includes(division.discipline))
      throw new DrawError(
        "This operated profile currently supports four-player divisions.",
      );
    let graph: Graph, seeds: Seed[];
    if (x.action === "preview") {
      let generated: ReturnType<typeof singleKnockout>;
      try {
        generated = singleKnockout(x.seedEntryIds!);
      } catch (e) {
        throw new DrawError((e as Error).message);
      }
      const rows = await readDrawFieldEntries(c, id, x.seedEntryIds, true);
      if (rows.length !== x.seedEntryIds!.length)
        throw new DrawError(
          "Every selected entry must belong to this division.",
          403,
        );
      if (rows.some((e) => !e.admitted))
        throw new DrawError(
          "Only entries admitted to this field can be seeded. Pending submissions are not field places.",
          422,
        );
      seeds = x.seedEntryIds!.map((entryId, i) => {
        const row = rows.find((r) => r.id === entryId)!;
        return { seed: i + 1, entryId, version: row.version, name: row.name };
      });
      graph = {
        ...generated,
        games: generated.games.map((g) => ({ ...g, id: randomUUID() })),
      };
    } else {
      if (before.state !== "preview" || !before.graph)
        throw new DrawError(
          "Save and review a preview before publishing.",
          409,
        );
      graph = before.graph;
      seeds = before.seeds;
      const current = await readDrawFieldEntries(
        c,
        id,
        seeds.map((s) => s.entryId),
        true,
      );
      if (
        seeds.some(
          (s) =>
            !current.some(
              (e) =>
                e.id === s.entryId && e.version === s.version && e.admitted,
            ),
        )
      )
        throw new DrawError(
          "An entry or field admission changed after preview. Save and review a new preview before publishing.",
          409,
        );
      // An existing operated/legacy competition is never silently replaced.
      if (
        (
          await c.query("SELECT id FROM game WHERE division_id=$1 LIMIT 1", [
            id,
          ])
        ).rowCount
      )
        throw new DrawError(
          "This division already has games. Use a separate division for this bounded draw.",
          409,
        );
    }
    const response: DrawState = {
      divisionId: id,
      version: before.version + 1,
      state: x.action === "preview" ? "preview" : "published",
      template: SINGLE_TEMPLATE,
      templateVersion: 1,
      seeds,
      graph,
    };
    const auditId = randomUUID();
    await c.query(
      "INSERT INTO competition_draw(division_id,version,state) VALUES($1,$2,$3) ON CONFLICT(division_id) DO UPDATE SET version=excluded.version,state=excluded.state",
      [id, response.version, response.state],
    );
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id,request_id,resource_version,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        auditId,
        userId,
        "draw." + x.action,
        id,
        x.requestId,
        response.version,
        JSON.stringify(before),
        JSON.stringify(response),
      ],
    );
    await c.query(
      "INSERT INTO draw_revision(division_id,version,state,template_id,template_version,graph,actor_id,request_id,command,response,reason,audit_id) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9,$10,$11)",
      [
        id,
        response.version,
        response.state,
        SINGLE_TEMPLATE,
        JSON.stringify(graph),
        userId,
        x.requestId,
        JSON.stringify(command),
        JSON.stringify(response),
        command.reason,
        auditId,
      ],
    );
    for (const s of seeds)
      await c.query(
        "INSERT INTO draw_seed(division_id,revision,seed,entry_id,entry_version,name) VALUES($1,$2,$3,$4,$5,$6)",
        [id, response.version, s.seed, s.entryId, s.version, s.name],
      );
    for (const g of graph.games)
      await c.query(
        "INSERT INTO draw_node(division_id,revision,key,round,game_id) VALUES($1,$2,$3,$4,$5)",
        [id, response.version, g.key, g.round, g.id],
      );
    for (const g of graph.games)
      for (const side of ["a", "b"] as const) {
        const source = g[side];
        await c.query(
          "INSERT INTO draw_slot(division_id,revision,node_key,side,seed,source_node,route) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            id,
            response.version,
            g.key,
            side,
            "seed" in source ? source.seed : null,
            "winner" in source ? source.winner : null,
            "winner" in source ? "winner" : null,
          ],
        );
      }
    if (x.action === "publish") {
      const participant = (source: DrawSource) =>
        "seed" in source ? seeds.find((s) => s.seed === source.seed)! : null;
      const label = (source: DrawSource) =>
        "seed" in source ? `Seed ${source.seed}` : `Winner of ${source.winner}`;
      for (const g of graph.games)
        await c.query(
          "INSERT INTO game(id,division_id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b) VALUES($1,$2,NULL,'',$3,'scheduled',$4,$5,$6,$7)",
          [
            g.id,
            id,
            `Single knockout · ${g.key}`,
            participant(g.a)?.entryId ?? null,
            participant(g.b)?.entryId ?? null,
            label(g.a),
            label(g.b),
          ],
        );
      for (const g of graph.games)
        for (const side of ["a", "b"] as const) {
          const source = g[side];
          if ("winner" in source)
            await c.query(
              "INSERT INTO game_assignment_dependency(upstream_game_id,downstream_game_id,side,route) VALUES($1,$2,$3,'winner')",
              [
                graph.games.find((n) => n.key === source.winner)!.id,
                g.id,
                side,
              ],
            );
        }
      await c.query(
        "UPDATE division SET format='Single knockout · eight slots, six or eight seeded entries' WHERE id=$1",
        [id],
      );
    }
    await c.query("COMMIT");
    return response;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function publicDraw(id: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const row = (
      await c.query(
        "SELECT d.name,d.event_id AS \"eventId\",e.timezone,e.origin,e.name AS \"eventName\" FROM division d JOIN event_edition e ON e.id=d.event_id JOIN competition_draw cd ON cd.division_id=d.id WHERE d.id=$1 AND e.published AND e.admission_status='approved' AND cd.state='published'",
        [id],
      )
    ).rows[0];
    if (!row) {
      await c.query("COMMIT");
      return null;
    }
    const current = await state(c, id);
    const games = (
      await c.query(
        'SELECT n.key,n.round,g.id,g.draw_id AS "drawId",g.sheet,ds.starts_at AS "startsAt",g.state,g.entry_a AS "entryA",g.entry_b AS "entryB",coalesce(a.display_name,g.slot_a) AS "nameA",coalesce(b.display_name,g.slot_b) AS "nameB",g.total_a AS "totalA",g.total_b AS "totalB",r.result->>\'winnerEntryId\' AS "winnerEntryId",g.version,EXISTS(SELECT 1 FROM game_assignment_attention t WHERE t.downstream_game_id=g.id OR t.upstream_game_id=g.id) AS attention FROM draw_node n JOIN game g ON g.id=n.game_id LEFT JOIN draw_session ds ON ds.id=g.draw_id LEFT JOIN event_entry a ON a.id=g.entry_a LEFT JOIN event_entry b ON b.id=g.entry_b LEFT JOIN LATERAL(SELECT result FROM game_result_version WHERE game_id=g.id ORDER BY version DESC LIMIT 1) r ON true WHERE n.division_id=$1 AND n.revision=$2 ORDER BY n.round,n.key',
        [id, current.version],
      )
    ).rows;
    const history = (
      await c.query(
        "SELECT version,state,created_at AS \"createdAt\" FROM draw_revision WHERE division_id=$1 AND state='published' ORDER BY version DESC",
        [id],
      )
    ).rows;
    await c.query("COMMIT");
    const source = (s: DrawSource): DrawSource =>
      "seed" in s ? { seed: s.seed } : { winner: s.winner };
    const graph = current.graph
      ? {
          template: current.graph.template,
          games: current.graph.games.map((g) => ({
            id: g.id,
            key: g.key,
            round: g.round,
            a: source(g.a),
            b: source(g.b),
          })),
          byes: current.graph.byes.map((b) => ({
            seed: b.seed,
            omittedGame: b.omittedGame,
            destination: b.destination,
            side: b.side,
          })),
        }
      : null;
    return {
      divisionId: current.divisionId,
      version: current.version,
      state: current.state,
      template: current.template,
      templateVersion: current.templateVersion,
      seeds: current.seeds.map((s) => ({
        seed: s.seed,
        entryId: s.entryId,
        version: s.version,
        name: s.name,
      })),
      graph,
      division: row,
      games,
      history,
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export type PublicDraw = NonNullable<Awaited<ReturnType<typeof publicDraw>>>;
