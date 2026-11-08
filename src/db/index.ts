import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
});
pool.on("error", (error) =>
  console.error("Idle database connection failed:", error.message),
);
export const db = drizzle(pool, { schema });
