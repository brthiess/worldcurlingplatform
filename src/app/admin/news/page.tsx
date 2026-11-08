"use client";
import { useEffect, useState } from "react";
type Source = {
  id: string;
  publisher: string;
  feedUrl: string;
  approved: boolean;
  version: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  stale: boolean;
};
type Item = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  hidden: boolean;
  version: number;
};
type Workspace = {
  sources: Source[];
  items: Item[];
  attempts: {
    jobId: string;
    state: string;
    itemCount: number;
    error: string | null;
    createdAt: string;
  }[];
};
export default function ManageNews() {
  const [data, setData] = useState<Workspace | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [reasons, setReasons] = useState<Record<string, string>>({});
  async function load() {
    try {
      const r = await fetch("/api/v1/news", { cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setData(body);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function command(body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/v1/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setMessage(
        result.jobId
          ? "Fetch queued. The worker will retry temporary failures; refresh status to see the result."
          : "Change saved.",
      );
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      values = new FormData(form);
    if (
      await command({
        action: "source",
        publisher: values.get("publisher"),
        feedUrl: values.get("feedUrl"),
        reason: values.get("reason"),
        approved: true,
      })
    )
      form.reset();
  }
  const reason = (id: string) => (
    <label>
      Change reason
      <input
        maxLength={500}
        minLength={5}
        value={reasons[id] ?? ""}
        onChange={(e) => setReasons({ ...reasons, [id]: e.target.value })}
      />
    </label>
  );
  return (
    <main id="main" className="news-page">
      <p className="eyebrow">Platform operations</p>
      <h1>News sources</h1>
      <p>
        Global administrators approve feeds, request fetches and moderate linked
        items. Approvals and visibility changes retain an audit history. Sources
        refresh hourly while the worker is running.
      </p>
      <p>
        <a href="/admin">Sign in / workspace</a> ·{" "}
        <a href="/news">Public news</a>
      </p>
      <button className="secondary" disabled={busy} onClick={() => void load()}>
        Refresh status
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {!data && !error && <p role="status">Checking news authority…</p>}
      {data && (
        <>
          <form className="form-card" onSubmit={add}>
            <h2>Approve an external feed</h2>
            <label htmlFor="publisher">Publisher</label>
            <input id="publisher" name="publisher" required maxLength={100} />
            <label htmlFor="feed-url">Feed URL</label>
            <input
              id="feed-url"
              name="feedUrl"
              type="url"
              placeholder="https://publisher.example/feed/"
              required
              maxLength={2048}
            />
            <label htmlFor="approval-reason">Approval reason</label>
            <input
              id="approval-reason"
              name="reason"
              required
              minLength={5}
              maxLength={500}
            />
            <button disabled={busy}>Add approved source</button>
          </form>
          <h2>Configured sources</h2>
          {!data.sources.length && (
            <p className="empty">
              No feeds configured. Add a reviewed source to begin.
            </p>
          )}
          <div className="news-grid">
            {data.sources.map((s) => (
              <article className="news-card" key={s.id}>
                <h3>{s.publisher}</h3>
                <p className="badge">{s.approved ? "Approved" : "Suspended"}</p>
                <p className="news-url">{s.feedUrl}</p>
                <p>
                  {s.lastSuccessAt
                    ? `Last successful fetch: ${new Date(s.lastSuccessAt).toLocaleString()}`
                    : "Never fetched"}
                  {s.stale ? " · Stale" : ""}
                </p>
                {s.lastAttemptAt && (
                  <p className="muted">
                    Last attempt: {new Date(s.lastAttemptAt).toLocaleString()}
                  </p>
                )}
                {s.lastError && <p className="error">{s.lastError}</p>}
                <button
                  disabled={busy || !s.approved}
                  onClick={() =>
                    void command({
                      action: "fetch",
                      id: s.id,
                      version: s.version,
                    })
                  }
                >
                  Fetch now
                </button>
                {reason(s.id)}
                <button
                  className="secondary"
                  disabled={busy || (reasons[s.id] ?? "").trim().length < 5}
                  onClick={() =>
                    void command({
                      action: "source",
                      id: s.id,
                      version: s.version,
                      approved: !s.approved,
                      reason: reasons[s.id],
                    })
                  }
                >
                  {s.approved ? "Suspend source" : "Approve source"}
                </button>
              </article>
            ))}
          </div>
          <h2>Fetched items</h2>
          {!data.items.length && (
            <p className="empty">No feed items have been fetched.</p>
          )}
          <div className="news-grid">
            {data.items.map((i) => (
              <article className="news-card" key={i.id}>
                <p className="eyebrow">{i.publisher}</p>
                <h3>
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    {i.title} ↗
                  </a>
                </h3>
                <p>
                  {i.hidden
                    ? "Hidden from public news"
                    : "Visible when its source is approved"}
                </p>
                {reason(i.id)}
                <button
                  className="secondary"
                  disabled={busy || (reasons[i.id] ?? "").trim().length < 5}
                  onClick={() =>
                    void command({
                      action: "item",
                      id: i.id,
                      version: i.version,
                      hidden: !i.hidden,
                      reason: reasons[i.id],
                    })
                  }
                >
                  {i.hidden ? "Restore item" : "Hide item"}
                </button>
              </article>
            ))}
          </div>
          <h2>Recent fetch attempts</h2>
          {!data.attempts.length ? (
            <p className="muted">No attempts recorded.</p>
          ) : (
            <ul>
              {data.attempts.slice(0, 20).map((a, index) => (
                <li key={index}>
                  {new Date(a.createdAt).toLocaleString()} · {a.state} ·{" "}
                  {a.itemCount} new items{a.error ? ` · ${a.error}` : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
