import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import { EntryError, identifier } from "@/domain/entries";
import { calendarDate, rulesInput } from "@/domain/ranking-inputs";
import { freezeContents } from "@/domain/finalization";
import { overallEngine, overallPolicy } from "@/domain/overall-rankings";
import { overallEvidence } from "@/domain/overall-ranking-input";
import {
  calculateOverall,
  type OverallSource,
} from "@/domain/overall-calculation";
import { overallStartingEvidence } from "./inputs";
import { overallEngineIdentity } from "../../../scripts/overall-engine-identity.mjs";
import { overallSources } from "@/domain/overall-sources";
import { currentFinalizationSource } from "../competition/finalization";
const loadedIdentity =
  process.env.NODE_ENV === "production" &&
  process.env.WCP_OVERALL_ENGINE_BUILD_IDENTITY
    ? JSON.parse(process.env.WCP_OVERALL_ENGINE_BUILD_IDENTITY)
    : overallEngineIdentity();
async function staff(c: PoolClient, id: string) {
  if (
    !(
      await c.query(
        "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
        [id],
      )
    ).rowCount
  )
    throw new EntryError(
      "Current World Curling administrator authority is required.",
      403,
    );
}
function discipline(v: unknown) {
  if (v !== "men_four" && v !== "women_four")
    throw new EntryError("Choose men's or women's four-player overall.");
  return v;
}
async function source(c: PoolClient, d: string, date: string, rulesId: string) {
  const rule = (
    await c.query(
      "SELECT r.id,r.version,v.state,v.data FROM ranking_record r JOIN ranking_revision v ON v.record_id=r.id AND v.version=r.version WHERE r.id=$1 AND r.kind='rules' FOR SHARE OF r,v",
      [rulesId],
    )
  ).rows[0];
  if (!rule) throw new EntryError("Rule-source edition not found.", 404);
  rule.data = rulesInput(rule.data);
  const registrations = (
    await c.query(
      'SELECT r.id AS "registrationId",r.team_id AS "teamId",v.display_name AS name,r.version AS "rosterVersion" FROM season_registration r JOIN team t ON t.id=r.team_id JOIN season_roster_version v ON v.registration_id=r.id AND v.version=r.version WHERE r.season=\'2026-27\' AND t.discipline=$1 ORDER BY r.id FOR SHARE OF r,t',
      [d],
    )
  ).rows;
  const subjects = [];
  for (const s of registrations)
    subjects.push({
      ...s,
      starting: await overallStartingEvidence(c, s.registrationId),
    });
  const events = (
    await c.query(
      "SELECT d.id AS \"divisionId\",e.name,e.ends_on::text AS date FROM division d JOIN event_edition e ON e.id=d.event_id WHERE d.discipline=$1 AND e.ends_on>='2026-08-01' AND e.ends_on<$2::date AND e.ends_on<= $3::date AND e.admission_status='approved' ORDER BY e.id,d.id",
      [d, "2027-08-01", date],
    )
  ).rows;
  for (const e of events) {
    // Original immutable033 bytes, not a join to mutable points or submitted totals.
    const a =
      (
        await c.query(
          'SELECT a.id,j.state,a.contents,a.digest,r.contents AS "resultContents",r.digest AS "resultDigest",r.input_digest AS "inputDigest" FROM event_assessment a JOIN event_calculation_job j ON j.assessment_id=a.id LEFT JOIN event_assessment_result r ON r.assessment_id=a.id WHERE a.division_id=$1 ORDER BY a.version DESC LIMIT 1',
          [e.divisionId],
        )
      ).rows[0] ?? null;
    if (a) {
      if (
        freezeContents(JSON.parse(a.contents)).digest !== a.digest ||
        (a.resultContents &&
          freezeContents(JSON.parse(a.resultContents)).digest !==
            a.resultDigest)
      )
        throw new EntryError(
          "Frozen event evidence digest does not match its bytes.",
          422,
        );
    }
    e.assessment = a;
    const finalization = (
      await c.query(
        "SELECT version,source_digest FROM division_finalization WHERE division_id=$1 ORDER BY version DESC LIMIT 1",
        [e.divisionId],
      )
    ).rows[0];
    const sporting = await currentFinalizationSource(c, e.divisionId);
    e.finalizationVersion = finalization?.version ?? null;
    e.currentSportingDigest = freezeContents(sporting).digest;
    e.finalizationSourceDigest = finalization?.source_digest ?? null;
    e.currentSportingDirty =
      !!finalization && e.currentSportingDigest !== finalization.source_digest;
  }
  const review: OverallSource = {
    discipline: d,
    effectiveDate: date,
    rules: rule,
    subjects,
    events,
  };
  return { ...review, sourceDigest: freezeContents(review).digest };
}
async function detail(c: PoolClient, id: string) {
  const r = (
    await c.query(
      'SELECT id,discipline,effective_date::text AS "effectiveDate",version,replaces_id AS "replacesId",manifest_contents AS "manifestContents",manifest_digest AS "manifestDigest",result_contents AS "resultContents",result_digest AS "resultDigest",actor_id AS "actorId",created_at AS "createdAt" FROM overall_ranking_run WHERE id=$1',
      [id],
    )
  ).rows[0];
  if (!r) throw new EntryError("Overall draft not found.", 404);
  return {
    ...r,
    manifest: JSON.parse(r.manifestContents),
    result: JSON.parse(r.resultContents),
  };
}
/** Publication consumes the exact frozen run, then independently checks the
 * present source and producer history. Frozen replay alone is not readiness. */
