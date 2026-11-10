"use client";
import { useEffect, useRef, useState } from "react";
import { RankingList } from "./ranking-list";
import { useAuthorityCommand, AuthorityRecovery } from "./authority-command";
import { canonicalJson } from "@/domain/canonical-json";
import type {
  PublicRankingList,
  comparePublication,
} from "@/domain/ranking-publication";
type Publication = {
  id: string;
  runId: string;
  producer: string;
  version: number;
  effectiveDate: string;
  publicDigest: string;
  privateDigest: string;
  evidence: { manifestDigest: string; resultDigest: string };
  data: PublicRankingList;
};
type Workspace = {
  actorId: string;
  runs: {
    id: string;
    discipline: string;
    effectiveDate: string;
    version: number;
    state: string;
  }[];
  receipts: {
    actorId: string;
    requestId: string;
    commandDigest: string;
    publicationId: string;
    action: string;
    path: string;
  }[];
  runId?: string;
  manifestDigest?: string;
  resultDigest?: string;
  data?: PublicRankingList;
  result?: { state: string; issues: string[]; warnings: string[] };
  blockers?: string[];
  version?: number;
  previous?: Publication | null;
  compared?: Publication | null;
  published?: Publication | null;
  comparison?: ReturnType<typeof comparePublication>;
};
const path = "/api/v1/ranking-publications";
async function read<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" }),
    data = await r.json();
  if (!r.ok)
    throw new Error(data.error ?? "Publication review could not be loaded.");
  return data;
}
export function RankingPublicationWorkbench() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [runId, setRunId] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [dismissedError, setDismissedError] = useState<string | null>(null),
    [stale, setStale] = useState(false),
    [ack, setAck] = useState<string[]>([]),
    [note, setNote] = useState("");
  const lastRejection = useRef<string | null>(null);
  async function load(id = runId, recovery = false) {
    setLoading(true);
    try {
      const next = await read<Workspace>(
        id ? `${path}?producer=overall&run=${encodeURIComponent(id)}` : path,
      );
      setWorkspace(next);
      setRunId(id);
      setAck([]);
      setError("");
      setStale(false);
      if (!command.pending && command.error === lastRejection.current)
        setDismissedError(command.error);
      return next;
    } catch (e) {
      setError((e as Error).message);
      setStale(true);
      if (recovery) throw e;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load("", false);
  }, []);
  const command = useAuthorityCommand(
    workspace?.actorId
      ? `ranking-publication-command:${workspace.actorId}`
      : null,
    workspace?.actorId,
    async (saved) => {
      const b = JSON.parse(saved.body);
      await load(b.runId, true);
      setNote("");
    },
    async (pending) => {
      const b = JSON.parse(pending.body);
      if (
        pending.actorId !== workspace?.actorId ||
        pending.path !== path ||
        !["approve", "replay"].includes(b.action) ||
        b.producer !== "overall" ||
        typeof b.requestId !== "string" ||
        typeof b.runId !== "string"
      )
        return false;
      const current = await read<Workspace>(path);
      if (current.actorId !== pending.actorId) return false;
      const bytes = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(canonicalJson(b)),
        ),
        digest = Array.from(new Uint8Array(bytes), (x) =>
          x.toString(16).padStart(2, "0"),
        ).join("");
      const receipt = current.receipts.find(
        (r) =>
          r.actorId === pending.actorId &&
          r.requestId === b.requestId &&
          r.action === b.action &&
          r.path === pending.path &&
          r.commandDigest === digest,
      );
      if (!receipt) return false;
      const approved = await read<Publication>(
        `${path}?id=${receipt.publicationId}`,
      );
      if (approved.runId !== b.runId || approved.producer !== b.producer)
        return false;
      if (
        b.action === "approve"
          ? approved.version !== b.version + 1 ||
            approved.evidence.manifestDigest !== b.manifestDigest ||
            approved.evidence.resultDigest !== b.resultDigest
          : approved.id !== b.publicationId ||
            approved.publicDigest !== b.publicDigest ||
            approved.privateDigest !== b.privateDigest
      )
        return false;
      await load(b.runId, true);
      return true;
    },
    (status, message) => {
      lastRejection.current = message;
      setDismissedError(null);
      if (status === 409 || status === 422) setStale(true);
    },
  );
  useEffect(() => {
    if (command.pending) setRunId(JSON.parse(command.pending.body).runId);
  }, [command.pending]);
  const locked = loading || command.locked,
    warnings = [...new Set(workspace?.result?.warnings ?? [])],
    blockers = [
      ...(workspace?.blockers ?? []),
      ...(workspace?.result?.issues ?? []),
    ];
  async function approve(event: React.FormEvent) {
    event.preventDefault();
    if (!workspace?.data) return;
    await command.submit(
      path,
      {
        action: "approve",
        producer: "overall",
        runId,
        manifestDigest: workspace.manifestDigest,
        resultDigest: workspace.resultDigest,
        version: workspace.version,
        previousId: workspace.previous?.id ?? null,
        comparedId: workspace.compared?.id ?? null,
        acknowledged: ack,
        note,
        requestId: crypto.randomUUID(),
      },
      "Approved publication saved; its exact frozen list is now public.",
    );
  }
  return (
    <main id="main" className="workspace publication-page">
      <p className="eyebrow">World Curling administration</p>
      <h1>Review & publish rankings</h1>
      <p>
        <a href="/admin/overall-rankings">Calculate an overall draft</a> ·{" "}
        <a href="/rankings">Open approved public lists</a>
      </p>
      <p className="notice">
        Synthetic review environment. Approval releases this exact calculated
        list. Imported observations remain separate; an informational
        acknowledgement never waives calculation or eligibility evidence.
      </p>
      <AuthorityRecovery
        state={{
          ...command,
          error:
            !command.pending && command.error === dismissedError
              ? ""
              : command.error,
        }}
        label="publication"
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {stale && (
        <p className="notice" role="status">
          This review is stale. Reload current publication review before
          approving.
        </p>
      )}
      {loading && <p role="status">Loading publication review…</p>}
      <div className="publication-filters">
        <label>
          Calculated draft
          <select
            value={runId}
            disabled={locked}
            onChange={(e) => void load(e.target.value)}
          >
            <option value="">Choose an exact draft</option>
            {workspace?.runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.effectiveDate} · {r.discipline.replaceAll("_", " ")} · draft{" "}
                {r.version} · {r.state} · {r.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          disabled={loading || command.busy}
          onClick={() => void load()}
        >
          Reload current publication review
        </button>
      </div>
      {workspace && !workspace.runs.length && (
        <p className="empty">
          No calculated drafts exist. Calculate a sourced draft before reviewing
          a publication.
        </p>
      )}
      {workspace?.data && (
        <section aria-label="Publication comparison">
          <div className="publication-heading">
            <div>
              <span className="status">
                {workspace.published
                  ? "Published · exact approved history"
                  : `Private ${workspace.result?.state} draft`}
              </span>
              <h2>{workspace.data.title}</h2>
              <p>
                Effective {workspace.data.effectiveDate} ·{" "}
                {workspace.published
                  ? "publication time retained in the approved record"
                  : "publication time will be recorded on approval"}
              </p>
              <p>
                Compared with{" "}
                {workspace.compared
                  ? `${workspace.compared.effectiveDate} · approved version ${workspace.compared.version}`
                  : "no earlier approved publication (first list)"}
                .
              </p>
            </div>
          </div>
          {blockers.length > 0 && (
            <div
              className={workspace.published ? "notice" : "error"}
              role={workspace.published ? "status" : "alert"}
            >
              <h3>
                {workspace.published
                  ? "Current-source differences"
                  : "Publication blocked"}
              </h3>
              <ul>
                {blockers.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <p>
                {workspace.published
                  ? "The exact approved snapshot remains unchanged. A new approval requires a fresh complete draft."
                  : "Resolve required evidence and calculate a fresh draft. These issues cannot be acknowledged."}
              </p>
            </div>
          )}
          <RankingList
            data={workspace.published?.data ?? workspace.data}
            comparison={workspace.published ? undefined : workspace.comparison}
          />
          {workspace.published ? (
            <p className="notice" role="status">
              Published as approved version {workspace.published.version}.{" "}
              <a href={`/rankings?publication=${workspace.published.id}`}>
                Open this exact approved publication
              </a>
            </p>
          ) : (
            <form className="form-card" onSubmit={approve}>
              <h2>Approve this exact list</h2>
              <fieldset disabled={locked || stale || blockers.length > 0}>
                <legend>Informational acknowledgements</legend>
                {warnings.length === 0 ? (
                  <p>No informational issues need acknowledgement.</p>
                ) : (
                  warnings.map((w) => (
                    <label className="publication-ack" key={w}>
                      <input
                        type="checkbox"
                        checked={ack.includes(w)}
                        onChange={(e) =>
                          setAck(
                            e.target.checked
                              ? [...ack, w]
                              : ack.filter((x) => x !== w),
                          )
                        }
                      />
                      <span>{w}</span>
                    </label>
                  ))
                )}
                <label>
                  Private approval rationale
                  <textarea
                    required
                    maxLength={4000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <p>
                  Totals, contributions and comparison are frozen. This does not
                  certify an official World Curling release.
                </p>
                <button
                  disabled={
                    !note.trim() || warnings.some((w) => !ack.includes(w))
                  }
                >
                  Approve & publish exact list
                </button>
              </fieldset>
            </form>
          )}
          <details className="publication-digest">
            <summary>Private frozen draft evidence</summary>
            <p>Run: {runId}</p>
            <p>Input manifest: {workspace.manifestDigest}</p>
            <p>Calculated output: {workspace.resultDigest}</p>
            <p>
              <a
                href={`${path}?producer=overall&run=${encodeURIComponent(runId)}`}
              >
                Inspect authenticated complete review evidence
              </a>
            </p>
          </details>
        </section>
      )}
    </main>
  );
}
