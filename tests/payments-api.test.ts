import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { hashPassword } from "better-auth/crypto";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
});
after(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
const sessions = new Map<string, string>();
async function login(role = "organizer") {
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
async function post(
  cookie: string,
  path: string,
  data: Record<string, unknown>,
  actor = "demo-organizer",
) {
  return fetch(base + path, {
    method: "POST",
    headers: {
      cookie,
      Origin: base,
      "Content-Type": "application/json",
      "X-WCP-Actor": actor,
    },
    body: JSON.stringify({ requestId: randomUUID(), ...data }),
  });
}
async function workspace(cookie: string) {
  const r = await fetch(base + "/api/v1/entry-charges", {
    headers: { cookie },
  });
  assert.equal(r.status, 200);
  return r.json();
}
const terms = {
  mode: "open",
  capacity: 2,
  requirements: "Event lineup",
  feeMinor: 12500,
  currency: "CAD",
  paymentTerms: "Pay during the reservation",
  paymentWindowMinutes: 5,
  format: "single_knockout",
  formatNotes: "Single elimination",
};
async function fixture(mode = "open") {
  const edition = randomUUID(),
    division = randomUUID(),
    entries = [randomUUID(), randomUUID()];
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) SELECT $1,series_id,'Fictional ledger fixture','Fixture ice','Fixture city','UTC','2027-01-01','2027-01-03','fictional_demo',true,'approved' FROM event_edition LIMIT 1",
    [edition],
  );
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format,entry_season) VALUES($1,$2,'Ledger division','men_four','single_knockout','2026-27')",
    [division, edition],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-organizer','organizer',$2)",
    [randomUUID(), edition],
  );
  for (const [i, id] of entries.entries())
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [id, division, `Fictional ledger team ${i + 1}`],
    );
  const cookie = await login();
  const r = await post(cookie, "/api/v1/registration", {
    action: "open",
    divisionId: division,
    version: 0,
    terms: { ...terms, mode },
  });
  assert.equal(r.status, 200, await r.text());
  return { edition, division, entries, cookie };
}
test("admission freezes normal charge terms; reasoned credits reconcile and remain external records", async () => {
  const f = await fixture();
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "request",
        divisionId: f.division,
        entryId: f.entries[0],
        version: 0,
      })
    ).status,
    200,
  );
  let w = await workspace(f.cookie),
    e = w.entries.find((e: any) => e.id === f.entries[0]);
  assert.equal(e.charge.feeMinor, 12500);
  assert.equal(e.balance.dueMinor, 12500);
  assert.equal(e.charge.feeVersion, 1);
  const adjustment = {
    action: "discount",
    divisionId: f.division,
    entryId: e.id,
    version: 1,
    amountMinor: 1500,
    currency: "CAD",
    reason: "Junior team award",
    requestId: randomUUID(),
  };
  const r = await post(f.cookie, "/api/v1/entry-charges", adjustment);
  assert.equal(r.status, 200, await r.text());
  const receipt = {
    action: "external_receipt",
    divisionId: f.division,
    entryId: e.id,
    version: 2,
    amountMinor: 4000,
    currency: "CAD",
    reason: "Bank transfer confirmed by staff",
    externalReference: "bank-" + randomUUID(),
    requestId: randomUUID(),
  };
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", receipt)).status,
    200,
  );
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", receipt)).status,
    200,
  );
  w = await workspace(f.cookie);
  const target = w.entries.find((x: any) => x.id === f.entries[0]);
  assert.equal(target.balance.dueMinor, 7000);
  assert.equal(target.history.length, 2);
  assert.equal(target.balance.externalMinor, 4000);
  assert.equal(target.admissionState, "held");
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "waiver",
        divisionId: f.division,
        entryId: target.id,
        version: 3,
        amountMinor: 7000,
        currency: "CAD",
        reason: "Sponsor covers remaining fee",
      })
    ).status,
    200,
  );
  const final = (await workspace(f.cookie)).entries.find(
    (x: any) => x.id === target.id,
  );
  assert.equal(final.balance.dueMinor, 0);
  assert.equal(final.admissionState, "accepted");
  assert.equal(final.balance.status, "settled_by_records");
});
test("fee revisions price only new charges; invited and manual entries retain normal fees", async () => {
  const f = await fixture("invited");
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "invite",
        divisionId: f.division,
        entryId: f.entries[0],
        version: 0,
      })
    ).status,
    200,
  );
  let first = (await workspace(f.cookie)).entries.find(
    (e: any) => e.id === f.entries[0],
  );
  assert.equal(first.charge.feeMinor, 12500);
  assert.equal(first.admissionState, "invited");
  const revise = {
    action: "revise_fee",
    divisionId: f.division,
    version: 1,
    terms: {
      feeMinor: 17525,
      currency: "CAD",
      paymentTerms: "New entries pay updated amount",
    },
    reason: "Revised ice rental",
    requestId: randomUUID(),
  };
  let r = await post(f.cookie, "/api/v1/entry-charges", revise);
  assert.equal(r.status, 200, await r.text());
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", revise)).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "freeze",
        divisionId: f.division,
        entryId: f.entries[1],
        version: 0,
        expectedFeeVersion: 2,
        reason: "Price normal organizer entry",
      })
    ).status,
    200,
  );
  const w = await workspace(f.cookie),
    second = w.entries.find((e: any) => e.id === f.entries[1]);
  first = w.entries.find((e: any) => e.id === f.entries[0]);
  assert.equal(first.charge.feeVersion, 1);
  assert.equal(first.charge.feeMinor, 12500);
  assert.equal(second.charge.feeVersion, 2);
  assert.equal(second.charge.feeMinor, 17525);
  assert.equal(
    w.divisions.find((d: any) => d.id === f.division).feeHistory.length,
    2,
  );
  const currentReg = await (
    await fetch(base + "/api/v1/registration", {
      headers: { cookie: f.cookie },
    })
  ).json();
  assert.equal(
    currentReg.divisions.find((d: any) => d.id === f.division).feeMinor,
    17525,
  );
  for (const invalid of [
    {
      ...revise,
      requestId: randomUUID(),
      version: 2,
      terms: { ...revise.terms, currency: "USD" },
    },
    { ...revise, requestId: randomUUID(), version: 1 },
  ])
    assert.ok(
      [400, 409].includes(
        (await post(f.cookie, "/api/v1/entry-charges", invalid)).status,
      ),
    );
  for (const table of ["entry_charge", "division_fee_version"])
    await assert.rejects(
      pool.query(`UPDATE ${table} SET fee_minor=1 WHERE division_id=$1`, [
        f.division,
      ]),
      /retained|immutable/i,
    );
  const immutable = (
    await pool.query(
      "SELECT fee_minor,currency FROM division_registration WHERE division_id=$1",
      [f.division],
    )
  ).rows[0];
  assert.deepEqual(immutable, { fee_minor: 12500, currency: "CAD" });
});

