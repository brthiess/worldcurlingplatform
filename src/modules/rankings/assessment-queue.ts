import PgBoss from "pg-boss";
export const assessmentQueue = "ranking-four-event";
let pending: Promise<PgBoss> | undefined;
export function assessmentProducer() {
  return (pending ??= (async () => {
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schedule: false,
      supervise: false,
    });
    boss.on("error", (e) => console.error("Assessment queue:", e.message));
    await boss.start();
    await boss.createQueue(assessmentQueue);
    return boss;
  })().catch((e) => {
    pending = undefined;
    throw e;
  }));
}
export async function stopAssessmentProducer() {
  const p = pending;
  pending = undefined;
  if (p) await (await p).stop();
}
