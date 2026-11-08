import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { pool } from "../src/db";
if (
  process.env.ALLOW_DEMO_SEED !== "true" ||
  !process.env.DEMO_PASSWORD ||
  process.env.DEMO_PASSWORD.length < 12
)
  throw new Error(
    "Explicit ALLOW_DEMO_SEED=true and DEMO_PASSWORD (12+ characters) required",
  );
const client = await pool.connect();
try {
  const password = await hashPassword(process.env.DEMO_PASSWORD);
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(721002)");
  const unsafe = await client.query(
    "SELECT id FROM event_edition WHERE id IN ('prairie-2026','other-2026') AND origin <> 'fictional_demo'",
  );
  if (unsafe.rowCount)
    throw new Error("Refusing to overwrite a non-demo event");
  await client.query(
    "INSERT INTO event_series(id,name) VALUES('prairie','Prairie Open'),('other','Northern Open') ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) VALUES('prairie-2026','prairie','Prairie Open 2026','Prairie Curling Centre','Regina, Canada','America/Regina','2026-11-08','2026-11-10','fictional_demo',true,'approved'),('other-2026','other','Northern Open 2026','Northern Ice','Calgary, Canada','America/Edmonton','2026-11-08','2026-11-10','fictional_demo',false,'draft') ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES('prairie-men','prairie-2026', 'Men’s four-player','men_four','16-team triple knockout'),('other-men','other-2026','Men’s four-player','men_four','16-team triple knockout') ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO draw_session VALUES('draw-1','prairie-men',1,'2026-11-08T09:00:00-06:00','completed'),('draw-2','prairie-men',2,'2026-11-08T13:00:00-06:00','live'),('draw-3','prairie-men',3,'2026-11-08T17:00:00-06:00','scheduled'),('other-draw','other-men',1,'2026-11-08T13:00:00-07:00','scheduled') ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO draw_session VALUES('draw-4','prairie-men',4,'2026-11-09T09:00:00-06:00','scheduled') ON CONFLICT DO NOTHING",
  );
  const names = [
    "North",
    "Granite",
    "Prairie",
    "Lake",
    "Cedar",
    "Summit",
    "River",
    "Birch",
    "Aspen",
    "Harbour",
    "Meadow",
    "Pine",
    "Ridge",
    "Valley",
    "Willow",
    "West",
  ];
  for (const [i, name] of names.entries())
    await client.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [`entry-${i + 1}`, "prairie-men", `Team ${name}`],
    );
  await client.query(
    "INSERT INTO game(id,draw_id,sheet,phase,state,entry_a,entry_b,slot_a,slot_b,total_a,total_b,hammer) VALUES('game-1','draw-1','A','A path · Opening round','confirmed','entry-1','entry-2','Team North','Team Granite',6,3,null),('game-2','draw-2','A','A path · Round 2','live','entry-1','entry-3','Team North','Team Prairie',3,2,'b'),('game-3','draw-2','B','B path · Round 1','live','entry-2','entry-4','Team Granite','Team Lake',null,null,null),('game-4','draw-3','A','A path · Round 3','scheduled',null,null,'Winner of game 2','Winner of game 5',null,null,null),('other-game','other-draw','A','Opening round','scheduled',null,null,'Entry pending','Entry pending',null,null,null) ON CONFLICT DO NOTHING",
  );
  await client.query(
    "UPDATE game SET slot_b='Opponent to be assigned' WHERE id='game-4' AND slot_b='Winner of game 5'",
  );
  for (const id of ["game-1", "game-2", "game-3", "game-4"]) {
    for (const side of ["a", "b"])
      for (let end = 1; end <= 8; end++) {
        const points =
          id === "game-1"
            ? (side === "a" ? [0, 2, 0, 1, 0, 3] : [1, 0, 2, 0, 0, 0])[end - 1]
            : id === "game-2"
              ? (side === "a" ? [0, 2, 0, 1] : [1, 0, 1, 0])[end - 1]
              : undefined;
        const state =
          points !== undefined
            ? "played"
            : id === "game-1"
              ? "unplayed"
              : id === "game-3" && end <= 2
                ? "unknown"
                : "upcoming";
        await client.query(
          "INSERT INTO game_end_score VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [id, side, end, state, points ?? null],
        );
      }
  }
  await client.query(
    "INSERT INTO auth_user(id,name,email,email_verified) VALUES('demo-ungranted','Unassigned test persona','ungranted@demo.invalid',true) ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,'demo-ungranted','credential','demo-ungranted',$2,now(),now()) ON CONFLICT(provider_id,account_id) DO NOTHING",
    [randomUUID(), password],
  );
  for (const role of [
    "administrator",
    "organizer",
    "scorekeeper",
    "reviewer",
  ]) {
    const id = `demo-${role}`;
    await client.query(
      "INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,$2,$3,true) ON CONFLICT(id) DO NOTHING",
      [id, `Demo ${role}`, `${role}@demo.invalid`],
    );
    await client.query(
      "INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now()) ON CONFLICT(provider_id,account_id) DO NOTHING",
      [randomUUID(), id, password],
    );
    await client.query(
      "INSERT INTO role_grant VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [
        `grant-${role}`,
        id,
        role,
        role === "administrator" ? null : "prairie-2026",
        role === "scorekeeper" ? "game-2" : null,
      ],
    );
  }
  await client.query(
    "INSERT INTO organizing_organization(id,name,approval_administrator_id) VALUES('prairie-club','Prairie Curling Club','demo-administrator') ON CONFLICT DO NOTHING",
  );
  await client.query(
    "INSERT INTO organization_organizer VALUES('prairie-club','demo-organizer') ON CONFLICT DO NOTHING",
  );
  await client.query(
    "UPDATE event_series SET organization_id='prairie-club' WHERE id='prairie' AND organization_id IS NULL",
  );
  await client.query(
    "UPDATE event_edition SET organization_id='prairie-club',city='Regina',country='Canada',responsible_administrator_id='demo-administrator' WHERE id='prairie-2026' AND organization_id IS NULL",
  );
  await client.query(
    "INSERT INTO player(id,name,origin) VALUES('demo-player','Alex Demo','fictional_demo'),('demo-player-other','Morgan Demo','fictional_demo') ON CONFLICT DO NOTHING",
  );
  await client.query("COMMIT");
  console.log(
    "Fictional scenario seeded (repeatable, preserves later changes). Demo persona emails: administrator/organizer/scorekeeper/reviewer @demo.invalid. Password comes only from local environment.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
