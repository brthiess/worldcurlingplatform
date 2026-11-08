"use client";
import { useEffect, useState } from "react";
import {
  AuthorityRecovery,
  useAuthorityCommand,
  type RetainedAuthorityCommand,
} from "./authority-command";
import { representationActions } from "@/domain/representation";
type Data = {
  actorId: string;
  isAdministrator: boolean;
  users: { id: string; name: string }[];
  registrations: { id: string; name: string; season: string; teamId: string }[];
  divisions: {
    id: string;
    name: string;
    eventName: string;
    season: string | null;
    seasonVersion: number;
  }[];
  grants: {
    id: string;
    userName: string;
    name: string;
    teamId: string;
    season: string;
    actions: string[];
    revokedAt: string | null;
    revocationReason: string | null;
  }[];
  history: {
    id: string;
    kind: string;
    actorName: string;
    reason: string;
    createdAt: string;
  }[];
  receipts: { requestId: string; command: unknown }[];
};
export function RepresentationWorkbench() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(""),
    [registrationId, setRegistrationId] = useState(""),
    [actions, setActions] = useState<string[]>([...representationActions]),
    [reason, setReason] = useState("");
  const [divisionId, setDivisionId] = useState(""),
    [season, setSeason] = useState("2026-27"),
    [seasonReason, setSeasonReason] = useState("");
  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/v1/team-representation", {
        cache: "no-store",
      });
      if (!r.ok)
        throw new Error(
          r.status === 401
            ? "Sign in to review team-season authority."
            : "Team authority could not be loaded.",
        );
      const next = (await r.json()) as Data;
      setData(next);
      setError("");
      return next;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load().catch(() => {});
  }, []);
  const command = useAuthorityCommand(
    data ? `wcp-team-representation:${data.actorId}` : null,
    data?.actorId,
    async () => {
      await load();
      setReason("");
      setSeasonReason("");
    },
    async (saved: RetainedAuthorityCommand) => {
      const next = await load(),
        body = JSON.parse(saved.body);
      return next.receipts.some(
        (r) =>
          r.requestId === body.requestId &&
          JSON.stringify(r.command, Object.keys(r.command as object).sort()) ===
            JSON.stringify(body, Object.keys(body).sort()),
      );
    },
  );
  function submit(body: Record<string, unknown>) {
    void command.submit(
      "/api/v1/team-representation",
      { ...body, requestId: crypto.randomUUID() },
      "Team-season authority recorded.",
    );
  }
  const division = data?.divisions.find((d) => d.id === divisionId);
  return (
    <main id="main">
      <a className="back" href="/admin">
        ← Your workspace
      </a>
      <p className="eyebrow">World Curling authority</p>
      <h1>Team-season representatives</h1>
      <p>
        Authority belongs to an exact team core, season and set of actions. A
        player-profile link grants no team powers. A different permanent core
        needs a separate grant.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && !data && <p role="status">Loading team-season authority…</p>}
      {!data && !loading && (
        <button onClick={() => void load().catch(() => {})}>
          Retry loading authority
        </button>
      )}
      <AuthorityRecovery state={command} label="team-season" />
      {data && (
        <>
          <button
            className="secondary"
            disabled={command.locked || loading}
            onClick={() => void load().catch(() => {})}
          >
            Refresh recorded authority
          </button>
          {loading && <p role="status">Refreshing team-season authority…</p>}
          <p>
            <a href="/admin/entries">Open your team entries</a>
          </p>
          {data.isAdministrator ? (
            <div className="application-layout">
              <section className="application-detail">
                <h2>Grant team-season authority</h2>
                <form
                  className="form-card application-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit({
                      action: "grant",
                      id: crypto.randomUUID(),
                      userId,
                      registrationId,
                      actions,
                      reason,
                    });
                  }}
                >
                  <fieldset disabled={command.locked}>
                    <label htmlFor="representative-account">
                      Representative account
                    </label>
                    <select
                      id="representative-account"
                      required
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                    >
                      <option value="">Choose an account</option>
                      {data.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} · {u.id}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="represented-season">Team and season</label>
                    <select
                      id="represented-season"
                      required
                      value={registrationId}
                      onChange={(e) => setRegistrationId(e.target.value)}
                    >
                      <option value="">Choose a registered team-season</option>
                      {data.registrations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} · {r.season} · {r.teamId}
                        </option>
                      ))}
                    </select>
                    <p>Granted actions</p>
                    {representationActions.map((a) => (
                      <label className="check-label" key={a}>
                        <input
                          type="checkbox"
                          checked={actions.includes(a)}
                          onChange={(e) =>
                            setActions(
                              e.target.checked
                                ? [...actions, a]
                                : actions.filter((x) => x !== a),
                            )
                          }
                        />
                        {a}
                      </label>
                    ))}
                    <label htmlFor="representation-reason">
                      Representation reason
                    </label>
                    <textarea
                      id="representation-reason"
                      required
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <button disabled={!actions.length} type="submit">
                      Grant team-season authority
                    </button>
                  </fieldset>
                </form>
              </section>
              <section className="application-detail">
                <h2>Division entry season</h2>
                <p>
                  This metadata connects self-entry to its granted season.
                  Manual organizer entry remains available. Entry capacity and
                  payment workflows are separate.
                </p>
                <form
                  className="form-card application-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit({
                      action: "configure-season",
                      divisionId,
                      season,
                      version: division?.seasonVersion,
                      reason: seasonReason,
                    });
                  }}
                >
                  <fieldset disabled={command.locked}>
                    <label htmlFor="representation-division">
                      Division for self-entry
                    </label>
                    <select
                      id="representation-division"
                      required
                      value={divisionId}
                      onChange={(e) => {
                        setDivisionId(e.target.value);
                        setSeason(
                          data.divisions.find((d) => d.id === e.target.value)
                            ?.season ?? "2026-27",
                        );
                      }}
                    >
                      <option value="">Choose a division</option>
                      {data.divisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.eventName} · {d.name}
                        </option>
                      ))}
                    </select>
                    {division && (
                      <p>
                        Current season:{" "}
                        {division.season ??
                          "Not configured; self-entry unavailable"}{" "}
                        · version {division.seasonVersion}
                      </p>
                    )}
                    <label htmlFor="entry-season">Entry season</label>
                    <input
                      id="entry-season"
                      required
                      pattern="20[0-9]{2}-[0-9]{2}"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                    />
                    <label htmlFor="season-reason">Season setup reason</label>
                    <textarea
                      id="season-reason"
                      required
                      maxLength={1000}
                      value={seasonReason}
                      onChange={(e) => setSeasonReason(e.target.value)}
                    />
                    <button type="submit">Save division entry season</button>
                  </fieldset>
                </form>
              </section>
            </div>
          ) : (
            <p className="notice">
              World Curling staff grant or revoke authority. You may use only
              your listed active actions; this grants no season or ranking
              roster control.
            </p>
          )}
          <h2>Recorded representation grants</h2>
          {!data.grants.length && (
            <p className="empty">
              No team-season authority is assigned to this account.
            </p>
          )}
          <ul className="workspace-list">
            {data.grants.map((g) => (
              <li key={g.id}>
                <h3>
                  {g.name} · {g.season}
                </h3>
                <p>
                  {g.userName} acting on behalf of team {g.teamId}
                </p>
                <p>
                  {g.actions.join(" · ")} · {g.revokedAt ? "Revoked" : "Active"}
                </p>
                {g.revocationReason && <p>{g.revocationReason}</p>}
                {data.isAdministrator && !g.revokedAt && (
                  <Revoke
                    disabled={command.locked}
                    onRevoke={(reason) =>
                      submit({ action: "revoke", id: g.id, reason })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          <h2>Authority history</h2>
          {!data.history.length && <p>No representation changes recorded.</p>}
          <ul className="workspace-list">
            {data.history.map((h) => (
              <li key={h.id}>
                <p>
                  {h.kind.replaceAll("_", " ")} · {h.actorName}
                </p>
                <p>{h.reason}</p>
                <time dateTime={h.createdAt}>
                  {new Date(h.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
function Revoke({
  disabled,
  onRevoke,
}: {
  disabled: boolean;
  onRevoke: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onRevoke(reason);
      }}
    >
      <fieldset disabled={disabled}>
        <label>
          Revocation reason
          <textarea
            required
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button type="submit">Revoke representation</button>
      </fieldset>
    </form>
  );
}
