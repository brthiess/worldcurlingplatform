import type { PoolClient } from "pg";
export async function seedDraws(c: PoolClient) {
  const unsafe = await c.query(
    "SELECT id FROM event_edition WHERE id='single-knockout-2026' AND origin<>'fictional_demo'",
  );
  if (unsafe.rowCount)
    throw new Error("Refusing to overwrite a non-demo knockout edition");
  await c.query(
    "INSERT INTO event_series(id,name,organization_id) VALUES('single-knockout-demo','Single Knockout Review','prairie-club') ON CONFLICT DO NOTHING",
  );
  await c.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status,organization_id,city,country,responsible_administrator_id) VALUES('single-knockout-2026','single-knockout-demo','Single Knockout Review 2026','Prairie Curling Centre','Regina, Canada','America/Regina','2026-11-08','2026-11-10','fictional_demo',true,'approved','prairie-club','Regina','Canada','demo-administrator') ON CONFLICT DO NOTHING",
  );
  await c.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES('single-knockout-six','single-knockout-2026','Six-entry single knockout','men_four','Single knockout · six seeded entries') ON CONFLICT DO NOTHING",
  );
  await c.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES('single-knockout-organizer','demo-organizer','organizer','single-knockout-2026') ON CONFLICT DO NOTHING",
  );
  for (let n = 1; n <= 6; n++)
    await c.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,'single-knockout-six',$2) ON CONFLICT DO NOTHING",
      ["single-seed-" + n, "Review team " + n],
    );
}
