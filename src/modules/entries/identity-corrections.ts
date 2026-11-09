import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  EntryError,
  coreIdentity,
  identifier,
  plainText,
} from "@/domain/entries";
import { correctedSelection } from "@/domain/identity-corrections";
import { readEventLineup } from "./entries";
type Reader = Pick<PoolClient, "query">;
async function staff(c: Reader, userId: string) {
  if (
    !(
      await c.query(
        "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
        [userId],
      )
    ).rowCount
  )
    throw new EntryError(
      "World Curling staff authority is required for factual identity corrections.",
      403,
    );
}
const projection = `id,actor_id AS "actorId",request_id AS "requestId",entry_id AS "entryId",reviewed_version AS "reviewedVersion",from_player_id AS "fromPlayerId",to_player_id AS "toPlayerId",reason,source,outcome,command_digest AS "commandDigest",created_at AS "createdAt",evidence`;
function receipt(row: Record<string, unknown>) {
  const { evidence, ...rest } = row;
  return { ...rest, ...(evidence as object) };
}
export async function correctionWorkspace(userId: string, requestId?: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await staff(c, userId);
    if (requestId) {
      const r = await c.query(
        `SELECT ${projection} FROM identity_correction WHERE actor_id=$1 AND request_id=$2`,
        [userId, identifier(requestId)],
      );
      if (!r.rowCount)
        throw new EntryError("No receipt for this account and request.", 404);
      await c.query("COMMIT");
      return receipt(r.rows[0]);
    }
    const entries = await c.query(
      `SELECT e.id,e.display_name AS name,e.version,d.name AS "divisionName",ev.name AS "eventName" FROM event_entry e JOIN division d ON d.id=e.division_id JOIN event_edition ev ON ev.id=d.event_id WHERE e.version>0 ORDER BY ev.starts_on DESC,e.display_name,e.id`,
    );
    const records = await c.query(
      `SELECT ${projection} FROM identity_correction ORDER BY created_at DESC,id`,
    );
    await c.query("COMMIT");
    return {
      actorId: userId,
      entries: entries.rows,
      records: records.rows.map(receipt),
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
/** Entry-local selection repair. No player consolidation, registered-core rewrite or historical reassessment. */
export async function correctIdentity(userId: string, bodyText: string) {
  if (bodyText.length > 12000)
    throw new EntryError("Correction evidence is too large.");
  const raw = JSON.parse(bodyText),
    entryId = identifier(raw?.entryId),
    requestId = identifier(raw?.requestId),
    from = identifier(raw?.fromPlayerId),
    to = identifier(raw?.toPlayerId);
  if (!Number.isSafeInteger(raw.version) || raw.version < 1)
    throw new EntryError("Provide the reviewed current entry version.");
  if (from === to) throw new EntryError("Choose a different player record.");
  const reason = plainText(raw.reason, 1000),
    source = plainText(raw.source, 1000),
    digest = createHash("sha256").update(bodyText).digest("hex");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    for (const key of [
      `identity-correction:${userId}:${requestId}`,
      `entry:${entryId}`,
    ])
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        key,
      ]);
    const observed = (
      await c.query(
        "SELECT e.division_id,d.event_id FROM event_entry e JOIN division d ON d.id=e.division_id WHERE e.id=$1",
        [entryId],
      )
    ).rows[0];
    if (!observed) throw new EntryError("Entry not found.", 404);
    await c.query("SELECT id FROM event_edition WHERE id=$1 FOR SHARE", [
      observed.event_id,
    ]);
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `admission-identity:${observed.division_id}`,
    ]);
    const entry = (
      await c.query("SELECT * FROM event_entry WHERE id=$1 FOR UPDATE", [
        entryId,
      ])
    ).rows[0];
    const d = (
      await c.query(
        "SELECT * FROM division WHERE id=$1 AND event_id=$2 FOR SHARE",
        [observed.division_id, observed.event_id],
      )
    ).rows[0];
    if (!d || entry.division_id !== observed.division_id)
      throw new EntryError(
        "Entry association changed. Reload before reviewing.",
        409,
      );
    // Current authority precedes both receipt replay and private evidence reads.
    await staff(c, userId);
    const previous = await c.query(
      `SELECT ${projection},body_text FROM identity_correction WHERE actor_id=$1 AND request_id=$2`,
      [userId, requestId],
    );
    if (previous.rowCount) {
      const { body_text, ...r } = previous.rows[0];
      if (body_text !== bodyText)
        throw new EntryError(
          "This request belongs to different exact command bytes.",
          409,
        );
      await c.query("COMMIT");
      return receipt(r);
    }
    if (entry.version !== raw.version)
      throw new EntryError(
        "This entry changed. Reload the current version before correcting.",
        409,
      );
    const before = await readEventLineup(c, entryId);
    if (!before) throw new EntryError("The entry has no recorded lineup.", 409);
    const core = (
      await c.query(
        "SELECT player_id FROM event_lineup_core WHERE entry_id=$1 AND version=$2 ORDER BY player_id",
        [entryId, entry.version],
      )
    ).rows.map((p) => p.player_id as string);
    const proposed = correctedSelection(
      {
        coreKnown: before.coreKnown,
        corePlayerIds: core,
        members: before.members.map(
          ({ playerId, role, position, participation }) => ({
            playerId,
            role,
            position,
            participation,
          }),
        ),
      },
      from,
      to,
    );
    const people = (
      await c.query(
        'SELECT id,name,origin,identity_status AS "identityStatus" FROM player WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',
        [[from, to]],
      )
    ).rows;
    if (people.length !== 2)
      throw new EntryError(
        "A selected player no longer exists. Reload the candidates.",
        409,
      );
    const collisions: { kind: string; ids: string[]; message: string }[] = [];
    if (proposed.collision)
      collisions.push({
        kind: "person",
        ids: [from, to],
        message:
          "Both player records already occur in this entry. Consolidation needs staff review.",
      });
    let teamId = before.teamId;
    const coreChanged = core.includes(from);
    const key =
      proposed.coreKnown && coreChanged && !proposed.collision
        ? coreIdentity(d.discipline, proposed.corePlayerIds)
        : null;
    if (key) {
      await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `team-core:${key}`,
      ]);
      const team = (
        await c.query("SELECT id FROM team WHERE core_key=$1", [key])
      ).rows[0];
      if (team) {
        collisions.push({
          kind: "team",
          ids: [before.teamId, team.id].filter(Boolean) as string[],
          message:
            "The corrected core already identifies another team. No teams were merged.",
        });
        const peers = (
          await c.query(
            "SELECT id FROM event_entry WHERE team_id=$1 AND id<>$2 ORDER BY id",
            [team.id, entryId],
          )
        ).rows;
        if (peers.length)
          collisions.push({
            kind: "entry",
            ids: peers.map((p) => p.id),
            message:
              "The proposed team already has event entries; retain separate participation records.",
          });
        const subjects = (
          await c.query(
            "SELECT rr.id FROM ranking_record rr JOIN season_registration sr ON sr.id=rr.registration_id WHERE sr.team_id=$1 ORDER BY rr.id",
            [team.id],
          )
        ).rows;
        if (subjects.length)
          collisions.push({
            kind: "ranking_subject",
            ids: subjects.map((s) => s.id),
            message:
              "The proposed team has separate ranking subjects. Frozen awards and inputs remain unchanged.",
          });
      } else teamId = randomUUID();
    }
    const id = randomUUID(),
      auditId = randomUUID(),
      outcome = collisions.length ? "issue" : "applied";
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [
        auditId,
        userId,
        outcome === "issue"
          ? "identity_correction_issue"
          : "factual_identity_correction",
        entryId,
      ],
    );
    let after: unknown = null;
    if (outcome === "applied") {
      if (key) {
        await c.query(
          "INSERT INTO team(id,discipline,core_key) VALUES($1,$2,$3)",
          [teamId, d.discipline, key],
        );
        for (const player of proposed.corePlayerIds)
          await c.query("INSERT INTO team_core_member VALUES($1,$2)", [
            teamId,
            player,
          ]);
      }
      const version = entry.version + 1,
        registrationId = coreChanged ? null : before.registrationId,
        registrationVersion = coreChanged ? null : before.registrationVersion;
      await c.query(
        "UPDATE event_entry SET version=$2,team_id=$3,season_registration_id=$4 WHERE id=$1",
        [entryId, version, teamId, registrationId],
      );
      const unresolved = await c.query(
        "SELECT id FROM player WHERE id=ANY($1::text[]) AND identity_status='provisional'",
        [
          [
            ...proposed.corePlayerIds,
            ...proposed.members.map((m) => m.playerId),
          ],
        ],
      );
      const status =
        !before.coreKnown ||
        proposed.members.filter(
          (m) => m.role === "core" || m.role === "substitute",
        ).length < (d.discipline === "mixed_doubles" ? 2 : 4) ||
        unresolved.rowCount
          ? "provisional"
          : "declared";
      await c.query(
        "INSERT INTO event_lineup_version(entry_id,version,team_id,registration_id,registration_version,display_name,core_known,status,audit_id,actor_id,request_id,command_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [
          entryId,
          version,
          teamId,
          registrationId,
          registrationVersion,
          before.name,
          before.coreKnown,
          status,
          auditId,
          userId,
          `correction-${id}`,
          digest,
        ],
      );
      for (const player of proposed.corePlayerIds)
        await c.query("INSERT INTO event_lineup_core VALUES($1,$2,$3)", [
          entryId,
          version,
          player,
        ]);
      for (const [i, m] of proposed.members.entries())
        await c.query(
          "INSERT INTO event_lineup_member VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            entryId,
            version,
            i,
            m.playerId,
            m.role,
            m.position,
            m.participation,
          ],
        );
      after = await readEventLineup(c, entryId);
    }
    const evidence = {
      before: { ...before, corePlayerIds: core },
      after,
      proposed,
      people,
      collisions,
      scope: "entry_selection",
      notice:
        outcome === "issue"
          ? "Unresolved staff issue retained. No canonical changes applied."
          : "Factual entry selection corrected. Prior cores, season registrations, game/result snapshots and ranking evidence remain preserved. Review ranking eligibility separately.",
    };
    const saved = await c.query(
      `INSERT INTO identity_correction(id,actor_id,request_id,entry_id,reviewed_version,from_player_id,to_player_id,reason,source,body_text,command_digest,outcome,evidence,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING ${projection}`,
      [
        id,
        userId,
        requestId,
        entryId,
        entry.version,
        from,
        to,
        reason,
        source,
        bodyText,
        digest,
        outcome,
        evidence,
        auditId,
      ],
    );
    await c.query("COMMIT");
    return receipt(saved.rows[0]);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
