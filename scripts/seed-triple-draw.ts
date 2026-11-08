import { pool } from "../src/db";
import { randomUUID } from "node:crypto";
import { saveEntry } from "../src/modules/entries/entries";
import { saveDraw, publicDraw } from "../src/modules/draws/draws";
import { saveSchedule, readSchedule } from "../src/modules/scheduling/schedule";
import { saveScoring, scoringGame } from "../src/modules/scoring/commands";
import { TRIPLE_TEMPLATE } from "../src/domain/draws";

/** Owned, labelled scenario. Fixed request IDs resume partial initialization;
 * immutable receipts and existing records preserve later operator changes. */
export async function seedTripleDraw() {
  const event = "main-triple-2026",
    division = "main-triple-sixteen",
    actor = "demo-organizer";
  if (
    (
      await pool.query(
        "SELECT 1 FROM audit_record WHERE action='demo.main-initialized' AND resource_id=$1",
        [event],
      )
    ).rowCount
  )
    return;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(721020)");
    if (
      (
        await c.query(
          "SELECT id FROM event_edition WHERE id=$1 AND origin<>'fictional_demo'",
          [event],
        )
      ).rowCount
    )
      throw new Error("Refusing to overwrite non-demo main draw");
    await c.query(
      "INSERT INTO event_series(id,name,organization_id) VALUES('main-triple-demo','Main Triple Knockout Review','prairie-club') ON CONFLICT DO NOTHING",
    );
    await c.query(
      "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status,organization_id,city,country,responsible_administrator_id) VALUES($1,'main-triple-demo','Main 16-team Triple Knockout 2026','Prairie Curling Centre','Regina, Canada','America/Regina','2026-11-08','2026-11-10','fictional_demo',true,'approved','prairie-club','Regina','Canada','demo-administrator') ON CONFLICT DO NOTHING",
      [event],
    );
    await c.query(
      "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Sixteen-team four-player demonstration','men_four','triple knockout') ON CONFLICT DO NOTHING",
      [division, event],
    );
    await c.query(
      "INSERT INTO role_grant(id,user_id,role,event_id) VALUES('main-triple-organizer',$1,'organizer',$2) ON CONFLICT DO NOTHING",
      [actor, event],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  const seeds = Array.from(
    { length: 16 },
    (_, n) => `main-triple-entry-${n + 1}`,
  );
  for (const [index, id] of seeds.entries()) {
    const players = Array.from(
      { length: 4 },
      (_, p) => `${id}-player-${p + 1}`,
    );
    await saveEntry(
      actor,
      id,
      {
        requestId: `main-triple-entry-request-${index + 1}`,
        version: 0,
        entry: {
          divisionId: division,
          name: `Fictional T${String(index + 1).padStart(2, "0")}`,
          coreKnown: true,
          corePlayerIds: players,
          members: players.map((playerId, p) => ({
            playerId,
            role: "core",
            position: ["Lead", "Second", "Third", "Skip"][p],
            participation: "declared",
          })),
          newPlayers: players.map((id, p) => ({
            id,
            name: `Fictional T${String(index + 1).padStart(2, "0")} player ${p + 1}`,
            provisional: false,
          })),
        },
      },
      true,
    );
  }
  await saveDraw(actor, division, {
    requestId: "main-triple-preview-v1",
    expectedVersion: 0,
    action: "preview",
    template: TRIPLE_TEMPLATE,
    seedEntryIds: seeds,
    reason: "Reviewed application 2 A / 3 B / 3 C profile",
  });
  await saveDraw(actor, division, {
    requestId: "main-triple-publish-v1",
    expectedVersion: 1,
    action: "publish",
    reason: "Publish fictional main sixteen-team scenario",
  });
  const graph = (await publicDraw(division))!;
  // One game per session makes fixture times/dependencies explicit and avoids
  // inventing simultaneous team participation. Unassigned games stay unknown.
  const sessions = [
    {
      id: "main-triple-opening",
      number: 1,
      localStart: "2026-11-08T09:00",
      key: "A01",
    },
    {
      id: "main-triple-b-opening",
      number: 2,
      localStart: "2026-11-08T13:00",
      key: "B01",
    },
    {
      id: "main-triple-b-middle",
      number: 3,
      localStart: "2026-11-08T17:00",
      key: "B05",
    },
    {
      id: "main-triple-c-middle",
      number: 4,
      localStart: "2026-11-09T09:00",
      key: "C04",
    },
  ];
  for (const s of sessions) {
    const sessionRequest = "seed-" + s.id;
    const exists = await pool.query(
      "SELECT 1 FROM schedule_revision WHERE event_id=$1 AND actor_id=$2 AND request_id=$3",
      [event, actor, sessionRequest],
    );
    if (!exists.rowCount) {
      const current = await readSchedule(actor, event);
      await saveSchedule(actor, event, {
        requestId: sessionRequest,
        expectedVersion: current.version,
        reason: "Explicit fictional demonstration session",
        action: "session",
        session: {
          id: s.id,
          divisionId: division,
          number: s.number,
          localStart: s.localStart,
          utcOffset: "-06:00",
          durationMinutes: 120,
        },
      });
    }
    const assignRequest = "seed-assign-" + s.id;
    if (
      !(
        await pool.query(
          "SELECT 1 FROM schedule_revision WHERE event_id=$1 AND actor_id=$2 AND request_id=$3",
          [event, actor, assignRequest],
        )
      ).rowCount
    ) {
      const current = await readSchedule(actor, event);
      await saveSchedule(actor, event, {
        requestId: assignRequest,
        expectedVersion: current.version,
        reason: "Explicit fictional game assignment",
        action: "assign",
        gameId: graph.games.find((g) => g.key === s.key)!.id,
        drawId: s.id,
        sheet: "A",
      });
    }
  }
  // Explicit bounded prefix: A01 loss, then B01 win for T16. A02 must finish
  // before B01. Later games are operated by the actual scorer/organizer UI.
  for (const [key, winner] of [
    ["A01", 1],
    ["A02", 8],
    ["A03", 4],
    ["A04", 5],
    ["A05", 2],
    ["A06", 7],
    ["A07", 3],
    ["A08", 6],
    ["A09", 1],
    ["A10", 4],
    ["A11", 2],
    ["A12", 3],
    ["A13", 1],
    ["A14", 2],
    ["B01", 16],
    ["B02", 13],
    ["B03", 15],
    ["B04", 14],
  ] as const) {
    const gameId = graph.games.find((g) => g.key === key)!.id;
    for (const action of ["start", "end", "confirm"] as const) {
      const requestId = `seed-main-${key}-${action}`;
      if (
        (
          await pool.query(
            "SELECT 1 FROM scoring_command WHERE game_id=$1 AND actor_id=$2 AND request_id=$3",
            [gameId, actor, requestId],
          )
        ).rowCount
      )
        continue;
      const g = await scoringGame(actor, gameId);
      await saveScoring(actor, gameId, {
        requestId,
        expectedVersion: g.version,
        action,
        hammer: null,
        ...(action === "end"
          ? {
              endNumber: 1,
              end: {
                state: "played",
                a: g.entryA === seeds[winner - 1] ? 2 : 0,
                b: g.entryB === seeds[winner - 1] ? 2 : 0,
              },
            }
          : {}),
        ...(action === "confirm"
          ? {
              outcome: "conceded",
              winnerEntryId: seeds[winner - 1],
              reason: "Fictional demonstration concession after one end",
            }
          : {}),
      });
    }
  }
  const b05 = graph.games.find((g) => g.key === "B05")!;
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES('main-triple-scorekeeper','demo-scorekeeper','scorekeeper',$1,$2) ON CONFLICT DO NOTHING",
    [event, b05.id],
  );
  await pool.query(
    "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,'demo.main-initialized',$3)",
    [randomUUID(), actor, event],
  );
}
