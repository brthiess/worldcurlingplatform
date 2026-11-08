"use client";
import { useEffect, useState } from "react";
import type { ApprovalScope } from "@/domain/authority";
import { disciplines } from "@/domain/applications";
type Delegations = {
  isAdministrator: boolean;
  organizations: { id: string; name: string }[];
  users: { id: string; name: string; isAdministrator: boolean }[];
  delegations: {
    id: string;
    authorityName: string;
    reviewerId: string;
    scope: ApprovalScope;
    revokedAt: string | null;
    revocationReason: string | null;
  }[];
  history: {
    kind: string;
    reason: string;
    actorName: string;
    createdAt: string;
    resourceId: string;
    before: {
      name?: string;
      authority_name?: string;
      eventId?: string;
      gameId?: string;
    } | null;
    after: {
      name?: string;
      authority_name?: string;
      eventId?: string;
      gameId?: string;
    } | null;
  }[];
};
type Staff = {
  events: { id: string; name: string }[];
  games: { id: string; eventId: string; sheet: string; drawNumber: number }[];
  grants: {
    id: string;
    name: string;
    role: string;
    eventId: string;
    gameId: string | null;
  }[];
};
const labels: Record<keyof ApprovalScope, string> = {
  countries: "Countries",
  organizationIds: "Organizing organizations",
  disciplines: "Disciplines",
  categories: "Event categories",
  includeEventIds: "Named included application identifiers",
  excludeEventIds: "Named excluded application identifiers",
};
const emptyScope: ApprovalScope = {
  countries: [],
  organizationIds: [],
  disciplines: [],
  categories: [],
  includeEventIds: [],
  excludeEventIds: [],
};
async function command(path: string, body: unknown) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
export function AuthorityWorkbench() {
  const [data, setData] = useState<Delegations | null>(null),
    [staff, setStaff] = useState<Staff | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [eventId, setEventId] = useState("");
  async function load() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetch("/api/v1/approval-delegations", { cache: "no-store" }),
        fetch("/api/v1/role-grants", { cache: "no-store" }),
      ]);
      if (!a.ok || !b.ok)
        throw new Error(
          a.status === 401
            ? "Sign in to manage assigned authority."
            : "Authority could not be loaded. Try again.",
        );
      setData(await a.json());
      const next = await b.json();
      setStaff(next);
      setEventId((current) =>
        next.events.some((e: { id: string }) => e.id === current)
          ? current
          : (next.events[0]?.id ?? ""),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(path: string, body: unknown, message: string) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await command(path, body);
      await load();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="workspace authority-workspace">
      <p className="eyebrow">Operations</p>
      <h1>Authority & event staff</h1>
      <p>
        <a href="/admin">Your workspace</a> ·{" "}
        <a href="/admin/applications">Event applications</a>
      </p>
      {error && (
        <div role="alert" className="error">
          {error}{" "}
          <button className="secondary" onClick={() => void load()}>
            Reload authority
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading assigned authority…</p>
      ) : (
        data &&
        staff && (
          <>
            <section>
              <h2>Approval delegations</h2>
              <p>
                World Curling controls every delegation. A delegation grants
                event review within its scope. Each application keeps one
                responsible authority and reviewer. Overlapping matches return
                routing to World Curling; existing applications require explicit
                reassignment. No onward delegation or ranking publication is
                granted.
              </p>
              {data.isAdministrator ? (
                <form
                  className="form-card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const scope = { ...emptyScope };
                    for (const key of Object.keys(
                      scope,
                    ) as (keyof ApprovalScope)[])
                      scope[key] =
                        key === "organizationIds" || key === "disciplines"
                          ? f.getAll(key).map(String)
                          : String(f.get(key) ?? "")
                              .split(",")
                              .map((x) => x.trim())
                              .filter(Boolean);
                    void save(
                      "/api/v1/approval-delegations",
                      {
                        action: "grant",
                        id: crypto.randomUUID(),
                        authorityName: f.get("authorityName"),
                        reviewerId: f.get("reviewerId"),
                        reason: f.get("reason"),
                        scope,
                      },
                      "Approval delegation recorded.",
                    );
                  }}
                >
                  <fieldset disabled={busy}>
                    <legend>Grant approval authority</legend>
                    <label htmlFor="authority-name">Authority name</label>
                    <input
                      id="authority-name"
                      name="authorityName"
                      maxLength={160}
                      required
                    />
                    <label htmlFor="grant-reviewer">Assigned reviewer</label>
                    <select id="grant-reviewer" name="reviewerId" required>
                      {data.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <p className="muted">
                      Select organizations and disciplines by name. Leave a
                      selection empty to allow all. Countries, categories and
                      named applications use comma-separated exact values; empty
                      countries or categories allow all. Every division must
                      match. Named inclusions bypass dimensions; named
                      exclusions always deny. Copy a named application
                      identifier from its details screen. Default category:
                      open.
                    </p>
                    {(Object.keys(labels) as (keyof ApprovalScope)[]).map(
                      (key) => (
                        <div key={key}>
                          <label htmlFor={`scope-${key}`}>{labels[key]}</label>
                          {key === "organizationIds" ||
                          key === "disciplines" ? (
                            <select
                              multiple
                              size={3}
                              id={`scope-${key}`}
                              name={key}
                            >
                              {(key === "organizationIds"
                                ? data.organizations
                                : Object.entries(disciplines).map(
                                    ([id, name]) => ({ id, name }),
                                  )
                              ).map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input id={`scope-${key}`} name={key} />
                          )}
                        </div>
                      ),
                    )}
                    <label htmlFor="delegation-reason">Delegation reason</label>
                    <textarea
                      id="delegation-reason"
                      name="reason"
                      required
                      maxLength={1000}
                    />
                    <button>Grant approval delegation</button>
                  </fieldset>
                </form>
              ) : (
                <p className="notice">
                  Only World Curling administrators may grant, revoke or
                  reassign approval authority.
                </p>
              )}
              {!data.delegations.length ? (
                <p className="empty">
                  No approval delegations are assigned to this account.
                </p>
              ) : (
                <ul className="workspace-list">
                  {data.delegations.map((d) => (
                    <li key={d.id}>
                      <h3>{d.authorityName}</h3>
                      <p>
                        Reviewer:{" "}
                        {data.users.find((u) => u.id === d.reviewerId)?.name ??
                          "Your account"}{" "}
                        · {d.revokedAt ? "Revoked" : "Active"}
                      </p>
                      <dl>
                        {(Object.keys(labels) as (keyof ApprovalScope)[]).map(
                          (key) => (
                            <div key={key}>
                              <dt>{labels[key]}</dt>
                              <dd style={{ overflowWrap: "anywhere" }}>
                                {d.scope[key]
                                  .map((value) =>
                                    key === "organizationIds"
                                      ? (data.organizations.find(
                                          (o) => o.id === value,
                                        )?.name ?? value)
                                      : key === "disciplines"
                                        ? (disciplines[
                                            value as keyof typeof disciplines
                                          ] ?? value)
                                        : value,
                                  )
                                  .join(", ") ||
                                  (key === "includeEventIds" ||
                                  key === "excludeEventIds"
                                    ? "None"
                                    : "All")}
                              </dd>
                            </div>
                          ),
                        )}
                      </dl>
                      {d.revocationReason && (
                        <p>Revocation: {d.revocationReason}</p>
                      )}
                      {data.isAdministrator && !d.revokedAt && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void save(
                              "/api/v1/approval-delegations",
                              {
                                action: "revoke",
                                id: d.id,
                                reason: new FormData(e.currentTarget).get(
                                  "reason",
                                ),
                              },
                              "Delegation revoked. Assigned applications need explicit reassignment.",
                            );
                          }}
                        >
                          <label htmlFor={`revoke-${d.id}`}>
                            Revocation reason for {d.authorityName}
                          </label>
                          <input
                            id={`revoke-${d.id}`}
                            name="reason"
                            required
                            maxLength={1000}
                          />
                          <button className="secondary" disabled={busy}>
                            Revoke {d.authorityName}
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2>Scoring assignments</h2>
              <p>
                Organizers assign scoring for games in their own events. Scoring
                access permits manual score commands in that game; it grants no
                organizer, approval or ranking publication authority.
              </p>
              {!staff.events.length ? (
                <p className="empty">
                  No events are assigned for staff management.
                </p>
              ) : (
                <>
                  <form
                    className="form-card"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void save(
                        "/api/v1/role-grants",
                        {
                          id: crypto.randomUUID(),
                          role: "scorekeeper",
                          eventId,
                          gameId: f.get("gameId"),
                          recipientEmail: f.get("email"),
                          reason: f.get("reason"),
                        },
                        "Scoring assignment saved.",
                      );
                    }}
                  >
                    <fieldset disabled={busy}>
                      <legend>Assign a scorekeeper</legend>
                      <label htmlFor="staff-event">Event</label>
                      <select
                        id="staff-event"
                        value={eventId}
                        onChange={(e) => setEventId(e.target.value)}
                      >
                        {staff.events.map((e) => (
                          <option value={e.id} key={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="staff-game">Game</label>
                      <select
                        id="staff-game"
                        name="gameId"
                        required
                        key={eventId}
                      >
                        {!staff.games.some((g) => g.eventId === eventId) && (
                          <option value="">No games scheduled</option>
                        )}
                        {staff.games
                          .filter((g) => g.eventId === eventId)
                          .map((g) => (
                            <option value={g.id} key={g.id}>
                              Draw {g.drawNumber} · Sheet {g.sheet} · {g.id}
                            </option>
                          ))}
                      </select>
                      <label htmlFor="staff-email">
                        Scorekeeper account email
                      </label>
                      <input
                        id="staff-email"
                        name="email"
                        type="email"
                        required
                      />
                      <label htmlFor="staff-reason">Assignment reason</label>
                      <input
                        id="staff-reason"
                        name="reason"
                        required
                        maxLength={1000}
                      />
                      <button
                        disabled={
                          !staff.games.some((g) => g.eventId === eventId)
                        }
                      >
                        Assign scoring access
                      </button>
                    </fieldset>
                  </form>
                  <ul className="workspace-list">
                    {staff.grants.map((g) => (
                      <li key={g.id}>
                        <h3>
                          {g.name} · {g.role}
                        </h3>
                        <p>
                          {staff.events.find((e) => e.id === g.eventId)?.name} ·{" "}
                          {g.gameId ? `Game ${g.gameId}` : "Event management"}
                        </p>
                        {g.role === "scorekeeper" && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void save(
                                "/api/v1/role-grants",
                                {
                                  action: "revoke",
                                  id: g.id,
                                  reason: new FormData(e.currentTarget).get(
                                    "reason",
                                  ),
                                },
                                "Scoring assignment revoked.",
                              );
                            }}
                          >
                            <label htmlFor={`staff-revoke-${g.id}`}>
                              Reason to end {g.name}’s assignment
                            </label>
                            <input
                              id={`staff-revoke-${g.id}`}
                              name="reason"
                              required
                              maxLength={1000}
                            />
                            <button className="secondary" disabled={busy}>
                              Revoke scoring for {g.name} · {g.gameId}
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!staff.grants.length && (
                    <p className="empty">
                      No staff assignments for these events.
                    </p>
                  )}
                </>
              )}
            </section>
            <section>
              <h2>Authority history</h2>
              {!data.history.length ? (
                <p className="empty">No authority changes in your scope.</p>
              ) : (
                <ol className="history-list">
                  {data.history.map((h, i) => (
                    <li key={i}>
                      <strong>
                        {h.kind.replaceAll("_", " ")} ·{" "}
                        {(h.after ?? h.before)?.authority_name ??
                          (h.after ?? h.before)?.name ??
                          "Recorded assignment"}
                      </strong>
                      {(h.after ?? h.before)?.eventId && (
                        <p>
                          {staff.events.find(
                            (e) => e.id === (h.after ?? h.before)?.eventId,
                          )?.name ?? "Assigned event"}{" "}
                          ·{" "}
                          {(h.after ?? h.before)?.gameId ?? "Event management"}
                        </p>
                      )}
                      <p>
                        {h.actorName} ·{" "}
                        {new Date(h.createdAt).toLocaleString("en-CA", {
                          timeZone: "UTC",
                        })}{" "}
                        UTC
                      </p>
                      <p>{h.reason}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )
      )}
    </main>
  );
}
export function ResponsibilityControls({
  id,
  version,
  onSaved,
}: {
  id: string;
  version: number;
  onSaved: () => void;
}) {
  const [data, setData] = useState<Delegations | null>(null),
    [target, setTarget] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/approval-delegations", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw new Error("Responsibility options could not be loaded.");
        const next = await r.json();
        if (active) setData(next);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id, version]);
  async function save(action: string) {
    setBusy(true);
    setError("");
    try {
      await command(`/api/v1/applications/${id}`, {
        requestId: crypto.randomUUID(),
        version,
        action,
        reason,
        ...(target.startsWith("wc:")
          ? { delegationId: null, reviewerId: target.slice(3) }
          : { delegationId: target }),
      });
      setReason("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="responsibility-controls">
      <summary>World Curling responsibility & override</summary>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data ? (
        <p>Loading responsibility options…</p>
      ) : (
        <fieldset disabled={busy}>
          <legend>Explicit responsibility change</legend>
          <label htmlFor="responsibility-target">
            Responsible authority and reviewer
          </label>
          <select
            id="responsibility-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Choose a responsibility</option>
            {data.users
              .filter((u) => u.isAdministrator)
              .map((u) => (
                <option key={u.id} value={`wc:${u.id}`}>
                  World Curling · {u.name}
                </option>
              ))}
            {data.delegations
              .filter((d) => !d.revokedAt)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.authorityName} ·{" "}
                  {data.users.find((u) => u.id === d.reviewerId)?.name}
                </option>
              ))}
          </select>
          <label htmlFor="responsibility-reason">
            Reassignment / override reason
          </label>
          <textarea
            id="responsibility-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
          />
          <div className="application-actions">
            <button
              disabled={!reason.trim() || !target}
              onClick={() => void save("reassign")}
            >
              Reassign responsibility
            </button>
            <button
              disabled={!reason.trim()}
              onClick={() => void save("override_approve")}
            >
              World Curling override: admit
            </button>
            <button
              className="secondary"
              disabled={!reason.trim()}
              onClick={() => void save("override_reject")}
            >
              World Curling override: return
            </button>
          </div>
          <p>
            Overrides apply to submitted or decided applications. All changes
            require a reason and preserve the previous version in history.
          </p>
        </fieldset>
      )}
    </details>
  );
}
