import PgBoss from "pg-boss";
export const newsQueue = "news-fetch";
let pending: Promise<PgBoss> | undefined;
export function newsProducer() {
  return (pending ??= (async () => {
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schedule: false,
      supervise: false,
    });
    boss.on("error", (e) => console.error("News queue:", e.message));
    await boss.start();
    await boss.createQueue(newsQueue);
    return boss;
  })().catch((e) => {
    pending = undefined;
    throw e;
  }));
}
