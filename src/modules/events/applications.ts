import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  routeApplication,
  responsibleReviewer,
  activeDelegations,
  isAdministrator,
} from "@/modules/identity/authority";
import {
  matchesApprovalScope,
  approvalActionPolicy,
  approvalOverride,
} from "@/domain/authority";
import {
  applicationTransition,
  validateApplication,
  type ApplicationInput,
} from "@/domain/applications";
type Queryable = Pick<PoolClient, "query">;
export class ApplicationError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new ApplicationError(status, message);
}
async function authority(client: Queryable, userId: string, eventId?: string) {
  const grants = await client.query(
    "SELECT role,event_id,game_id FROM role_grant WHERE user_id=$1 FOR SHARE",
    [userId],
  );
  return {
    admin: grants.rows.some(
      (g) =>
        g.role === "administrator" && g.event_id === null && g.game_id === null,
    ),
    organizer: grants.rows.some(
      (g) =>
        g.role === "organizer" && g.event_id === eventId && g.game_id === null,
    ),
  };
}
async function snapshot(client: Queryable, id: string) {
  const result = await client.query(
    `SELECT e.id,e.series_id AS "seriesId",e.organization_id AS "organizationId",e.name,e.starts_on::text AS "startsOn",e.ends_on::text AS "endsOn",e.city,e.country,e.venue,e.timezone,e.origin,e.category,e.approval_delegation_id AS "delegationId",e.approval_authority_name AS "authorityName",e.admission_status AS status,e.registration_status AS "registrationStatus",e.version,e.responsible_administrator_id AS "reviewerId",u.name AS "reviewerName",o.name AS "organizationName",s.name AS "seriesName" FROM event_edition e JOIN event_series s ON s.id=e.series_id LEFT JOIN organizing_organization o ON o.id=e.organization_id LEFT JOIN auth_user u ON u.id=e.responsible_administrator_id WHERE e.id=$1`,
    [id],
  );
  if (!result.rowCount) return null;
  const divisions = await client.query(
    'SELECT id,name,discipline,ranking_status AS "rankingStatus" FROM division WHERE event_id=$1 ORDER BY id',
    [id],
  );
  return { ...result.rows[0], divisions: divisions.rows };
}
export async function applicationDetail(userId: string, id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const rights = await authority(client, userId, id);
    const app = await snapshot(client, id);
    const reviewer = app
      ? await responsibleReviewer(client, userId, app)
      : false;
    if (!rights.admin && !rights.organizer && !reviewer)
      fail(403, "This application is outside your assigned scope.");
    if (!app) fail(404, "Application not found.");
    const history = await client.query(
      `SELECT h.version,h.action,h.reason,h.snapshot,h.created_at AS "createdAt",u.name AS "actorName",a.action AS "auditAction" FROM event_application_history h JOIN auth_user u ON u.id=h.actor_id JOIN audit_record a ON a.id=h.id WHERE h.event_id=$1 ORDER BY h.version`,
      [id],
    );
    await client.query("COMMIT");
    return {
      ...app,
      canReview: reviewer,
      canEdit: rights.admin || rights.organizer,
      canReassign: rights.admin,
      responsibilityActive: await responsibleReviewer(
        client,
        app.reviewerId,
        app,
      ),
      history: history.rows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function applicationWorkspace(userId: string) {
  const rights = await authority(pool, userId);
  const organizations = await pool.query(
    `SELECT o.id,o.name,u.name AS "reviewerName" FROM organizing_organization o JOIN auth_user u ON u.id=o.approval_administrator_id WHERE $2 OR EXISTS(SELECT 1 FROM organization_organizer m WHERE m.organization_id=o.id AND m.user_id=$1) ORDER BY o.name`,
    [userId, rights.admin],
  );
  const series = await pool.query(
    'SELECT id,name,organization_id AS "organizationId" FROM event_series WHERE organization_id=ANY($1::text[]) ORDER BY name',
    [organizations.rows.map((o) => o.id)],
  );
  const apps = await pool.query(
    `SELECT e.id,e.name,e.starts_on::text AS "startsOn",e.admission_status AS status,e.version,e.approval_authority_name AS "authorityName",u.name AS "reviewerName",EXISTS(SELECT 1 FROM role_grant r WHERE r.user_id=$1 AND r.role='organizer' AND r.event_id=e.id AND r.game_id IS NULL) AS "isOrganizer" FROM event_edition e LEFT JOIN auth_user u ON u.id=e.responsible_administrator_id WHERE e.organization_id IS NOT NULL AND ($2 OR e.responsible_administrator_id=$1 OR EXISTS(SELECT 1 FROM role_grant r WHERE r.user_id=$1 AND r.role='organizer' AND r.event_id=e.id AND r.game_id IS NULL)) ORDER BY e.starts_on DESC,e.id`,
    [userId, rights.admin],
  );
  const visible = [];
  for (const row of apps.rows) {
    if (
      rights.admin ||
      row.isOrganizer ||
      (await responsibleReviewer(pool, userId, (await snapshot(pool, row.id))!))
    )
      visible.push(row);
  }
  return {
    organizations: organizations.rows,
    series: series.rows,
    applications: visible,
    isAdministrator: rights.admin,
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export async function applicationCommand(
  userId: string,
  id: string,
  raw: unknown,
  creating = false,
) {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  if (
    typeof id !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(id) ||
    typeof c.requestId !== "string" ||
    !/^[a-zA-Z0-9-]{1,80}$/.test(c.requestId) ||
    ![
      "create",
      "edit",
      "submit",
      "approve",
      "reject",
      "reassign",
      "override_approve",
      "override_reject",
    ].includes(String(c.action)) ||
    creating !== (c.action === "create")
  )
    fail(400, "Provide a valid command and unique request identifier.");
  if (!creating && (!Number.isSafeInteger(c.version) || Number(c.version) < 1))
    fail(400, "Provide the version you reviewed.");
  const digest = createHash("sha256")
    .update(canonical({ id, command: c }))
    .digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `application-request:${userId}:${c.requestId}`,
    ]);
    // One command per resource at a time, including initial creation and retries.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `application:${id}`,
    ]);
    await client.query("SELECT id FROM event_edition WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    const rights = await authority(client, userId, id);
    if (creating) {
      const candidate = c.application as ApplicationInput | undefined;
      const membership = await client.query(
        "SELECT organization_id FROM organization_organizer WHERE organization_id=$1 AND user_id=$2 FOR SHARE",
        [candidate?.organizationId, userId],
      );
      if (!rights.admin && !membership.rowCount)
        fail(403, "Organizer membership in this organization is required.");
    } else {
      const candidate = await snapshot(client, id);
      const reviewing = ["approve", "reject"].includes(String(c.action));
      if (
        !rights.admin &&
        !rights.organizer &&
        !(
          reviewing &&
          candidate &&
          (await responsibleReviewer(client, userId, candidate))
        )
      )
        fail(403, "This application is outside your assigned scope.");
    }
    const duplicate = await client.query(
      "SELECT command_digest,event_id FROM event_application_history WHERE actor_id=$1 AND request_id=$2",
      [userId, c.requestId],
    );
    if (duplicate.rowCount) {
      if (
        duplicate.rows[0].command_digest !== digest ||
        duplicate.rows[0].event_id !== id
      )
        fail(
          409,
          "This request identifier was already used for another command.",
        );
      await client.query("COMMIT");
      return applicationDetail(userId, id);
    }
    let existing = await snapshot(client, id);
    if (creating && existing) fail(409, "This edition already exists.");
    if (!creating && !existing) fail(404, "Application not found.");
    if (existing && existing.version !== c.version)
      fail(
        409,
        "This application changed. Reload and review the current version before saving.",
      );
    const action = String(c.action);
    const transitionAction = action.startsWith("override_")
      ? action.slice(9)
      : action;
    const reason = typeof c.reason === "string" ? c.reason.trim() : "";
    const policy = approvalActionPolicy(
      {
        isAdministrator: rights.admin,
        isOrganizer: rights.organizer || creating,
        isResponsibleReviewer:
          !!existing && (await responsibleReviewer(client, userId, existing)),
      },
      action,
      reason,
    );
    if (policy) fail(policy.status, policy.error);
    if (reason.length > 1000 || /[\u0000-\u001f]/.test(reason))
      fail(400, "Use at most 1000 characters for the review reason.");
    if (action === "reject" && !reason)
      throw new ApplicationError(
        400,
        "Give the organizer a reason for rejection.",
        { reason: "Enter a rejection reason." },
      );
    if (action === "reassign") {
      let reviewerId: string,
        delegationId: string | null = null,
        authorityName = "World Curling";
      if (c.delegationId === null) {
        if (
          typeof c.reviewerId !== "string" ||
          !(await isAdministrator(client, c.reviewerId))
        )
          fail(400, "Select an active World Curling administrator.");
        reviewerId = c.reviewerId as string;
      } else {
        const grant = (await activeDelegations(client)).find(
          (g) => g.id === c.delegationId,
        );
        if (!grant || !matchesApprovalScope(grant.scope, existing!))
          fail(
            400,
            "Select an active delegation matching all application dimensions or a named exception.",
          );
        reviewerId = grant!.reviewerId;
        delegationId = grant!.id;
        authorityName = grant!.authorityName;
      }
      await client.query(
        "UPDATE event_edition SET responsible_administrator_id=$2,approval_delegation_id=$3,approval_authority_name=$4,version=version+1 WHERE id=$1",
        [id, reviewerId, delegationId, authorityName],
      );
    } else if (creating || action === "edit") {
      const errors = validateApplication(c.application);
      if (Object.keys(errors).length)
        throw new ApplicationError(
          400,
          "Check the application fields.",
          errors,
        );
      const input = c.application as ApplicationInput;
      if (
        existing &&
        (input.organizationId !== existing.organizationId ||
          input.seriesId !== existing.seriesId)
      )
        fail(
          400,
          "An edition cannot be moved to another organization or series. Create a new edition.",
        );
      const series = await client.query(
        "SELECT id FROM event_series WHERE id=$1 AND organization_id=$2 FOR SHARE",
        [input.seriesId, input.organizationId],
      );
      if (!series.rowCount) {
        if (!creating || !input.newSeriesName)
          fail(400, "Choose an event series belonging to this organization.");
        const claimed = await client.query(
          "SELECT id FROM event_series WHERE id=$1",
          [input.seriesId],
        );
        if (claimed.rowCount)
          fail(400, "This event series belongs to another organization.");
        await client.query(
          "INSERT INTO event_series(id,name,organization_id) VALUES($1,$2,$3)",
          [input.seriesId, input.newSeriesName.trim(), input.organizationId],
        );
      }
      if (creating) {
        const organization = await client.query(
          `SELECT o.approval_administrator_id FROM organizing_organization o JOIN role_grant r ON r.user_id=o.approval_administrator_id AND r.role='administrator' AND r.event_id IS NULL AND r.game_id IS NULL WHERE o.id=$1 FOR SHARE OF o,r`,
          [input.organizationId],
        );
        if (!organization.rowCount)
          fail(
            409,
            "This organization needs a responsible World Curling administrator before applying.",
          );
        await client.query(
          `INSERT INTO event_edition(id,series_id,name,venue,location,timezone,starts_on,ends_on,origin,published,organization_id,city,country,responsible_administrator_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'operated',false,$9,$10,$11,$12)`,
          [
            id,
            input.seriesId,
            input.name.trim(),
            input.venue.trim(),
            `${input.city.trim()}, ${input.country.trim()}`,
            input.timezone,
            input.startsOn,
            input.endsOn,
            input.organizationId,
            input.city.trim(),
            input.country.trim(),
            organization.rows[0].approval_administrator_id,
          ],
        );
        const routing = await routeApplication(
          client,
          { ...input, id, country: input.country.trim() },
          organization.rows[0].approval_administrator_id,
        );
        await client.query(
          "UPDATE event_edition SET responsible_administrator_id=$2,approval_delegation_id=$3,approval_authority_name=$4,category=$5 WHERE id=$1",
          [
            id,
            routing.reviewerId,
            routing.delegationId,
            routing.authorityName,
            input.category ?? "open",
          ],
        );
        await client.query(
          `INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES($1,$2,'organizer',$3,NULL)`,
          [randomUUID(), userId, id],
        );
      } else {
        await client.query(
          `UPDATE event_edition SET name=$2,venue=$3,location=$4,timezone=$5,starts_on=$6,ends_on=$7,city=$8,country=$9,version=version+1 WHERE id=$1`,
          [
            id,
            input.name.trim(),
            input.venue.trim(),
            `${input.city.trim()}, ${input.country.trim()}`,
            input.timezone,
            input.startsOn,
            input.endsOn,
            input.city.trim(),
            input.country.trim(),
          ],
        );
        await client.query("UPDATE event_edition SET category=$2 WHERE id=$1", [
          id,
          input.category ?? "open",
        ]);
      }
      const active = await client.query(
        `SELECT d.id,d.discipline FROM division d WHERE d.event_id=$1 AND (EXISTS(SELECT 1 FROM draw_session ds WHERE ds.division_id=d.id) OR EXISTS(SELECT 1 FROM event_entry en WHERE en.division_id=d.id))`,
        [id],
      );
      for (const d of active.rows)
        if (
          !input.divisions.some(
            (v) => v.id === d.id && v.discipline === d.discipline,
          )
        )
          fail(
            409,
            "A division with entries or scheduled games cannot be removed or change discipline.",
          );
      await client.query(
        "DELETE FROM division WHERE event_id=$1 AND NOT(id=ANY($2::text[]))",
        [id, input.divisions.map((d) => d.id)],
      );
      for (const d of input.divisions) {
        const owned = await client.query(
          "SELECT event_id FROM division WHERE id=$1",
          [d.id],
        );
        if (owned.rowCount && owned.rows[0].event_id !== id)
          fail(400, "A division identifier belongs to another edition.");
        await client.query(
          `INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,$3,$4,'Not configured') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,discipline=EXCLUDED.discipline`,
          [d.id, id, d.name.trim(), d.discipline],
        );
      }
    } else {
      const errors = validateApplication(existing);
      if (Object.keys(errors).length && transitionAction !== "reject")
        throw new ApplicationError(
          400,
          "Complete the application before submitting or approving.",
          errors,
        );
      let next;
      try {
        next = action.startsWith("override_")
          ? approvalOverride(existing!.status, transitionAction)
          : applicationTransition(existing!.status, transitionAction);
      } catch {
        fail(409, "This application transition is not allowed.");
      }
      await client.query(
        "UPDATE event_edition SET admission_status=$2,published=$3,version=version+1 WHERE id=$1",
        [id, next.status, next.published],
      );
    }
    existing = await snapshot(client, id);
    const auditId = randomUUID();
    await client.query(
      "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
      [auditId, userId, `application_${action}`, id],
    );
    await client.query(
      "INSERT INTO event_application_history(id,event_id,version,actor_id,request_id,command_digest,action,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        auditId,
        id,
        existing!.version,
        userId,
        c.requestId,
        digest,
        action,
        reason,
        JSON.stringify(existing),
      ],
    );
    await client.query("COMMIT");
    return applicationDetail(userId, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
