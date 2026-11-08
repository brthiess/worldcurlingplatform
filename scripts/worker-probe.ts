import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import PgBoss from 'pg-boss';
import { startWorker, probeQueue } from '../src/worker/runtime';
import { pool } from '../src/db';
const worker = await startWorker();
const producer = new PgBoss(process.env.DATABASE_URL!);
try {
  await producer.start();
  const probeId = randomUUID();
  const id = await producer.send(probeQueue,{probeId},{retryLimit:2,retryDelay:1});
  assert.ok(id);
  let job;
  for (let attempt=0;attempt<30;attempt++) {
    job = await producer.getJobById(probeQueue,id);
    if (job?.state==='completed') break;
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.equal(job?.state,'completed');
  assert.deepEqual(job?.output,{status:'ready',probeId});
  console.log('PostgreSQL-backed job completed through pg-boss API; handler output verified');
} finally { await producer.stop(); await worker.stop(); await pool.end(); }
