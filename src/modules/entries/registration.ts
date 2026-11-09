import { randomUUID, createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  EntryError,
  identifier,
  canonicalEntryCommand,
} from "@/domain/entries";
import {
  registrationTerms,
  effectiveAdmission,
  requestAdmission,
} from "@/domain/registration";
import { representationFor } from "@/modules/identity/representation";
import { assertAdmissionTeamAvailable } from "./admission-identity";
import { feeTerms } from "@/domain/payments";
import { freezeEntryCharge, chargeBalance } from "@/modules/payments/charges";

async function staff(
  c: Pick<PoolClient, "query">,
  userId: string,
  eventId: string,
) {
  return !!(
    await c.query(
      "SELECT id FROM role_grant WHERE user_id=$1 AND ((role='administrator' AND event_id IS NULL AND game_id IS NULL) OR (role='organizer' AND event_id=$2 AND game_id IS NULL)) FOR SHARE",
      [userId, eventId],
    )
  ).rowCount;
}
const configColumns = `r.version,r.mode,r.capacity,r.requirements,coalesce(f.fee_minor,r.fee_minor) AS "feeMinor",coalesce(f.currency,r.currency) AS currency,coalesce(f.payment_terms,r.payment_terms) AS "paymentTerms",f.version AS "feeVersion",r.payment_window_minutes AS "paymentWindowMinutes",r.format,r.format_notes AS "formatNotes",r.opened_at AS "openedAt"`;