test("credits reject invalid amounts, overcredit, currency changes, blank reasons and duplicated external references", async () => {
  const f = await fixture();
  for (const entryId of f.entries)
    assert.equal(
      (
        await post(f.cookie, "/api/v1/entry-charges", {
          action: "freeze",
          divisionId: f.division,
          entryId,
          version: 0,
          reason: "Normal fee",
        })
      ).status,
      200,
    );
  const basic = {
    action: "external_receipt",
    divisionId: f.division,
    entryId: f.entries[0],
    version: 1,
    amountMinor: 1000,
    currency: "CAD",
    reason: "Cash received at office",
    externalReference: "office-" + randomUUID(),
  };
  for (const change of [
    { amountMinor: 0 },
    { amountMinor: -1 },
    { amountMinor: 1.5 },
    { amountMinor: 12501 },
    { currency: "USD" },
    { reason: "" },
    { externalReference: "" },
    { action: "waiver", amountMinor: 1000 },
  ])
    assert.ok(
      [400, 409].includes(
        (await post(f.cookie, "/api/v1/entry-charges", { ...basic, ...change }))
          .status,
      ),
    );
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", basic)).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        ...basic,
        entryId: f.entries[1],
      })
    ).status,
    409,
  );
  const e = (await workspace(f.cookie)).entries.find(
    (e: any) => e.id === f.entries[1],
  );
  assert.equal(e.balance.dueMinor, 12500);
  assert.equal(e.history.length, 0);
});

