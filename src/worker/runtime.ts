import PgBoss from 'pg-boss';
import { pool } from '../db';
export const probeQueue = 'runtime-probe';
export async function startWorker() {
  const boss = new PgBoss(process.env.DATABASE_URL!);
  boss.on('error', error=>console.error('Worker error:',error.message));
  await boss.start();
  await boss.createQueue(probeQueue);
  await boss.work<{ probeId: string }>(probeQueue,{pollingIntervalSeconds:1},async ([job])=>{
    if (typeof job.data.probeId!=='string' || job.data.probeId.length>100) throw new Error('Invalid probe identifier');
    await pool.query('INSERT INTO worker_probe(id) VALUES($1) ON CONFLICT DO NOTHING',[job.data.probeId]);
    return { status:'ready', probeId:job.data.probeId };
  });
  return boss;
}
