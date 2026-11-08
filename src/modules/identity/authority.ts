import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db";
import {
  type ApprovalScope,
  type Delegation,
  type ApprovalSubject,
  matchesApprovalScope,
  routeApproval,
} from "@/domain/authority";
import { ApplicationError } from "@/modules/events/applications";
type Queryable = Pick<PoolClient, "query">;
const fail = (status: number, message: string): never => {
  throw new ApplicationError(status, message);
};
export async function isAdministrator(c: Queryable, userId: string) {
  return !!(
    await c.query(
      "SELECT id FROM role_grant WHERE user_id=$1 AND role='administrator' AND event_id IS NULL AND game_id IS NULL FOR SHARE",
      [userId],
    )
  ).rowCount;
}
export async function activeDelegations(c: Queryable): Promise<Delegation[]> {
  return (
    await c.query(
      'SELECT id,authority_name AS "authorityName",reviewer_id AS "reviewerId",scope FROM approval_delegation WHERE revoked_at IS NULL ORDER BY id FOR SHARE',
    )
  ).rows;
}
export async function routeApplication(
  c: Queryable,
  subject: ApprovalSubject,
  defaultReviewerId: string,
) {
  return routeApproval(await activeDelegations(c), subject, defaultReviewerId);
}
export async function responsibleReviewer(
  c: Queryable,
  userId: string,
  app: ApprovalSubject & { reviewerId: string; delegationId: string | null },
) {
  if (app.reviewerId !== userId) return false;
  if (!app.delegationId) return isAdministrator(c, userId);
  const grants = await activeDelegations(c);
  return grants.some(
    (g) =>
      g.id === app.delegationId &&
      g.reviewerId === userId &&
      matchesApprovalScope(g.scope, app),
  );
}
export async function recordAuthority(
  c: Queryable,
  userId: string,
  kind: string,
  resourceId: string,
  reason: string,
  before: unknown,
  after: unknown,
) {
  const id = randomUUID();
  await c.query(
    "INSERT INTO audit_record(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
    [id, userId, kind, resourceId],
  );
  await c.query(
    "INSERT INTO authority_history(id,kind,resource_id,actor_id,reason,before_state,after_state) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      id,
      kind,
      resourceId,
      userId,
      reason,
      JSON.stringify(before),
      JSON.stringify(after),
    ],
  );
}
export async function delegationWorkspace(userId: string) {
  const admin = await isAdministrator(pool, userId);
  const delegations = (
    await pool.query(
      'SELECT id,authority_name AS "authorityName",reviewer_id AS "reviewerId",scope,revoked_at AS "revokedAt",revocation_reason AS "revocationReason" FROM approval_delegation WHERE $2 OR reviewer_id=$1 ORDER BY created_at DESC',
      [userId, admin],
    )
  ).rows;
  const users = admin
    ? (
        await pool.query(
          `SELECT u.id,u.name,EXISTS(SELECT 1 FROM role_grant r WHERE r.user_id=u.id AND r.role='administrator' AND r.event_id IS NULL AND r.game_id IS NULL) AS "isAdministrator" FROM auth_user u ORDER BY u.name,u.id`,
        )
      ).rows
    : [];
  const history = (
    await pool.query(
      `SELECT h.kind,h.resource_id AS "resourceId",h.reason,h.before_state AS before,h.after_state AS after,h.created_at AS "createdAt",u.name AS "actorName" FROM authority_history h JOIN auth_user u ON u.id=h.actor_id WHERE $2 OR EXISTS(SELECT 1 FROM approval_delegation d WHERE d.id=h.resource_id AND d.reviewer_id=$1) OR EXISTS(SELECT 1 FROM role_grant r WHERE r.user_id=$1 AND r.role='organizer' AND r.game_id IS NULL AND r.event_id=coalesce(h.after_state->>'eventId',h.before_state->>'eventId')) ORDER BY h.created_at DESC`,
      [userId, admin],
    )
  ).rows;
  const organizations = (
    await pool.query(
      `SELECT o.id,o.name FROM organizing_organization o WHERE $2 OR EXISTS(SELECT 1 FROM approval_delegation d WHERE d.reviewer_id=$1 AND d.scope->'organizationIds' ? o.id) ORDER BY o.name,o.id`,
      [userId, admin],
    )
  ).rows;
  return { isAdministrator: admin, delegations, users, history, organizations };
}
export async function delegationCommand(userId: string, raw: unknown) {
  const input = raw as {
    action: string;
    id: string;
    authorityName?: string;
    reviewerId?: string;
    scope?: ApprovalScope;
    reason: string;
  };
  if (
    !input ||
    !["grant", "revoke"].includes(input.action) ||
    typeof input.id !== "string" ||
    !/^[-\w]{1,80}$/.test(input.id) ||
    typeof input.reason !== "string" ||
    !input.reason.trim() ||
    input.reason.length > 1000 ||
    /[\u0000-\u001f]/.test(input.reason)
  )
    fail(
      400,
      "Provide a grant identifier, action and reason (1–1000 characters).",
    );
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    if (!(await isAdministrator(c, userId)))
      fail(
        403,
        "Only World Curling administrators control approval delegations.",
      );
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `delegation:${input.id}`,
    ]);
    const before = (
      await c.query(
        "SELECT * FROM approval_delegation WHERE id=$1 FOR UPDATE",
        [input.id],
      )
    ).rows[0];
    if (input.action === "grant") {
      const s = input.scope;
      if (
        typeof input.authorityName !== "string" ||
        !input.authorityName.trim() ||
        input.authorityName.length > 160 ||
        /[\u0000-\u001f]/.test(input.authorityName) ||
        typeof input.reviewerId !== "string" ||
        !s ||
        ![
          "countries",
          "organizationIds",
          "disciplines",
          "categories",
          "includeEventIds",
          "excludeEventIds",
        ].every(
          (k) =>
            Array.isArray(s[k as keyof ApprovalScope]) &&
            s[k as keyof ApprovalScope].length <= 100 &&
            s[k as keyof ApprovalScope].every(
              (v) =>
                typeof v === "string" &&
                v.trim() === v &&
                v.length > 0 &&
                v.length <= 160 &&
                !/[\u0000-\u001f]/.test(v),
            ),
        )
      )
        fail(
          400,
          "Provide an authority, reviewer and explicit scope lists. Empty lists mean all values in that dimension.",
        );
      if (
        !(
          await c.query("SELECT id FROM auth_user WHERE id=$1", [
            input.reviewerId,
          ])
        ).rowCount
      )
        fail(400, "Reviewer account not found.");
      if (before) {
        const same = (
          await c.query(
            "SELECT authority_name=$2 AND reviewer_id=$3 AND scope=$4::jsonb AND created_by=$5 AND EXISTS(SELECT 1 FROM authority_history h WHERE h.resource_id=$1 AND h.kind='approval_grant' AND h.actor_id=$5 AND h.reason=$6) AS same FROM approval_delegation WHERE id=$1",
            [
              input.id,
              input.authorityName!.trim(),
              input.reviewerId,
              JSON.stringify(s),
              userId,
              input.reason.trim(),
            ],
          )
        ).rows[0].same;
        if (!same || before.revoked_at)
          fail(
            409,
            "Grant identifier already exists. Revoke and create a new grant to change its scope.",
          );
        await c.query("COMMIT");
        return delegationWorkspace(userId);
      }
      await c.query(
        "INSERT INTO approval_delegation(id,authority_name,reviewer_id,scope,created_by) VALUES($1,$2,$3,$4,$5)",
        [
          input.id,
          input.authorityName!.trim(),
          input.reviewerId,
          JSON.stringify(s),
          userId,
        ],
      );
    } else {
      if (!before) fail(404, "Delegation not found.");
      if (before.revoked_at) {
        if (before.revocation_reason !== input.reason.trim())
          fail(409, "Delegation already revoked with another reason.");
        await c.query("COMMIT");
        return delegationWorkspace(userId);
      }
      await c.query(
        "UPDATE approval_delegation SET revoked_at=now(),revocation_reason=$2 WHERE id=$1",
        [input.id, input.reason.trim()],
      );
    }
    const after = (
      await c.query("SELECT * FROM approval_delegation WHERE id=$1", [input.id])
    ).rows[0];
    await recordAuthority(
      c,
      userId,
      `approval_${input.action}`,
      input.id,
      input.reason.trim(),
      before ?? null,
      after,
    );
    await c.query("COMMIT");
    return delegationWorkspace(userId);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
