import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 4,
});
after(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
const sessions = new Map<string, string>();
async function login(role: string) {
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
async function command(
  cookie: string,
  data: Record<string, unknown>,
  actor = "demo-organizer",
) {
  return fetch(base + "/api/v1/registration", {
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
export const terms = {
  mode: "open",
  capacity: 1,
  requirements: "A declared event lineup",
  feeMinor: 0,
  currency: "CAD",
  paymentTerms: "No entry fee",
  paymentWindowMinutes: 1,
  format: "single_knockout",
  formatNotes: "One elimination; no consolation",
};
async function fixture() {
  const edition = randomUUID(),
    division = randomUUID();
  await pool.query(
    "INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,admission_status) SELECT $1,series_id,'Registration fixture','Fixture ice','Fixture city','UTC','2027-01-01','2027-01-03','fictional_demo',true,'approved' FROM event_edition LIMIT 1",
    [edition],
  );
  await pool.query(
    "INSERT INTO division(id,event_id,name,discipline,format,entry_season) VALUES($1,$2,'Capacity fixture','men_four','single_knockout','2026-27')",
    [division, edition],
  );
  await pool.query(
    "INSERT INTO role_grant(id,user_id,role,event_id) VALUES($1,'demo-organizer','organizer',$2)",
    [randomUUID(), edition],
  );
  const entries = [randomUUID(), randomUUID()];
  for (const [i, id] of entries.entries())
    await pool.query(
      "INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",
      [id, division, `Capacity team ${i + 1}`],
    );
  return { edition, division, entries };
}
test("opening requires terms and scoped current actor; competing zero-fee acceptance cannot overbook", async () => {
  const cookie = await login("organizer"),
    reviewer = await login("reviewer"),
    f = await fixture();
  assert.equal(
    (
      await command(cookie, {
        action: "open",
        divisionId: f.division,
        version: 0,
        terms: { ...terms, paymentTerms: "" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await command(
        reviewer,
        { action: "open", divisionId: f.division, version: 0, terms },
        "demo-reviewer",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await command(
        cookie,
        { action: "open", divisionId: f.division, version: 0, terms },
        "demo-reviewer",
      )
    ).status,
    403,
  );
  const open = await command(cookie, {
    action: "open",
    divisionId: f.division,
    version: 0,
    terms,
  });
  assert.equal(open.status, 200, await open.text());
  const responses = await Promise.all(
    f.entries.map((entryId) =>
      command(cookie, {
        action: "accept",
        divisionId: f.division,
        entryId,
        version: 0,
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const workspace = await (
    await fetch(base + "/api/v1/registration", { headers: { cookie } })
  ).json();
  const division = workspace.divisions.find(
    (d: { id: string }) => d.id === f.division,
  );
  assert.equal(division.remaining, 0);
  assert.equal(
    workspace.entries.filter(
      (e: { divisionId: string; state: string }) =>
        e.divisionId === f.division && e.state === "accepted",
    ).length,
    1,
  );
});

test("competing paid reservations consume only one place and a full request joins the waitlist", async () => {
  const cookie = await login("organizer"),
    f = await fixture();
  assert.equal(
    (
      await command(cookie, {
        action: "open",
        divisionId: f.division,
        version: 0,
        terms: { ...terms, feeMinor: 10000 },
      })
    ).status,
    200,
  );
  const responses = await Promise.all(
    f.entries.map((entryId) =>
      command(cookie, {
        action: "request",
        divisionId: f.division,
        entryId,
        version: 0,
      }),
    ),
  );
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  const results = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(results.map((r) => r.state).sort(), ["held", "waitlisted"]);
  assert.equal((await read(cookie, f.division)).division.remaining, 0);
});

async function read(cookie: string, divisionId: string) {
  const r = await fetch(base + "/api/v1/registration", { headers: { cookie } });
  assert.equal(r.status, 200);
  const w = await r.json();
  return {
    ...w,
    division: w.divisions.find((d: { id: string }) => d.id === divisionId),
    entries: w.entries.filter(
      (e: { divisionId: string }) => e.divisionId === divisionId,
    ),
  };
}
test("review acceptance creates a bounded unpaid hold; expiry releases capacity and exact retry cannot extend it", async () => {
  const cookie = await login("organizer"),
    f = await fixture();
  assert.equal(
    (
      await command(cookie, {
        action: "open",
        divisionId: f.division,
        version: 0,
        terms: { ...terms, mode: "reviewed", feeMinor: 25000 },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await command(cookie, {
        action: "request",
        divisionId: f.division,
        entryId: f.entries[0],
        version: 0,
      })
    ).status,
    200,
  );
  let w = await read(cookie, f.division);
  assert.equal(w.entries[0].state, "pending");
  assert.equal(w.division.remaining, 1);
  const accept = {
    action: "accept",
    divisionId: f.division,
    entryId: f.entries[0],
    version: 1,
    requestId: randomUUID(),
  };
  let r = await command(cookie, accept);
  assert.equal(r.status, 200);
  const held = await r.json();
  assert.equal(held.state, "held");
  assert.equal(held.paymentState, "unpaid");
  assert.equal(held.feeMinor, 25000);
  const deadline = Date.parse(held.deadline);
  assert.ok(deadline > Date.now() + 55000 && deadline <= Date.now() + 60000);
  r = await command(cookie, accept);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).deadline, held.deadline);
  assert.equal((await command(cookie, { ...accept, version: 2 })).status, 409);
  assert.equal(
    (
      await command(cookie, {
        action: "accept",
        divisionId: f.division,
        entryId: f.entries[1],
        version: 0,
      })
    ).status,
    409,
  );
  await pool.query(
    "UPDATE event_entry SET reservation_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",
    [f.entries[0]],
  );
  w = await read(cookie, f.division);
  assert.equal(w.entries[0].state, "expired");
  assert.equal(w.division.remaining, 1);
  // Retry is a receipt, not a new reservation. Current read remains expired.
  assert.equal((await command(cookie, accept)).status, 200);
  w = await read(cookie, f.division);
  assert.equal(w.entries[0].state, "expired");
  assert.equal(
    (
      await command(cookie, {
        action: "accept",
        divisionId: f.division,
        entryId: f.entries[1],
        version: 0,
      })
    ).status,
    200,
  );
  w = await read(cookie, f.division);
  assert.equal(w.division.remaining, 0);
  assert.deepEqual(
    w.entries.map((e: { state: string }) => e.state),
    ["expired", "held"],
  );
  assert.equal(
    (
      await command(cookie, {
        action: "request",
        divisionId: f.division,
        entryId: f.entries[0],
        version: 3,
      })
    ).status,
    409,
  );
  const expire = {
    action: "expire",
    divisionId: f.division,
    version: 1,
    requestId: randomUUID(),
  };
  assert.equal((await command(cookie, expire)).status, 200);
  assert.equal((await command(cookie, expire)).status, 200);
});

async function waitBlocked(pid: number) {
  for (let i = 0; i < 150; i++) {
    const blocked = await pool.query(
      "SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))",
      [pid],
    );
    if (blocked.rowCount) return blocked.rows[0].pid as number;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.fail("HTTP admission must actually wait at the edition lock barrier");
}
test("two live transactions compete behind an edition barrier, rechecking expiry after the wait", async () => {
  const cookie = await login("organizer"),
    f = await fixture();
  assert.equal(
    (
      await command(cookie, {
        action: "open",
        divisionId: f.division,
        version: 0,
        terms: { ...terms, feeMinor: 10000 },
      })
    ).status,
    200,
  );
  await pool.query(
    "UPDATE event_entry SET admission_state='held',reservation_deadline=clock_timestamp()+interval '2 seconds' WHERE id=$1",
    [f.entries[0]],
  );
  const before = await read(cookie, f.division);
  assert.equal(before.division.remaining, 0);
  const barrier = await pool.connect();
  let request: Promise<Response> | undefined;
  try {
    await barrier.query("BEGIN");
    const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    await barrier.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      f.edition,
    ]);
    request = command(cookie, {
      action: "request",
      divisionId: f.division,
      entryId: f.entries[1],
      version: 0,
    });
    await waitBlocked(pid);
    await new Promise((r) => setTimeout(r, 2200));
    await barrier.query("COMMIT");
    const r = await request;
    assert.equal(r.status, 200, await r.clone().text());
    assert.equal((await r.json()).state, "held");
    const after = await read(cookie, f.division);
    assert.equal(after.division.remaining, 0);
    assert.deepEqual(
      after.entries.map((e: { state: string }) => e.state),
      ["expired", "held"],
    );
  } finally {
    await barrier.query("ROLLBACK");
    barrier.release();
    if (request) await request;
  }
});

test("invitation is explicit, reviewed request reserves nothing, and actor revocation precedes receipt replay", async () => {
  const cookie = await login("organizer"),
    rep = await login("reviewer"),
    f = await fixture();
  const team = randomUUID(),
    registration = randomUUID(),
    grant = randomUUID();
  await pool.query(
    "INSERT INTO team(id,discipline,core_key) VALUES($1,'men_four',$2)",
    [team, `registration-fixture:${team}`],
  );
  await pool.query(
    "INSERT INTO season_registration(id,team_id,season,version) VALUES($1,$2,'2026-27',1)",
    [registration, team],
  );
  await pool.query(
    "INSERT INTO season_roster_version(registration_id,version,display_name,actor_id) VALUES($1,1,'Invited fixture','demo-organizer')",
    [registration],
  );
  await pool.query(
    "UPDATE event_entry SET team_id=$2,season_registration_id=$3,entry_admission='submitted_pending' WHERE id=$1",
    [f.entries[0], team, registration],
  );
  await pool.query(
    "INSERT INTO team_representation(id,user_id,registration_id,actions,created_by) VALUES($1,'demo-reviewer',$2,ARRAY['submit'],'demo-administrator')",
    [grant, registration],
  );
  assert.equal(
    (
      await command(cookie, {
        action: "open",
        divisionId: f.division,
        version: 0,
        terms: { ...terms, mode: "invited" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await command(
        rep,
        {
          action: "request",
          divisionId: f.division,
          entryId: f.entries[0],
          version: 0,
        },
        "demo-reviewer",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await command(
        rep,
        {
          action: "invite",
          divisionId: f.division,
          entryId: f.entries[0],
          version: 0,
        },
        "demo-reviewer",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await command(cookie, {
        action: "invite",
        divisionId: f.division,
        entryId: f.entries[0],
        version: 0,
      })
    ).status,
    200,
  );
  let w = await read(rep, f.division);
  assert.equal(w.entries.length, 1);
  assert.equal(w.entries[0].state, "invited");
  assert.equal(w.division.remaining, 1);
  const request = {
    action: "request",
    divisionId: f.division,
    entryId: f.entries[0],
    version: 1,
    requestId: randomUUID(),
  };
  const saved = await command(rep, request, "demo-reviewer");
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).state, "accepted");
  assert.equal(
    (
      await command(
        rep,
        {
          action: "request",
          divisionId: f.division,
          entryId: f.entries[1],
          version: 0,
        },
        "demo-reviewer",
      )
    ).status,
    403,
  );
  const audit = await pool.query(
    "SELECT c.audit_id,a.action,a.actor_id FROM registration_command c JOIN audit_record a ON a.id=c.audit_id WHERE c.actor_id='demo-reviewer' AND c.request_id=$1",
    [request.requestId],
  );
  assert.equal(audit.rowCount, 1);
  assert.equal(audit.rows[0].action, "registration_request");
  assert.equal(audit.rows[0].actor_id, "demo-reviewer");
  await assert.rejects(
    pool.query(
      "UPDATE registration_command SET result='{}' WHERE request_id=$1",
      [request.requestId],
    ),
    /immutable|preserv|history/i,
  );
  await pool.query(
    "UPDATE team_representation SET revoked_at=now(),revocation_reason='Fixture revocation' WHERE id=$1",
    [grant],
  );
  assert.equal((await command(rep, request, "demo-reviewer")).status, 403);
  w = await read(rep, f.division);
  assert.equal(w.entries.length, 0);
});

test("exact receipt replay cannot carry old authority across a queued division edition move", async () => {
  const cookie = await login("organizer"),
    f = await fixture(),
    other = await fixture();
  await pool.query(
    "DELETE FROM role_grant WHERE user_id='demo-organizer' AND event_id=$1",
    [other.edition],
  );
  const original = {
    action: "open",
    divisionId: f.division,
    version: 0,
    terms,
    requestId: randomUUID(),
  };
  assert.equal((await command(cookie, original)).status, 200);
  const barrier = await pool.connect();
  let replay: Promise<Response> | undefined;
  try {
    await barrier.query("BEGIN");
    const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    await barrier.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      f.edition,
    ]);
    replay = command(cookie, original);
    await waitBlocked(pid);
    await barrier.query("UPDATE division SET event_id=$2 WHERE id=$1", [
      f.division,
      other.edition,
    ]);
    await barrier.query("COMMIT");
    assert.equal((await replay).status, 409);
    const w = await read(cookie, f.division);
    assert.equal(w.division, undefined);
  } finally {
    await barrier.query("ROLLBACK");
    barrier.release();
    if (replay) await replay;
    await pool.query("UPDATE division SET event_id=$2 WHERE id=$1", [
      f.division,
      f.edition,
    ]);
  }
});

test("an audit/receipt persistence failure rolls admission and capacity back together", async () => {
  const cookie = await login("organizer"),
    f = await fixture();
  assert.equal(
    (
      await command(cookie, {
        action: "open",
        divisionId: f.division,
        version: 0,
        terms,
      })
    ).status,
    200,
  );
  const requestId = randomUUID(),
    name = `wcp009_${requestId.replaceAll("-", "")}`;
  await pool.query(
    `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Owned registration audit failure fixture'; END $$`,
  );
  await pool.query(
    `CREATE TRIGGER ${name} BEFORE INSERT ON registration_command FOR EACH ROW WHEN(NEW.request_id='${requestId}') EXECUTE FUNCTION ${name}()`,
  );
  try {
    assert.equal(
      (
        await command(cookie, {
          action: "accept",
          divisionId: f.division,
          entryId: f.entries[0],
          version: 0,
          requestId,
        })
      ).status,
      503,
    );
    const w = await read(cookie, f.division);
    assert.equal(w.division.remaining, 1);
    assert.equal(w.entries[0].state, "pending");
    assert.equal(w.entries[0].version, 0);
    assert.equal(
      w.receipts.some((r: { requestId: string }) => r.requestId === requestId),
      false,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT id FROM audit_record WHERE action='registration_accept' AND resource_id=$1",
          [f.entries[0]],
        )
      ).rowCount,
      0,
    );
  } finally {
    await pool.query(`DROP TRIGGER ${name} ON registration_command`);
    await pool.query(`DROP FUNCTION ${name}()`);
  }
});

test("one known team cannot consume two active places, including through an active lineup amendment; historical receipts remain read-only", async () => {
  const cookie = await login("organizer"),
    f = await fixture();
  function assemble(name: string) {
    const ids = Array.from({ length: 4 }, () => randomUUID());
    return {
      divisionId: f.division,
      name,
      coreKnown: true,
      corePlayerIds: ids,
      members: ids.map((playerId) => ({
        playerId,
        role: "core",
        position: "",
        participation: "declared",
      })),
      newPlayers: ids.map((id, i) => ({
        id,
        name: `${name} player ${i + 1}`,
        provisional: false,
      })),
    };
  }
  async function entry(raw: unknown, id = randomUUID(), version = 0) {
    return fetch(base + `/api/v1/entries${version ? `/${id}` : ""}`, {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        version,
        requestId: randomUUID(),
        entry: raw,
      }),
    });
  }
  const a = assemble("Known team A"),
    b = assemble("Known team B");
  let r = await entry(a);
  assert.equal(r.status, 201);
  const first = await r.json();
  r = await entry({
    ...a,
    newPlayers: [],
    teamId: first.teamId,
    name: "Duplicate submission for known team A",
  });
  assert.equal(r.status, 201);
  const duplicate = await r.json();
  r = await entry(b);
  assert.equal(r.status, 201);
  const other = await r.json();
  assert.equal(
    (
      await command(cookie, {
        action: "open",
        divisionId: f.division,
        version: 0,
        terms: { ...terms, capacity: 2, feeMinor: 10000 },
      })
    ).status,
    200,
  );
  const acceptA = {
    action: "request",
    divisionId: f.division,
    entryId: first.id,
    version: 0,
    requestId: randomUUID(),
  };
  assert.equal((await command(cookie, acceptA)).status, 200);
  r = await command(cookie, {
    action: "request",
    divisionId: f.division,
    entryId: duplicate.id,
    version: 0,
  });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /known team|active place/i);
  let w = await read(cookie, f.division);
  assert.equal(
    w.entries.find((e: { id: string }) => e.id === duplicate.id).state,
    "pending",
  );
  assert.equal(w.division.remaining, 1);
  assert.equal(
    (
      await command(cookie, {
        action: "request",
        divisionId: f.division,
        entryId: other.id,
        version: 0,
      })
    ).status,
    200,
  );
  r = await entry(
    {
      ...a,
      newPlayers: [],
      teamId: first.teamId,
      name: "Cannot replace known B with known A",
    },
    other.id,
    1,
  );
  assert.equal(r.status, 409);
  const current = await (
    await fetch(base + `/api/v1/entries/${other.id}`, { headers: { cookie } })
  ).json();
  assert.equal(current.teamId, other.teamId);
  assert.equal(current.version, 1);
  await pool.query(
    "UPDATE event_entry SET reservation_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",
    [first.id],
  );
  assert.equal(
    (
      await command(cookie, {
        action: "request",
        divisionId: f.division,
        entryId: duplicate.id,
        version: 0,
      })
    ).status,
    200,
  );
  // The original receipt remains valid after expiry and replacement, without reserving again.
  assert.equal((await command(cookie, acceptA)).status, 200);
  w = await read(cookie, f.division);
  assert.equal(
    w.entries.find((e: { id: string }) => e.id === first.id).state,
    "expired",
  );
  assert.equal(
    w.entries.find((e: { id: string }) => e.id === duplicate.id).state,
    "held",
  );
  assert.equal(w.division.remaining, 0);
});

test("two active lineup amendments to one known identity serialize before lower entry locks", async () => {
  const cookie = await login("organizer"),
    f = await fixture();
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const core = {
    divisionId: f.division,
    name: "Concurrent known core",
    coreKnown: true,
    corePlayerIds: ids,
    members: ids.map((playerId) => ({
      playerId,
      role: "core",
      position: "",
      participation: "declared",
    })),
    newPlayers: ids.map((id, i) => ({
      id,
      name: `Concurrent core player ${i}`,
      provisional: false,
    })),
  };
  let r = await fetch(base + "/api/v1/entries", {
    method: "POST",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: randomUUID(),
      version: 0,
      requestId: randomUUID(),
      entry: core,
    }),
  });
  assert.equal(r.status, 201);
  const known = await r.json();
  assert.equal(
    (
      await command(cookie, {
        action: "open",
        divisionId: f.division,
        version: 0,
        terms: { ...terms, capacity: 2 },
      })
    ).status,
    200,
  );
  for (const entryId of f.entries)
    assert.equal(
      (
        await command(cookie, {
          action: "request",
          divisionId: f.division,
          entryId,
          version: 0,
        })
      ).status,
      200,
    );
  const barrier = await pool.connect();
  let first: Promise<Response> | undefined,
    second: Promise<Response> | undefined;
  const amend = (id: string) =>
    fetch(base + `/api/v1/entries/${id}`, {
      method: "POST",
      headers: { cookie, Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 0,
        requestId: randomUUID(),
        entry: { ...core, teamId: known.teamId, newPlayers: [] },
      }),
    });
  try {
    await barrier.query("BEGIN");
    const pid = (await barrier.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    await barrier.query("SELECT id FROM division WHERE id=$1 FOR UPDATE", [
      f.division,
    ]);
    first = amend(f.entries[0]);
    const firstPid = await waitBlocked(pid);
    second = amend(f.entries[1]);
    await waitBlocked(firstPid);
    await barrier.query("ROLLBACK");
    const results = await Promise.all([first, second]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 409],
    );
    const current = await Promise.all(
      f.entries.map(async (id) =>
        (
          await fetch(base + `/api/v1/entries/${id}`, { headers: { cookie } })
        ).json(),
      ),
    );
    assert.equal(current.filter((e) => e.teamId === known.teamId).length, 1);
    assert.equal(current.filter((e) => e.teamId === null).length, 1);
    const w = await read(cookie, f.division);
    assert.equal(w.division.remaining, 0);
    assert.equal(
      w.entries.filter((e: { state: string }) => e.state === "accepted").length,
      2,
    );
  } finally {
    await barrier.query("ROLLBACK");
    barrier.release();
    await Promise.allSettled(
      [first, second].filter((p): p is Promise<Response> => !!p),
    );
  }
});
