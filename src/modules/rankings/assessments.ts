import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { pool } from "@/db";
import { EntryError, identifier } from "@/domain/entries";
import { freezeContents } from "@/domain/finalization";
import { rulesInput } from "@/domain/ranking-inputs";
import {
  assessmentEvidence,
  assessmentPolicy,
  type AssessmentEvidence,
} from "@/domain/event-assessment-input";
import {
  assessmentEngine,
  assessFourPlayer,
  type CalculationField,
} from "@/domain/event-assessments";
import {
  prepareEventCalculation,
  type SportingSnapshot,
} from "@/domain/event-assessment-snapshot";
import { calculationRosterEvidence } from "./inputs";
import { currentFinalizationSource } from "../competition/finalization";
import { assessmentProducer, assessmentQueue } from "./assessment-queue";
async function staff(c: PoolClient, userId: string) {
  const r = await c.query(
    "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
    [userId],
  );
  if (!r.rowCount)
    throw new EntryError(
      "Current World Curling administrator authority is required.",
      403,
    );
}
async function association(c: PoolClient, id: string, lock = false) {
  const old = (await c.query("SELECT event_id FROM division WHERE id=$1", [id]))
    .rows[0];
  if (!old) throw new EntryError("Division not found.", 404);
  if (lock) {
    await c.query("SELECT id FROM event_edition WHERE id=$1 FOR SHARE", [
      old.event_id,
    ]);
    await c.query(
      "SELECT id FROM event_entry WHERE division_id=$1 ORDER BY id FOR SHARE",
      [id],
    );
    const d = (
      await c.query("SELECT event_id FROM division WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
    if (!d || d.event_id !== old.event_id)
      throw new EntryError(
        "Division association changed; reload the review.",
        409,
      );
    await c.query(
      "SELECT id FROM draw_session WHERE division_id=$1 ORDER BY id FOR SHARE",
      [id],
    );
    await c.query(
      "SELECT g.id FROM game g JOIN draw_session ds ON ds.id=g.draw_id WHERE ds.division_id=$1 ORDER BY g.id FOR SHARE OF g",
      [id],
    );
  }
  return old.event_id as string;
}
async function review(c: PoolClient, id: string, rulesId: string) {
  const current = await currentFinalizationSource(c, id);
  const latest =
    (
      await c.query(
        "SELECT version,contents,digest,source_digest FROM division_finalization WHERE division_id=$1 ORDER BY version DESC LIMIT 1",
        [id],
      )
    ).rows[0] ?? null;
  const rule = (
    await c.query(
      "SELECT r.id,r.version,v.state,v.data FROM ranking_record r JOIN ranking_revision v ON v.record_id=r.id AND v.version=r.version WHERE r.id=$1 AND r.kind='rules' FOR SHARE OF r,v",
      [rulesId],
    )
  ).rows[0];
  if (!rule)
    throw new EntryError("Choose an existing rule-source edition.", 404);
  const eligibility = (
    await c.query(
      "SELECT d.ranking_status,e.timezone FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.id=$1",
      [id],
    )
  ).rows[0];
  const starting = [];
  for (const entry of current.entries) {
    const evidence = entry.lineup?.registrationId
      ? await calculationRosterEvidence(c, entry.lineup.registrationId)
      : null;
    starting.push({ entryId: entry.id, evidence });
  }
  const state = {
    current,
    finalization: latest,
    rules: rule,
    starting,
    eligibility,
  };
  return { ...state, sourceDigest: freezeContents(state).digest };
}
async function detail(c: PoolClient, id: string) {
  const row = (
    await c.query(
      'SELECT a.id,a.division_id AS "divisionId",a.version,a.replaces_id AS "replacesId",a.contents,a.digest,a.engine,a.actor_id AS "actorId",a.request_id AS "requestId",a.created_at AS "createdAt",j.state,j.attempts,j.error,j.queue_id AS "queueId",j.updated_at AS "updatedAt",r.contents AS "resultContents",r.digest AS "resultDigest",r.input_digest AS "inputDigest" FROM event_assessment a JOIN event_calculation_job j ON j.assessment_id=a.id LEFT JOIN event_assessment_result r ON r.assessment_id=a.id WHERE a.id=$1',
      [id],
    )
  ).rows[0];
  if (!row) throw new EntryError("Assessment not found.", 404);
  return row;
}
export async function assessmentWorkspace(
  userId: string,
  divisionId?: string,
  rulesId?: string,
  selectedId?: string,
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await staff(c, userId);
    const divisions = (
      await c.query(
        "SELECT d.id,d.name,e.name AS \"eventName\" FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.discipline IN ('men_four','women_four') ORDER BY e.starts_on DESC,d.id",
      )
    ).rows;
    const rules = (
      await c.query(
        "SELECT r.id,r.version,v.state,v.data->>'title' AS title FROM ranking_record r JOIN ranking_revision v ON v.record_id=r.id AND v.version=r.version WHERE r.kind='rules' ORDER BY v.created_at DESC",
      )
    ).rows;
    if (!divisionId) {
      await c.query("COMMIT");
      return { actorId: userId, divisions, rules, policy: assessmentPolicy };
    }
    await association(c, identifier(divisionId));
    const state = await review(
      c,
      divisionId,
      identifier(rulesId ?? rules[0]?.id),
    );
    const history = (
      await c.query(
        'SELECT a.id,a.version,a.replaces_id AS "replacesId",a.actor_id AS "actorId",a.request_id AS "requestId",a.created_at AS "createdAt",j.state FROM event_assessment a JOIN event_calculation_job j ON j.assessment_id=a.id WHERE a.division_id=$1 ORDER BY a.version DESC',
        [divisionId],
      )
    ).rows;
    if (selectedId && !history.some((h) => h.id === selectedId))
      throw new EntryError(
        "Selected assessment belongs to another division.",
        404,
      );
    const selected = selectedId ?? history[0]?.id;
    const result = {
      actorId: userId,
      divisions,
      rules,
      policy: assessmentPolicy,
      review: state,
      history,
      selected: selected ? await detail(c, selected) : null,
    };
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
function fieldFor(
  e: AssessmentEvidence,
  r: Awaited<ReturnType<typeof review>>,
): CalculationField {
  const issues: string[] = [];
  if (!r.finalization)
    issues.push("Finalize sporting results before assessment.");
  if (r.eligibility.ranking_status !== "eligible")
    issues.push(
      "Current division ranking eligibility is unresolved or ineligible.",
    );
  if (
    r.finalization &&
    r.finalization.source_digest !== freezeContents(r.current).digest
  )
    issues.push(
      "Sporting results changed after finalization; record an explicit revised snapshot.",
    );
  if (r.rules.state !== "reviewed" || r.rules.version !== e.rulesVersion)
    issues.push("The selected rule revision must be current and reviewed.");
  const rules = rulesInput(r.rules.data);
  if (
    rules.season !== "2026-27" ||
    rules.effectiveFrom > r.current.division.startsOn ||
    rules.effectiveTo <= r.current.division.endsOn
  )
    issues.push("Reviewed rules must cover this event's 2026-27 interval.");
  for (const url of [
    "https://worldcurling.org/teamrankings/ranking-calculations-four-player/",
    "https://worldcurling.org/wp-content/uploads/2026/07/WCTRS-Team-and-Player-Eligibility-Rules-2026-2027.pdf",
  ])
    if (!rules.sources.some((s) => s.url === url))
      issues.push(
        "Reviewed rule edition lacks required four-player calculation/eligibility provenance.",
      );
  const snapshot: SportingSnapshot = r.finalization
    ? JSON.parse(r.finalization.contents)
    : { source: r.current, placements: [] };
  return prepareEventCalculation(
    e,
    snapshot,
    r.starting
      .filter((s) => s.evidence)
      .map((s) => ({ entryId: s.entryId, ...s.evidence! })),
    issues,
    r.eligibility.timezone,
  );
}
export async function queueEventAssessment(userId: string, raw: unknown) {
  const cmd = raw as Record<string, unknown>;
  if (!cmd || !Number.isSafeInteger(cmd.version) || Number(cmd.version) < 0)
    throw new EntryError("Provide the reviewed assessment version.");
  const divisionId = identifier(cmd.divisionId),
    requestId = identifier(cmd.requestId),
    action = cmd.action ?? "calculate",
    commandDigest = freezeContents(cmd).digest;
  if (!["calculate", "retry"].includes(String(action)))
    throw new EntryError("Choose calculate or retry.");
  const producer = await assessmentProducer(),
    c = await pool.connect();
  try {
    await c.query("BEGIN");
    await staff(c, userId);
    await association(c, divisionId, true);
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `assessment-request:${userId}:${requestId}`,
    ]);
    const receipt = (
      await c.query(
        "SELECT assessment_id,command_digest FROM event_calculation_receipt WHERE actor_id=$1 AND request_id=$2",
        [userId, requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.command_digest !== commandDigest)
        throw new EntryError(
          "Request identifier conflicts with the retained command.",
          409,
        );
      const saved = await detail(c, receipt.assessment_id);
      if (saved.divisionId !== divisionId)
        throw new EntryError("Receipt association changed.", 409);
      await c.query("COMMIT");
      return saved;
    }
    let id: string,
      version: number,
      auditId = randomUUID();
    if (action === "retry") {
      id = identifier(cmd.assessmentId);
      const old = await detail(c, id);
      if (old.divisionId !== divisionId || old.version !== cmd.version)
        throw new EntryError("Retry target changed.", 409);
      if (old.state !== "failed")
        throw new EntryError(
          "Only a failed delivery can be retried; blocked inputs need a new assessment revision.",
          409,
        );
      version = old.version;
    } else {
      const evidence = assessmentEvidence(cmd.evidence),
        r = await review(c, divisionId, evidence.rulesId);
      if (r.sourceDigest !== cmd.sourceDigest)
        throw new EntryError(
          "Source evidence changed. Reload before calculating.",
          409,
        );
      const latest = (
        await c.query(
          "SELECT id,version FROM event_assessment WHERE division_id=$1 ORDER BY version DESC LIMIT 1",
          [divisionId],
        )
      ).rows[0];
      if ((latest?.version ?? 0) !== cmd.version)
        throw new EntryError(
          "Assessment history changed. Reload before creating a revision.",
          409,
        );
      if (!r.finalization)
        throw new EntryError(
          "Finalize sporting results before queuing an assessment.",
          422,
        );
      id = randomUUID();
      version = Number(cmd.version) + 1;
      const manifest = freezeContents({
        schema: "wcp.event-assessment-input.v1",
        engine: assessmentEngine,
        policy: assessmentPolicy,
        evidence,
        source: r,
        calculation: fieldFor(evidence, r),
      });
      await c.query(
        "INSERT INTO audit_record(id,actor_id,action,resource_id,after_state) VALUES($1,$2,'event_assessment_queued',$3,$4)",
        [
          auditId,
          userId,
          id,
          { version, digest: manifest.digest, engine: assessmentEngine },
        ],
      );
      await c.query(
        "INSERT INTO event_assessment(id,division_id,version,replaces_id,finalization_version,rules_id,rules_version,contents,digest,engine,actor_id,request_id,command_digest,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
        [
          id,
          divisionId,
          version,
          latest?.id ?? null,
          r.finalization.version,
          evidence.rulesId,
          evidence.rulesVersion,
          manifest.contents,
          manifest.digest,
          assessmentEngine,
          userId,
          requestId,
          commandDigest,
          auditId,
        ],
      );
    }
    const queueId = await producer.send(
      assessmentQueue,
      { assessmentId: id },
      {
        retryLimit: 2,
        retryDelay: 2,
        retryBackoff: true,
        expireInSeconds: 60,
        db: { executeSql: (sql, values) => c.query(sql, values) },
      },
    );
    if (!queueId) throw new Error("Assessment queue did not accept work");
    if (action === "retry")
      await c.query(
        "INSERT INTO audit_record(id,actor_id,action,resource_id,after_state) VALUES($1,$2,'event_assessment_retry',$3,$4)",
        [auditId, userId, id, { queueId }],
      );
    await c.query(
      "INSERT INTO event_calculation_job(assessment_id,queue_id,state) VALUES($1,$2,'queued') ON CONFLICT(assessment_id) DO UPDATE SET queue_id=excluded.queue_id,state='queued',error=NULL,updated_at=now()",
      [id, queueId],
    );
    await c.query(
      "INSERT INTO event_calculation_receipt(actor_id,request_id,assessment_id,command_digest,queue_id,audit_id) VALUES($1,$2,$3,$4,$5,$6)",
      [userId, requestId, id, commandDigest, queueId, auditId],
    );
    const result = await detail(c, id);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
/** Real queue delivery; input/result association is frozen and duplicate delivery is harmless. */
export async function processEventAssessment(database: Pool, id: string) {
  const c = await database.connect();
  try {
    await c.query("BEGIN");
    const row = (
      await c.query(
        "SELECT a.*,j.state FROM event_assessment a JOIN event_calculation_job j ON j.assessment_id=a.id WHERE a.id=$1 FOR UPDATE OF j",
        [identifier(id)],
      )
    ).rows[0];
    if (!row) throw new Error("Assessment input not found");
    if (["completed", "blocked"].includes(row.state)) {
      await c.query("COMMIT");
      return;
    }
    await c.query(
      "UPDATE event_calculation_job SET state='running',attempts=attempts+1,error=NULL,updated_at=now() WHERE assessment_id=$1",
      [id],
    );
    const input = JSON.parse(row.contents);
    if (
      freezeContents(input).digest !== row.digest ||
      input.engine !== assessmentEngine ||
      row.engine !== assessmentEngine
    )
      throw new Error("Frozen input digest or engine mismatch");
    const result = assessFourPlayer(input.calculation);
    const frozen = freezeContents({
      schema: "wcp.event-assessment-result.v1",
      assessmentId: id,
      inputDigest: row.digest,
      engine: assessmentEngine,
      policyId: input.policy.id,
      result,
    });
    const auditId = randomUUID();
    await c.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id,after_state) VALUES($1,$2,'event_assessment_calculated',$3,$4)",
      [
        auditId,
        row.actor_id,
        id,
        {
          executor: "ranking-four-event-worker",
          state: result.state,
          inputDigest: row.digest,
          resultDigest: frozen.digest,
        },
      ],
    );
    await c.query(
      "INSERT INTO event_assessment_result(assessment_id,input_digest,contents,digest,audit_id) VALUES($1,$2,$3,$4,$5)",
      [id, row.digest, frozen.contents, frozen.digest, auditId],
    );
    await c.query(
      "UPDATE event_calculation_job SET state=$2,updated_at=now() WHERE assessment_id=$1",
      [id, result.state],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    await c.query(
      "UPDATE event_calculation_job SET state='failed',attempts=attempts+1,error=$2,updated_at=now() WHERE assessment_id=$1 AND state NOT IN ('completed','blocked')",
      [id, e instanceof Error ? e.message.slice(0, 500) : "Delivery failed"],
    );
    throw e;
  } finally {
    c.release();
  }
}
