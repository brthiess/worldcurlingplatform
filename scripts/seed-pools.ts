import { pool } from "../src/db";
import { saveDraw, drawWorkspace } from "../src/modules/draws/draws";
import { POOL_TEMPLATE } from "../src/domain/pools";
/** A separate labelled edition; repeat seeds retain operator results and history. */
export async function seedPools() {
  const event = "pools-2026",
    id = "pools-eight";
  if (
    (
      await pool.query(
        "SELECT id FROM event_edition WHERE id=$1 AND origin<>'fictional_demo'",
        [event],
      )
    ).rowCount
  )
    throw new Error("Refusing to seed a non-demo pool edition");
  await pool.query(
    "INSERT INTO event_series(id,name,organization_id) VALUES('pools-demo','Pooled Round Robin Review','prairie-club') ON CONFLICT DO NOTHING",
  );
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES($1,'pools-demo','Pooled Round Robin Review 2026','Prairie Curling Centre','Regina, Canada','America/Regina','2026-11-08','2026-11-10','fictional_demo',true,'approved') ON CONFLICT DO NOTHING",
    [event],
  );
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Two pools of four','men_four','round_robin') ON CONFLICT DO NOTHING",
    [id, event],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES('pools-organizer','demo-organizer','organizer',$1) ON CONFLICT DO NOTHING",
    [event],
  );
  const seeds = Array.from({ length: 8 }, (_, i) => `pools-entry-${i + 1}`);
  for (const [i, entry] of seeds.entries())
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [entry, id, `Fictional pool team ${i + 1}`],
    );
  const current = await drawWorkspace("demo-organizer", id);
  if (current.version > 0) return;
  await saveDraw("demo-organizer", id, {
    requestId: "pool-demo-preview",
    expectedVersion: 0,
    action: "preview",
    template: POOL_TEMPLATE,
    seedEntryIds: seeds,
    reason: "Adopted application pools2x4 fixture; manual playoff selection",
  });
  await saveDraw("demo-organizer", id, {
    requestId: "pool-demo-publish",
    expectedVersion: 1,
    action: "publish",
    reason: "Publish labelled three-round pool demonstration",
  });
}
