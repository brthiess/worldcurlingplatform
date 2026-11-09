"use client";
import { useEffect, useRef, useState } from "react";
import {
  AuthorityRecovery,
  useAuthorityCommand,
  type RetainedAuthorityCommand,
} from "./authority-command";
import { candidateClassification } from "@/domain/identity-corrections";
type Player = {
  id: string;
  name: string;
  identityStatus: string;
  origin: string;
  contexts: string[];
};
type Entry = {
  id: string;
  name: string;
  version: number;
  core: { playerId: string; name: string }[];
  lineup: { members: { playerId: string; name: string; role: string }[] };
};
type Receipt = {
  id: string;
  actorId: string;
  requestId: string;
  commandDigest: string;
  entryId: string;
  reviewedVersion: number;
  fromPlayerId: string;
  toPlayerId: string;
  reason: string;
  source: string;
  outcome: string;
  notice: string;
  createdAt: string;
  people: { id: string; name: string }[];
  collisions: { kind: string; ids: string[]; message: string }[];
  after: { version: number } | null;
};
type Workspace = {
  actorId: string;
  entries: {
    id: string;
    name: string;
    version: number;
    eventName: string;
    divisionName: string;
  }[];
  records: Receipt[];
};
async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-store" });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error ?? "The current records could not be loaded.");
  return data;
}
export function IdentityCorrections() {
  const outcomeRef = useRef<HTMLElement>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [players, setPlayers] = useState<Player[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null),
    [selectedId, setSelectedId] = useState(""),
    [entryLoading, setEntryLoading] = useState(false),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [query, setQuery] = useState(""),
    [reason, setReason] = useState(""),
    [source, setSource] = useState(""),
    [result, setResult] = useState<Receipt | null>(null),
    [stale, setStale] = useState(false);
  async function load() {
    const [w, p] = await Promise.all([
      get<Workspace>("/api/v1/identity-corrections"),
      get<Player[]>("/api/v1/public/players"),
    ]);
    setWorkspace(w);
    setPlayers(p);
    setError("");
  }
  async function receipt(saved: RetainedAuthorityCommand) {
    const body = JSON.parse(saved.body);
    const r = await get<Receipt>(
      `/api/v1/identity-corrections?requestId=${body.requestId}`,
    );
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(saved.body),
    );
    const digest = Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (r.actorId !== saved.actorId || r.commandDigest !== digest)
      throw new Error("The receipt does not match this original command.");
    setResult(r);
    setSelectedId(r.entryId);
    await load();
    if (r.outcome === "applied") {
      setEntry(await get<Entry>(`/api/v1/entries/${r.entryId}`));
      setFrom("");
      setTo("");
      setReason("");
      setSource("");
    }
    return true;
  }
  const recovery = useAuthorityCommand(
    workspace ? `wcp-identity-correction:${workspace.actorId}` : null,
    workspace?.actorId,
    async (saved) => {
      await receipt(saved);
    },
    receipt,
    (status) => {
      if (status === 409) setStale(true);
    },
  );
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (result) {
      outcomeRef.current?.focus();
    }
  }, [result]);
  async function select(id: string) {
    setSelectedId(id);
    setEntry(null);
    setFrom("");
    setTo("");
    setResult(null);
    setStale(false);
    setError("");
    if (!id) return;
    setEntryLoading(true);
    try {
      setEntry(await get<Entry>(`/api/v1/entries/${id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEntryLoading(false);
    }
  }
  const matches = query.trim()
    ? players.filter(
        (p) =>
          p.name
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()) ||
          p.id === query.trim(),
      )
    : [];
  const selected = players.find((p) => p.id === to),
    members = entry
      ? [
          ...new Map(
            [...entry.core, ...entry.lineup.members].map((p) => [
              p.playerId,
              p,
            ]),
          ).values(),
        ]
      : [];
  const locked = recovery.locked || entryLoading;
  return (
    <main id="main" className="workspace">
      <p className="eyebrow">World Curling staff</p>
      <h1>Factual player selection corrections</h1>
      <p>
        Repair a mistaken sport record in one current event entry. A real
        permanent core change belongs in{" "}
        <a href="/admin/entries">Team entries</a>. Previous cores, registered
        season rosters, confirmed game lineups and approved ranking evidence
        remain preserved. Account links and representative grants do not
        transfer.
      </p>
      {loading ? (
        <p role="status">Loading correction workspace…</p>
      ) : (
        <>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!workspace ? (
            <p>
              <a href="/admin">Sign in with World Curling staff authority</a>
            </p>
          ) : (
            <>
              <AuthorityRecovery state={recovery} label="identity correction" />
              {result && (
                <section
                  className="notice"
                  aria-label="Correction outcome"
                  ref={outcomeRef}
                  tabIndex={-1}
                >
                  <h2>
                    {result.outcome === "issue"
                      ? "Unresolved identity issue"
                      : "Factual correction recorded"}
                  </h2>
                  <p>{result.notice}</p>
                  <p>
                    Receipt {result.id} · reviewed entry revision{" "}
                    {result.reviewedVersion}
                    {result.after
                      ? ` → ${result.after.version}`
                      : " · entry unchanged"}
                  </p>
                  {result.collisions.map((c) => (
                    <p key={c.kind}>
                      <strong>{c.kind.replaceAll("_", " ")}</strong>:{" "}
                      {c.message} Records: {c.ids.join(", ")}
                    </p>
                  ))}
                </section>
              )}
              <form
                className="form-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!entry || stale) return;
                  setResult(null);
                  void recovery.submit(
                    "/api/v1/identity-corrections",
                    {
                      requestId: crypto.randomUUID(),
                      entryId: entry.id,
                      version: entry.version,
                      fromPlayerId: from,
                      toPlayerId: to,
                      reason,
                      source,
                    },
                    "Correction request recorded. Review its outcome below.",
                  );
                }}
              >
                <fieldset
                  disabled={locked}
                  style={{ border: 0, padding: 0, minWidth: 0 }}
                >
                  <legend>Review a factual selection</legend>
                  <label htmlFor="correction-entry">Affected entry</label>
                  <select
                    id="correction-entry"
                    value={selectedId}
                    onChange={(e) => void select(e.target.value)}
                    required
                  >
                    <option value="">Choose an entry</option>
                    {workspace.entries.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.eventName} · {e.divisionName} · revision{" "}
                        {e.version}
                      </option>
                    ))}
                  </select>
                  {entryLoading && (
                    <p role="status">Loading the current entry…</p>
                  )}
                  {entry && (
                    <>
                      <p>
                        Reviewing {entry.name}, revision {entry.version} ·{" "}
                        <a href={`/entries/${entry.id}`}>
                          Public entry history
                        </a>
                      </p>
                      <label htmlFor="mistaken-player">
                        Mistaken player record
                      </label>
                      <select
                        id="mistaken-player"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        required
                      >
                        <option value="">Choose the incorrect record</option>
                        {members.map((m) => (
                          <option key={m.playerId} value={m.playerId}>
                            {m.name} · {m.playerId}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="correct-player-search">
                        Search replacement players
                      </label>
                      <input
                        id="correct-player-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query.trim() && (
                        <>
                          <p role="status">
                            {candidateClassification(query, matches) ===
                            "ambiguous"
                              ? "Several possible records. Compare context and explicitly choose one."
                              : matches.length
                                ? "Possible record only. A name is not proof of identity."
                                : "No matching records."}
                          </p>
                          <ul className="search-results">
                            {matches.slice(0, 12).map((p) => (
                              <li key={p.id}>
                                <p>
                                  <strong>{p.name}</strong> · {p.identityStatus}{" "}
                                  · {p.origin}
                                </p>
                                <p style={{ overflowWrap: "anywhere" }}>
                                  {p.id} ·{" "}
                                  {p.contexts.join("; ") ||
                                    "No public event context recorded"}
                                </p>
                                <button
                                  type="button"
                                  className="secondary"
                                  aria-label={`Select ${p.name} (${p.id})`}
                                  onClick={() => setTo(p.id)}
                                >
                                  Select record
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      <p>
                        If identity remains uncertain,{" "}
                        <a href="/admin/entries">
                          declare a provisional player in the entry editor
                        </a>{" "}
                        for later review. Equal names never authorize a merge.
                      </p>
                      <p aria-live="polite">
                        Proposed replacement:{" "}
                        {selected
                          ? `${selected.name} · ${selected.id} · ${selected.identityStatus}`
                          : "No replacement selected"}
                      </p>
                      <label htmlFor="correction-reason">
                        Factual correction reason
                      </label>
                      <textarea
                        id="correction-reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                        maxLength={1000}
                      />
                      <label htmlFor="correction-source">Source evidence</label>
                      <textarea
                        id="correction-source"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        required
                        maxLength={1000}
                      />
                      {stale && (
                        <p className="error" role="alert">
                          The reviewed entry is stale. Reload the current entry
                          and review again.
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={!from || !to || from === to || stale}
                      >
                        Record factual correction
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => void select(entry.id)}
                      >
                        Reload current entry
                      </button>
                    </>
                  )}
                  {!workspace.entries.length && (
                    <p className="empty">
                      No recorded entry lineups are available to correct.
                    </p>
                  )}
                </fieldset>
              </form>
              <h2>Correction and unresolved issue history</h2>
              {!workspace.records.length ? (
                <p className="empty">
                  No factual corrections or identity issues recorded.
                </p>
              ) : (
                <ul className="workspace-list">
                  {workspace.records.map((r) => (
                    <li key={r.id} style={{ overflowWrap: "anywhere" }}>
                      <h3>
                        {r.outcome === "issue"
                          ? "Unresolved identity issue"
                          : "Factual correction"}
                      </h3>
                      <p>
                        {r.entryId} · revision {r.reviewedVersion} ·{" "}
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                      <p>
                        {r.people.find((p) => p.id === r.fromPlayerId)?.name} (
                        {r.fromPlayerId}) →{" "}
                        {r.people.find((p) => p.id === r.toPlayerId)?.name} (
                        {r.toPlayerId})
                      </p>
                      <p>Reason: {r.reason}</p>
                      <p>Source: {r.source}</p>
                      <p>{r.notice}</p>
                      {r.collisions.map((c) => (
                        <p key={c.kind}>
                          {c.kind.replaceAll("_", " ")}: {c.message}{" "}
                          {c.ids.join(", ")}
                        </p>
                      ))}
                      <details>
                        <summary>Audit receipt</summary>
                        <p>
                          {r.id} · actor {r.actorId} · request {r.requestId}
                        </p>
                        <p>Command SHA-256 {r.commandDigest}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
