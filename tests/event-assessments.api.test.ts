import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";
import PgBoss from "pg-boss";
import { freezeContents } from "../src/domain/finalization";
import { authRequest } from "./auth-request";
import { assessmentFixture } from "./event-assessments-fixture";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 }),
  base = process.env.BETTER_AUTH_URL!,
  sessions = new Map<string, string>();
after(() => db.end());
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
  const c = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  sessions.set(role, c);
  return c;
}
const request = (cookie: string, path: string, body?: unknown) =>
  fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
async function waitForJob(
  send: (path: string, body?: unknown) => Promise<Response>,
  f: { divisionId: string; rulesId: string },
  state = "completed",
) {
  const deadline = Date.now() + 20000;
  let view: any;
  while (Date.now() < deadline) {
    const r = await send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    );
    assert.equal(r.status, 200, await r.clone().text());
    view = await r.json();
    if (
      view.selected?.state === state ||
      (state === "terminal" &&
        ["completed", "blocked"].includes(view.selected?.state))
    )
      return view;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `Job ${view?.selected?.id} did not reach ${state}: observed ${view?.selected?.state}; ${view?.selected?.error ?? ""}`,
  );
}
async function waitingCalculation(exceptPid?: number) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    const r = await db.query(
      "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%event_calculation_job%' AND pid<>coalesce($1,0) ORDER BY query_start",
      [exceptPid ?? null],
    );
    if (r.rowCount) return Number(r.rows[0].pid);
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(
    "Real calculation command did not reach the job-row lock barrier",
  );
}
test("complete real event queues immutable duplicate-safe assessment and worker returns independent F2 awards", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send);
  const workspace = async () => {
    const r = await send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    );
    assert.equal(r.status, 200, await r.clone().text());
    return r.json();
  };
  const reviewed = await workspace(),
    cmd = {
      action: "calculate",
      divisionId: f.divisionId,
      version: 0,
      requestId: randomUUID(),
      sourceDigest: reviewed.review.sourceDigest,
      evidence: f.evidence,
    };
  const submitted = await send("/api/v1/event-assessments", cmd);
  assert.equal(submitted.status, 200, await submitted.clone().text());
  const first = await submitted.json();
  const deliveries = await Promise.all(
    Array.from({ length: 3 }, () => send("/api/v1/event-assessments", cmd)),
  );
  for (const r of deliveries) {
    assert.equal(r.status, 200);
    assert.equal((await r.json()).id, first.id);
  }
  assert.equal(
    (
      await send("/api/v1/event-assessments", {
        ...cmd,
        evidence: { ...f.evidence, reviewNote: "conflicting retry" },
      })
    ).status,
    409,
  );
  const deadline = Date.now() + 20000;
  let done: any;
  while (Date.now() < deadline) {
    done = (await workspace()).selected;
    if (["completed", "blocked"].includes(done.state)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(done.state, "completed", done.resultContents);
  const result = JSON.parse(done.resultContents).result;
  assert.equal(result.sfm, "18/5");
  assert.deepEqual(
    f.entries.map(
      (entryId) => result.awards.find((a: any) => a.entryId === entryId).points,
    ),
    ["27", "99/5", "261/20", "261/20", "27/20", "27/20", "27/20", "27/20"],
  );
  assert.equal(done.inputDigest, first.digest);
  assert.equal(
    createHash("sha256").update(first.contents).digest("hex"),
    first.digest,
  );
  assert.equal(
    createHash("sha256").update(done.resultContents).digest("hex"),
    done.resultDigest,
  );
  await assert.rejects(
    db.query("UPDATE event_assessment SET digest=$2 WHERE id=$1", [
      first.id,
      "b".repeat(64),
    ]),
    /immutable/,
  );
  await assert.rejects(
    db.query(
      "UPDATE event_assessment_result SET input_digest=$2 WHERE assessment_id=$1",
      [first.id, "b".repeat(64)],
    ),
    /immutable/,
  );
  await assert.rejects(
    db.query(
      "UPDATE event_calculation_job SET assessment_id=$2 WHERE assessment_id=$1",
      [first.id, randomUUID()],
    ),
    /association is immutable/,
  );
  const adminGrant = (
    await db.query(
      "SELECT * FROM role_grant WHERE user_id='demo-administrator' AND role='administrator'",
    )
  ).rows;
  try {
    await db.query(
      "DELETE FROM role_grant WHERE user_id='demo-administrator' AND role='administrator'",
    );
    assert.equal((await send("/api/v1/event-assessments", cmd)).status, 403);
    assert.equal(
      (
        await send(
          `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
        )
      ).status,
      403,
    );
  } finally {
    for (const g of adminGrant)
      await db.query(
        "INSERT INTO role_grant VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [g.id, g.user_id, g.role, g.event_id, g.game_id],
      );
  }
  assert.equal(
    (
      await request(
        await login("organizer"),
        `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "",
        `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
      )
    ).status,
    401,
  );
});
test("explicit event roster review permits unused unknown starting amounts, while missing current roster review blocks; revisions preserve old bytes", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send);
  const saved = await (
    await send(`/api/v1/ranking-inputs?id=${f.reviewIds[0]}`)
  ).json();
  const draft = {
    id: f.reviewIds[0],
    kind: "season",
    version: 1,
    requestId: randomUUID(),
    state: "draft",
    data: {
      ...saved.data,
      contributions: saved.data.contributions.map((c: any) => ({
        ...c,
        amount: null,
        basis: "unknown",
        ownershipSourceId: "",
      })),
    },
  };
  const modified = await send("/api/v1/ranking-inputs", draft);
  assert.equal(modified.status, 200);
  const current = await modified.json();
  assert.equal(current.state, "draft");
  assert.equal(current.currentReadiness.complete, false);
  f.evidence.entries[0].rosterReview!.version = 2;
  const workspace = () =>
    send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    ).then((r) => r.json());
  let view = await workspace();
  const cmd = {
    action: "calculate",
    divisionId: f.divisionId,
    version: 0,
    requestId: randomUUID(),
    sourceDigest: view.review.sourceDigest,
    evidence: f.evidence,
  };
  assert.equal((await send("/api/v1/event-assessments", cmd)).status, 200);
  view = await waitForJob(send, f);
  const original = view.selected;
  assert.equal(JSON.parse(original.resultContents).result.sfm, "18/5");
  assert.ok(!original.contents.includes('"contributions"'));
  assert.equal(
    JSON.parse(original.contents).source.starting.find(
      (x: any) => x.entryId === f.entries[0],
    ).evidence.startingState,
    "draft",
  );
  const missing = structuredClone(f.evidence);
  missing.entries[0].rosterReview = null;
  assert.equal(
    (
      await send("/api/v1/event-assessments", {
        ...cmd,
        version: 1,
        requestId: randomUUID(),
        evidence: missing,
      })
    ).status,
    200,
  );
  view = await waitForJob(send, f, "blocked");
  assert.equal(view.selected.version, 2);
  assert.equal(view.selected.replacesId, original.id);
  assert.equal(JSON.parse(view.selected.resultContents).result.sfm, null);
  assert.match(view.selected.resultContents, /explicitly review/);
  const old = await (
    await send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}&assessment=${original.id}`,
    )
  ).json();
  assert.equal(old.selected.contents, original.contents);
  assert.equal(old.selected.resultContents, original.resultContents);
  assert.equal(
    (
      await send("/api/v1/event-assessments", {
        action: "retry",
        divisionId: f.divisionId,
        assessmentId: view.selected.id,
        version: 2,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  await db.query(
    "UPDATE division SET ranking_status='ineligible' WHERE id=$1",
    [f.divisionId],
  );
  assert.equal(
    (
      await send("/api/v1/event-assessments", {
        ...cmd,
        version: 2,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
});
test("queue and audit are atomic, failed real worker deliveries retry frozen inputs and retain their failures", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send);
  const view = await (
    await send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    )
  ).json();
  const cmd = {
    action: "calculate",
    divisionId: f.divisionId,
    version: 0,
    requestId: randomUUID(),
    sourceDigest: view.review.sourceDigest,
    evidence: f.evidence,
  };
  const before = (
    await db.query(
      "SELECT count(*) FROM pgboss.job WHERE name='ranking-four-event'",
    )
  ).rows[0].count;
  await db.query(
    "CREATE FUNCTION fail_wcp033_queued_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='event_assessment_queued' THEN RAISE EXCEPTION 'Controlled assessment audit failure'; END IF;RETURN NEW;END $$;CREATE TRIGGER fail_wcp033_queued_audit BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION fail_wcp033_queued_audit()",
  );
  try {
    assert.equal((await send("/api/v1/event-assessments", cmd)).status, 503);
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM event_assessment WHERE division_id=$1",
          [f.divisionId],
        )
      ).rows[0].count,
      "0",
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM pgboss.job WHERE name='ranking-four-event'",
        )
      ).rows[0].count,
      before,
    );
  } finally {
    await db.query(
      "DROP TRIGGER fail_wcp033_queued_audit ON audit_record;DROP FUNCTION fail_wcp033_queued_audit()",
    );
  }
  await db.query(
    `CREATE FUNCTION fail_wcp033_result() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM event_assessment WHERE id=NEW.assessment_id AND division_id='${f.divisionId}') THEN RAISE EXCEPTION 'Controlled transient result storage failure'; END IF;RETURN NEW;END $$;CREATE TRIGGER fail_wcp033_result BEFORE INSERT ON event_assessment_result FOR EACH ROW EXECUTE FUNCTION fail_wcp033_result()`,
  );
  let failed: any;
  try {
    const accepted = await send("/api/v1/event-assessments", cmd);
    assert.equal(accepted.status, 200);
    failed = (await waitForJob(send, f, "failed")).selected;
    assert.match(failed.error, /Controlled transient/);
    assert.equal(failed.resultContents, null);
    assert.equal(failed.deliveries[0].outcome, "failed");
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM audit_record WHERE resource_id=$1 AND action='event_assessment_calculated'",
          [failed.id],
        )
      ).rows[0].count,
      "0",
    );
  } finally {
    await db.query(
      "DROP TRIGGER fail_wcp033_result ON event_assessment_result;DROP FUNCTION fail_wcp033_result()",
    );
  }
  const retry = {
    action: "retry",
    divisionId: f.divisionId,
    assessmentId: failed.id,
    version: 1,
    requestId: randomUUID(),
  };
  assert.equal((await send("/api/v1/event-assessments", retry)).status, 200);
  const completed = (await waitForJob(send, f)).selected;
  assert.equal(completed.contents, failed.contents);
  assert.equal(completed.digest, failed.digest);
  assert.ok(completed.attempts >= 2);
  assert.equal(completed.deliveries[0].outcome, "failed");
  assert.equal(completed.deliveries.at(-1).outcome, "completed");
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM audit_record WHERE resource_id=$1 AND action='event_assessment_calculated'",
        [completed.id],
      )
    ).rows[0].count,
    "1",
  );
  const replay = await send("/api/v1/event-assessments", retry);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).id, completed.id);
  assert.equal(
    (
      await db.query(
        "SELECT count(*) FROM event_assessment_result WHERE assessment_id=$1",
        [completed.id],
      )
    ).rows[0].count,
    "1",
  );
});
test("same-label different engine implementation fails durably; retry never silently recalculates under new code", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send);
  const view = await (
    await send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    )
  ).json();
  assert.equal(
    (
      await send("/api/v1/event-assessments", {
        action: "calculate",
        divisionId: f.divisionId,
        version: 0,
        requestId: randomUUID(),
        sourceDigest: view.review.sourceDigest,
        evidence: f.evidence,
      })
    ).status,
    200,
  );
  const original = (await waitForJob(send, f)).selected,
    input = JSON.parse(original.contents);
  assert.match(input.engineIdentity.fingerprint, /^[a-f0-9]{64}$/);
  assert.ok(
    input.engineIdentity.files.some(
      (x: any) => x.path === "src/domain/ranking-inputs.ts",
    ),
  );
  const changed = freezeContents({
      ...input,
      engineIdentity: { ...input.engineIdentity, fingerprint: "0".repeat(64) },
    }),
    id = randomUUID(),
    auditId = randomUUID(),
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schedule: false,
      supervise: false,
    });
  boss.on("error", () => {});
  await boss.start();
  await boss.createQueue("ranking-four-event");
  const c = await db.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,'demo-administrator','fixture_historical_engine_revision',$2)",
      [auditId, id],
    );
    await c.query(
      "INSERT INTO event_assessment(id,division_id,version,replaces_id,finalization_version,rules_id,rules_version,contents,digest,engine,actor_id,request_id,command_digest,audit_id) VALUES($1,$2,2,$3,1,$4,1,$5,$6,$7,'demo-administrator',$8,$9,$10)",
      [
        id,
        f.divisionId,
        original.id,
        f.rulesId,
        changed.contents,
        changed.digest,
        input.engine,
        randomUUID(),
        "0".repeat(64),
        auditId,
      ],
    );
    const queueId = await boss.send(
      "ranking-four-event",
      { assessmentId: id },
      {
        retryLimit: 1,
        retryDelay: 2,
        db: { executeSql: (sql, values) => c.query(sql, values) },
      },
    );
    await c.query(
      "INSERT INTO event_calculation_job(assessment_id,queue_id,state) VALUES($1,$2,'queued')",
      [id, queueId],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await boss.stop();
  }
  const failed = (await waitForJob(send, f, "failed")).selected;
  assert.match(failed.error, /implementation fingerprint/);
  assert.equal(failed.resultContents, null);
  assert.equal(failed.contents, changed.contents);
  assert.equal(
    (
      await send("/api/v1/event-assessments", {
        action: "retry",
        divisionId: f.divisionId,
        assessmentId: id,
        version: 2,
        requestId: randomUUID(),
      })
    ).status,
    200,
  );
  const again = (await waitForJob(send, f, "failed")).selected;
  assert.equal(again.resultContents, null);
  assert.equal(again.digest, changed.digest);
});
test("manual retry queued behind an automatic completion rechecks terminal job state under its row lock", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send),
    view = await (
      await send(
        `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
      )
    ).json();
  await db.query(
    `CREATE FUNCTION fail_wcp033_race_result() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM event_assessment WHERE id=NEW.assessment_id AND division_id='${f.divisionId}') THEN RAISE EXCEPTION 'Controlled retry barrier failure'; END IF;RETURN NEW;END $$;CREATE TRIGGER fail_wcp033_race_result BEFORE INSERT ON event_assessment_result FOR EACH ROW EXECUTE FUNCTION fail_wcp033_race_result()`,
  );
  let failed: any;
  const blocker = await db.connect();
  let active = false;
  try {
    assert.equal(
      (
        await send("/api/v1/event-assessments", {
          action: "calculate",
          divisionId: f.divisionId,
          version: 0,
          requestId: randomUUID(),
          sourceDigest: view.review.sourceDigest,
          evidence: f.evidence,
        })
      ).status,
      200,
    );
    failed = (await waitForJob(send, f, "failed")).selected;
    await blocker.query("BEGIN");
    active = true;
    await blocker.query(
      "SELECT assessment_id FROM event_calculation_job WHERE assessment_id=$1 FOR UPDATE",
      [failed.id],
    );
    await db.query(
      "DROP TRIGGER fail_wcp033_race_result ON event_assessment_result;DROP FUNCTION fail_wcp033_race_result()",
    );
    const workerPid = await waitingCalculation();
    const retry = send("/api/v1/event-assessments", {
      action: "retry",
      divisionId: f.divisionId,
      assessmentId: failed.id,
      version: 1,
      requestId: randomUUID(),
    });
    await waitingCalculation(workerPid);
    await blocker.query("COMMIT");
    active = false;
    const response = await retry;
    assert.equal(
      response.status,
      409,
      (await response.clone().text()).slice(0, 500),
    );
    const completed = (await waitForJob(send, f)).selected;
    assert.equal(completed.state, "completed");
    assert.ok(completed.resultContents);
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM event_assessment_result WHERE assessment_id=$1",
          [failed.id],
        )
      ).rows[0].count,
      "1",
    );
  } finally {
    if (active) await blocker.query("ROLLBACK");
    blocker.release();
    await db.query(
      "DROP TRIGGER IF EXISTS fail_wcp033_race_result ON event_assessment_result;DROP FUNCTION IF EXISTS fail_wcp033_race_result()",
    );
  }
});
test("women's special event consumes every completed unscheduled game from accepted019, without inventing session order", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send, {
      discipline: "women_four",
      unscheduled: true,
    });
  f.evidence.event.kind = "world_qualifier";
  const view = await (
    await send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    )
  ).json();
  assert.equal(view.review.current.games.length, 11);
  assert.ok(view.review.current.games.every((g: any) => g.drawId === null));
  assert.equal(view.review.current.draws.length, 0);
  const r = await send("/api/v1/event-assessments", {
    action: "calculate",
    divisionId: f.divisionId,
    version: 0,
    requestId: randomUUID(),
    sourceDigest: view.review.sourceDigest,
    evidence: f.evidence,
  });
  assert.equal(r.status, 200, await r.clone().text());
  const completed = (await waitForJob(send, f)).selected,
    result = JSON.parse(completed.resultContents).result;
  assert.equal(result.sfm, "63/10");
  assert.equal(result.series, "Champion");
  assert.equal(
    result.awards.find((a: any) => a.entryId === f.entries[0]).points,
    "189/4",
  );
});
test("published immutable single-knockout profile overrides a misleading legacy label and rejects a missing reduction", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send, { platformSingle: true });
  const view = await (
    await send(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    )
  ).json();
  const wrong = structuredClone(f.evidence);
  wrong.event.singleKnockout = false;
  const cmd = {
    action: "calculate",
    divisionId: f.divisionId,
    version: 0,
    requestId: randomUUID(),
    sourceDigest: view.review.sourceDigest,
    evidence: wrong,
  };
  assert.equal((await send("/api/v1/event-assessments", cmd)).status, 200);
  const blocked = (await waitForJob(send, f, "terminal")).selected;
  assert.equal(blocked.state, "blocked");
  assert.match(blocked.resultContents, /format\/stages/);
  assert.equal(
    (
      await send("/api/v1/event-assessments", {
        ...cmd,
        version: 1,
        requestId: randomUUID(),
        evidence: f.evidence,
      })
    ).status,
    200,
  );
  const completed = (await waitForJob(send, f)).selected,
    input = JSON.parse(completed.contents),
    result = JSON.parse(completed.resultContents).result;
  assert.equal(
    input.source.publishedProfile.definition.family,
    "single_knockout",
  );
  assert.equal(input.source.publishedProfile.revision, 2);
  assert.equal(input.source.publishedProfile.nodes.length, 7);
  assert.equal(
    input.source.current.division.format,
    "Round robin and playoffs",
  );
  assert.equal(result.sfm, "27/10");
  assert.equal(
    result.awards.find((a: any) => a.entryId === f.entries[0]).points,
    "81/4",
  );
});
test("an identity change committing during source review invalidates the queued assessment instead of freezing an earlier identified projection", async () => {
  const cookie = await login(),
    send = (path: string, body?: unknown) => request(cookie, path, body),
    f = await assessmentFixture(db, send),
    view = await (
      await send(
        `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
      )
    ).json(),
    playerId = f.playerLists[0][0],
    blocker = await db.connect();
  let active = false;
  try {
    await blocker.query("BEGIN");
    active = true;
    const pid = Number(
      (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0].pid,
    );
    await blocker.query(
      "UPDATE player SET identity_status='provisional' WHERE id=$1",
      [playerId],
    );
    const pending = send("/api/v1/event-assessments", {
      action: "calculate",
      divisionId: f.divisionId,
      version: 0,
      requestId: randomUUID(),
      sourceDigest: view.review.sourceDigest,
      evidence: f.evidence,
    });
    let reached = false;
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      if (
        (
          await db.query(
            "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))",
            [pid],
          )
        ).rowCount
      ) {
        reached = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.ok(
      reached,
      "The real source review must reach the identity writer's lock barrier",
    );
    await blocker.query("COMMIT");
    active = false;
    const response = await pending;
    assert.equal(response.status, 409);
    assert.equal(
      (
        await db.query(
          "SELECT count(*) FROM event_assessment WHERE division_id=$1",
          [f.divisionId],
        )
      ).rows[0].count,
      "0",
    );
  } finally {
    if (active) await blocker.query("ROLLBACK");
    blocker.release();
    await db.query(
      "UPDATE player SET identity_status='identified' WHERE id=$1",
      [playerId],
    );
  }
});
