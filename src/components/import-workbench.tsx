"use client";
import { useEffect, useRef, useState } from "react";
import { canonicalEntryCommand } from "@/domain/entries";
import {
  AuthorityRecovery,
  useAuthorityCommand,
  type RetainedAuthorityCommand,
} from "./authority-command";
type Job = {
  id: string;
  actorId: string;
  digest: string;
  status: string;
  attempts: number;
  uniqueGames: number;
  sourceRecords: number;
  evidenceRecords: number;
  issueCount: number;
  error: string | null;
  updatedAt: string;
  manifest: Record<string, unknown> | null;
};
type Game = {
  id: string;
  entryIds: string[];
  entryNames: string[];
  ends: number[][] | null;
  totals: number[] | null;
  completeness: string;
  firstEndHammer: {
    entryId: string;
    basis: string;
    interpretationId: string;
  } | null;
  lineups: ({
    completeness: string;
    person_ids: string[];
    deliveries: unknown;
  } | null)[];
  drawId: string | null;
  sourceDrawId: string;
  issues: string[];
};
type Catalog = {
  actorId: string;
  source: { available: boolean; digest: string | null };
  jobs: Job[];
};
type Batch = {
  actorId: string;
  job: Job;
  receipts: {
    requestId: string;
    jobId: string;
    actorId: string;
    commandDigest: string;
  }[];
  games: Game[];
  issues: { sourceKey: string; code: string; detail: string }[];
  records: { key: string; kind: string; lineDigest: string }[];
  attempts: { action: string; createdAt: string; evidence: unknown }[];
};
async function get<T>(q = ""): Promise<T> {
  const r = await fetch("/api/v1/imports" + q, { cache: "no-store" });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error ?? "Historical staging could not be loaded.");
  return data;
}
export function ImportWorkbench() {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [batch, setBatch] = useState<Batch | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [record, setRecord] = useState<{
      key: string;
      kind: string;
      payload: unknown;
      lineDigest: string;
    } | null>(null);
  const review = useRef<HTMLElement>(null),
    sourceView = useRef<HTMLElement>(null),
    pendingFocus = useRef(false);
  async function load() {
    try {
      setCatalog(await get<Catalog>());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function show(id: string, focus = true) {
    try {
      const b = await get<Batch>(`?job=${encodeURIComponent(id)}`);
      setBatch(b);
      setRecord(null);
      setError("");
      if (focus) {
        pendingFocus.current = true;
      }
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }
  async function recorded(saved: RetainedAuthorityCommand) {
    if (saved.path !== "/api/v1/imports") return null;
    const v = JSON.parse(saved.body);
    if (typeof v.id !== "string") return null;
    const b = await get<Batch>(`?job=${encodeURIComponent(v.id)}`);
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonicalEntryCommand(v)),
    );
    const digest = Array.from(new Uint8Array(bytes), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
    if (
      b.actorId !== saved.actorId ||
      b.job.actorId !== saved.actorId ||
      b.job.id !== v.id ||
      b.job.digest !== v.sourceDigest ||
      !b.receipts.some(
        (r) =>
          r.requestId === (v.requestId ?? v.id) &&
          r.jobId === v.id &&
          r.actorId === saved.actorId &&
          r.commandDigest === digest,
      )
    )
      return null;
    return b;
  }
  async function accepted(saved: RetainedAuthorityCommand) {
    const b = await recorded(saved);
    if (!b)
      throw new Error(
        "The recorded import does not match the original account and complete command.",
      );
    setBatch(b);
    setRecord(null);
    setError("");
    pendingFocus.current = true;
    await load();
  }
  const command = useAuthorityCommand(
    catalog ? `wcp-import:${catalog.actorId}` : null,
    catalog?.actorId,
    accepted,
    async (saved) => {
      const b = await recorded(saved);
      if (!b) return false;
      setBatch(b);
      setRecord(null);
      setError("");
      pendingFocus.current = true;
      await load();
      return true;
    },
  );
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (batch && pendingFocus.current) {
      review.current?.focus();
      pendingFocus.current = false;
    }
  }, [batch]);
  useEffect(() => {
    if (!batch || !["queued", "running"].includes(batch.job.status)) return;
    let alive = true;
    const timer = setInterval(async () => {
      try {
        const b = await get<Batch>(`?job=${batch.job.id}`);
        if (alive) {
          setBatch(b);
          setError("");
          if (!["queued", "running"].includes(b.job.status)) void load();
        }
      } catch (e) {
        if (alive)
          setError(
            "Progress could not be refreshed. The last recorded state is shown; refresh to recover.",
          );
      }
    }, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [batch?.job.id, batch?.job.status]);
  async function inspect(key: string) {
    try {
      setRecord(
        await get(`?job=${batch!.job.id}&record=${encodeURIComponent(key)}`),
      );
      setError("");
      setTimeout(() => sourceView.current?.focus(), 0);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main id="main" className="workspace import-workbench">
      <p className="eyebrow">World Curling administration</p>
      <h1>Historical import staging</h1>
      <p>
        <a href="/admin">Your workspace</a>
      </p>
      <p className="notice">
        Historical source observations remain private until a separate batch
        approval. Staging publishes nothing and grants no scorekeeper
        certification, permanent team identity or verified participation.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <AuthorityRecovery state={command} label="import" />
      {loading ? (
        <p role="status">Loading configured export and staging history…</p>
      ) : (
        catalog && (
          <>
            <section className="form-card" aria-labelledby="configured-export">
              <h2 id="configured-export">Configured consistent export</h2>
              {catalog.source.available ? (
                <>
                  <p>Export SHA-256</p>
                  <code className="import-key">{catalog.source.digest}</code>
                  <p>
                    Creates a new review batch from the operator’s frozen
                    export. Evidence records are separate from unique games.
                  </p>
                  <button
                    disabled={command.locked}
                    onClick={() =>
                      void command.submit(
                        "/api/v1/imports",
                        {
                          action: "stage",
                          id: crypto.randomUUID(),
                          sourceDigest: catalog.source.digest,
                        },
                        "Staging job recorded. Its progress and frozen contents appear below.",
                      )
                    }
                  >
                    Stage configured export
                  </button>
                </>
              ) : (
                <p className="empty">
                  No consistent export is available. An operator must configure
                  the frozen export before staging.
                </p>
              )}
            </section>
            <section aria-labelledby="staging-history">
              <h2 id="staging-history">Staging history</h2>
              {!catalog.jobs.length ? (
                <p className="empty">No imports have been staged.</p>
              ) : (
                <details>
                  <summary>
                    Browse staging history ({catalog.jobs.length} recent jobs)
                  </summary>
                  <ul className="workspace-list">
                    {catalog.jobs.map((j) => (
                      <li key={j.id}>
                        <strong>
                          {j.status === "staged"
                            ? "Frozen review batch"
                            : j.status === "failed"
                              ? "Failed staging job"
                              : j.status === "running"
                                ? "Reading and validating export"
                                : "Queued for worker"}
                        </strong>
                        <code className="import-key">{j.id}</code>
                        <p>
                          {j.uniqueGames} unique games · {j.issueCount} retained
                          issues
                        </p>
                        <button
                          className="secondary"
                          onClick={() => void show(j.id).catch(() => {})}
                          aria-label={`Review batch ${j.id}`}
                        >
                          Review batch
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          </>
        )
      )}
      <button
        className="secondary"
        disabled={command.busy}
        onClick={() => {
          void load();
          if (batch) void show(batch.job.id, false).catch(() => {});
        }}
      >
        Refresh import state
      </button>
      {batch && (
        <section
          ref={review}
          tabIndex={-1}
          role="region"
          aria-label="Import batch review"
          data-job-id={batch.job.id}
        >
          <h2>Batch review</h2>
          <p role="status">
            {batch.job.status === "staged"
              ? "Frozen for review · private staging"
              : batch.job.status === "failed"
                ? "Staging failed · no batch contents committed"
                : batch.job.status === "running"
                  ? "Reading and validating export · contents are not yet frozen"
                  : "Queued · waiting for the background worker"}
          </p>
          <dl>
            <dt>Batch identifier</dt>
            <dd className="import-key">{batch.job.id}</dd>
            <dt>Exact export SHA-256</dt>
            <dd className="import-key">{batch.job.digest}</dd>
            <dt>Last recorded progress</dt>
            <dd>
              {new Date(batch.job.updatedAt).toLocaleString()} · attempt{" "}
              {batch.job.attempts}
            </dd>
          </dl>
          {batch.job.status === "failed" && (
            <>
              <p className="error">{batch.job.error}</p>
              <button
                disabled={command.locked}
                onClick={() =>
                  void command.submit(
                    "/api/v1/imports",
                    {
                      action: "retry",
                      id: batch.job.id,
                      sourceDigest: batch.job.digest,
                      requestId: crypto.randomUUID(),
                    },
                    "Retry recorded for this exact import batch.",
                  )
                }
              >
                Retry this staging job
              </button>
            </>
          )}
          {batch.job.status === "staged" && (
            <>
              <p>
                {batch.job.uniqueGames} unique games · {batch.job.sourceRecords}{" "}
                source records · {batch.job.evidenceRecords} evidence records
              </p>
              <p>
                {batch.job.issueCount} retained quality issues. Evidence counts
                are not unique game counts.
              </p>
              <h3>Game previews</h3>
              {batch.games.map((g) => (
                <article key={g.id} className="form-card">
                  <h4>{g.entryNames.join(" v ")}</h4>
                  <code className="import-key">{g.id}</code>
                  <p>
                    <strong>
                      {g.completeness === "complete_line_score"
                        ? "Complete line score"
                        : g.completeness === "final_score_only"
                          ? "Final score only"
                          : "Score unavailable"}
                    </strong>
                    {g.totals && (
                      <>
                        {" "}
                        · <span>{g.totals.join("–")}</span>
                      </>
                    )}
                  </p>
                  {g.ends && (
                    <div
                      className="table-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label={`Line score ${g.id}`}
                    >
                      <table>
                        <caption>Reported end scores</caption>
                        <thead>
                          <tr>
                            <th scope="col">Entry</th>
                            {g.ends.map((_, i) => (
                              <th scope="col" key={i}>
                                {i + 1}
                              </th>
                            ))}
                            <th scope="col">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.entryNames.map((n, side) => (
                            <tr key={g.entryIds[side]}>
                              <th scope="row">{n}</th>
                              {g.ends!.map((e, i) => (
                                <td key={i}>{e[side]}</td>
                              ))}
                              <td>{g.totals![side]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p>
                    {g.firstEndHammer
                      ? `Reported first-end hammer: ${g.entryNames[g.entryIds.indexOf(g.firstEndHammer.entryId)]} · retained marker with same-game publisher corroboration`
                      : "First-end hammer unknown"}
                  </p>
                  <p>
                    Permanent core unresolved · player identities unresolved ·
                    no human certification.
                  </p>
                  <p>
                    Lineups:{" "}
                    {g.lineups
                      .map((l) =>
                        l
                          ? `${l.completeness} (${l.person_ids.length} listed people; stone delivery unverified)`
                          : "unknown",
                      )
                      .join(" / ")}
                    . Source draw {g.sourceDrawId}; canonical draw{" "}
                    {g.drawId ?? "unknown"}.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => void inspect(g.id)}
                    aria-label={`Inspect source ${g.id}`}
                  >
                    Inspect frozen source
                  </button>
                  {g.firstEndHammer && (
                    <button
                      className="secondary"
                      onClick={() =>
                        void inspect(g.firstEndHammer!.interpretationId)
                      }
                    >
                      Inspect hammer interpretation
                    </button>
                  )}
                </article>
              ))}
              <h3>Retained quality issues</h3>
              <p>
                Preview shows up to 100 games and 1,000 issues and record
                digests. Batch counts describe the complete frozen contents.
              </p>
              <ul>
                {Object.entries(
                  batch.issues.reduce<Record<string, number>>((counts, i) => {
                    counts[i.code] = (counts[i.code] ?? 0) + 1;
                    return counts;
                  }, {}),
                ).map(([code, count]) => (
                  <li key={code}>
                    {code.replaceAll("_", " ")}: {count}
                  </li>
                ))}
              </ul>
              <details>
                <summary>Inspect individual quality issues</summary>
                <ul className="workspace-list">
                  {batch.issues.map((i) => (
                    <li key={i.sourceKey + i.code}>
                      <strong>{i.code.replaceAll("_", " ")}</strong>
                      <code className="import-key">{i.sourceKey}</code>
                      <p>{i.detail}</p>
                    </li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>Frozen source manifest and record digests</summary>
                <pre tabIndex={0}>
                  {JSON.stringify(batch.job.manifest, null, 2)}
                </pre>
                <ul>
                  {batch.records.map((r) => (
                    <li key={r.key}>
                      <button
                        className="secondary import-key"
                        onClick={() => void inspect(r.key)}
                      >
                        {r.kind}: {r.key}
                      </button>
                      <code className="import-key">{r.lineDigest}</code>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
          <details>
            <summary>Job audit history</summary>
            <ul>
              {batch.attempts.map((a, i) => (
                <li key={i}>
                  {a.action.replaceAll("_", " ")} ·{" "}
                  {new Date(a.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
      {record && (
        <section
          ref={sourceView}
          tabIndex={-1}
          role="region"
          aria-label="Frozen source record"
        >
          <h2>Frozen source record</h2>
          <code className="import-key">{record.key}</code>
          <p>
            Record SHA-256:{" "}
            <code className="import-key">{record.lineDigest}</code>
          </p>
          <pre tabIndex={0}>{JSON.stringify(record.payload, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
