import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { assessmentFixture } from "./event-assessments-fixture";
import { source } from "./ranking-inputs-fixtures";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 }),
  base = process.env.BETTER_AUTH_URL!;
after(() => db.end());
let cookie = "";
async function send(path: string, body?: unknown) {
  if (!cookie) {
    const r = await authRequest(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "administrator@demo.invalid",
        password: process.env.DEMO_PASSWORD,
      }),
    });
    assert.equal(r.status, 200);
    cookie = r.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function json(path: string, body?: unknown) {
  const r = await send(path, body);
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
test("real persisted awards produce immutable overall contributions, command retries and frozen replay", async () => {
  const f = await assessmentFixture(db, send);
  const review = await json(
    `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
  );
  await json("/api/v1/event-assessments", {
    action: "calculate",
    divisionId: f.divisionId,
    version: 0,
    sourceDigest: review.review.sourceDigest,
    requestId: randomUUID(),
    evidence: f.evidence,
  });
  let completed: any;
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    completed = await json(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    );
    if (completed.selected?.state === "completed") break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(completed.selected.state, "completed");
  // Distinct independently sourced prior entitlements avoid exhausted fixture ties.
  for (let i = 0; i < 8; i++) {
    const v = await json(`/api/v1/ranking-inputs?id=${f.reviewIds[i]}`);
    v.data.contributions.forEach((c: any) => (c.amount = String(50 + i * 10)));
    await json("/api/v1/ranking-inputs", {
      id: v.id,
      kind: "season",
      version: v.version,
      requestId: randomUUID(),
      state: "reviewed",
      data: v.data,
    });
  }
  const path = `/api/v1/overall-rankings?discipline=men_four&date=2026-11-23&rules=${f.rulesId}`;
  const w = await json(path);
  const evidence = {
    policyId: "wcp.four-overall-policy.2026-27.v1",
    sources: [source],
    reviewNote:
      "Fictional full list including separately sourced exclusions, not official results.",
    events: w.review.events.map((e: any) => ({
      divisionId: e.divisionId,
      state: e.divisionId === f.divisionId ? "assessed" : "excluded",
      sourceId: "official",
      note: "Fictional full-universe assessment/exclusion decision.",
    })),
    subjects: w.review.subjects.map((s: any) => ({
      registrationId: s.registrationId,
      eligibility: f.seasonIds.includes(s.registrationId)
        ? "eligible"
        : "excluded",
      sourceId: "official",
      note: "Fictional full-universe eligibility and no unrecorded transfers or penalties.",
      continuity: {
        state: "none",
        sourceId: "official",
        note: "Independently reviewed individual starting rights; no continuity floor.",
        prior: null,
      },
      adjustments: {
        state: "none",
        sourceId: "official",
        note: "No outstanding ownership changes, ordinary adjustments, penalties or exemptions.",
        exclusions: [],
      },
    })),
  };
  const cmd = {
    action: "calculate",
    discipline: "men_four",
    effectiveDate: "2026-11-23",
    rulesId: f.rulesId,
    version: w.version,
    sourceDigest: w.review.sourceDigest,
    requestId: randomUUID(),
    evidence,
  };
  const done = await json("/api/v1/overall-rankings", cmd);
  assert.equal(done.result.state, "ready", JSON.stringify(done.result.issues));
  assert.equal(
    done.result.rows.find((r: any) => r.id === f.seasonIds[0]).total,
    "102",
  ); //27 + 200 ×3/8
  assert.equal(
    done.result.rows.find((r: any) => r.id === f.seasonIds[0]).counted[0]
      .points,
    "27",
  );
  assert.equal((await json("/api/v1/overall-rankings", cmd)).id, done.id);
  assert.equal(
    (
      await send("/api/v1/overall-rankings", {
        ...cmd,
        evidence: { ...evidence, reviewNote: "Conflict" },
      })
    ).status,
    409,
  );
  const replay = await json("/api/v1/overall-rankings", {
    action: "replay",
    runId: done.id,
    discipline: "men_four",
    effectiveDate: "2026-11-23",
    requestId: randomUUID(),
  });
  assert.equal(replay.resultDigest, done.resultDigest);
  assert.equal(
    (
      await send("/api/v1/overall-rankings", {
        ...cmd,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  const old = await json(`/api/v1/overall-rankings?id=${done.id}`);
  assert.equal(old.manifestDigest, done.manifestDigest);
  assert.equal(old.resultDigest, done.resultDigest);
  // A newer033 input is append-only. It must invalidate a source captured before waiting on the overall lock.
  const before = await json(path),
    barrier = await db.connect();
  await barrier.query("BEGIN");
  const barrierPid = (await barrier.query("SELECT pg_backend_pid() AS pid"))
    .rows[0].pid;
  await barrier.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    "overall:men_four:2026-11-23",
  ]);
  const waiting = send("/api/v1/overall-rankings", {
    ...cmd,
    version: before.version,
    sourceDigest: before.review.sourceDigest,
    requestId: randomUUID(),
  });
  let seen = false;
  for (let i = 0; i < 200; i++) {
    const q = await db.query(
      "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND pid<>$1",
      [barrierPid],
    );
    if (q.rowCount) {
      seen = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.equal(seen, true, "Real overall command reached advisory barrier");
  try {
    const current = await json(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    );
    const e = structuredClone(f.evidence);
    e.entries.forEach((x, i) => (x.rosterReview!.version = 2));
    await json("/api/v1/event-assessments", {
      action: "calculate",
      divisionId: f.divisionId,
      version: current.selected.version,
      sourceDigest: current.review.sourceDigest,
      requestId: randomUUID(),
      evidence: e,
    });
  } finally {
    await barrier.query("COMMIT");
    barrier.release();
  }
  assert.equal(
    (await waiting).status,
    409,
    "Fresh source must see033 input appended while waiting",
  );
  for (let i = 0; i < 200; i++) {
    const a = await json(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    );
    if (a.selected.state === "completed") break;
    await new Promise((r) => setTimeout(r, 50));
  }
  await json(`/api/v1/games/${f.games[0].id}/scoring`, {
    requestId: randomUUID(),
    expectedVersion: 2,
    action: "correct",
    hammer: null,
    outcome: "conceded",
    winnerEntryId: f.entries[f.games[0].winner],
    reason: "Ordinary corrected sporting evidence after frozen finalization",
    ends: [],
  });
  const dirty = await json(path),
    dirtyRun = await json("/api/v1/overall-rankings", {
      ...cmd,
      version: dirty.version,
      sourceDigest: dirty.review.sourceDigest,
      requestId: randomUUID(),
    });
  assert.equal(
    dirtyRun.result.state,
    "blocked",
    "A changed current sporting source needs attention even before finalization version increments",
  );
  assert.match(
    dirtyRun.result.issues.join(" "),
    /sporting source|current.*correction/i,
  );
  assert.equal(
    (await json(`/api/v1/overall-rankings?id=${done.id}`)).resultDigest,
    done.resultDigest,
  );
  const conflictRequest = randomUUID(),
    dates = ["2026-11-24", "2026-11-25"],
    beforeCounts = (
      await db.query(
        "SELECT (SELECT count(*) FROM overall_ranking_run) AS runs,(SELECT count(*) FROM audit_record WHERE action='overall_ranking_calculated') AS audits",
      )
    ).rows[0];
  const contexts = await Promise.all(
    dates.map((date) =>
      json(
        `/api/v1/overall-rankings?discipline=men_four&date=${date}&rules=${f.rulesId}`,
      ),
    ),
  );
  const concurrent = await Promise.all(
    contexts.map((w, i) =>
      send("/api/v1/overall-rankings", {
        ...cmd,
        effectiveDate: dates[i],
        version: w.version,
        sourceDigest: w.review.sourceDigest,
        requestId: conflictRequest,
      }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  const afterCounts = (
    await db.query(
      "SELECT (SELECT count(*) FROM overall_ranking_run) AS runs,(SELECT count(*) FROM audit_record WHERE action='overall_ranking_calculated') AS audits",
    )
  ).rows[0];
  assert.equal(Number(afterCounts.runs) - Number(beforeCounts.runs), 1);
  assert.equal(Number(afterCounts.audits) - Number(beforeCounts.audits), 1);
  assert.equal((await fetch(base + "/api/v1/overall-rankings")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/v1/overall-rankings", {
        method: "POST",
        headers: {
          cookie,
          Origin: "https://untrusted.invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cmd),
      })
    ).status,
    403,
  );
  const login = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "organizer@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  const otherCookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.equal(
    (
      await fetch(base + `/api/v1/overall-rankings?id=${done.id}`, {
        headers: { cookie: otherCookie },
      })
    ).status,
    403,
  );
  const grants = (
    await db.query(
      "DELETE FROM role_grant WHERE user_id='demo-administrator' AND role='administrator' RETURNING *",
    )
  ).rows;
  try {
    assert.equal(
      (await send("/api/v1/overall-rankings", cmd)).status,
      403,
      "Current authority precedes receipt replay",
    );
    assert.equal(
      (await send(`/api/v1/overall-rankings?id=${done.id}`)).status,
      403,
    );
  } finally {
    for (const g of grants)
      await db.query(
        "INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES($1,$2,$3,$4,$5)",
        [g.id, g.user_id, g.role, g.event_id, g.game_id],
      );
  }
  const starting = await json(`/api/v1/ranking-inputs?id=${f.reviewIds[0]}`);
  await json("/api/v1/ranking-inputs", {
    id: starting.id,
    kind: "season",
    version: starting.version,
    requestId: randomUUID(),
    state: "draft",
    data: starting.data,
  });
  const incomplete = await json(path),
    incompleteRun = await json("/api/v1/overall-rankings", {
      ...cmd,
      version: incomplete.version,
      sourceDigest: incomplete.review.sourceDigest,
      requestId: randomUUID(),
      evidence: {
        ...evidence,
        events: evidence.events.map((e: any) => ({ ...e, state: "excluded" })),
      },
    });
  assert.equal(incompleteRun.result.state, "blocked");
  assert.match(
    incompleteRun.result.issues.join(" "),
    /current complete reviewed starting/,
  );
  assert.equal(
    (await json(`/api/v1/overall-rankings?id=${done.id}`)).resultDigest,
    done.resultDigest,
  );
  await assert.rejects(
    () =>
      db.query(
        "UPDATE overall_ranking_run SET result_contents='{}' WHERE id=$1",
        [done.id],
      ),
    /immutable/,
  );
  await assert.rejects(
    () =>
      db.query("DELETE FROM overall_ranking_receipt WHERE run_id=$1", [
        done.id,
      ]),
    /immutable/,
  );
  const failedContext = await json(path),
    failedCommand = {
      ...cmd,
      version: failedContext.version,
      sourceDigest: failedContext.review.sourceDigest,
      requestId: randomUUID(),
    },
    beforeFailure = (
      await db.query("SELECT count(*) AS count FROM overall_ranking_run")
    ).rows[0].count;
  await db.query(
    "CREATE FUNCTION wcp034_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled034audit failure'; END $$; CREATE TRIGGER wcp034_test_audit_failure BEFORE INSERT ON audit_record FOR EACH ROW WHEN (NEW.action='overall_ranking_calculated') EXECUTE FUNCTION wcp034_test_audit_failure()",
  );
  try {
    assert.equal(
      (await send("/api/v1/overall-rankings", failedCommand)).status,
      503,
    );
    assert.equal(
      (await db.query("SELECT count(*) AS count FROM overall_ranking_run"))
        .rows[0].count,
      beforeFailure,
    );
  } finally {
    await db.query(
      "DROP TRIGGER wcp034_test_audit_failure ON audit_record; DROP FUNCTION wcp034_test_audit_failure()",
    );
  }
  const recovered = await json("/api/v1/overall-rankings", failedCommand);
  assert.equal(
    (await json("/api/v1/overall-rankings", failedCommand)).id,
    recovered.id,
  );
  assert.equal(
    Number(
      (await db.query("SELECT count(*) AS count FROM overall_ranking_run"))
        .rows[0].count,
    ) - Number(beforeFailure),
    1,
  );
});
