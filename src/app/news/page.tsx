"use client";
import { useEffect, useState } from "react";
type Feed = {
  items: {
    id: string;
    title: string;
    publisher: string;
    publishedAt: string;
    excerpt: string;
    url: string;
  }[];
  sources: {
    id: string;
    publisher: string;
    lastSuccessAt: string | null;
    failed: boolean;
    stale: boolean;
  }[];
  refreshedAt: string;
};
export default function News() {
  const [data, setData] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/v1/public/news", { cache: "no-store" });
      if (!r.ok)
        throw new Error("News is temporarily unavailable. Try again shortly.");
      setData(await r.json());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <main id="main" className="news-page">
      <p className="eyebrow">From the publishers</p>
      <h1>Curling news</h1>
      <p className="lead">
        Headlines and short supplied excerpts from approved external feeds. Read
        each story at its original publisher.
      </p>
      <button className="secondary" disabled={busy} onClick={() => void load()}>
        {busy ? "Refreshing…" : "Refresh news"}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Loading approved news…</p>}
      {data && (
        <>
          <p className="muted">
            Page refreshed{" "}
            {new Date(data.refreshedAt).toLocaleString("en-CA", {
              timeZone: "UTC",
            })}{" "}
            UTC
          </p>
          {data.sources.some((s) => s.failed || s.stale) && (
            <div className="notice" role="status">
              Some sources have not refreshed successfully in the last 24 hours.
              Previously fetched stories may remain available.
            </div>
          )}
          {data.items.length ? (
            <div className="news-grid">
              {data.items.map((item) => (
                <article className="news-card" key={item.id}>
                  <p className="eyebrow">{item.publisher}</p>
                  <p className="muted">
                    <time dateTime={item.publishedAt}>
                      {new Date(item.publishedAt).toLocaleDateString("en-CA", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      })}
                    </time>{" "}
                    · Publisher date (UTC)
                  </p>
                  <h2>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.title}
                    </a>
                  </h2>
                  {item.excerpt && <p>{item.excerpt}</p>}
                  <a
                    className="news-original"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read at {item.publisher} ↗
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>No news available yet</h2>
              <p>
                Approved sources will appear here after a successful fetch. No
                stories have been invented to fill this page.
              </p>
            </div>
          )}
          <section aria-label="Source freshness">
            <h2>Source updates</h2>
            {data.sources.length ? (
              <ul>
                {data.sources.map((s) => (
                  <li key={s.id}>
                    <strong>{s.publisher}</strong> —{" "}
                    {s.lastSuccessAt
                      ? `Last successful fetch ${new Date(s.lastSuccessAt).toLocaleString("en-CA", { timeZone: "UTC" })} UTC`
                      : "Never fetched"}
                    {s.failed
                      ? " · Latest fetch failed"
                      : s.stale
                        ? " · Awaiting fresh fetch"
                        : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No approved sources are configured.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
