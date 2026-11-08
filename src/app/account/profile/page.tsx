"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoManager } from "@/components/photo-manager";
type Player = {
  id: string;
  name: string;
  biography: string;
  handedness: string | null;
  version: number;
  origin?: string;
};
type Claim = {
  id: string;
  playerId: string;
  name: string;
  claimantName: string;
  status: string;
  message: string;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
type Workspace = { canReview: boolean; claims: Claim[]; owned: Player[] };
async function command(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error ?? "Save could not be confirmed. Refresh before retrying.",
    );
  return result;
}
export default function Profiles() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [players, setPlayers] = useState<Player[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const retry = useRef({ body: "", id: "" });
  const load = useCallback(async () => {
    try {
      const [privateResponse, publicResponse] = await Promise.all([
        fetch("/api/v1/player-claims", { cache: "no-store" }),
        fetch("/api/v1/public/players", { cache: "no-store" }),
      ]);
      if (privateResponse.status === 401) {
        setWorkspace(null);
        return;
      }
      if (!privateResponse.ok || !publicResponse.ok)
        throw new Error(
          "Could not load current profile status. Try refreshing.",
        );
      setWorkspace(await privateResponse.json());
      setPlayers(await publicResponse.json());
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Could not load current profile status. Try refreshing."
          : (e as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(path: string, body: unknown, message: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await command(path, body);
      setNotice(message);
      await load();
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Save could not be confirmed. Refresh current status before retrying."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function request(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
        playerId: form.get("playerId"),
        message: form.get("message"),
      },
      signature = JSON.stringify(body);
    if (retry.current.body !== signature)
      retry.current = { body: signature, id: crypto.randomUUID() };
    await save(
      "/api/v1/player-claims",
      { ...body, id: retry.current.id },
      "Claim submitted. World Curling must review it before you can edit.",
    );
  }
  return (
    <main id="main" className="workspace">
      <p className="eyebrow">Player accounts</p>
      <h1>Claims and profile</h1>
      <p>
        Profile ownership permits biography and handedness changes. Team, event
        and permission grants require separate authority.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Loading profile status…</p>
      ) : !workspace ? (
        <p className="notice">
          <a href="/account">Sign in or register</a> to request a player link.{" "}
          <a href="/admin">Demo personas</a> are also available.
        </p>
      ) : (
        <>
          <PhotoManager
            owned={workspace.owned}
            canReview={workspace.canReview}
          />
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              void load();
            }}
          >
            Refresh current status
          </button>
          {!!workspace.owned.length && (
            <section aria-label="Your approved profile">
              <h2>Your approved profile</h2>
              {workspace.owned.map((player) => (
                <form
                  className="form-card"
                  key={player.id + "-" + player.version}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void save(
                      "/api/v1/players/" + player.id + "/profile",
                      {
                        biography: form.get("biography"),
                        handedness: form.get("handedness") || null,
                        version: player.version,
                      },
                      "Profile saved and published.",
                    );
                  }}
                >
                  <h3>{player.name}</h3>
                  <label htmlFor={"bio-" + player.id}>Short biography</label>
                  <textarea
                    id={"bio-" + player.id}
                    name="biography"
                    maxLength={500}
                    rows={5}
                    defaultValue={player.biography}
                  />
                  <p className="muted">
                    Up to 500 plain-text characters. Leave blank to remove your
                    biography.
                  </p>
                  <label htmlFor={"hand-" + player.id}>Handedness</label>
                  <select
                    id={"hand-" + player.id}
                    name="handedness"
                    defaultValue={player.handedness ?? ""}
                  >
                    <option value="">Not provided</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                  <button disabled={busy}>
                    {busy ? "Saving…" : "Save profile"}
                  </button>
                  <a href={"/players/" + player.id}>View public profile →</a>
                </form>
              ))}
            </section>
          )}
          {!workspace.owned.length && (
            <section>
              <h2>Request an existing player</h2>
              <p>
                Explain your connection privately. An account does not
                automatically create or claim a player.
              </p>
              {!players.length ? (
                <p className="empty">
                  No public players are available to claim.
                </p>
              ) : (
                <form className="form-card" onSubmit={request}>
                  <label htmlFor="player">Player</label>
                  <select id="player" name="playerId" required>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.origin === "fictional_demo"
                          ? " · fictional demonstration"
                          : ""}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="evidence">
                    Your connection to this player
                  </label>
                  <textarea
                    id="evidence"
                    name="message"
                    minLength={10}
                    maxLength={1000}
                    rows={4}
                    required
                  />
                  <button disabled={busy}>
                    {busy ? "Submitting…" : "Request player link"}
                  </button>
                </form>
              )}
            </section>
          )}
          <section>
            <h2>
              {workspace.canReview
                ? "World Curling claim review"
                : "Your claim history"}
            </h2>
            {!workspace.claims.length ? (
              <p className="empty">No claims to show.</p>
            ) : (
              <ul className="workspace-list">
                {workspace.claims.map((c) => (
                  <li key={c.id}>
                    <h3>
                      <a href={"/players/" + c.playerId}>{c.name}</a>
                    </h3>
                    <p>
                      <strong>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </strong>{" "}
                      · Requested {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                    {workspace.canReview && <p>Account: {c.claimantName}</p>}
                    <p>{c.message}</p>
                    {c.reason && <p>Decision: {c.reason}</p>}
                    {c.reviewedAt && (
                      <p className="muted">
                        Reviewed {new Date(c.reviewedAt).toLocaleString()}
                      </p>
                    )}
                    {workspace.canReview && c.status === "pending" && (
                      <form
                        className="form-card"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          const decision = (
                            event.nativeEvent as SubmitEvent
                          ).submitter?.getAttribute("value");
                          void save(
                            "/api/v1/player-claims/" + c.id + "/review",
                            { decision, reason: form.get("reason") },
                            "Claim decision recorded.",
                          );
                        }}
                      >
                        <label htmlFor={"reason-" + c.id}>Review reason</label>
                        <textarea
                          id={"reason-" + c.id}
                          name="reason"
                          minLength={5}
                          maxLength={1000}
                          required
                          rows={3}
                        />
                        <div className="account-actions">
                          <button
                            name="decision"
                            value="approved"
                            disabled={busy}
                          >
                            Approve claim
                          </button>
                          <button
                            className="secondary"
                            name="decision"
                            value="rejected"
                            disabled={busy}
                          >
                            Reject claim
                          </button>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <p>
        <a href="/players">Browse public players →</a>
      </p>
      <p>
        <a href="/admin">Operations and sign out →</a>
      </p>
    </main>
  );
}
