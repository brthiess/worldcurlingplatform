import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { processImport } from "../src/modules/imports/staging";
import pg from "pg";
import { authRequest } from "./auth-request";
const base = process.env.BETTER_AUTH_URL!;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sessions = new Map<string, string>();
async function login(role = "administrator") {
  if (sessions.has(role)) return sessions.get(role)!;
  const r = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${role}@demo.invalid`,
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(r.status, 200);
  const cookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  sessions.set(role, cookie);
  return cookie;
}
async function req(query = "", body?: unknown, role = "administrator") {
  return fetch(base + "/api/v1/imports" + query, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Origin: base,
      cookie: await login(role),
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function hash(path: string) {
  const h = createHash("sha256");
  for await (const b of createReadStream(path)) h.update(b);
  return h.digest("hex");
}
async function wait(id: string) {
  for (let i = 0; i < 60; i++) {
    const r = await req(`?job=${id}`);
    assert.equal(r.status, 200);
    const j = await r.json();
    if (["staged", "failed"].includes(j.job.status)) return j;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Import did not reach a terminal state");
}
test("real consistent export becomes a frozen private review batch through the queued staff API", async () => {
  const before = await hash(process.env.CRAWLER_IMPORT_EXPORT!);
  const catalog = await req();
  assert.equal(catalog.status, 200);
  const w = await catalog.json();
  assert.equal(w.source.available, true);
  assert.equal(w.source.digest, before);
  const id = randomUUID(),
    command = { action: "stage", id, sourceDigest: before };
  const r = await req("", command);
  assert.equal(r.status, 200, await r.text());
  const batch = await wait(id);
  assert.equal(batch.job.status, "staged", JSON.stringify(batch.job));
  assert.equal(batch.job.digest, before);
  assert.equal(batch.job.uniqueGames, 4);
  assert.equal(batch.job.sourceRecords, 44);
  assert.equal(batch.job.evidenceRecords, 50);
  // Independent frozen-source inventory: 10 unresolved entry cores, 6 unknown
  // disciplines, 24 people, 21 game issues, 41 missing parser versions, 11 null URLs.
  assert.equal(batch.job.issueCount, 113);
  assert.equal(batch.issues.length, 113);
  const frozenLines = (
    await db.query(
      "SELECT source_line FROM import_record WHERE job_id=$1 ORDER BY ordinal",
      [id],
    )
  ).rows
    .map((r) => r.source_line + "\n")
    .join("");
  assert.equal(createHash("sha256").update(frozenLines).digest("hex"), before);
  const body = await req(`?job=${id}&record=raw-body-134743`);
  assert.equal(body.status, 200);
  const retained = (await body.json()).payload;
  assert.equal(
    retained.bodySha256,
    "f73d059f96fdbe9217d190cf7aa5335b5498c529a1d6c39090204a10b4b84b4f",
  );
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(retained.body, "base64"))
      .digest("hex"),
    "f73d059f96fdbe9217d190cf7aa5335b5498c529a1d6c39090204a10b4b84b4f",
  );
  const byId = Object.fromEntries(batch.games.map((g: any) => [g.id, g]));
  assert.deepEqual(byId["src:cz:game:9205:13:366859"].totals, [5, 3]);
  assert.deepEqual(byId["src:cz:game:9205:13:366859"].ends, [
    [0, 0],
    [2, 0],
    [0, 2],
    [0, 0],
    [1, 0],
    [0, 0],
    [0, 1],
    [2, 0],
  ]);
  assert.equal(
    byId["src:cz:game:9205:13:366859"].firstEndHammer.entryId,
    "src:cz:entry:9205:192891",
  );
  assert.deepEqual(byId["src:cz:game:9694:2:389825"].totals, [3, 8]);
  assert.equal(byId["src:cz:game:9694:2:389825"].firstEndHammer, null);
  assert.deepEqual(byId["src:cz:game:9473:13:391274"].totals, [7, 3]);
  assert.equal(byId["src:cz:game:9473:13:391274"].ends, null);
  assert.equal(byId["src:cz:game:8129:14:322560"].totals, null);
  assert.ok(batch.issues.some((i: any) => i.code === "score_requires_review"));
  assert.ok(
    batch.issues.some((i: any) => i.code === "historical_parser_unknown"),
  );
  const raw = await req(
    `?job=${id}&record=${encodeURIComponent("src:cz:game:9473:13:391274")}`,
  );
  assert.equal(raw.status, 200);
  assert.deepEqual(
    (await raw.json()).payload.partial_score_evidence.raw_cells[0],
    ["X", "X"],
  );
  const again = await req("", command);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).id, id);
  assert.equal((await wait(id)).job.attempts, 1);
  assert.equal(await hash(process.env.CRAWLER_IMPORT_EXPORT!), before);
  assert.equal(
    (await req("", { ...command, sourceDigest: "0".repeat(64) })).status,
    409,
  );
  assert.equal((await req("", command, "organizer")).status, 403);
  const games = await db.query(
    "SELECT count(*)::int n FROM game g JOIN division d ON d.id=g.division_id JOIN event_edition e ON e.id=d.event_id WHERE e.origin='historical_import'",
  );
  assert.equal(games.rows[0].n, 0);
});
test.after(async () => {
  await db.end();
});
test("job creation and its durable queue roll back when audit insertion fails", async () => {
  const id = randomUUID(),
    name = "wcp014_enqueue_" + id.replaceAll("-", "");
  await db.query(
    `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='import_stage_queued' AND NEW.resource_id='${id}' THEN RAISE EXCEPTION 'WCP014 controlled enqueue audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${name} BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION ${name}()`,
  );
  try {
    const r = await req("", {
      action: "stage",
      id,
      sourceDigest: await hash(process.env.CRAWLER_IMPORT_EXPORT!),
    });
    assert.equal(r.status, 503);
    assert.equal((await req(`?job=${id}`)).status, 404);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int n FROM pgboss.job WHERE name='historical-import-stage' AND data->>'importId'=$1",
          [id],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.query(
      `DROP TRIGGER ${name} ON audit_record; DROP FUNCTION ${name}()`,
    );
  }
});
test("late audit failure leaves no partial batch, and deliberate retries have immutable duplicate-safe receipts", async () => {
  const id = randomUUID(),
    name = "wcp014_freeze_" + id.replaceAll("-", ""),
    digest = await hash(process.env.CRAWLER_IMPORT_EXPORT!);
  await db.query(
    `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='import_batch_frozen' AND NEW.resource_id='${id}' THEN RAISE EXCEPTION 'WCP014 controlled freeze audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ${name} BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION ${name}()`,
  );
  try {
    assert.equal(
      (await req("", { action: "stage", id, sourceDigest: digest })).status,
      200,
    );
    const failed = await wait(id);
    assert.equal(failed.job.status, "failed");
    assert.deepEqual(failed.records, []);
    assert.deepEqual(failed.issues, []);
    assert.equal(failed.job.manifest, null);
    const retry = {
      action: "retry",
      id,
      sourceDigest: digest,
      requestId: randomUUID(),
    };
    assert.equal((await req("", retry)).status, 200);
    const second = await wait(id);
    assert.equal(second.job.status, "failed");
    assert.equal(second.job.attempts, 2);
    assert.equal((await req("", retry)).status, 200);
    await new Promise((r) => setTimeout(r, 1200));
    assert.equal((await wait(id)).job.attempts, 2);
  } finally {
    await db.query(
      `DROP TRIGGER ${name} ON audit_record; DROP FUNCTION ${name}()`,
    );
  }
  assert.equal(
    (
      await req("", {
        action: "retry",
        id,
        sourceDigest: digest,
        requestId: randomUUID(),
      })
    ).status,
    200,
  );
  const complete = await wait(id);
  assert.equal(complete.job.status, "staged");
  assert.equal(complete.job.attempts, 3);
  assert.equal(complete.games.length, 4);
});
test("worker rechecks current staff authority rather than trusting the queued actor", async () => {
  const id = randomUUID(),
    grant = randomUUID();
  await db.query(
    "INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES($1,'demo-reviewer','administrator',NULL,NULL)",
    [grant],
  );
  await db.query(
    "INSERT INTO import_job(id,actor_id,source_path,digest,status) VALUES($1,'demo-reviewer',$2,$3,'queued')",
    [
      id,
      process.env.CRAWLER_IMPORT_EXPORT,
      await hash(process.env.CRAWLER_IMPORT_EXPORT!),
    ],
  );
  await db.query("DELETE FROM role_grant WHERE id=$1", [grant]);
  await processImport(db, id);
  const denied = await wait(id);
  assert.equal(denied.job.status, "failed");
  assert.match(denied.job.error, /administrator/);
  assert.deepEqual(denied.records, []);
  assert.equal(
    (
      await req(
        "",
        { action: "stage", id, sourceDigest: denied.job.digest },
        "reviewer",
      )
    ).status,
    403,
  );
});
test("changed export bytes and malformed structural records never leave partial staged contents", async () => {
  const sourceText = await readFile(process.env.CRAWLER_IMPORT_EXPORT!, "utf8"),
    original = await hash(process.env.CRAWLER_IMPORT_EXPORT!);
  for (const scenario of ["changed", "malformed"]) {
    const id = randomUUID(),
      path = join(
        dirname(process.env.CRAWLER_IMPORT_EXPORT!),
        `fault-${id}.ndjson`,
      );
    let text = sourceText;
    if (scenario === "changed") {
      const lines = sourceText.split("\n");
      const h = JSON.parse(lines[0]);
      h.payload.testObservation = "changed private copy";
      lines[0] = JSON.stringify(h);
      text = lines.join("\n");
    } else {
      text = sourceText.replace('"totals":[5,3]', '"totals":[-1,3]');
      assert.notEqual(text, sourceText);
    }
    await writeFile(path, text, { flag: "wx" });
    await db.query(
      "INSERT INTO import_job(id,actor_id,source_path,digest,status) VALUES($1,'demo-administrator',$2,$3,'queued')",
      [id, path, scenario === "changed" ? original : await hash(path)],
    );
    await processImport(db, id);
    const failed = await wait(id);
    assert.equal(failed.job.status, "failed");
    assert.deepEqual(failed.records, []);
    assert.match(
      failed.job.error,
      scenario === "changed" ? /changed/ : /score/,
    );
  }
  assert.equal(await hash(process.env.CRAWLER_IMPORT_EXPORT!), original);
  assert.equal(
    (
      await req("", {
        action: "stage",
        id: randomUUID(),
        sourceDigest: original,
        sourcePath: "C:/arbitrary.sqlite",
      })
    ).status,
    400,
  );
});
test("a frozen batch rejects later appended evidence as well as changed records", async () => {
  const digest = await hash(process.env.CRAWLER_IMPORT_EXPORT!),
    id = randomUUID();
  assert.equal(
    (await req("", { action: "stage", id, sourceDigest: digest })).status,
    200,
  );
  await wait(id);
  await assert.rejects(
    db.query(
      "INSERT INTO import_record(job_id,source_key,kind,source_line,line_digest,payload) VALUES($1,'late-evidence','evidence','{}',$2,'{}')",
      [id, "0".repeat(64)],
    ),
    /frozen|immutable/i,
  );
  await assert.rejects(
    db.query("UPDATE import_record SET payload='{}' WHERE job_id=$1", [id]),
    /immutable/i,
  );
});