export async function overallPublicationCandidate(c: PoolClient, id: string) {
  const run = await detail(c, id),
    m = run.manifest;
  if (
    freezeContents(m).digest !== run.manifestDigest ||
    freezeContents(run.result).digest !== run.resultDigest
  )
    throw new EntryError(
      "Frozen draft evidence digest does not match its bytes.",
      422,
    );
  const current = await source(
    c,
    run.discipline,
    run.effectiveDate,
    m.source.rules.id,
  );
  const latest = (
    await c.query(
      "SELECT id FROM overall_ranking_run WHERE discipline=$1 AND effective_date=$2 ORDER BY version DESC LIMIT 1",
      [run.discipline, run.effectiveDate],
    )
  ).rows[0];
  const blockers: string[] = [];
  if (current.sourceDigest !== m.source.sourceDigest)
    blockers.push(
      "Current calculation inputs or eligibility changed. Calculate and review a fresh draft.",
    );
  if (latest?.id !== run.id)
    blockers.push(
      "A newer draft exists for this effective date. Review the latest exact run.",
    );
  if (
    m.engineIdentity.fingerprint !== loadedIdentity.fingerprint ||
    m.engineIdentity.node !== loadedIdentity.node
  )
    blockers.push(
      "Review a draft from the current supported engine/source build.",
    );
  return { run, blockers };
}
export async function overallWorkspace(
  userId: string,
  params: { id?: string; discipline?: string; date?: string; rules?: string },
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await staff(c, userId);
    if (params.id) {
      const r = await detail(c, identifier(params.id));
      await c.query("COMMIT");
      return r;
    }
    const rules = (
      await c.query(
        "SELECT r.id,r.version,v.state,v.data FROM ranking_record r JOIN ranking_revision v ON v.record_id=r.id AND v.version=r.version WHERE r.kind='rules' ORDER BY v.created_at DESC,r.id",
      )
    ).rows;
    if (!params.discipline || !params.date || !params.rules) {
      await c.query("COMMIT");
      return { actorId: userId, rules };
    }
    const d = discipline(params.discipline),
      date = calendarDate(params.date),
      review = await source(c, d, date, identifier(params.rules));
    const history = (
      await c.query(
        "SELECT id,version,result_contents::jsonb->>'state' AS state,created_at AS \"createdAt\" FROM overall_ranking_run WHERE discipline=$1 AND effective_date=$2 ORDER BY version DESC",
        [d, date],
      )
    ).rows;
    const receipts = (
      await c.query(
        'SELECT r.actor_id AS "actorId",r.request_id AS "requestId",r.run_id AS "runId",r.command_digest AS "commandDigest",r.action,\'/api/v1/overall-rankings\' AS path,x.discipline,x.effective_date::text AS "effectiveDate" FROM overall_ranking_receipt r JOIN overall_ranking_run x ON x.id=r.run_id WHERE x.discipline=$1 AND x.effective_date=$2',
        [d, date],
      )
    ).rows;
    const selected = history.length ? await detail(c, history[0].id) : null;
    await c.query("COMMIT");
    return {
      actorId: userId,
      rules,
      review,
      version: history[0]?.version ?? 0,
      history,
      receipts,
      selected,
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function saveOverall(userId: string, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new EntryError("Provide an overall command.");
  const cmd = raw as Record<string, unknown>,
    d = discipline(cmd.discipline),
    date = calendarDate(cmd.effectiveDate),
    requestId = identifier(cmd.requestId),
    action = cmd.action;
  if (action !== "calculate" && action !== "replay")
    throw new EntryError("Choose calculate or frozen replay.");
  const commandDigest = freezeContents(cmd).digest,
    c = await pool.connect();
  const lockKeys = [
    `overall-request:${userId}:${requestId}`,
    `overall:${d}:${date}`,
  ];
  const held: string[] = [];
  let destroy = false;
  try {
    // Session lock precedes BEGIN so the consistent snapshot is acquired after
    // the wait. An append-only033/finalization must not hide in an old snapshot.
    for (const key of lockKeys) {
      await c.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [key]);
      held.push(key);
    }
    await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await staff(c, userId);
    let replayed: Awaited<ReturnType<typeof detail>> | null = null;
    if (action === "replay") {
      replayed = await detail(c, identifier(cmd.runId));
      if (replayed.discipline !== d || replayed.effectiveDate !== date)
        throw new EntryError("Draft context does not match this command.", 409);
    }
    const receipt = (
      await c.query(
        "SELECT run_id,command_digest FROM overall_ranking_receipt WHERE actor_id=$1 AND request_id=$2",
        [userId, requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.command_digest !== commandDigest)
        throw new EntryError(
          "Request identifier was already used with different content.",
          409,
        );
      const r = await detail(c, receipt.run_id);
      if (r.discipline !== d || r.effectiveDate !== date)
        throw new EntryError("Receipt context changed.", 409);
      await c.query("COMMIT");
      return r;
    }
    let result: Awaited<ReturnType<typeof detail>>;
    const auditId = randomUUID();
    if (action === "replay") {
      const old = replayed!,
        m = old.manifest;
      if (
        freezeContents(m).digest !== old.manifestDigest ||
        freezeContents(old.result).digest !== old.resultDigest ||
        m.engineIdentity.fingerprint !== loadedIdentity.fingerprint ||
        m.engineIdentity.node !== loadedIdentity.node
      )
        throw new EntryError(
          "Frozen replay requires the matching retained engine/source build.",
          422,
        );
      const calculated = calculateOverall(m.source, m.evidence);
      if (freezeContents(calculated).digest !== old.resultDigest)
        throw new EntryError(
          "Replay differs from the immutable original result.",
          422,
        );
      await c.query(
        "INSERT INTO audit_record(id,actor_id,action,resource_id,after_state) VALUES($1,$2,'overall_ranking_replayed',$3,$4)",
        [
          auditId,
          userId,
          old.id,
          {
            manifestDigest: old.manifestDigest,
            resultDigest: old.resultDigest,
            engineIdentity: loadedIdentity.fingerprint,
          },
        ],
      );
      result = old;
    } else {
      if (!Number.isSafeInteger(cmd.version) || Number(cmd.version) < 0)
        throw new EntryError("Provide the exact draft version.");
      const current = await source(c, d, date, identifier(cmd.rulesId)),
        latest = (
          await c.query(
            "SELECT id,version FROM overall_ranking_run WHERE discipline=$1 AND effective_date=$2 ORDER BY version DESC LIMIT 1",
            [d, date],
          )
        ).rows[0];
      if (
        current.sourceDigest !== cmd.sourceDigest ||
        Number(cmd.version) !== (latest?.version ?? 0)
      )
        throw new EntryError(
          "Overall source or draft history changed. Reload and review before calculating.",
          409,
        );
      const evidence = overallEvidence(cmd.evidence),
        calculated = calculateOverall(current, evidence),
        id = randomUUID(),
        manifest = freezeContents({
          schema: "wcp.overall-ranking-manifest.v1",
          engine: overallEngine,
          engineIdentity: loadedIdentity,
          policy: overallPolicy,
          sources: overallSources,
          source: current,
          evidence,
          actorId: userId,
          requestId,
          auditId,
        }),
        output = freezeContents(calculated);
      await c.query(
        "INSERT INTO audit_record(id,actor_id,action,resource_id,after_state) VALUES($1,$2,'overall_ranking_calculated',$3,$4)",
        [
          auditId,
          userId,
          id,
          {
            manifestDigest: manifest.digest,
            resultDigest: output.digest,
            state: calculated.state,
          },
        ],
      );
      await c.query(
        "INSERT INTO overall_ranking_run(id,discipline,effective_date,version,replaces_id,manifest_contents,manifest_digest,result_contents,result_digest,actor_id,audit_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          id,
          d,
          date,
          Number(cmd.version) + 1,
          latest?.id ?? null,
          manifest.contents,
          manifest.digest,
          output.contents,
          output.digest,
          userId,
          auditId,
        ],
      );
      result = await detail(c, id);
    }
    await c.query(
      "INSERT INTO overall_ranking_receipt(actor_id,request_id,command_digest,run_id,action,audit_id) VALUES($1,$2,$3,$4,$5,$6)",
      [userId, requestId, commandDigest, result.id, action, auditId],
    );
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    if ((e as { code?: string }).code === "40001")
      throw new EntryError(
        "Concurrent overall inputs changed. Retry the same command, then reload if stale.",
        409,
      );
    throw e;
  } finally {
    for (const key of held.reverse()) {
      try {
        const unlocked = await c.query(
          "SELECT pg_advisory_unlock(hashtextextended($1,0)) AS unlocked",
          [key],
        );
        if (unlocked.rows[0]?.unlocked !== true) destroy = true;
      } catch {
        destroy = true;
      }
    }
    // Never return a session carrying a lock to the shared pool.
    c.release(destroy);
  }
}