test("concurrent adjustments cannot overcredit and exact retry never duplicates audit or history", async () => {
  const f = await fixture(),
    entryId = f.entries[0];
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "freeze",
        divisionId: f.division,
        entryId,
        version: 0,
        reason: "Normal fee",
      })
    ).status,
    200,
  );
  const a = {
    action: "discount",
    divisionId: f.division,
    entryId,
    version: 1,
    amountMinor: 8000,
    currency: "CAD",
    reason: "Approved grant",
    requestId: randomUUID(),
  };
  const b = { ...a, requestId: randomUUID(), reason: "Second grant" };
  const results = await Promise.all([
    post(f.cookie, "/api/v1/entry-charges", a),
    post(f.cookie, "/api/v1/entry-charges", b),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const winner = results[0].status === 200 ? a : b;
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", winner)).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        ...winner,
        amountMinor: 1,
      })
    ).status,
    409,
  );
  const e = (await workspace(f.cookie)).entries.find(
    (e: any) => e.id === entryId,
  );
  assert.equal(e.balance.dueMinor, 4500);
  assert.equal(e.history.length, 1);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM audit_record WHERE resource_id=$1 AND action='entry_charge_discount'",
        [entryId],
      )
    ).rows[0].n,
    1,
  );
});
async function waitBlocked(pid: number) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const w = await pool.query(
      "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))",
      [pid],
    );
    if (w.rowCount) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("Expected owned edition barrier was not reached");
}
test("settlement checks database time after edition lock waits and never revives expired capacity", async () => {
  const f = await fixture(),
    entryId = f.entries[0];
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "request",
        divisionId: f.division,
        entryId,
        version: 0,
      })
    ).status,
    200,
  );
  const barrier = await pool.connect();
  let pending: Promise<Response> | undefined;
  try {
    await barrier.query("BEGIN");
    await barrier.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      f.edition,
    ]);
    const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    // Still a live hold as the HTTP command begins; it expires while the command waits.
    await barrier.query(
      "UPDATE event_entry SET reservation_deadline=clock_timestamp()+interval '800 milliseconds' WHERE id=$1",
      [entryId],
    );
    pending = post(f.cookie, "/api/v1/entry-charges", {
      action: "external_receipt",
      divisionId: f.division,
      entryId,
      version: 1,
      amountMinor: 12500,
      currency: "CAD",
      reason: "Transfer arrived at deadline",
      externalReference: "late-" + randomUUID(),
    });
    await waitBlocked(pid);
    await new Promise((r) => setTimeout(r, 1000));
    await barrier.query("COMMIT");
    const r = await pending;
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.admissionState, "expired");
    assert.equal(result.disposition, "staff_attention");
    const e = (await workspace(f.cookie)).entries.find(
      (e: any) => e.id === entryId,
    );
    assert.equal(e.balance.dueMinor, 0);
    assert.equal(e.admissionState, "expired");
  } finally {
    await barrier.query("ROLLBACK");
    barrier.release();
    await Promise.allSettled(pending ? [pending] : []);
  }
});

test("current organizer scope is checked after lock wait and before receipt replay", async () => {
  const f = await fixture(),
    reviewer = await login("reviewer"),
    grant = randomUUID();
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-reviewer','organizer',$2)",
    [grant, f.edition],
  );
  const command = {
    action: "freeze",
    divisionId: f.division,
    entryId: f.entries[0],
    version: 0,
    reason: "Normal manual fee",
    requestId: randomUUID(),
  };
  assert.equal(
    (await post(reviewer, "/api/v1/entry-charges", command, "demo-reviewer"))
      .status,
    200,
  );
  const barrier = await pool.connect();
  let pending: Promise<Response> | undefined;
  try {
    await barrier.query("BEGIN");
    await barrier.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      f.edition,
    ]);
    const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    pending = post(reviewer, "/api/v1/entry-charges", command, "demo-reviewer");
    await waitBlocked(pid);
    await barrier.query("DELETE FROM role_grant WHERE id=$1", [grant]);
    await barrier.query("COMMIT");
    assert.equal((await pending).status, 403);
    const w = await workspace(reviewer);
    assert.equal(
      w.entries.some((e: any) => e.id === f.entries[0]),
      false,
    );
    assert.equal(
      w.receipts.some((r: any) => r.requestId === command.requestId),
      false,
    );
  } finally {
    await barrier.query("ROLLBACK");
    barrier.release();
    await Promise.allSettled(pending ? [pending] : []);
    await pool.query("DELETE FROM role_grant WHERE id=$1", [grant]);
  }
});

