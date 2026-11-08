import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(() => pool.end());
const base = process.env.BETTER_AUTH_URL!;
const sessions = new Map<string, string>();
async function login(role: string) {
  if (sessions.has(role)) return sessions.get(role)!;
  const send = () =>
    fetch(base + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${role}@demo.invalid`,
        password: process.env.DEMO_PASSWORD,
      }),
    });
  let r = await send();
  if (r.status === 429) {
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(
          60000,
          Math.max(1000, Number(r.headers.get("X-Retry-After") ?? 60) * 1000),
        ) + 250,
      ),
    );
    r = await send();
  }
  assert.equal(r.status, 200);
  const cookie = r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  sessions.set(role, cookie);
  return cookie;
}
async function request(path: string, cookie: string, body?: unknown) {
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("WC grants scoped review, routes one reviewer and delegates cannot grant onward or edit organizer data", async () => {
  const admin = await login("administrator"),
    organizer = await login("organizer"),
    reviewer = await login("reviewer");
  const grantId = randomUUID();
  const grant = {
    action: "grant",
    id: grantId,
    authorityName: "Curling Canada test",
    reviewerId: "demo-reviewer",
    scope: {
      countries: ["Canada"],
      organizationIds: ["prairie-club"],
      disciplines: ["men_four"],
      categories: ["open"],
      includeEventIds: [],
      excludeEventIds: [],
    },
    reason: "National federation assignment",
  };
  assert.equal(
    (await request("/api/v1/approval-delegations", organizer, grant)).status,
    403,
  );
  let r = await request("/api/v1/approval-delegations", admin, grant);
  assert.equal(r.status, 200, await r.text());
  assert.equal(
    (
      await request("/api/v1/approval-delegations", reviewer, {
        ...grant,
        id: randomUUID(),
      })
    ).status,
    403,
  );
  const id = randomUUID(),
    application = {
      organizationId: "prairie-club",
      seriesId: "prairie",
      name: "Authority Open 2027",
      startsOn: "2027-11-08",
      endsOn: "2027-11-10",
      city: "Regina",
      country: "Canada",
      venue: "",
      timezone: "America/Regina",
      category: "open",
      divisions: [{ id: randomUUID(), name: "Men", discipline: "men_four" }],
    };
  r = await request("/api/v1/applications", organizer, {
    id,
    requestId: randomUUID(),
    action: "create",
    application,
  });
  assert.equal(r.status, 201);
  let app = await r.json();
  assert.equal(app.reviewerId, "demo-reviewer");
  assert.equal(app.authorityName, "Curling Canada test");
  r = await request(`/api/v1/applications/${id}`, organizer, {
    requestId: randomUUID(),
    action: "submit",
    version: app.version,
  });
  assert.equal(r.status, 200);
  app = await r.json();
  const queue = await (await request("/api/v1/applications", reviewer)).json();
  assert.equal(
    queue.applications.some((a: { id: string }) => a.id === id),
    true,
  );
  assert.equal(
    (
      await request(`/api/v1/applications/${id}`, reviewer, {
        requestId: randomUUID(),
        action: "edit",
        version: app.version,
        application,
      })
    ).status,
    403,
  );
  r = await request(`/api/v1/applications/${id}`, reviewer, {
    requestId: randomUUID(),
    action: "approve",
    version: app.version,
  });
  assert.equal(r.status, 200);
  app = await r.json();
  assert.equal(app.status, "approved");
  assert.equal(app.history.at(-1).actorName, "Demo reviewer");
  r = await request("/api/v1/approval-delegations", admin, {
    action: "revoke",
    id: grantId,
    reason: "Test assignment ended",
  });
  assert.equal(r.status, 200);
  assert.equal(
    (await request(`/api/v1/applications/${id}`, reviewer)).status,
    403,
  );
});
test("explicit reassignment and reasoned WC override preserve a single responsibility and versioned history", async () => {
  const admin = await login("administrator"),
    organizer = await login("organizer"),
    reviewer = await login("reviewer");
  const grantId = randomUUID(),
    id = randomUUID();
  const grant = {
    action: "grant",
    id: grantId,
    authorityName: "Named exception authority",
    reviewerId: "demo-reviewer",
    scope: {
      countries: ["Sweden"],
      organizationIds: [],
      disciplines: [],
      categories: [],
      includeEventIds: [id],
      excludeEventIds: [],
    },
    reason: "Named event exception",
  };
  assert.equal(
    (await request("/api/v1/approval-delegations", admin, grant)).status,
    200,
  );
  const application = {
    organizationId: "prairie-club",
    seriesId: "prairie",
    name: "Exception Open 2027",
    startsOn: "2027-11-08",
    endsOn: "2027-11-10",
    city: "Regina",
    country: "Canada",
    venue: "",
    timezone: "America/Regina",
    divisions: [{ id: randomUUID(), name: "Women", discipline: "women_four" }],
  };
  let r = await request("/api/v1/applications", organizer, {
    id,
    requestId: randomUUID(),
    action: "create",
    application,
  });
  assert.equal(r.status, 201);
  let app = await r.json();
  assert.equal(app.authorityName, "Named exception authority");
  r = await request(`/api/v1/applications/${id}`, organizer, {
    requestId: randomUUID(),
    action: "submit",
    version: app.version,
  });
  app = await r.json();
  assert.equal(
    (
      await request(`/api/v1/applications/${id}`, admin, {
        requestId: randomUUID(),
        action: "approve",
        version: app.version,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`/api/v1/applications/${id}`, admin, {
        requestId: randomUUID(),
        action: "override_approve",
        version: app.version,
      })
    ).status,
    400,
  );
  const reassign = {
    requestId: randomUUID(),
    action: "reassign",
    version: app.version,
    delegationId: null,
    reviewerId: "demo-administrator",
    reason: "World Curling retains responsibility for this exception",
  };
  assert.equal(
    (await request(`/api/v1/applications/${id}`, reviewer, reassign)).status,
    403,
  );
  r = await request(`/api/v1/applications/${id}`, admin, reassign);
  assert.equal(r.status, 200);
  app = await r.json();
  assert.equal(app.reviewerId, "demo-administrator");
  assert.equal(app.authorityName, "World Curling");
  assert.equal(app.history.at(-1).reason, reassign.reason);
  assert.equal(
    (
      await request(`/api/v1/applications/${id}`, reviewer, {
        requestId: randomUUID(),
        action: "approve",
        version: app.version,
      })
    ).status,
    403,
  );
  r = await request(`/api/v1/applications/${id}`, admin, {
    requestId: randomUUID(),
    action: "reassign",
    version: app.version,
    delegationId: grantId,
    reason: "Return responsibility explicitly",
  });
  assert.equal(r.status, 200);
  app = await r.json();
  const decisions = await Promise.all([
    request(`/api/v1/applications/${id}`, admin, {
      requestId: randomUUID(),
      action: "override_approve",
      version: app.version,
      reason: "WC resolves this application after direct verification",
    }),
    request(`/api/v1/applications/${id}`, reviewer, {
      requestId: randomUUID(),
      action: "reject",
      version: app.version,
      reason: "Concurrent delegated decision",
    }),
  ]);
  assert.deepEqual(decisions.map((d) => d.status).sort(), [200, 409]);
  app = await (await request(`/api/v1/applications/${id}`, admin)).json();
  assert.equal(app.history.length, 5);
  assert.equal(app.delegationId, grantId);
  const override = {
    requestId: randomUUID(),
    action: app.status === "approved" ? "override_reject" : "override_approve",
    version: app.version,
    reason:
      "World Curling replaces the decided admission with recorded justification",
  };
  r = await request(`/api/v1/applications/${id}`, admin, override);
  assert.equal(r.status, 200);
  app = await r.json();
  assert.equal(app.history.length, 6);
  assert.equal(app.history.at(-1).reason, override.reason);
  assert.equal(app.history.at(-1).action, override.action);
  assert.equal(
    (await request(`/api/v1/applications/${id}`, admin, override)).status,
    200,
  );
  assert.equal(
    (
      await request(`/api/v1/applications/${id}`, admin, {
        ...override,
        reason: "Conflicting request reuse",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/v1/approval-delegations", admin, {
        action: "revoke",
        id: grantId,
        reason: "Acceptance complete",
      })
    ).status,
    200,
  );
});
test("organizer assigns only own event scoring; actual score commands deny cross-event and revoked access", async () => {
  const organizer = await login("organizer"),
    recipient = await login("ungranted");
  const id = randomUUID(),
    grant = {
      id,
      userId: "demo-ungranted",
      role: "scorekeeper",
      eventId: "prairie-2026",
      gameId: "game-3",
      reason: "Volunteer sheet B duty",
    };
  assert.equal(
    (
      await request("/api/v1/role-grants", organizer, {
        ...grant,
        id: randomUUID(),
        eventId: "other-2026",
        gameId: "other-game",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/v1/role-grants", organizer, {
        ...grant,
        id: randomUUID(),
        role: "organizer",
        gameId: null,
      })
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/v1/role-grants", organizer, grant)).status,
    201,
  );
  let r = await request("/api/v1/games/game-3/scoring", recipient);
  assert.equal(r.status, 200);
  const game = await r.json();
  const command = {
    requestId: randomUUID(),
    action: "end",
    expectedVersion: game.version,
    hammer: null,
    endNumber: 1,
    end: { state: "unknown", a: null, b: null },
  };
  r = await request("/api/v1/games/game-3/scoring", recipient, command);
  assert.equal(r.status, 200);
  assert.equal(
    (
      await request("/api/v1/games/other-game/scoring", recipient, {
        ...command,
        requestId: randomUUID(),
        expectedVersion: 0,
      })
    ).status,
    403,
  );
  assert.equal((await request("/api/v1/applications", recipient)).status, 200);
  assert.deepEqual(
    (await (await request("/api/v1/applications", recipient)).json())
      .applications,
    [],
  );
  assert.equal(
    (
      await request("/api/v1/role-grants", organizer, {
        action: "revoke",
        id,
        reason: "Shift ended",
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/v1/games/game-3/scoring", recipient, command)).status,
    403,
  );
  assert.equal(
    (await request("/api/v1/games/game-3/scoring", recipient)).status,
    403,
  );
});
async function waitForBlocked(pid: number) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const result = await pool.query(
      "SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))",
      [pid],
    );
    if (result.rowCount) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(
    "Expected real HTTP command to wait behind the fixture resource lock",
  );
}
test("real routing independently denies each scope mismatch, named exclusion and overlapping matches", async () => {
  const admin = await login("administrator"),
    reviewer = await login("reviewer");
  const grantId = randomUUID(),
    namedId = randomUUID(),
    excludedId = randomUUID(),
    otherOrg = `wcp005-org-${randomUUID()}`,
    otherSeries = `wcp005-series-${randomUUID()}`;
  await pool.query(
    "INSERT INTO organizing_organization(id,name,approval_administrator_id) VALUES($1,'Authority alternate organizer','demo-administrator')",
    [otherOrg],
  );
  await pool.query(
    "INSERT INTO event_series(id,name,organization_id) VALUES($1,'Authority alternate series',$2)",
    [otherSeries, otherOrg],
  );
  const scope = {
    countries: ["Canada"],
    organizationIds: ["prairie-club"],
    disciplines: ["men_four"],
    categories: ["open"],
    includeEventIds: [namedId, excludedId],
    excludeEventIds: [excludedId],
  };
  const grant = {
    action: "grant",
    id: grantId,
    authorityName: "Independent scope routing",
    reviewerId: "demo-reviewer",
    scope,
    reason: "Match every independent dimension",
  };
  assert.equal(
    (await request("/api/v1/approval-delegations", admin, grant)).status,
    200,
  );
  const baseline = {
    organizationId: "prairie-club",
    seriesId: "prairie",
    name: "Routing expectation Open",
    startsOn: "2027-11-08",
    endsOn: "2027-11-10",
    city: "Regina",
    country: "Canada",
    venue: "",
    timezone: "America/Regina",
    category: "open",
    divisions: [{ id: randomUUID(), name: "Men", discipline: "men_four" }],
  };
  const cases = [
    { country: "Sweden" },
    { organizationId: otherOrg, seriesId: otherSeries },
    { category: "invitational" },
    {
      divisions: [
        { id: randomUUID(), name: "Mixed", discipline: "mixed_doubles" },
      ],
    },
    {
      divisions: [
        { id: randomUUID(), name: "Men", discipline: "men_four" },
        { id: randomUUID(), name: "Women", discipline: "women_four" },
      ],
    },
  ];
  for (const changes of cases) {
    const id = randomUUID();
    const application = {
      ...baseline,
      divisions: [{ id: randomUUID(), name: "Men", discipline: "men_four" }],
      ...changes,
    };
    const r = await request("/api/v1/applications", admin, {
      id,
      requestId: randomUUID(),
      action: "create",
      application,
    });
    assert.equal(r.status, 201);
    const app = await r.json();
    assert.equal(app.authorityName, "World Curling");
    assert.equal(app.reviewerId, "demo-administrator");
    assert.equal(
      (await request(`/api/v1/applications/${id}`, reviewer)).status,
      403,
    );
  }
  for (const [id, expected] of [
    [namedId, "demo-reviewer"],
    [excludedId, "demo-administrator"],
  ]) {
    const r = await request("/api/v1/applications", admin, {
      id,
      requestId: randomUUID(),
      action: "create",
      application: {
        ...baseline,
        country: "Sweden",
        divisions: [{ id: randomUUID(), name: "Men", discipline: "men_four" }],
      },
    });
    assert.equal(r.status, 201);
    assert.equal((await r.json()).reviewerId, expected);
  }
  const overlapId = randomUUID();
  assert.equal(
    (
      await request("/api/v1/approval-delegations", admin, {
        ...grant,
        id: overlapId,
        authorityName: "Overlapping federation",
      })
    ).status,
    200,
  );
  const r = await request("/api/v1/applications", admin, {
    id: randomUUID(),
    requestId: randomUUID(),
    action: "create",
    application: {
      ...baseline,
      divisions: [{ id: randomUUID(), name: "Men", discipline: "men_four" }],
    },
  });
  assert.equal(r.status, 201);
  const overlap = await r.json();
  assert.equal(overlap.reviewerId, "demo-administrator");
  assert.equal(overlap.delegationId, null);
  for (const id of [grantId, overlapId])
    assert.equal(
      (
        await request("/api/v1/approval-delegations", admin, {
          action: "revoke",
          id,
          reason: "Independent routing checks complete",
        })
      ).status,
      200,
    );
});
test("approval grants roll back with their audit and retain immutable reasoned history", async () => {
  const admin = await login("administrator"),
    id = randomUUID();
  const grant = {
    action: "grant",
    id,
    authorityName: "Atomic federation",
    reviewerId: "demo-reviewer",
    scope: {
      countries: ["Norway"],
      organizationIds: [],
      disciplines: [],
      categories: [],
      includeEventIds: [],
      excludeEventIds: [],
    },
    reason: "Atomic authority audit",
  };
  await pool.query(
    "CREATE FUNCTION wcp005_fail_authority_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled audit failure'; END $$",
  );
  await pool.query(
    `CREATE TRIGGER wcp005_fail_authority_audit BEFORE INSERT ON authority_history FOR EACH ROW WHEN (NEW.resource_id='${id}') EXECUTE FUNCTION wcp005_fail_authority_audit()`,
  );
  try {
    assert.equal(
      (await request("/api/v1/approval-delegations", admin, grant)).status,
      503,
    );
    const workspace = await (
      await request("/api/v1/approval-delegations", admin)
    ).json();
    assert.equal(
      workspace.delegations.some((d: { id: string }) => d.id === id),
      false,
    );
    assert.equal(
      workspace.history.some(
        (h: { resourceId: string }) => h.resourceId === id,
      ),
      false,
    );
  } finally {
    await pool.query(
      "DROP TRIGGER wcp005_fail_authority_audit ON authority_history",
    );
    await pool.query("DROP FUNCTION wcp005_fail_authority_audit()");
  }
  assert.equal(
    (await request("/api/v1/approval-delegations", admin, grant)).status,
    200,
  );
  assert.equal(
    (await request("/api/v1/approval-delegations", admin, grant)).status,
    200,
  );
  await assert.rejects(
    pool.query("UPDATE authority_history SET reason=$2 WHERE resource_id=$1", [
      id,
      "Tampered",
    ]),
    /immutable/,
  );
  const history = (
    await (await request("/api/v1/approval-delegations", admin)).json()
  ).history.filter((h: { resourceId: string }) => h.resourceId === id);
  assert.equal(history.length, 1);
  assert.equal(history[0].reason, "Atomic authority audit");
  assert.equal(
    (
      await request("/api/v1/approval-delegations", admin, {
        action: "revoke",
        id,
        reason: "Atomic audit check complete",
      })
    ).status,
    200,
  );
});
test("queued application and scoring commands recheck authority after revocation commits", async () => {
  const admin = await login("administrator"),
    organizer = await login("organizer"),
    reviewer = await login("reviewer"),
    recipient = await login("ungranted");
  const id = randomUUID(),
    grantId = randomUUID();
  assert.equal(
    (
      await request("/api/v1/approval-delegations", admin, {
        action: "grant",
        id: grantId,
        authorityName: "Queued review authority",
        reviewerId: "demo-reviewer",
        scope: {
          countries: [],
          organizationIds: [],
          disciplines: [],
          categories: [],
          includeEventIds: [id],
          excludeEventIds: [],
        },
        reason: "Named queued review test",
      })
    ).status,
    200,
  );
  const application = {
    organizationId: "prairie-club",
    seriesId: "prairie",
    name: "Revocation race Open",
    startsOn: "2027-11-08",
    endsOn: "2027-11-10",
    city: "Regina",
    country: "Canada",
    venue: "",
    timezone: "America/Regina",
    divisions: [{ id: randomUUID(), name: "Men", discipline: "men_four" }],
  };
  let response = await request("/api/v1/applications", organizer, {
    id,
    requestId: randomUUID(),
    action: "create",
    application,
  });
  assert.equal(response.status, 201);
  let app = await response.json();
  response = await request(`/api/v1/applications/${id}`, organizer, {
    requestId: randomUUID(),
    action: "submit",
    version: app.version,
  });
  assert.equal(response.status, 200);
  app = await response.json();
  const blocker = await pool.connect();
  try {
    await blocker.query("BEGIN");
    const pid = (await blocker.query("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    await blocker.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    const pending = request(`/api/v1/applications/${id}`, reviewer, {
      requestId: randomUUID(),
      action: "approve",
      version: app.version,
    });
    await waitForBlocked(pid);
    assert.equal(
      (
        await request("/api/v1/approval-delegations", admin, {
          action: "revoke",
          id: grantId,
          reason: "Review duty revoked while command queued",
        })
      ).status,
      200,
    );
    await blocker.query("COMMIT");
    assert.equal((await pending).status, 403);
    const current = await (
      await request(`/api/v1/applications/${id}`, admin)
    ).json();
    assert.equal(current.status, "submitted");
    assert.equal(current.history.length, 2);
    assert.equal(current.responsibilityActive, false);
    const staffId = randomUUID();
    assert.equal(
      (
        await request("/api/v1/role-grants", organizer, {
          id: staffId,
          userId: "demo-ungranted",
          role: "scorekeeper",
          eventId: "prairie-2026",
          gameId: "game-3",
          reason: "Queued scoring duty",
        })
      ).status,
      201,
    );
    const game = await (
      await request("/api/v1/games/game-3/scoring", recipient)
    ).json();
    await blocker.query("BEGIN");
    await blocker.query("SELECT id FROM game WHERE id='game-3' FOR UPDATE");
    const scoring = request("/api/v1/games/game-3/scoring", recipient, {
      requestId: randomUUID(),
      action: "end",
      expectedVersion: game.version,
      hammer: null,
      endNumber: 1,
      end: { state: "unknown", a: null, b: null },
    });
    await waitForBlocked(pid);
    assert.equal(
      (
        await request("/api/v1/role-grants", organizer, {
          action: "revoke",
          id: staffId,
          reason: "Scoring duty revoked while queued",
        })
      ).status,
      200,
    );
    await blocker.query("COMMIT");
    assert.equal((await scoring).status, 403);
  } finally {
    await blocker.query("ROLLBACK");
    blocker.release();
  }
});