test("an exact committed staging receipt acknowledges while its worker still owns the job row", async () => {
  const id = randomUUID(),
    name = "wcp014_receipt_" + id.replaceAll("-", ""),
    key = 140114,
    lock = await db.connect(),
    barrierPid = (await lock.query("SELECT pg_backend_pid() AS id")).rows[0].id,
    command = {
      action: "stage",
      id,
      sourceDigest: await hash(process.env.CRAWLER_IMPORT_EXPORT!),
    };
  let pending: Promise<Response> | undefined;
  await lock.query("SELECT pg_advisory_lock($1)", [key]);
  await db.query(
    `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.job_id='${id}' AND NEW.kind='game' THEN PERFORM pg_advisory_xact_lock(${key}); END IF; RETURN NEW; END $$; CREATE TRIGGER ${name} BEFORE INSERT ON import_record FOR EACH ROW EXECUTE FUNCTION ${name}()`,
  );
  try {
    assert.equal((await req("", command)).status, 200);
    let blocked = false;
    for (let i = 0; i < 100; i++) {
      blocked = !!(
        await db.query(
          "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND $1::integer=ANY(pg_blocking_pids(pid))",
          [barrierPid],
        )
      ).rowCount;
      if (blocked) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal(
      blocked,
      true,
      "The real worker must be blocked behind the fixture barrier",
    );
    const probe = await db.connect();
    try {
      await probe.query("BEGIN");
      await assert.rejects(
        probe.query("SELECT id FROM import_job WHERE id=$1 FOR UPDATE NOWAIT", [
          id,
        ]),
        /could not obtain lock/,
      );
    } finally {
      await probe.query("ROLLBACK");
      probe.release();
    }
    pending = req("", command);
    const response = await Promise.race([
      pending,
      new Promise<null>((r) => setTimeout(() => r(null), 2000)),
    ]);
    assert.notEqual(
      response,
      null,
      "A durable receipt acknowledgement must not wait for the worker's mutable job-row lock",
    );
    assert.equal(response!.status, 200);
    assert.equal((await response!.json()).id, id);
    assert.equal(
      (await (await req(`?job=${id}`)).json()).job.status,
      "running",
    );
    assert.equal(
      (await req("", { ...command, sourceDigest: "0".repeat(64) })).status,
      409,
    );
    const otherId = randomUUID();
    assert.equal(
      (await req("", { ...command, id: otherId, requestId: id })).status,
      409,
    );
    assert.equal((await req(`?job=${otherId}`)).status, 404);
    assert.equal((await req("", command, "organizer")).status, 403);
  } finally {
    await lock.query("SELECT pg_advisory_unlock_all()");
    lock.release();
    if (pending) {
      const response = await pending;
      if (!response.bodyUsed) await response.arrayBuffer();
    }
    await db.query(
      `DROP TRIGGER ${name} ON import_record; DROP FUNCTION ${name}()`,
    );
  }
  const done = await wait(id);
  assert.equal(done.job.status, "staged");
  assert.equal(done.job.attempts, 1);
  assert.equal(
    done.attempts.filter((a: any) => a.action === "import_stage_queued").length,
    1,
  );
});