test("a receipt/audit persistence failure rolls back the credit and admission transition atomically", async () => {
  const f = await fixture(),
    entryId = f.entries[0];
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "request",
        divisionId: f.division,
        entryId,
        version: 0,
      })
    ).status,
    200,
  );
  const command = {
    action: "waiver",
    divisionId: f.division,
    entryId,
    version: 1,
    amountMinor: 12500,
    currency: "CAD",
    reason: "Atomic sponsor waiver",
    requestId: randomUUID(),
  };
  const fn = "wcp010_fail_" + randomUUID().replaceAll("-", "");
  await pool.query(
    `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entry_id='${entryId}' THEN RAISE EXCEPTION 'owned receipt failure fixture'; END IF; RETURN NEW; END $$`,
  );
  await pool.query(
    `CREATE TRIGGER ${fn} BEFORE INSERT ON entry_charge_command FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  );
  try {
    assert.equal(
      (await post(f.cookie, "/api/v1/entry-charges", command)).status,
      503,
    );
    const e = (await workspace(f.cookie)).entries.find(
      (e: any) => e.id === entryId,
    );
    assert.equal(e.balance.dueMinor, 12500);
    assert.equal(e.history.length, 0);
    assert.equal(e.admissionState, "held");
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM audit_record WHERE resource_id=$1 AND action='entry_charge_waiver'",
          [entryId],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await pool.query(`DROP TRIGGER ${fn} ON entry_charge_command`);
    await pool.query(`DROP FUNCTION ${fn}()`);
  }
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", command)).status,
    200,
  );
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", command)).status,
    200,
  );
});
test("exact team-season payment grants control ledger reads; profile ownership and other actions confer no financial rights", async () => {
  const f = await fixture(),
    reviewer = await login("reviewer"),
    team = randomUUID(),
    registration = randomUUID(),
    grant = randomUUID();
  await pool.query(
    "INSERT INTO team(id,discipline,core_key) VALUES($1,'men_four',$2)",
    [team, `wcp010:${team}`],
  );
  await pool.query(
    "INSERT INTO season_registration(id,team_id,season,version) VALUES($1,$2,'2026-27',1)",
    [registration, team],
  );
  await pool.query(
    "UPDATE event_entry SET team_id=$2,season_registration_id=$3 WHERE id=$1",
    [f.entries[0], team, registration],
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "freeze",
        divisionId: f.division,
        entryId: f.entries[0],
        version: 0,
        reason: "Price represented normal entry",
      })
    ).status,
    200,
  );
  assert.equal(
    (await workspace(reviewer)).entries.some((e: any) => e.id === f.entries[0]),
    false,
  );
  const ownerId = `wcp010-owner-${randomUUID()}`,
    playerId = randomUUID();
  await pool.query(
    "INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,'Fictional financial profile owner',$2,true)",
    [ownerId, `${ownerId}@demo.invalid`],
  );
  await pool.query(
    "INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now())",
    [randomUUID(), ownerId, await hashPassword(process.env.DEMO_PASSWORD!)],
  );
  await pool.query(
    "INSERT INTO player(id,name,origin) VALUES($1,'Fictional financial core player','fictional_demo')",
    [playerId],
  );
  await pool.query(
    "INSERT INTO team_core_member(team_id,player_id) VALUES($1,$2)",
    [team, playerId],
  );
  await pool.query(
    "INSERT INTO player_account_link(player_id,user_id) VALUES($1,$2)",
    [playerId, ownerId],
  );
  const owner = await login(ownerId);
  assert.equal(
    (await workspace(owner)).entries.some((e: any) => e.id === f.entries[0]),
    false,
  );
  assert.equal(
    (
      await post(
        owner,
        "/api/v1/entry-charges",
        {
          action: "waiver",
          divisionId: f.division,
          entryId: f.entries[0],
          version: 1,
          amountMinor: 12500,
          currency: "CAD",
          reason: "Profile ownership is not financial authority",
        },
        ownerId,
      )
    ).status,
    403,
  );
  const registrationView = async () =>
    (
      await (
        await fetch(base + "/api/v1/registration", {
          headers: { cookie: reviewer },
        })
      ).json()
    ).entries.find((x: any) => x.id === f.entries[0]);
  const submitGrant = randomUUID();
  await pool.query(
    "INSERT INTO team_representation(id,user_id,registration_id,actions,created_by) VALUES($1,'demo-reviewer',$2,ARRAY['submit'],'demo-administrator')",
    [submitGrant, registration],
  );
  assert.equal(
    (await workspace(reviewer)).entries.some((e: any) => e.id === f.entries[0]),
    false,
  );
  const submitView = await registrationView();
  assert.equal(submitView.canReadPayment, false);
  assert.equal(submitView.payment, null);
  await pool.query(
    "INSERT INTO team_representation(id,user_id,registration_id,actions,created_by) VALUES($1,'demo-reviewer',$2,ARRAY['payment'],'demo-administrator')",
    [grant, registration],
  );
  const paymentView = await registrationView();
  assert.equal(paymentView.canReadPayment, true);
  assert.equal(paymentView.payment.dueMinor, 12500);
  let w = await workspace(reviewer);
  const e = w.entries.find((e: any) => e.id === f.entries[0]);
  assert.equal(e.balance.dueMinor, 12500);
  assert.equal(e.staff, false);
  assert.equal(
    w.entries.some((e: any) => e.id === f.entries[1]),
    false,
  );
  assert.equal(
    (
      await post(
        reviewer,
        "/api/v1/entry-charges",
        {
          action: "discount",
          divisionId: f.division,
          entryId: f.entries[0],
          version: 1,
          amountMinor: 1,
          currency: "CAD",
          reason: "Not staff",
        },
        "demo-reviewer",
      )
    ).status,
    403,
  );
  await pool.query("UPDATE division SET entry_season='2027-28' WHERE id=$1", [
    f.division,
  ]);
  assert.equal(
    (await workspace(reviewer)).entries.some((e: any) => e.id === f.entries[0]),
    false,
  );
  await pool.query("UPDATE division SET entry_season='2026-27' WHERE id=$1", [
    f.division,
  ]);
  await pool.query(
    "UPDATE team_representation SET revoked_at=clock_timestamp(),revocation_reason='Fixture authority ended' WHERE id=$1",
    [grant],
  );
  assert.equal(
    (await workspace(reviewer)).entries.some((e: any) => e.id === f.entries[0]),
    false,
  );
  const revokedView = await registrationView();
  assert.equal(revokedView.canReadPayment, false);
  assert.equal(revokedView.payment, null);
  const invalidActor = {
    action: "freeze",
    divisionId: f.division,
    entryId: f.entries[1],
    version: 0,
    reason: "Normal fee",
  };
  assert.equal(
    (
      await post(
        f.cookie,
        "/api/v1/entry-charges",
        invalidActor,
        "demo-reviewer",
      )
    ).status,
    403,
  );
  assert.equal((await fetch(base + "/api/v1/entry-charges")).status, 401);
});
test("new charges require the reviewed fee quote; frozen charges and exact receipts survive later fee revisions", async () => {
  const f = await fixture();
  const freeze = {
    action: "freeze",
    divisionId: f.division,
    entryId: f.entries[0],
    version: 0,
    expectedFeeVersion: 1,
    reason: "Review normal quote",
    requestId: randomUUID(),
  };
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", freeze)).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "revise_fee",
        divisionId: f.division,
        version: 1,
        terms: {
          feeMinor: 20000,
          currency: "CAD",
          paymentTerms: "Updated fee for new charges",
        },
        reason: "Updated ice rental",
      })
    ).status,
    200,
  );
  const stale = {
    action: "freeze",
    divisionId: f.division,
    entryId: f.entries[1],
    version: 0,
    expectedFeeVersion: 1,
    reason: "Old displayed quote",
  };
  const staleResult = await post(f.cookie, "/api/v1/entry-charges", stale);
  assert.equal(staleResult.status, 409, await staleResult.text());
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "request",
        divisionId: f.division,
        entryId: f.entries[1],
        version: 0,
        expectedFeeVersion: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "accept",
        divisionId: f.division,
        entryId: f.entries[1],
        version: 0,
      })
    ).status,
    409,
  );
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", freeze)).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "request",
        divisionId: f.division,
        entryId: f.entries[0],
        version: 0,
        expectedFeeVersion: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "request",
        divisionId: f.division,
        entryId: f.entries[1],
        version: 0,
        expectedFeeVersion: 2,
      })
    ).status,
    200,
  );
  const w = await workspace(f.cookie);
  assert.equal(
    w.entries.find((e: any) => e.id === f.entries[0]).charge.feeMinor,
    12500,
  );
  assert.equal(
    w.entries.find((e: any) => e.id === f.entries[1]).charge.feeMinor,
    20000,
  );
});
test("unknown historical fee terms cannot be repriced by later fee revisions through admission commands", async () => {
  const f = await fixture(),
    division = randomUUID(),
    oldEntry = randomUUID(),
    newEntry = randomUUID();
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Fictional legacy unknown fee','men_four','single_knockout')",
    [division, f.edition],
  );
  await pool.query(
    "INSERT INTO division_registration(division_id,version,mode,capacity,requirements,fee_minor,currency,payment_terms,payment_window_minutes,format,format_notes,opened_at) VALUES($1,1,'reviewed',2,'Declared lineup',5000,'XYZ','Unknown legacy currency terms',60,'single_knockout','Single elimination',clock_timestamp())",
    [division],
  );
  await pool.query(
    "INSERT INTO event_entry(id,division_id,display_name,admission_version) VALUES($1,$2,'Fictional historical unpriced entry',1),($3,$2,'Fictional future new entry',0)",
    [oldEntry, division, newEntry],
  );
  assert.equal(
    (await workspace(f.cookie)).entries.find((e: any) => e.id === oldEntry)
      .charge,
    null,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "revise_fee",
        divisionId: division,
        version: 0,
        terms: {
          feeMinor: 9000,
          currency: "CAD",
          paymentTerms: "New supported future terms",
        },
        reason: "Establish future pricing; old terms unresolved",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "freeze",
        divisionId: division,
        entryId: oldEntry,
        version: 0,
        expectedFeeVersion: 1,
        reason: "Attempt historical normal fee",
      })
    ).status,
    409,
  );
  const result = await post(f.cookie, "/api/v1/registration", {
    action: "accept",
    divisionId: division,
    entryId: oldEntry,
    version: 1,
    expectedFeeVersion: 1,
  });
  assert.equal(result.status, 409, await result.text());
  assert.equal(
    (await workspace(f.cookie)).entries.find((e: any) => e.id === oldEntry)
      .charge,
    null,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "accept",
        divisionId: division,
        entryId: newEntry,
        version: 0,
        expectedFeeVersion: 1,
      })
    ).status,
    200,
  );
  assert.equal(
    (await workspace(f.cookie)).entries.find((e: any) => e.id === newEntry)
      .charge.feeMinor,
    9000,
  );
});
test("global administrators can record scoped external receipts and public projections omit financial evidence", async () => {
  const f = await fixture(),
    admin = await login("administrator"),
    entryId = f.entries[0],
    reference = "private-bank-" + randomUUID();
  assert.equal(
    (
      await post(
        admin,
        "/api/v1/entry-charges",
        {
          action: "freeze",
          divisionId: f.division,
          entryId,
          version: 0,
          expectedFeeVersion: 1,
          reason: "Normal central staff pricing",
        },
        "demo-administrator",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await post(
        admin,
        "/api/v1/entry-charges",
        {
          action: "external_receipt",
          divisionId: f.division,
          entryId,
          version: 1,
          amountMinor: 1000,
          currency: "CAD",
          reason:
            "Private receipt evidence for staff and payment representatives",
          externalReference: reference,
        },
        "demo-administrator",
      )
    ).status,
    200,
  );
  const e = (await workspace(f.cookie)).entries.find(
    (e: any) => e.id === entryId,
  );
  assert.equal(e.balance.dueMinor, 11500);
  assert.equal(e.history[0].externalReference, reference);
  const r = await fetch(base + "/api/v1/public/entries/" + entryId);
  assert.equal(r.status, 200);
  const body = await r.text();
  for (const privateValue of [
    reference,
    "Private receipt evidence",
    "feeMinor",
    "externalMinor",
    "amountMinor",
  ])
    assert.equal(body.includes(privateValue), false);
});
test("late partial external funds require attention without reclaiming released capacity", async () => {
  const f = await fixture(),
    entryId = f.entries[0];
  assert.equal(
    (
      await post(f.cookie, "/api/v1/registration", {
        action: "request",
        divisionId: f.division,
        entryId,
        version: 0,
      })
    ).status,
    200,
  );
  await pool.query(
    "UPDATE event_entry SET reservation_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",
    [entryId],
  );
  const command = {
    action: "external_receipt",
    divisionId: f.division,
    entryId,
    version: 1,
    amountMinor: 1000,
    currency: "CAD",
    reason: "Late partial bank transfer verified",
    externalReference: "late-partial-" + randomUUID(),
    requestId: randomUUID(),
  };
  const r = await post(f.cookie, "/api/v1/entry-charges", command);
  assert.equal(r.status, 200);
  const result = await r.json();
  assert.equal(result.disposition, "staff_attention");
  assert.equal(result.attention, "funds_without_place");
  const e = (await workspace(f.cookie)).entries.find(
    (e: any) => e.id === entryId,
  );
  assert.equal(e.balance.dueMinor, 11500);
  assert.equal(e.admissionState, "expired");
  assert.equal(e.attention, "funds_without_place");
  assert.equal(
    (await post(f.cookie, "/api/v1/entry-charges", command)).status,
    200,
  );
  assert.equal(
    (await workspace(f.cookie)).entries.find((e: any) => e.id === entryId)
      .history.length,
    1,
  );
});

test("registration summaries use frozen terms and balances rather than revised division prices", async () => {
  const f = await fixture();
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "freeze",
        divisionId: f.division,
        entryId: f.entries[0],
        version: 0,
        expectedFeeVersion: 1,
        reason: "Normal original manual fee",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "revise_fee",
        divisionId: f.division,
        version: 1,
        terms: {
          feeMinor: 0,
          currency: "CAD",
          paymentTerms: "New zero-fee future charges",
        },
        reason: "Sponsor new entrants",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "freeze",
        divisionId: f.division,
        entryId: f.entries[1],
        version: 0,
        expectedFeeVersion: 2,
        reason: "New normal zero-fee manual entry",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await post(f.cookie, "/api/v1/entry-charges", {
        action: "revise_fee",
        divisionId: f.division,
        version: 2,
        terms: {
          feeMinor: 20000,
          currency: "CAD",
          paymentTerms: "New future normal fee",
        },
        reason: "Next pricing version",
      })
    ).status,
    200,
  );
  const r = await fetch(base + "/api/v1/registration", {
    headers: { cookie: f.cookie },
  });
  assert.equal(r.status, 200);
  const w = await r.json(),
    old = w.entries.find((e: any) => e.id === f.entries[0]),
    zero = w.entries.find((e: any) => e.id === f.entries[1]);
  assert.equal(old.canReadPayment, true);
  assert.equal(old.payment.feeMinor, 12500);
  assert.equal(old.payment.dueMinor, 12500);
  assert.equal(zero.payment.feeMinor, 0);
  assert.equal(zero.payment.status, "no_fee");
  assert.equal(
    w.divisions.find((d: any) => d.id === f.division).feeMinor,
    20000,
  );
});
