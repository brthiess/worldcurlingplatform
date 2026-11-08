import { startWorker } from "./runtime";
import { pool } from "../db";
const boss = await startWorker();
console.log(
  "Worker listening: runtime-probe, news-fetch, hourly approved feed refresh",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await boss.stop({ graceful: true, timeout: 15000 });
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
