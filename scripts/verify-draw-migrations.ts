import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const applied = (
    await pool.query("SELECT name,sha256 FROM schema_migration ORDER BY name")
  ).rows;
  const names = (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort();
  assert.deepEqual(
    applied.map((r) => r.name),
    names,
  );
  for (const row of applied)
    assert.equal(
      createHash("sha256")
        .update(await readFile("migrations/" + row.name))
        .digest("hex"),
      row.sha256,
      row.name,
    );
  const template = (
    await pool.query(
      "SELECT version,definition FROM draw_template_version WHERE id='application-single8-seeded-v1'",
    )
  ).rows;
  assert.equal(template.length, 1);
  assert.equal(template[0].version, 1);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::integer AS n FROM event_entry WHERE division_id='single-knockout-six'",
      )
    ).rows[0].n,
    6,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::integer AS n FROM game WHERE division_id='single-knockout-six'",
      )
    ).rows[0].n,
    0,
  );
  console.log(
    JSON.stringify({
      migrationCount: names.length,
      allSha256Match: true,
      profileVersion: 1,
      seedEntries: 6,
      seedGames: 0,
      profileMigrationSha256: applied.find((r) => r.name.startsWith("0022_"))
        .sha256,
    }),
  );
} finally {
  await pool.end();
}
