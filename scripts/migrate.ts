import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pool } from "../src/db";
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(721001)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`migrations/${name}`, "utf8");
    const sha = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT sha256 FROM schema_migration WHERE name=$1",
      [name],
    );
    if (existing.rows.length && existing.rows[0].sha256 !== sha)
      throw new Error(`Applied migration changed: ${name}`);
    if (!existing.rows.length) {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migration(name,sha256) VALUES($1,$2)",
        [name, sha],
      );
      console.log(`Applied ${name}`);
    }
  }
  await client.query("COMMIT");
  console.log("Migrations up to date");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
