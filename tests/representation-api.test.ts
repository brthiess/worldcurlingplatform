import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { authRequest } from "./auth-request";
import { representationFor } from "../src/modules/identity/representation";
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
async function request(
  path: string,
  cookie: string,
  body?: unknown,
  actorId?: string,
) {
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie,
      Origin: base,
      "Content-Type": "application/json",
      ...(actorId ? { "X-WCP-Actor": actorId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("WC grants explicit team-season actions; representatives self-enter with immutable on-behalf-of evidence", async () => {
  const admin = await login("administrator"),
    organizer = await login("organizer"),
    representative = await login("reviewer");
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const assembled = {
    divisionId: "prairie-men",
    name: "Representation API team",
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
      name: `Representative player ${i}`,
      provisional: false,
    })),
    registerSeason: { season: "2026-27", version: 0 },
  };
  let r = await request("/api/v1/entries", organizer, {
    id: randomUUID(),
    version: 0,
    requestId: randomUUID(),
    entry: assembled,
  });
  assert.equal(r.status, 201);
  const source = await r.json();
  r = await request("/api/v1/team-representation", admin);
  assert.equal(r.status, 200);
  const workspace = await r.json(),
    division = workspace.divisions.find(
      (d: { id: string }) => d.id === "prairie-men",
    );
  const configure = {
    action: "configure-season",
    requestId: randomUUID(),
    divisionId: "prairie-men",
    season: "2026-27",
    version: division.seasonVersion,
    reason: "Configure the entry season",
  };
  assert.equal(
    (await request("/api/v1/team-representation", admin, configure)).status,
    200,
  );
  const grant = {
    action: "grant",
    id: randomUUID(),
    requestId: randomUUID(),
    userId: "demo-reviewer",
    registrationId: source.registration.id,
    actions: ["submit", "amend", "withdraw", "payment"],
    reason: "Appointed team representative",
  };
  assert.equal(
    (await request("/api/v1/team-representation", organizer, grant)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/api/v1/team-representation",
        admin,
        grant,
        "demo-organizer",
      )
    ).status,
    403,
  );
  assert.equal(
    (await request("/api/v1/team-representation", admin, grant)).status,
    200,
  );
  assert.equal(
    (await request("/api/v1/team-representation", admin, grant)).status,
    200,
  );
  const entry = {
    ...assembled,
    newPlayers: [],
    registerSeason: undefined,
    teamId: source.teamId,
    registrationId: source.registration.id,
  };
  const command = {
    id: randomUUID(),
    requestId: randomUUID(),
    version: 0,
    entry,
  };
  r = await request("/api/v1/entries", representative, command);
  assert.equal(r.status, 201);
  const saved = await r.json();
  assert.equal(saved.teamId, source.teamId);
  assert.equal(saved.entryAdmission, "submitted_pending");
  assert.equal(saved.attribution.actorId, "demo-reviewer");
  assert.equal(saved.attribution.representationGrantId, grant.id);
  assert.equal(saved.attribution.season, "2026-27");
  assert.equal(
    (await request("/api/v1/entries", representative, command)).status,
    201,
  );
  assert.equal(
    (await request(`/api/v1/entries/${command.id}`, representative)).status,
    200,
  );
  const permitted = await (
    await request("/api/v1/entries", representative)
  ).json();
  assert.equal(
    permitted.representations.some((g: { id: string }) => g.id === grant.id),
    true,
  );
  assert.equal(
    permitted.entries.some((e: { id: string }) => e.id === command.id),
    true,
  );
  const amendment = {
    requestId: randomUUID(),
    version: 1,
    entry: { ...entry, name: "Representative amended name" },
  };
  r = await request(`/api/v1/entries/${command.id}`, representative, amendment);
  assert.equal(r.status, 200);
  const amended = await r.json();
  assert.equal(amended.version, 2);
  assert.equal(amended.registration.version, 1);
  assert.equal(
    (await request(`/api/v1/entries/${command.id}?version=1`, representative))
      .status,
    200,
  );
  assert.equal(
    (
      await request(`/api/v1/entries/${command.id}`, representative, {
        ...amendment,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(`/api/v1/entries/${command.id}`, representative, {
        ...amendment,
        requestId: randomUUID(),
        version: 2,
        entry: { ...entry, registerSeason: { season: "2026-27", version: 1 } },
      })
    ).status,
    403,
  );
  const replacement = randomUUID();
  const differentCore = {
    ...entry,
    teamId: undefined,
    corePlayerIds: [...ids.slice(0, 3), replacement],
    members: [],
    newPlayers: [
      { id: replacement, name: "Denied new core", provisional: false },
    ],
  };
  assert.equal(
    (
      await request(`/api/v1/entries/${command.id}`, representative, {
        requestId: randomUUID(),
        version: 2,
        entry: differentCore,
      })
    ).status,
    403,
  );
  assert.equal(
    (await request(`/api/v1/public/players/${replacement}`, "")).status,
    404,
  );
  const substitute = randomUUID();
  r = await request(`/api/v1/entries/${command.id}`, representative, {
    requestId: randomUUID(),
    version: 2,
    entry: {
      ...entry,
      members: [
        ...entry.members.slice(0, 3),
        {
          playerId: substitute,
          role: "substitute",
          position: "lead",
          participation: "declared",
        },
      ],
      newPlayers: [
        { id: substitute, name: "Event-only guest", provisional: false },
      ],
    },
  });
  assert.equal(r.status, 200);
  const substitution = await r.json();
  assert.equal(substitution.teamId, source.teamId);
  assert.equal(substitution.registration.members.length, 4);
  assert.equal(
    substitution.lineup.members.some(
      (m: { playerId: string }) => m.playerId === substitute,
    ),
    true,
  );
  const revoked = {
    action: "revoke",
    id: grant.id,
    requestId: randomUUID(),
    reason: "Representation ended",
  };
  assert.equal(
    (await request("/api/v1/team-representation", admin, revoked)).status,
    200,
  );
  assert.equal(
    (await request("/api/v1/team-representation", admin, revoked)).status,
    200,
  );
  assert.equal(
    (await request("/api/v1/entries", representative, command)).status,
    403,
  );
  assert.equal(
    (await request(`/api/v1/entries/${command.id}`, representative)).status,
    403,
  );
  const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  try {
    for (const action of ["submit", "amend", "withdraw", "payment"] as const)
      await assert.rejects(
        representationFor(
          db,
          "demo-reviewer",
          source.teamId,
          source.registration.id,
          "2026-27",
          action,
        ),
        /Current .* authority/,
      );
    const onlySubmit = {
      ...grant,
      id: randomUUID(),
      requestId: randomUUID(),
      actions: ["submit"],
    };
    assert.equal(
      (await request("/api/v1/team-representation", admin, onlySubmit)).status,
      200,
    );
    assert.equal(
      await representationFor(
        db,
        "demo-reviewer",
        source.teamId,
        source.registration.id,
        "2026-27",
        "submit",
      ),
      onlySubmit.id,
    );
    for (const action of ["amend", "withdraw", "payment"] as const)
      await assert.rejects(
        representationFor(
          db,
          "demo-reviewer",
          source.teamId,
          source.registration.id,
          "2026-27",
          action,
        ),
        /Current .* authority/,
      );
    await assert.rejects(
      representationFor(
        db,
        "demo-reviewer",
        source.teamId,
        source.registration.id,
        "2027-28",
        "submit",
      ),
      /Current .* authority/,
    );
    assert.equal(
      (
        await request(`/api/v1/entries/${command.id}`, representative, {
          ...amendment,
          version: 3,
          requestId: randomUUID(),
        })
      ).status,
      403,
    );
    const configuration = (
      await (await request("/api/v1/team-representation", admin)).json()
    ).divisions.find((d: { id: string }) => d.id === "prairie-men");
    const changed = {
      ...configure,
      requestId: randomUUID(),
      season: "2027-28",
      version: configuration.seasonVersion,
    };
    assert.equal(
      (await request("/api/v1/team-representation", admin, changed)).status,
      200,
    );
    assert.equal(
      (
        await request("/api/v1/entries", representative, {
          ...command,
          id: randomUUID(),
          requestId: randomUUID(),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/api/v1/team-representation", admin, {
          ...changed,
          requestId: randomUUID(),
          season: "2026-27",
          version: configuration.seasonVersion + 1,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await request("/api/v1/team-representation", admin, {
          ...onlySubmit,
          reason: "conflicting reuse",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request("/api/v1/team-representation", admin, {
          action: "revoke",
          id: onlySubmit.id,
          requestId: randomUUID(),
          reason: "End narrow authority",
        })
      ).status,
      200,
    );
    const linked = await db.query(
      "INSERT INTO player_account_link(player_id,user_id) VALUES($1,'demo-reviewer') ON CONFLICT DO NOTHING RETURNING player_id",
      [ids[0]],
    );
    try {
      assert.equal(
        (
          await request("/api/v1/entries", representative, {
            ...command,
            id: randomUUID(),
            requestId: randomUUID(),
          })
        ).status,
        403,
      );
    } finally {
      if (linked.rowCount)
        await db.query(
          "DELETE FROM player_account_link WHERE player_id=$1 AND user_id='demo-reviewer'",
          [ids[0]],
        );
    }
    const audit = await db.query(
      "SELECT a.actor_id,a.action,v.representation_grant_id FROM event_lineup_version v JOIN audit_record a ON a.id=v.audit_id WHERE v.entry_id=$1 AND v.version=1",
      [command.id],
    );
    assert.deepEqual(audit.rows, [
      {
        actor_id: "demo-reviewer",
        action: "entry_create",
        representation_grant_id: grant.id,
      },
    ]);
  } finally {
    await db.end();
  }
});
