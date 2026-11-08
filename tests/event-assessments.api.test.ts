import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import pg from "pg";
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
    if (view.selected?.state === state) return view;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `Job did not reach ${state}: ${JSON.stringify(view?.selected)}`,
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
