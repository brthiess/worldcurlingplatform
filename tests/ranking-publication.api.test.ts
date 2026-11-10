import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { authRequest } from "./auth-request";
import {
  overallFixture,
  overallReviewEvidence,
} from "./overall-rankings-fixture";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
const base = process.env.BETTER_AUTH_URL!;
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
test("public defaults contain approved publications only, with an honest empty state", async () => {
  const r = await fetch(base + "/api/v1/rankings?date=1900-01-01");
  assert.equal(r.status, 200);
  const data = await r.json();
  assert.deepEqual(data.publications, []);
  assert.equal(data.selected, null);
});
test("complete sourced overall draft can be compared, approved and read as exact safe frozen public data", async () => {
  const f = await overallFixture(db, async (path, body) => {
    const r = await send(path, body);
    return { status: r.status, json: () => r.json(), text: () => r.text() };
  });
  const w = await json(
    `/api/v1/overall-rankings?discipline=${f.discipline}&date=2026-11-23&rules=${f.rulesId}`,
  );
  const draft = await json("/api/v1/overall-rankings", {
    action: "calculate",
    discipline: f.discipline,
    effectiveDate: "2026-11-23",
    rulesId: f.rulesId,
    version: w.version,
    sourceDigest: w.review.sourceDigest,
    requestId: randomUUID(),
    evidence: overallReviewEvidence(w.review, f),
  });
  assert.equal(
    draft.result.state,
    "ready",
    JSON.stringify(draft.result.issues),
  );
  const review = await json(
    `/api/v1/ranking-publications?producer=overall&run=${draft.id}`,
  );
  assert.deepEqual(review.blockers, []);
  const command = {
    action: "approve",
    producer: "overall",
    runId: draft.id,
    manifestDigest: draft.manifestDigest,
    resultDigest: draft.resultDigest,
    version: review.version,
    previousId: review.previous?.id ?? null,
    comparedId: review.compared?.id ?? null,
    acknowledged: draft.result.warnings,
    note: "PRIVATE038 Synthetic complete list approved for demonstration; no World Curling endorsement.",
    requestId: randomUUID(),
  };
  assert.equal(
    (
      await send("/api/v1/ranking-publications", {
        ...command,
        acknowledged: [],
      })
    ).status,
    422,
  );
  const approved = await json("/api/v1/ranking-publications", command);
  assert.equal(
    (await json("/api/v1/ranking-publications", command)).id,
    approved.id,
  );
  const publicList = await (
    await fetch(base + `/api/v1/rankings?id=${approved.id}`)
  ).json();
  const row = publicList.selected.data.rows.find(
    (r: any) => r.subjectId === f.seasonIds[0],
  );
  assert.equal(row.total, "102");
  assert.equal(row.carryover, "75");
  assert.equal(row.eventTotal, "27");
  assert.equal(row.contributions[0].points, "27");
  assert.equal(publicList.selected.effectiveDate, "2026-11-23");
  assert.notEqual(publicList.selected.publishedAt.slice(0, 10), "2026-11-23");
  assert.doesNotMatch(
    JSON.stringify(publicList),
    /actorId|reviewNote|entitlement|demo-administrator|manifestContents|applicabilitySourceId|rankingPlayerIds|PRIVATE038/,
  );
  const originalPublic = JSON.stringify(publicList.selected);
  assert.equal(
    (
      await send("/api/v1/ranking-publications", {
        ...command,
        note: "Different bytes",
      })
    ).status,
    409,
  );
  const replay = {
    action: "replay",
    producer: "overall",
    runId: draft.id,
    publicationId: approved.id,
    publicDigest: approved.publicDigest,
    privateDigest: approved.privateDigest,
    requestId: randomUUID(),
  };
  assert.equal(
    (await json("/api/v1/ranking-publications", replay)).id,
    approved.id,
  );
  assert.equal(
    (
      await send("/api/v1/ranking-publications", {
        ...replay,
        requestId: randomUUID(),
        publicDigest: "0".repeat(64),
      })
    ).status,
    409,
  );
  assert.equal(
    (await fetch(base + "/api/v1/ranking-publications")).status,
    401,
  );
  assert.equal(
    (await fetch(base + `/api/v1/rankings?id=${draft.id}`)).status,
    404,
    "Private draft IDs never select public content",
  );
  assert.equal(
    (
      await fetch(base + "/api/v1/ranking-publications", {
        method: "POST",
        headers: {
          cookie,
          Origin: "https://untrusted.invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/v1/ranking-publications", {
        method: "POST",
        headers: {
          cookie,
          Origin: base,
          "X-WCP-Actor": "wrong-account",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      })
    ).status,
    403,
  );
  const organizer = await authRequest(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "organizer@demo.invalid",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(organizer.status, 200);
  const otherCookie = organizer.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.equal(
    (
      await fetch(base + "/api/v1/ranking-publications", {
        method: "POST",
        headers: {
          cookie: otherCookie,
          Origin: base,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(command),
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + `/api/v1/ranking-publications?id=${approved.id}`, {
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
      (await send("/api/v1/ranking-publications", command)).status,
      403,
      "Revoked authority precedes exact receipt replay",
    );
    assert.equal(
      (await send("/api/v1/ranking-publications", replay)).status,
      403,
    );
  } finally {
    for (const g of grants)
      await db.query(
        "INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES($1,$2,$3,$4,$5)",
        [g.id, g.user_id, g.role, g.event_id, g.game_id],
      );
  }
  await assert.rejects(
    () =>
      db.query(
        "UPDATE ranking_publication SET public_contents='{}' WHERE id=$1",
        [approved.id],
      ),
    /immutable/,
  );
  await assert.rejects(
    () =>
      db.query(
        "DELETE FROM ranking_publication_receipt WHERE publication_id=$1",
        [approved.id],
      ),
    /immutable/,
  );
  const input = await json(`/api/v1/ranking-inputs?id=${f.reviewIds[0]}`);
  input.data.contributions.forEach((c: any) => (c.amount = "60"));
  await json("/api/v1/ranking-inputs", {
    id: input.id,
    kind: "season",
    version: input.version,
    state: "reviewed",
    requestId: randomUUID(),
    data: input.data,
  });
  const stale = await json(
    `/api/v1/ranking-publications?producer=overall&run=${draft.id}`,
  );
  assert.match(stale.blockers.join(" "), /inputs or eligibility changed/);
  assert.equal(
    (
      await send("/api/v1/ranking-publications", {
        ...command,
        requestId: randomUUID(),
        version: stale.version,
        previousId: stale.previous.id,
        comparedId: stale.compared.id,
      })
    ).status,
    422,
  );
  const current = await json(
    `/api/v1/overall-rankings?discipline=${f.discipline}&date=2026-11-23&rules=${f.rulesId}`,
  );
  const revised = await json("/api/v1/overall-rankings", {
    action: "calculate",
    discipline: f.discipline,
    effectiveDate: "2026-11-23",
    rulesId: f.rulesId,
    version: current.version,
    sourceDigest: current.review.sourceDigest,
    requestId: randomUUID(),
    evidence: overallReviewEvidence(current.review, f),
  });
  const revisedReview = await json(
    `/api/v1/ranking-publications?producer=overall&run=${revised.id}`,
  );
  assert.deepEqual(revisedReview.blockers, []);
  const comparison = revisedReview.comparison.rows.find(
    (r: any) => r.subjectId === f.seasonIds[0],
  );
  assert.equal(comparison.previousTotal, "102");
  assert.equal(comparison.total, "117");
  assert.equal(comparison.pointsChanged, true);
  const revisedCommand = {
    ...command,
    runId: revised.id,
    manifestDigest: revised.manifestDigest,
    resultDigest: revised.resultDigest,
    version: revisedReview.version,
    previousId: revisedReview.previous.id,
    comparedId: revisedReview.compared.id,
    acknowledged: revised.result.warnings,
    requestId: randomUUID(),
  };
  const before = (
    await db.query(
      "SELECT (SELECT count(*) FROM ranking_publication) AS publications,(SELECT count(*) FROM ranking_publication_receipt) AS receipts,(SELECT count(*) FROM audit_record WHERE action='ranking_publication_approved') AS audits",
    )
  ).rows[0];
  await db.query(
    "CREATE FUNCTION wcp038_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled038audit failure'; END $$; CREATE TRIGGER wcp038_test_audit_failure BEFORE INSERT ON audit_record FOR EACH ROW WHEN (NEW.action='ranking_publication_approved') EXECUTE FUNCTION wcp038_test_audit_failure()",
  );
  try {
    assert.equal(
      (await send("/api/v1/ranking-publications", revisedCommand)).status,
      503,
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT (SELECT count(*) FROM ranking_publication) AS publications,(SELECT count(*) FROM ranking_publication_receipt) AS receipts,(SELECT count(*) FROM audit_record WHERE action='ranking_publication_approved') AS audits",
        )
      ).rows[0],
      before,
      "Failure leaves no publication, audit or receipt",
    );
  } finally {
    await db.query(
      "DROP TRIGGER wcp038_test_audit_failure ON audit_record; DROP FUNCTION wcp038_test_audit_failure()",
    );
  }
  const raced = await Promise.all([
    send("/api/v1/ranking-publications", revisedCommand),
    send("/api/v1/ranking-publications", {
      ...revisedCommand,
      requestId: randomUUID(),
    }),
  ]);
  assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
  const replacement = await raced.find((r) => r.status === 200)!.json();
  assert.equal(replacement.replacesId, approved.id);
  assert.equal(replacement.previousId, approved.id);
  assert.equal(
    replacement.data.rows.find((r: any) => r.subjectId === f.seasonIds[0])
      .total,
    "117",
  );
  assert.equal(
    JSON.stringify(
      (await (await fetch(base + `/api/v1/rankings?id=${approved.id}`)).json())
        .selected,
    ),
    originalPublic,
  );
  assert.equal(
    (
      await (
        await fetch(base + `/api/v1/rankings?discipline=${f.discipline}`)
      ).json()
    ).selected.id,
    replacement.id,
  );
  const receipts = (await json("/api/v1/ranking-publications")).receipts;
  const exact = receipts.find((r: any) => r.requestId === command.requestId);
  assert.equal(exact.publicationId, approved.id);
  assert.equal(exact.actorId, "demo-administrator");
  assert.equal(exact.path, "/api/v1/ranking-publications");
  await json("/api/v1/ranking-inputs", {
    id: input.id,
    kind: "season",
    version: input.version + 1,
    state: "draft",
    requestId: randomUUID(),
    data: input.data,
  });
  const incompleteContext = await json(
    `/api/v1/overall-rankings?discipline=${f.discipline}&date=2026-11-24&rules=${f.rulesId}`,
  );
  const incomplete = await json("/api/v1/overall-rankings", {
    action: "calculate",
    discipline: f.discipline,
    effectiveDate: "2026-11-24",
    rulesId: f.rulesId,
    version: incompleteContext.version,
    sourceDigest: incompleteContext.review.sourceDigest,
    requestId: randomUUID(),
    evidence: overallReviewEvidence(incompleteContext.review, f),
  });
  assert.equal(incomplete.result.state, "blocked");
  const blocked = await json(
    `/api/v1/ranking-publications?producer=overall&run=${incomplete.id}`,
  );
  const blockedCommand = {
    ...command,
    requestId: randomUUID(),
    runId: incomplete.id,
    manifestDigest: incomplete.manifestDigest,
    resultDigest: incomplete.resultDigest,
    version: blocked.version,
    previousId: blocked.previous.id,
    comparedId: blocked.compared.id,
    acknowledged: incomplete.result.warnings,
  };
  assert.equal(
    (await send("/api/v1/ranking-publications", blockedCommand)).status,
    422,
  );
  assert.equal(
    (
      await send("/api/v1/ranking-publications", {
        ...blockedCommand,
        requestId: randomUUID(),
        acknowledged: [
          ...incomplete.result.warnings,
          ...incomplete.result.issues,
        ],
      })
    ).status,
    400,
    "P04 does not permit eligibility waivers",
  );
  assert.equal(
    JSON.stringify(
      (await (await fetch(base + `/api/v1/rankings?id=${approved.id}`)).json())
        .selected,
    ),
    originalPublic,
  );
});
