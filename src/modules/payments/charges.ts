import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  EntryError,
  identifier,
  plainText,
  canonicalEntryCommand,
} from "@/domain/entries";
import {
  feeTerms,
  reconcileCharge,
  creditAmount,
  admissionAttention,
} from "@/domain/payments";
import { effectiveAdmission } from "@/domain/registration";
import { assertAdmissionTeamAvailable } from "@/modules/entries/admission-identity";

type Reader = Pick<PoolClient, "query">;
export async function financialStaff(
  c: Reader,
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
export async function currentFee(c: Reader, divisionId: string) {
  return (
    (
      await c.query(
        'SELECT version,fee_minor AS "feeMinor",currency,payment_terms AS "paymentTerms",reason,created_at AS "createdAt" FROM division_fee_version WHERE division_id=$1 ORDER BY version DESC LIMIT 1',
        [divisionId],
      )
    ).rows[0] ?? null
  );
}
/** Caller owns edition EXCLUSIVE and the entry lock. Price once; never silently reprice. */
export async function freezeEntryCharge(
  c: Reader,
  entryId: string,
  divisionId: string,
  expectedFeeVersion?: unknown,
) {
  let charge = (
    await c.query(
      'SELECT entry_id AS "entryId",division_id AS "divisionId",fee_version AS "feeVersion",fee_minor AS "feeMinor",currency,payment_terms AS "paymentTerms",created_at AS "createdAt" FROM entry_charge WHERE entry_id=$1',
      [entryId],
    )
  ).rows[0];
  if (charge) {
    if (charge.divisionId !== divisionId)
      throw new EntryError(
        "The entry moved from its frozen charge context. Staff review is required.",
        409,
      );
    return charge;
  }
  const prior = (
    await c.query(
      "SELECT admission_version FROM event_entry WHERE id=$1 AND division_id=$2",
      [entryId, divisionId],
    )
  ).rows[0];
  if (prior?.admission_version > 0)
    throw new EntryError(
      "Historical fee terms have not been established for this earlier admission. Staff must review the original terms; a newer fee cannot reprice this entry.",
      409,
    );
  const fee = await currentFee(c, divisionId);
  if (!fee)
    throw new EntryError(
      "Fee terms are unknown or unsupported. Staff must establish a supported fee version before pricing this entry; this is not proof of zero fee or payment.",
      409,
    );
  const originalV1 =
    expectedFeeVersion === undefined &&
    fee.version === 1 &&
    !!(
      await c.query(
        "SELECT division_id FROM division_registration WHERE division_id=$1 AND fee_minor=$2 AND currency=$3 AND payment_terms=$4",
        [divisionId, fee.feeMinor, fee.currency, fee.paymentTerms],
      )
    ).rowCount;
  if (expectedFeeVersion !== fee.version && !originalV1)
    throw new EntryError(
      "The quoted fee version changed. Refresh and review the new charge amount before submitting again.",
      409,
    );
  await c.query(
    "INSERT INTO entry_charge(entry_id,division_id,fee_version,fee_minor,currency,payment_terms) VALUES($1,$2,$3,$4,$5,$6)",
    [
      entryId,
      divisionId,
      fee.version,
      fee.feeMinor,
      fee.currency,
      fee.paymentTerms,
    ],
  );
  charge = {
    entryId,
    divisionId,
    feeVersion: fee.version,
    feeMinor: fee.feeMinor,
    currency: fee.currency,
    paymentTerms: fee.paymentTerms,
  };
  return charge;
}
export async function chargeBalance(
  c: Reader,
  entryId: string,
  charge: { feeMinor: number; currency: string; paymentTerms: string },
) {
  const history = (
    await c.query(
      'SELECT id,version,kind,amount_minor AS "amountMinor",currency,reason,external_reference AS "externalReference",actor_id AS "actorId",created_at AS "createdAt" FROM entry_charge_credit WHERE entry_id=$1 ORDER BY version',
      [entryId],
    )
  ).rows;
  return {
    history,
    version: history.length + 1,
    balance: reconcileCharge(charge, history),
  };
}

const scope = `EXISTS(SELECT 1 FROM role_grant g WHERE g.user_id=$1 AND ((g.role='administrator' AND g.event_id IS NULL AND g.game_id IS NULL) OR (g.role='organizer' AND g.event_id=d.event_id AND g.game_id IS NULL)))`;
const paymentScope = `EXISTS(SELECT 1 FROM team_representation g JOIN season_registration sr ON sr.id=g.registration_id WHERE g.user_id=$1 AND g.revoked_at IS NULL AND 'payment'=ANY(g.actions) AND sr.id=en.season_registration_id AND sr.team_id=en.team_id AND sr.season=d.entry_season)`;
export async function chargeWorkspace(userId: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const now = (await c.query("SELECT clock_timestamp() AS now")).rows[0]
      .now as Date;
    const divisions = (
      await c.query(
        `SELECT d.id,d.name,e.name AS "eventName",${scope} AS staff,EXISTS(SELECT 1 FROM division_registration r WHERE r.division_id=d.id) AS configured FROM division d JOIN event_edition e ON e.id=d.event_id WHERE ${scope} OR EXISTS(SELECT 1 FROM event_entry en WHERE en.division_id=d.id AND ${paymentScope}) ORDER BY e.starts_on DESC,d.name,d.id`,
        [userId],
      )
    ).rows;
    const entries = (
      await c.query(
        `SELECT en.id,en.division_id AS "divisionId",en.display_name AS name,en.admission_state AS state,en.reservation_deadline AS deadline,coalesce(v.status,'provisional') AS "rosterStatus",${scope} AS staff FROM event_entry en JOIN division d ON d.id=en.division_id LEFT JOIN event_lineup_version v ON v.entry_id=en.id AND v.version=en.version WHERE ${scope} OR ${paymentScope} ORDER BY en.display_name,en.id`,
        [userId],
      )
    ).rows;
    const result = [];
    for (const en of entries) {
      const charge =
        (
          await c.query(
            'SELECT fee_version AS "feeVersion",fee_minor AS "feeMinor",currency,payment_terms AS "paymentTerms",created_at AS "createdAt",division_id AS "divisionId" FROM entry_charge WHERE entry_id=$1',
            [en.id],
          )
        ).rows[0] ?? null;
      const accounting = charge
        ? await chargeBalance(c, en.id, charge)
        : { version: 0, balance: null, history: [] };
      const admissionState = effectiveAdmission(en.state, en.deadline, now);
      result.push({
        ...en,
        admissionState,
        charge,
        ...accounting,
        attention: accounting.balance
          ? admissionAttention(admissionState, accounting.balance)
          : null,
      });
    }
    const scopedDivisions = [];
    for (const d of divisions)
      scopedDivisions.push({
        ...d,
        fee: await currentFee(c, d.id),
        feeHistory: (
          await c.query(
            'SELECT version,fee_minor AS "feeMinor",currency,payment_terms AS "paymentTerms",reason,created_at AS "createdAt" FROM division_fee_version WHERE division_id=$1 ORDER BY version',
            [d.id],
          )
        ).rows,
      });
    const receipts = (
      await c.query(
        'SELECT request_id AS "requestId",command,result FROM entry_charge_command WHERE actor_id=$1 AND division_id=ANY($2::text[]) ORDER BY created_at DESC LIMIT 200',
        [userId, divisions.filter((d) => d.staff).map((d) => d.id)],
      )
    ).rows;
    await c.query("COMMIT");
    return {
      actorId: userId,
      now,
      divisions: scopedDivisions,
      entries: result,
      receipts,
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export async function chargeCommand(userId: string, raw: unknown) {
  if (!raw || typeof raw !== "object")
    throw new EntryError("Provide a charge command.");
  const v = raw as Record<string, unknown>,
    action = String(v.action),
    divisionId = identifier(v.divisionId),
    requestId = identifier(v.requestId);
  if (
    ![
      "revise_fee",
      "freeze",
      "discount",
      "waiver",
      "external_receipt",
    ].includes(action)
  )
    throw new EntryError("Choose a fee or charge action.");
  if (!Number.isSafeInteger(v.version) || Number(v.version) < 0)
    throw new EntryError("Provide the current financial version.");
  const entryId = action === "revise_fee" ? null : identifier(v.entryId);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const observed = (
      await c.query("SELECT event_id FROM division WHERE id=$1", [divisionId])
    ).rows[0];
    if (!observed) throw new EntryError("Division not found.", 404);
    await c.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      observed.event_id,
    ]);
    const entry = entryId
      ? (
          await c.query(
            "SELECT * FROM event_entry WHERE id=$1 AND division_id=$2 FOR UPDATE",
            [entryId, divisionId],
          )
        ).rows[0]
      : null;
    const d = (
      await c.query(
        "SELECT id FROM division WHERE id=$1 AND event_id=$2 FOR SHARE",
        [divisionId, observed.event_id],
      )
    ).rows[0];
    if (!d) throw new EntryError("Division moved. Reload before saving.", 409);
    if (entryId && !entry)
      throw new EntryError("Entry not found in this division.", 404);
    if (!(await financialStaff(c, userId, observed.event_id)))
      throw new EntryError(
        "Current organizer authority for this edition or World Curling administrator authority is required to change financial records.",
        403,
      );
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `entry-charge-request:${userId}:${requestId}`,
    ]);
    const old = (
      await c.query(
        "SELECT command,result FROM entry_charge_command WHERE actor_id=$1 AND request_id=$2",
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
      return { ...old.result, replayed: true };
    }
    const now = (await c.query("SELECT clock_timestamp() AS now")).rows[0]
      .now as Date;
    const reason = plainText(v.reason, 1000),
      auditId = randomUUID();
    let result: Record<string, unknown>;
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [auditId, userId, `entry_charge_${action}`, entryId ?? divisionId],
    );
    if (action === "revise_fee") {
      if (
        !(
          await c.query(
            "SELECT division_id FROM division_registration WHERE division_id=$1",
            [divisionId],
          )
        ).rowCount
      )
        throw new EntryError(
          "Open the complete registration terms before revising fees.",
          409,
        );
      const previous = await currentFee(c, divisionId);
      if (v.version !== (previous?.version ?? 0))
        throw new EntryError(
          "The fee version changed. Refresh before preparing a new revision.",
          409,
        );
      const t = feeTerms(v.terms),
        version = (previous?.version ?? 0) + 1;
      // One ledger currency per division; revisions can change amount/wording only.
      if (previous && previous.currency !== t.currency)
        throw new EntryError(
          "The division currency is fixed. Currency conversion and mixed-currency charge histories are not supported.",
        );
      await c.query(
        "INSERT INTO division_fee_version(division_id,version,fee_minor,currency,payment_terms,reason,actor_id,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          divisionId,
          version,
          t.feeMinor,
          t.currency,
          t.paymentTerms,
          reason,
          userId,
          auditId,
        ],
      );
      result = { divisionId, version, terms: t };
    } else {
      const existing = (
        await c.query("SELECT entry_id FROM entry_charge WHERE entry_id=$1", [
          entryId,
        ])
      ).rowCount;
      if (action === "freeze" && (existing || v.version !== 0))
        throw new EntryError(
          "This charge is already frozen or its version changed. Refresh the ledger.",
          409,
        );
      if (action !== "freeze" && !existing)
        throw new EntryError(
          "Freeze the entry's normal charge before recording credits.",
          409,
        );
      // Legacy admissions are never priced from a later fee revision.
      if (!existing && entry.admission_version > 0) {
        const original = (
          await c.query(
            "SELECT f.* FROM division_fee_version f JOIN division_registration r ON r.division_id=f.division_id AND r.fee_minor=f.fee_minor AND r.currency=f.currency AND r.payment_terms=f.payment_terms WHERE f.division_id=$1 AND f.version=1",
            [divisionId],
          )
        ).rows[0];
        if (!original)
          throw new EntryError(
            "Historical fee terms are unknown. Staff review is required; do not assume zero or reprice the prior admission.",
            409,
          );
        await c.query(
          "INSERT INTO entry_charge(entry_id,division_id,fee_version,fee_minor,currency,payment_terms) VALUES($1,$2,1,$3,$4,$5)",
          [
            entryId,
            divisionId,
            original.fee_minor,
            original.currency,
            original.payment_terms,
          ],
        );
      }
      const charge = await freezeEntryCharge(
          c,
          entryId!,
          divisionId,
          v.expectedFeeVersion,
        ),
        current = await chargeBalance(c, entryId!, charge);
      if (action !== "freeze") {
        if (v.version !== current.version)
          throw new EntryError(
            "The charge changed. Refresh its balance before preparing another adjustment.",
            409,
          );
        if (v.currency !== charge.currency)
          throw new EntryError(
            "The credit currency must match the frozen charge; no currency conversion is performed.",
          );
        const amount = creditAmount(
            action,
            v.amountMinor,
            current.balance.dueMinor,
          ),
          reference =
            action === "external_receipt"
              ? plainText(v.externalReference, 200)
              : null;
        await c.query(
          "INSERT INTO entry_charge_credit(id,entry_id,division_id,version,kind,amount_minor,currency,reason,external_reference,actor_id,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            randomUUID(),
            entryId,
            divisionId,
            current.version + 1,
            action,
            amount,
            charge.currency,
            reason,
            reference,
            userId,
            auditId,
          ],
        );
      }
      const next = await chargeBalance(c, entryId!, charge),
        effective = effectiveAdmission(
          entry.admission_state,
          entry.reservation_deadline,
          now,
        );
      let admissionState = effective,
        disposition = "unchanged";
      if (next.balance.dueMinor === 0 && effective === "held") {
        await assertAdmissionTeamAvailable(
          c,
          divisionId,
          entry.team_id,
          entryId!,
          now,
          true,
        );
        await c.query(
          "UPDATE event_entry SET admission_state='accepted',reservation_deadline=NULL,admission_version=admission_version+1 WHERE id=$1",
          [entryId],
        );
        admissionState = "accepted";
        disposition = "accepted_within_reservation";
      } else if (admissionAttention(effective, next.balance))
        disposition = "staff_attention";
      result = {
        entryId,
        divisionId,
        version: next.version,
        balance: next.balance,
        admissionState,
        disposition,
        attention: admissionAttention(admissionState, next.balance),
      };
    }
    await c.query(
      "INSERT INTO entry_charge_command(actor_id,request_id,division_id,entry_id,command,result,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
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
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "23505")
      throw new EntryError(
        "This request or external reference was already recorded. Refresh and review its history.",
        409,
      );
    throw e;
  } finally {
    c.release();
  }
}