export async function registrationWorkspace(userId: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const clock = (await c.query("SELECT clock_timestamp() AS now")).rows[0]
      .now as Date;
    const divisions = (
      await c.query(
        `SELECT d.id,d.name,d.event_id AS "eventId",e.name AS "eventName",${configColumns},EXISTS(SELECT 1 FROM role_grant g WHERE g.user_id=$1 AND ((g.role='administrator' AND g.event_id IS NULL AND g.game_id IS NULL) OR (g.role='organizer' AND g.event_id=e.id AND g.game_id IS NULL))) AS manual FROM division d JOIN event_edition e ON e.id=d.event_id LEFT JOIN division_registration r ON r.division_id=d.id LEFT JOIN LATERAL (SELECT * FROM division_fee_version f WHERE f.division_id=d.id ORDER BY version DESC LIMIT 1) f ON true WHERE EXISTS(SELECT 1 FROM role_grant g WHERE g.user_id=$1 AND ((g.role='administrator' AND g.event_id IS NULL AND g.game_id IS NULL) OR (g.role='organizer' AND g.event_id=e.id AND g.game_id IS NULL))) OR (e.published AND e.admission_status='approved' AND EXISTS(SELECT 1 FROM team_representation g JOIN season_registration sr ON sr.id=g.registration_id JOIN team t ON t.id=sr.team_id WHERE g.user_id=$1 AND g.revoked_at IS NULL AND sr.season=d.entry_season AND t.discipline=d.discipline)) ORDER BY e.starts_on DESC,d.name,d.id`,
        [userId],
      )
    ).rows;
    const entries = (
      await c.query(
        `SELECT en.id,en.division_id AS "divisionId",en.display_name AS name,en.admission_state AS state,en.admission_version AS version,en.reservation_deadline AS deadline,coalesce(v.status,'provisional') AS "rosterStatus",(en.division_id=ANY($2::text[]) OR EXISTS(SELECT 1 FROM team_representation pg JOIN season_registration ps ON ps.id=pg.registration_id WHERE pg.user_id=$3 AND pg.revoked_at IS NULL AND 'payment'=ANY(pg.actions) AND ps.id=en.season_registration_id AND ps.team_id=en.team_id AND ps.season=d.entry_season)) AS "canReadPayment" FROM event_entry en JOIN division d ON d.id=en.division_id LEFT JOIN event_lineup_version v ON v.entry_id=en.id AND v.version=en.version WHERE en.division_id=ANY($1::text[]) AND (en.division_id=ANY($2::text[]) OR EXISTS(SELECT 1 FROM team_representation g JOIN season_registration sr ON sr.id=g.registration_id WHERE g.user_id=$3 AND g.revoked_at IS NULL AND sr.id=en.season_registration_id AND sr.team_id=en.team_id AND sr.season=d.entry_season)) ORDER BY en.display_name,en.id`,
        [
          divisions.map((d) => d.id),
          divisions.filter((d) => d.manual).map((d) => d.id),
          userId,
        ],
      )
    ).rows.map((e) => ({
      ...e,
      state: effectiveAdmission(e.state, e.deadline, clock),
    }));
    for (const en of entries) {
      en.payment = null;
      if (en.canReadPayment) {
        const charge = (
          await c.query(
            'SELECT fee_version AS "feeVersion",fee_minor AS "feeMinor",currency,payment_terms AS "paymentTerms" FROM entry_charge WHERE entry_id=$1',
            [en.id],
          )
        ).rows[0];
        if (charge)
          en.payment = {
            feeVersion: charge.feeVersion,
            currency: charge.currency,
            ...(await chargeBalance(c, en.id, charge)).balance,
          };
      }
    }
    const occupied = (
      await c.query(
        "SELECT division_id,count(*)::int AS count FROM event_entry WHERE division_id=ANY($1::text[]) AND (admission_state='accepted' OR (admission_state='held' AND reservation_deadline>$2)) GROUP BY division_id",
        [divisions.map((d) => d.id), clock],
      )
    ).rows;
    const receipts = (
      await c.query(
        `SELECT rc.request_id AS "requestId",rc.division_id AS "divisionId",rc.entry_id AS "entryId",rc.command FROM registration_command rc JOIN division rd ON rd.id=rc.division_id JOIN event_edition rev ON rev.id=rd.event_id LEFT JOIN event_entry ren ON ren.id=rc.entry_id AND ren.division_id=rd.id WHERE rc.actor_id=$1 AND (EXISTS(SELECT 1 FROM role_grant rg WHERE rg.user_id=$1 AND ((rg.role='administrator' AND rg.event_id IS NULL AND rg.game_id IS NULL) OR (rg.role='organizer' AND rg.event_id=rd.event_id AND rg.game_id IS NULL))) OR (rc.command->>'action'='request' AND rev.published AND rev.admission_status='approved' AND EXISTS(SELECT 1 FROM team_representation pg JOIN season_registration ps ON ps.id=pg.registration_id WHERE pg.user_id=$1 AND pg.revoked_at IS NULL AND 'submit'=ANY(pg.actions) AND ps.id=ren.season_registration_id AND ps.team_id=ren.team_id AND ps.season=rd.entry_season))) ORDER BY rc.created_at DESC LIMIT 200`,
        [userId],
      )
    ).rows;
    await c.query("COMMIT");
    return {
      actorId: userId,
      now: clock,
      divisions: divisions.map((d) => ({
        ...d,
        version: d.version ?? 0,
        remaining:
          d.capacity === null
            ? null
            : Math.max(
                0,
                d.capacity -
                  (occupied.find((o) => o.division_id === d.id)?.count ?? 0),
              ),
      })),
      entries,
      receipts: receipts.map(({ command, ...association }) => ({
        ...association,
        action: command.action,
        commandDigest: createHash("sha256")
          .update(canonicalEntryCommand(command))
          .digest("hex"),
      })),
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

function registrationReply(
  result: Record<string, unknown>,
  canReadPayment: boolean,
) {
  if (canReadPayment) return result;
  return Object.fromEntries(
    ["divisionId", "entryId", "version", "state", "deadline", "expired"]
      .filter((key) => Object.hasOwn(result, key))
      .map((key) => [key, result[key]]),
  );
}
export async function registrationCommand(userId: string, raw: unknown) {
  if (!raw || typeof raw !== "object")
    throw new EntryError("Provide a registration command.");
  const v = raw as Record<string, unknown>;
  const action = String(v.action),
    divisionId = identifier(v.divisionId),
    requestId = identifier(v.requestId);
  if (!["open", "request", "accept", "invite", "expire"].includes(action))
    throw new EntryError("Choose a registration action.");
  if (!Number.isSafeInteger(v.version) || Number(v.version) < 0)
    throw new EntryError("Provide the current registration version.");
  const entryId = ["request", "accept", "invite"].includes(action)
    ? identifier(v.entryId)
    : null;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const observed = (
      await c.query("SELECT event_id FROM division WHERE id=$1", [divisionId])
    ).rows[0];
    if (!observed) throw new EntryError("Division not found.", 404);
    // Every capacity/expiry command takes edition EXCLUSIVE before any lower row lock.
    // Compatible entry/finalizer SHARE writers therefore cannot form a lower-lock cycle.
    await c.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      observed.event_id,
    ]);
    const d = (
      await c.query(
        "SELECT d.entry_season,e.published,e.admission_status FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.id=$1 AND d.event_id=$2 FOR UPDATE OF d",
        [divisionId, observed.event_id],
      )
    ).rows[0];
    if (!d) throw new EntryError("Division moved. Reload before saving.", 409);
    const manual = await staff(c, userId, observed.event_id);
    const entry = entryId
      ? (
          await c.query(
            "SELECT * FROM event_entry WHERE id=$1 AND division_id=$2 FOR UPDATE",
            [entryId, divisionId],
          )
        ).rows[0]
      : null;
    if (entryId && !entry)
      throw new EntryError("Entry not found in this division.", 404);
    if (!manual) {
      if (action !== "request")
        throw new EntryError(
          "Organizer authority for this edition is required.",
          403,
        );
      if (!d.published || d.admission_status !== "approved")
        throw new EntryError(
          "Entry requires an approved published edition.",
          403,
        );
      await representationFor(
        c,
        userId,
        entry.team_id,
        entry.season_registration_id,
        d.entry_season,
        "submit",
      );
    }
    const canReadPayment =
      manual ||
      !!(
        await c.query(
          "SELECT pg.id FROM team_representation pg JOIN season_registration ps ON ps.id=pg.registration_id WHERE pg.user_id=$1 AND pg.revoked_at IS NULL AND 'payment'=ANY(pg.actions) AND ps.id=$2 AND ps.team_id=$3 AND ps.season=$4 FOR SHARE OF pg,ps",
          [
            userId,
            entry?.season_registration_id,
            entry?.team_id,
            d.entry_season,
          ],
        )
      ).rowCount;
    const old = (
      await c.query(
        "SELECT command,result FROM registration_command WHERE actor_id=$1 AND request_id=$2",
        [userId, requestId],
      )
    ).rows[0];
    if (old) {
      if (canonicalEntryCommand(old.command) !== canonicalEntryCommand(raw))
        throw new EntryError(
          "This request identifier was used for another command.",
          409,
        );
      await c.query("COMMIT");
      return {
        ...registrationReply(old.result, canReadPayment),
        replayed: true,
      };
    }
    // Capture time after any lock wait, not transaction-start now().
    const now = (await c.query("SELECT clock_timestamp() AS now")).rows[0]
      .now as Date;
    const config = (
      await c.query(
        "SELECT * FROM division_registration WHERE division_id=$1",
        [divisionId],
      )
    ).rows[0];
    let result: Record<string, unknown>;
    if (action === "open") {
      if (config)
        throw new EntryError(
          "Entry terms are already open and retained. Reload the current terms.",
          409,
        );
      if (v.version !== 0)
        throw new EntryError(
          "Registration changed. Reload the current terms.",
          409,
        );
      if (!d.published || d.admission_status !== "approved")
        throw new EntryError(
          "Approve and publish the edition before opening entries.",
          409,
        );
      if (
        (
          await c.query("SELECT id FROM game WHERE division_id=$1 LIMIT 1", [
            divisionId,
          ])
        ).rowCount
      )
        throw new EntryError(
          "Registration must open before a competition draw exists.",
          409,
        );
      const t = registrationTerms(v.terms);
      feeTerms(t);
      await c.query(
        "INSERT INTO division_registration(division_id,version,mode,capacity,requirements,fee_minor,currency,payment_terms,payment_window_minutes,format,format_notes,opened_at) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          divisionId,
          t.mode,
          t.capacity,
          t.requirements,
          t.feeMinor,
          t.currency,
          t.paymentTerms,
          t.paymentWindowMinutes,
          t.format,
          t.formatNotes,
          now,
        ],
      );
      await c.query(
        "INSERT INTO division_fee_version(division_id,version,fee_minor,currency,payment_terms,reason,actor_id) VALUES($1,1,$2,$3,$4,$5,$6)",
        [
          divisionId,
          t.feeMinor,
          t.currency,
          t.paymentTerms,
          "Original immutable opened fee terms",
          userId,
        ],
      );
      await c.query("UPDATE division SET format=$2 WHERE id=$1", [
        divisionId,
        t.format,
      ]);
      result = { divisionId, version: 1, openedAt: now, terms: t };
    } else {
      if (!config)
        throw new EntryError("Complete and open entry terms first.", 409);
      const expired = (
        await c.query(
          "UPDATE event_entry SET admission_state='expired',reservation_deadline=NULL,admission_version=admission_version+1 WHERE division_id=$1 AND admission_state='held' AND reservation_deadline<=$2 RETURNING id",
          [divisionId, now],
        )
      ).rows.map((e) => e.id);
      if (action === "expire") {
        if (v.version !== config.version)
          throw new EntryError(
            "Registration changed. Reload before releasing holds.",
            409,
          );
        result = { divisionId, expired };
      } else {
        // An entry may have expired above; compare the original observed version but never revive it.
        if (v.version !== entry.admission_version)
          throw new EntryError(
            "This admission changed. Reload its current version.",
            409,
          );
        const state = effectiveAdmission(
          entry.admission_state,
          entry.reservation_deadline,
          now,
        );
        const count = (
          await c.query(
            "SELECT count(*)::int AS count FROM event_entry WHERE division_id=$1 AND admission_state IN ('accepted','held')",
            [divisionId],
          )
        ).rows[0].count;
        const charge = await freezeEntryCharge(
          c,
          entryId!,
          divisionId,
          v.expectedFeeVersion,
        );
        const financial = await chargeBalance(c, entryId!, charge);
        let next;
        if (action === "invite") {
          if (config.mode !== "invited" || state !== "pending")
            throw new EntryError(
              "Only a pending entry in invitation-only mode can be invited.",
              409,
            );
          next = { state: "invited", deadline: null };
        } else
          next = requestAdmission(
            config.mode,
            state,
            financial.balance.dueMinor,
            config.payment_window_minutes,
            config.capacity - count,
            now,
            action === "accept",
          );
        const version = entry.admission_version + 1;
        if (["held", "accepted"].includes(next.state))
          await assertAdmissionTeamAvailable(
            c,
            divisionId,
            entry.team_id,
            entryId!,
            now,
            manual,
          );
        await c.query(
          "UPDATE event_entry SET admission_state=$2,reservation_deadline=$3,admission_version=$4 WHERE id=$1",
          [entryId, next.state, next.deadline, version],
        );
        result = {
          divisionId,
          entryId,
          version,
          ...next,
          expired,
          feeMinor: charge.feeMinor,
          currency: charge.currency,
          paymentState:
            financial.balance.dueMinor > 0
              ? "unpaid"
              : charge.feeMinor === 0
                ? "not_required"
                : "settled_by_records",
        };
      }
    }
    const auditId = randomUUID();
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [auditId, userId, `registration_${action}`, entryId ?? divisionId],
    );
    await c.query(
      "INSERT INTO registration_command(actor_id,request_id,division_id,entry_id,command,result,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        userId,
        requestId,
        divisionId,
        entryId,
        JSON.stringify(raw),
        JSON.stringify(result),
        auditId,
      ],
    );
    await c.query("COMMIT");
    return registrationReply(result, canReadPayment);
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      throw new EntryError(
        "This request identifier was used by another command. Reload before retrying.",
        409,
      );
    throw e;
  } finally {
    c.release();
  }
}
