import PgBoss from "pg-boss";
import type { Pool } from "pg";
import { fetchSource } from "../modules/news/service";
import { newsQueue } from "../modules/news/queue";
import { assessmentQueue } from "../modules/rankings/assessment-queue";
import { processEventAssessment } from "../modules/rankings/assessments";
import { importQueue, processImport } from "../modules/imports/staging";
export const probeQueue = "runtime-probe";
export async function startWorker(database?: Pool) {
  const pool = database ?? (await import("../db")).pool;
  const boss = new PgBoss(process.env.DATABASE_URL!);
  boss.on("error", (error) => console.error("Worker error:", error.message));
  await boss.start();
  await boss.createQueue(probeQueue);
  await boss.createQueue(importQueue);
  await boss.work<{importId:string}>(importQueue,{pollingIntervalSeconds:1},async ([job])=>{
    if(typeof job.data.importId!=="string" || !/^[a-zA-Z0-9-]{1,80}$/.test(job.data.importId))throw new Error("Invalid import identifier");
    await processImport(pool,job.data.importId);
  });
  await boss.createQueue(assessmentQueue);
  await boss.work<{ assessmentId: string }>(
    assessmentQueue,
    { pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (
        typeof job.data.assessmentId !== "string" ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(job.data.assessmentId)
      )
        throw new Error("Invalid event assessment identifier");
      await processEventAssessment(pool, job.data.assessmentId, job.id);
    },
  );
  await boss.work<{ probeId: string }>(
    probeQueue,
    { pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (typeof job.data.probeId !== "string" || job.data.probeId.length > 100)
        throw new Error("Invalid probe identifier");
      await pool.query(
        "INSERT INTO worker_probe(id) VALUES($1) ON CONFLICT DO NOTHING",
        [job.data.probeId],
      );
      return { status: "ready", probeId: job.data.probeId };
    },
  );
  await boss.createQueue(newsQueue);
  await boss.work<{ sourceId: string }>(
    newsQueue,
    { pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (
        typeof job.data.sourceId !== "string" ||
        job.data.sourceId.length > 80
      )
        throw new Error("Invalid source identifier");
      await fetchSource(pool, job.data.sourceId, job.id);
    },
  );
  await boss.createQueue("news-refresh-approved");
  await boss.work(
    "news-refresh-approved",
    { pollingIntervalSeconds: 5 },
    async () => {
      const sources = await pool.query(
        "SELECT id FROM news_source WHERE approved",
      );
      for (const source of sources.rows)
        await boss.send(
          newsQueue,
          { sourceId: source.id },
          {
            retryLimit: 3,
            retryDelay: 5,
            retryBackoff: true,
            expireInSeconds: 60,
            singletonKey: source.id,
            singletonSeconds: 30,
          },
        );
    },
  );
  await boss.schedule("news-refresh-approved", "0 * * * *", {}, { tz: "UTC" });
  return boss;
}
