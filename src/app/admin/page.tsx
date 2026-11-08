"use client";
import { useCallback, useEffect, useState } from "react";
type Workspace = {
  name: string;
  grants: { role: string; eventId: string | null; gameId: string | null }[];
  games: {
    id: string;
    nameA: string;
    nameB: string;
    eventName: string;
    eventId: string;
    sheet: string;
    state: string;
    canScore: boolean;
    canManage: boolean;
    published: boolean;
  }[];
};
export default function Admin() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [persona, setPersona] = useState("scorekeeper");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/workspace", { cache: "no-store" });
      if (response.status === 401) {
        setWorkspace(null);
        return;
      }
      if (!response.ok)
        throw new Error("The workspace could not be loaded. Try again.");
      setWorkspace(await response.json());
      setError("");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: `${persona}@demo.invalid`,
          password: form.get("password"),
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Too many sign-in attempts. Please wait one minute."
            : "Sign-in failed. Check the selected persona and local demo password.",
        );
      await load();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok)
        throw new Error("Sign-out could not be confirmed. Please try again.");
      setWorkspace(null);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="workspace">
      <p className="eyebrow">Operations</p>
      <h1>{workspace ? "Your workspace" : "Demo sign-in"}</h1>
      <div className="notice">
        Fictional review environment. Teams and results are demonstration
        records.
      </div>
      <p>
        <a href="/account">Personal account sign-in / registration →</a>
      </p>
      <p>
        <a href="/account/profile">Player claims, review and profile →</a>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="loading">
          Checking your session…
        </p>
      ) : workspace ? (
        <>
          <p>
            Signed in as <strong>{workspace.name}</strong>.
          </p>
          <p>
            <a href="/admin/applications">Event applications</a>
          </p>
          <p>
            <a href="/admin/authority">Authority & event staff</a>
          </p>
          <p>
            <a href="/admin/entries">Team entries</a>
            <a href="/admin/representatives">Team-season representatives</a>
          </p>
          <p>
            <a href="/admin/news">News sources and moderation</a>
          </p>
          <p>
            <a href="/admin/ranking-inputs">Season ranking inputs and rule editions</a>
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void signOut()}
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
          <h2 style={{ marginTop: 32 }}>Your authority</h2>
          <ul className="workspace-list">
            {workspace.grants.map((grant, i) => {
              const game = workspace.games.find((game) =>
                grant.gameId
                  ? game.id === grant.gameId
                  : game.eventId === grant.eventId,
              );
              return (
                <li key={i}>
                  <strong>
                    {grant.role.charAt(0).toUpperCase() + grant.role.slice(1)}
                  </strong>
                  <p className="muted">
                    {grant.eventId
                      ? (game?.eventName ?? "Assigned event")
                      : "All platform events"}
                    {grant.gameId && game
                      ? ` · ${game.nameA} vs ${game.nameB}`
                      : ""}
                  </p>
                  {grant.role === "reviewer" && (
                    <p>Read-only access. Changes are denied.</p>
                  )}
                </li>
              );
            })}
          </ul>
          <h2 style={{ marginTop: 32 }}>Permitted games</h2>
          {!workspace.games.length ? (
            <p className="empty">No games are assigned to this account.</p>
          ) : (
            <ul className="workspace-list">
              {workspace.games.map((game) => (
                <li key={game.id}>
                  <p className="eyebrow">
                    {game.eventName} · Sheet {game.sheet}
                  </p>
                  <h3>
                    {game.nameA} vs {game.nameB}
                  </h3>
                  <p>
                    {game.state} ·{" "}
                    {game.canManage
                      ? "Organizer management scope"
                      : game.canScore
                        ? "Assigned scoring scope"
                        : "Read-only scope"}
                  </p>
                  {game.canScore && (
                    <p>
                      <a href={`/admin/games/${game.id}`}>
                        Enter live scores →
                      </a>
                    </p>
                  )}
                  {game.published ? (
                    <a href={`/games/${game.id}`}>Open game details →</a>
                  ) : (
                    <p className="muted">
                      Unpublished event · visible within your assigned scope
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <form className="form-card" onSubmit={signIn}>
          <h2>Choose your demo role</h2>
          <p className="muted">
            Use the password configured for this isolated scenario by the local
            operator.
          </p>
          <label htmlFor="persona">Demo persona</label>
          <select
            id="persona"
            value={persona}
            onChange={(event) => setPersona(event.target.value)}
          >
            <option value="scorekeeper">Scorekeeper · one assigned game</option>
            <option value="organizer">Organizer · Prairie Open</option>
            <option value="reviewer">Reviewer · read only</option>
            <option value="administrator">
              Administrator · platform scope
            </option>
          </select>
          <label htmlFor="password">Demo password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={12}
          />
          <button disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
    </main>
  );
}
