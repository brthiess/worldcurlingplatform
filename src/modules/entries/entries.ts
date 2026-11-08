import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  coreIdentity,
  entryInput,
  EntryError,
  identifier,
  type LineupMember,
} from "@/domain/entries";
type Reader = Pick<PoolClient, "query">;
export type EventLineup = {
  entryId: string;
  version: number;
  status: "declared" | "provisional";
  teamId: string | null;
  registrationId: string | null;
  registrationVersion: number | null;
  name: string;
  coreKnown: boolean;
  recordedAt: Date | null;
  members: (LineupMember & {
    name: string;
    identityStatus: "identified" | "provisional";
  })[];
};
async function authorize(c: Reader, userId: string, eventId: string) {
  const r = await c.query(
    "SELECT role FROM role_grant WHERE user_id=$1 AND ((role='administrator' AND event_id IS NULL AND game_id IS NULL) OR (role='organizer' AND event_id=$2 AND game_id IS NULL)) FOR SHARE",
    [userId, eventId],
  );
  if (!r.rowCount)
    throw new EntryError(
      "Organizer authority for this edition is required.",
      403,
    );
}
async function roster(c: Reader, id: string, version?: number) {
  const r = await c.query(
    'SELECT r.id,r.team_id AS "teamId",r.season,v.version,v.display_name AS name FROM season_registration r JOIN season_roster_version v ON v.registration_id=r.id AND v.version=coalesce($2,r.version) WHERE r.id=$1',
    [id, version ?? null],
  );
  if (!r.rowCount) return null;
  const m = await c.query(
    "SELECT m.player_id AS \"playerId\",p.name,p.identity_status AS \"identityStatus\",m.role,m.position FROM season_roster_member m JOIN player p ON p.id=m.player_id WHERE m.registration_id=$1 AND m.version=$2 ORDER BY CASE m.role WHEN 'core' THEN 0 WHEN 'alternate' THEN 1 ELSE 2 END,p.name,p.id",
    [id, r.rows[0].version],
  );
  return { ...r.rows[0], members: m.rows };
}
/** Trusted shared read boundary. A game default references entryId + version; this is declared/defaulted roster evidence, never verified stone delivery. */
export async function readEventLineup(
  c: Reader,
  entryId: string,
  version?: number,
): Promise<EventLineup | null> {
  const r = await c.query(
    'SELECT e.id AS "entryId",v.version,v.status,v.team_id AS "teamId",v.registration_id AS "registrationId",v.registration_version AS "registrationVersion",v.display_name AS name,v.core_known AS "coreKnown",v.created_at AS "recordedAt" FROM event_entry e JOIN event_lineup_version v ON v.entry_id=e.id AND v.version=coalesce($2,e.version) WHERE e.id=$1',
    [entryId, version ?? null],
  );
  if (!r.rowCount) return null;
  const row = r.rows[0] as Omit<EventLineup, "members">;
  const m = await c.query(
    'SELECT m.player_id AS "playerId",p.name,p.identity_status AS "identityStatus",m.role,m.position,m.participation FROM event_lineup_member m JOIN player p ON p.id=m.player_id WHERE m.entry_id=$1 AND m.version=$2 ORDER BY m.ordinal',
    [entryId, row.version],
  );
  return { ...row, members: m.rows };
}
async function detail(c: Reader, id: string, version?: number) {
  let lineup = await readEventLineup(c, id, version);
  if (!lineup) {
    const legacy = await c.query(
      "SELECT id,display_name,version FROM event_entry WHERE id=$1 AND version=0",
      [id],
    );
    if (!legacy.rowCount || (version !== undefined && version !== 0))
      return null;
    lineup = {
      entryId: id,
      version: 0,
      status: "provisional",
      teamId: null,
      registrationId: null,
      registrationVersion: null,
      name: legacy.rows[0].display_name,
      coreKnown: false,
      recordedAt: null,
      members: [],
    };
  }
  const e = await c.query(
    'SELECT e.division_id AS "divisionId",d.event_id AS "eventId",d.discipline,ev.name AS "eventName",ev.origin FROM event_entry e JOIN division d ON d.id=e.division_id JOIN event_edition ev ON ev.id=d.event_id WHERE e.id=$1',
    [id],
  );
  const core = await c.query(
    'SELECT p.id AS "playerId",p.name,p.identity_status AS "identityStatus" FROM event_lineup_core m JOIN player p ON p.id=m.player_id WHERE m.entry_id=$1 AND m.version=$2 ORDER BY p.id',
    [id, lineup.version],
  );
  return {
    id,
    ...e.rows[0],
    name: lineup.name,
    version: lineup.version,
    status: lineup.status,
    coreKnown: lineup.coreKnown,
    teamId: lineup.teamId,
    core: core.rows,
    lineup,
    registration: lineup.registrationId
      ? await roster(
          c,
          lineup.registrationId,
          lineup.registrationVersion ?? undefined,
        )
      : null,
  };
}
export async function entryDetail(
  userId: string,
  id: string,
  version?: number,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const e = await c.query(
      "SELECT d.event_id FROM event_entry e JOIN division d ON d.id=e.division_id WHERE e.id=$1",
      [id],
    );
    if (!e.rowCount) throw new EntryError("Entry not found.", 404);
    await authorize(c, userId, e.rows[0].event_id);
    const result = await detail(c, id, version);
    if (!result)
      throw new EntryError("No recorded lineup for this entry version.", 404);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.entries(v)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(v) ?? "null";
}
export async function saveEntry(
  userId: string,
  id: string,
  raw: unknown,
  creating = false,
) {
  identifier(id);
  const command = (raw ?? {}) as Record<string, unknown>;
  const requestId = identifier(command.requestId);
  if (
    !Number.isSafeInteger(command.version) ||
    Number(command.version) < 0 ||
    (creating && command.version !== 0)
  )
    throw new EntryError(
      "Provide the reviewed entry version (zero for a new entry).",
    );
  const digest = createHash("sha256")
    .update(canonical({ id, command }))
    .digest("hex");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    for (const key of [`entry-request:${userId}:${requestId}`, `entry:${id}`])
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        key,
      ]);
    const existing = await c.query(
      "SELECT * FROM event_entry WHERE id=$1 FOR UPDATE",
      [id],
    );
    const candidate = (command.entry ?? {}) as Record<string, unknown>;
    const divisionId =
      existing.rows[0]?.division_id ?? identifier(candidate.divisionId);
    const d = await c.query(
      "SELECT d.discipline,d.event_id,e.origin FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.id=$1 FOR SHARE OF d,e",
      [divisionId],
    );
    if (!d.rowCount) throw new EntryError("Division not found.", 404);
    await authorize(c, userId, d.rows[0].event_id);
    const duplicate = await c.query(
      "SELECT entry_id,version,command_digest FROM event_lineup_version WHERE actor_id=$1 AND request_id=$2",
      [userId, requestId],
    );
    if (duplicate.rowCount) {
      const old = duplicate.rows[0];
      if (old.entry_id !== id || old.command_digest !== digest)
        throw new EntryError(
          "This request identifier was used for another command.",
          409,
        );
      const result = await detail(c, id, old.version);
      await c.query("COMMIT");
      return result;
    }
    if (creating && existing.rowCount)
      throw new EntryError("Entry already exists.", 409);
    if (!creating && !existing.rowCount)
      throw new EntryError("Entry not found.", 404);
    if (existing.rowCount && existing.rows[0].version !== command.version)
      throw new EntryError(
        "This entry changed. Reload the current version before saving.",
        409,
      );
    const input = entryInput(command.entry, d.rows[0].discipline);
    if (input.divisionId !== divisionId)
      throw new EntryError("An entry cannot move divisions.");
    for (const p of input.newPlayers)
      await c.query(
        "INSERT INTO player(id,name,origin,identity_status) VALUES($1,$2,$3,$4)",
        [
          p.id,
          p.name,
          d.rows[0].origin,
          p.provisional ? "provisional" : "identified",
        ],
      );
    const playerIds = [
      ...new Set([
        ...input.corePlayerIds,
        ...input.members.map((m) => m.playerId),
      ]),
    ];
    const players = await c.query(
      "SELECT id,identity_status FROM player WHERE id=ANY($1::text[]) FOR SHARE",
      [playerIds],
    );
    if (players.rowCount !== playerIds.length)
      throw new EntryError(
        "A selected player no longer exists. Select an existing player or add a new sport record.",
      );
    let teamId: string | null = null;
    if (input.coreKnown) {
      const key = coreIdentity(d.rows[0].discipline, input.corePlayerIds);
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `team-core:${key}`,
      ]);
      const found = await c.query("SELECT id FROM team WHERE core_key=$1", [
        key,
      ]);
      if (input.teamId && found.rows[0]?.id !== input.teamId)
        throw new EntryError(
          "The selected team has a different regular core or discipline. Assemble the permanent new core separately.",
          409,
        );
      teamId = found.rows[0]?.id ?? randomUUID();
      if (!found.rowCount) {
        await c.query(
          "INSERT INTO team(id,discipline,core_key) VALUES($1,$2,$3)",
          [teamId, d.rows[0].discipline, key],
        );
        for (const p of input.corePlayerIds)
          await c.query("INSERT INTO team_core_member VALUES($1,$2)", [
            teamId,
            p,
          ]);
      }
    }
    let registrationId: string | null = input.registrationId ?? null,
      registrationVersion: number | null = null;
    if (registrationId) {
      const selected = await roster(c, registrationId);
      if (!selected || selected.teamId !== teamId)
        throw new EntryError(
          "Season registration does not belong to this team.",
        );
      registrationVersion = selected.version;
    }
    if (input.registerSeason) {
      if (!teamId)
        throw new EntryError(
          "Complete regular core membership before season registration.",
        );
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `season-roster:${teamId}:${input.registerSeason.season}`,
      ]);
      const found = await c.query(
        "SELECT id,version FROM season_registration WHERE team_id=$1 AND season=$2 FOR UPDATE",
        [teamId, input.registerSeason.season],
      );
      if (found.rowCount) {
        const staff = await c.query(
          "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
          [userId],
        );
        if (!staff.rowCount)
          throw new EntryError(
            "Staff authority is required to amend an existing season roster. Save event-only lineup changes instead.",
            403,
          );
      }
      if ((found.rows[0]?.version ?? 0) !== input.registerSeason.version)
        throw new EntryError(
          "This season roster changed. Reload the selected team before changing its registration.",
          409,
        );
      registrationId = found.rows[0]?.id ?? randomUUID();
      registrationVersion = (found.rows[0]?.version ?? 0) + 1;
      if (!found.rowCount)
        await c.query("INSERT INTO season_registration VALUES($1,$2,$3,$4)", [
          registrationId,
          teamId,
          input.registerSeason.season,
          registrationVersion,
        ]);
      else
        await c.query("UPDATE season_registration SET version=$2 WHERE id=$1", [
          registrationId,
          registrationVersion,
        ]);
      await c.query(
        "INSERT INTO season_roster_version(registration_id,version,display_name,actor_id) VALUES($1,$2,$3,$4)",
        [registrationId, registrationVersion, input.name, userId],
      );
      const seasonMembers: LineupMember[] = [
        ...input.corePlayerIds.map(
          (playerId) =>
            input.members.find((m) => m.playerId === playerId) ?? {
              playerId,
              role: "core" as const,
              position: "",
              participation: "declared" as const,
            },
        ),
        ...input.members.filter(
          (m) => m.role === "alternate" || m.role === "coach",
        ),
      ];
      for (const m of seasonMembers)
        await c.query(
          "INSERT INTO season_roster_member VALUES($1,$2,$3,$4,$5)",
          [registrationId, registrationVersion, m.playerId, m.role, m.position],
        );
    }
    const version = Number(command.version) + 1;
    if (creating)
      await c.query(
        "INSERT INTO event_entry(id,division_id,display_name,team_id,season_registration_id,version) VALUES($1,$2,$3,$4,$5,$6)",
        [id, divisionId, input.name, teamId, registrationId, version],
      );
    else
      await c.query(
        "UPDATE event_entry SET display_name=$2,team_id=$3,season_registration_id=$4,version=$5 WHERE id=$1",
        [id, input.name, teamId, registrationId, version],
      );
    const status =
      !input.coreKnown ||
      input.members.filter((m) => m.role === "core" || m.role === "substitute")
        .length < (d.rows[0].discipline === "mixed_doubles" ? 2 : 4) ||
      players.rows.some((p) => p.identity_status === "provisional")
        ? "provisional"
        : "declared";
    const auditId = randomUUID();
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [auditId, userId, creating ? "entry_create" : "entry_lineup_update", id],
    );
    await c.query(
      "INSERT INTO event_lineup_version(entry_id,version,team_id,registration_id,registration_version,display_name,core_known,status,audit_id,actor_id,request_id,command_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
      [
        id,
        version,
        teamId,
        registrationId,
        registrationVersion,
        input.name,
        input.coreKnown,
        status,
        auditId,
        userId,
        requestId,
        digest,
      ],
    );
    for (const p of input.corePlayerIds)
      await c.query("INSERT INTO event_lineup_core VALUES($1,$2,$3)", [
        id,
        version,
        p,
      ]);
    for (const [i, m] of input.members.entries())
      await c.query(
        "INSERT INTO event_lineup_member VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, version, i, m.playerId, m.role, m.position, m.participation],
      );
    const result = await detail(c, id, version);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      throw new EntryError(
        "A record identifier already exists. Reload before retrying a different command.",
        409,
      );
    throw e;
  } finally {
    c.release();
  }
}
export async function entryWorkspace(userId: string) {
  const divisions = await pool.query(
    `SELECT d.id,d.name,d.discipline,e.id AS "eventId",e.name AS "eventName" FROM division d JOIN event_edition e ON e.id=d.event_id WHERE EXISTS(SELECT 1 FROM role_grant r WHERE r.user_id=$1 AND ((r.role='administrator' AND r.event_id IS NULL AND r.game_id IS NULL) OR (r.role='organizer' AND r.event_id=e.id AND r.game_id IS NULL))) ORDER BY e.starts_on DESC,d.name`,
    [userId],
  );
  const entries = await pool.query(
    'SELECT id,division_id AS "divisionId",display_name AS name,version FROM event_entry WHERE division_id=ANY($1::text[]) ORDER BY display_name,id',
    [divisions.rows.map((d) => d.id)],
  );
  const admin = await pool.query(
    "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL",
    [userId],
  );
  return {
    divisions: divisions.rows,
    entries: entries.rows,
    isAdministrator: !!admin.rowCount,
  };
}
export async function publicEntry(id: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const visible = await c.query(
      "SELECT en.id FROM event_entry en JOIN division d ON d.id=en.division_id JOIN event_edition e ON e.id=d.event_id WHERE en.id=$1 AND e.published AND e.admission_status='approved'",
      [id],
    );
    const result = visible.rowCount ? await detail(c, id) : null;
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function publicTeams(id?: string, q = "") {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const teams = await c.query(
      `SELECT t.id,t.discipline,coalesce((SELECT r.display_name FROM event_lineup_version r WHERE r.team_id=t.id ORDER BY r.created_at DESC LIMIT 1),'Team') AS name FROM team t WHERE ($1::text IS NULL OR t.id=$1) ORDER BY t.id`,
      [id ?? null],
    );
    const result = [];
    for (const t of teams.rows) {
      const core = await c.query(
        'SELECT p.id AS "playerId",p.name,p.origin,p.identity_status AS "identityStatus" FROM team_core_member m JOIN player p ON p.id=m.player_id WHERE m.team_id=$1 ORDER BY p.name,p.id',
        [t.id],
      );
      if (
        q &&
        !`${t.name} ${core.rows.map((p) => p.name).join(" ")}`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
        continue;
      const registrations = await c.query(
        "SELECT id FROM season_registration WHERE team_id=$1 ORDER BY season DESC",
        [t.id],
      );
      const entries = await c.query(
        `SELECT en.id,en.display_name AS name,en.version,d.event_id AS "eventId",e.name AS "eventName" FROM event_entry en JOIN division d ON d.id=en.division_id JOIN event_edition e ON e.id=d.event_id WHERE en.team_id=$1 AND e.published AND e.admission_status='approved' ORDER BY e.starts_on DESC,en.id`,
        [t.id],
      );
      result.push({
        ...t,
        core: core.rows,
        registrations: await Promise.all(
          registrations.rows.map((r) => roster(c, r.id)),
        ),
        entries: entries.rows,
      });
    }
    await c.query("COMMIT");
    return id ? (result[0] ?? null) : result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function publicEventEntries(eventId: string) {
  const result = await pool.query(
    `SELECT en.id,en.display_name AS name,en.division_id AS "divisionId",en.team_id AS "teamId",en.version,coalesce(v.status,'provisional') AS status FROM event_entry en JOIN division d ON d.id=en.division_id JOIN event_edition e ON e.id=d.event_id LEFT JOIN event_lineup_version v ON v.entry_id=en.id AND v.version=en.version WHERE e.id=$1 AND e.published AND e.admission_status='approved' ORDER BY en.display_name,en.id`,
    [eventId],
  );
  return result.rows;
}
