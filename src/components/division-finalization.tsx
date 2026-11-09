"use client";
import { canonicalJson } from "@/domain/canonical-json";
import { finalizationCommand } from "@/domain/finalization-command";
import { useCallback, useEffect, useState } from "react";
import { useAuthorityCommand, AuthorityRecovery } from "./authority-command";
type Entry = {
  id: string;
  name: string;
  version: number;
  lineup: {
    version: number;
    status: string;
    members: { playerId: string; name: string; participation: string }[];
  } | null;
};
type Game = {
  id: string;
  state: string;
  resultVersion: number | null;
  entryA: string;
  entryB: string;
  result: {
    winnerEntryId: string;
    outcome: string;
    totalA: number | null;
    totalB: number | null;
    lineupA?: { mode: string };
    lineupB?: { mode: string };
  } | null;
};
type Source = {
  division: {
    id: string;
    name: string;
    eventName: string;
    eventId: string;
    format: string;
    origin: string;
  };
  entries: Entry[];
  games: Game[];
};
type Revision = {
  version: number;
  replacesVersion: number | null;
  digest: string;
  contents: string;
  createdAt: string;
  finalizedBy: string;
  actorId: string;
  requestId?: string;
  visibility?: "public-sporting-projection";
  snapshotDigest?: string;
};
type Frozen = {
  source: Source;
  placements: { entryId: string; place: number }[];
  rulesReference: string;
  note: string;
};
type Review = {
  actorId?: string;
  receipts?: {
    actorId: string;
    requestId: string;
    divisionId: string;
    version: number;
    commandDigest: string;
    path: string;
  }[];
  source: Source;
  sourceDigest: string;
  version: number;
  dirty: boolean;
  prerequisites: string[];
  selected: Revision | null;
  history: Revision[];
  ranking?: {
    issues: { code: string; entryId?: string; message: string }[];
    note: string;
  };
};
type Division = { id: string; name: string; eventName: string };
function ResultRows({ source }: { source: Source }) {
  return (
    <ul className="workspace-list">
      {source.games.map((g) => (
        <li key={g.id}>
          <a href={`/games/${g.id}`}>
            {source.entries.find((e) => e.id === g.entryA)?.name ?? g.entryA} vs{" "}
            {source.entries.find((e) => e.id === g.entryB)?.name ?? g.entryB}
          </a>
          <p>
            {g.result
              ? `${g.result.outcome} · winner: ${source.entries.find((e) => e.id === g.result?.winnerEntryId)?.name ?? g.result.winnerEntryId} · result version ${g.resultVersion}`
              : `${g.state} · explicit outcome not recorded`}
          </p>
          {g.result && (
            <p className="muted">
              Game lineups: {g.result.lineupA?.mode ?? "not recorded"} /{" "}
              {g.result.lineupB?.mode ?? "not recorded"}. Declared or defaulted
              evidence does not certify stone delivery.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
function Snapshot({ revision }: { revision: Revision }) {
  const f = JSON.parse(revision.contents) as Frozen;
  return (
    <section
      aria-label={`Frozen revision ${revision.version}`}
      className="final-snapshot"
    >
      <h2>
        {revision.replacesVersion
          ? `Revision ${revision.version} · replaces revision ${revision.replacesVersion}`
          : `Original finalization · revision ${revision.version}`}
      </h2>
      <p>
        Recorded by {revision.finalizedBy} ·{" "}
        {new Date(revision.createdAt).toISOString()}
      </p>
      <ol className="final-placements">
        {f.placements.map((p) => (
          <li key={p.entryId}>
            <strong>Place {p.place}</strong>{" "}
            <a href={`/entries/${p.entryId}`}>
              {f.source.entries.find((e) => e.id === p.entryId)?.name ??
                p.entryId}
            </a>
          </li>
        ))}
      </ol>
      <p className="muted">
        Entry links open current details. The frozen event lineups below belong
        to this revision.
      </p>
      <details>
        <summary>Frozen event lineups</summary>
        {f.source.entries.map((entry) => (
          <section key={entry.id}>
            <h3>
              {entry.name} · entry version {entry.version}
            </h3>
            <p>
              Event lineup{" "}
              {entry.lineup
                ? `version ${entry.lineup.version} · ${entry.lineup.status}`
                : "not recorded"}
              . Declared/defaulted evidence does not certify stone delivery.
            </p>
            {entry.lineup?.members.length ? (
              <ul>
                {entry.lineup.members.map((m) => (
                  <li key={m.playerId}>
                    <a href={`/players/${m.playerId}`}>{m.name}</a> ·{" "}
                    {m.participation}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No event lineup members were recorded.</p>
            )}
          </section>
        ))}
      </details>
      <p>
        <strong>Competition rules:</strong> {f.rulesReference}
      </p>
      <p>{f.note}</p>
      <ResultRows source={f.source} />
      <p className="muted">
        {revision.visibility
          ? "Public sporting projection SHA-256"
          : "Exact snapshot SHA-256"}{" "}
        <code className="digest">{revision.digest}</code>
      </p>
      {revision.visibility && (
        <p className="muted">
          Original private snapshot SHA-256{" "}
          <code className="digest">{revision.snapshotDigest}</code>. The public
          sporting projection excludes internal audit, receipt and account
          identifiers; its bytes and digest are separate.
        </p>
      )}
      <details>
        <summary>
          {revision.visibility
            ? "Public sporting contents and lineup references"
            : "Exact frozen contents and entry lineup references"}
        </summary>
        <pre className="frozen-contents">{revision.contents}</pre>
      </details>
    </section>
  );
}
export function FinalizationWorkbench() {
  const [divisions, setDivisions] = useState<Division[]>([]),
    [actorId, setActorId] = useState<string>(),
    [id, setId] = useState(""),
    [review, setReview] = useState<Review | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [places, setPlaces] = useState<Record<string, string>>({}),
    [note, setNote] = useState(""),
    [rules, setRules] = useState(""),
    [historical, setHistorical] = useState<Revision | null>(null);
  const load = useCallback(async (division: string) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
          `/api/v1/division-finalizations?division=${encodeURIComponent(division)}`,
          { cache: "no-store" },
        ),
        data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Division could not be loaded.");
      const next = data as Review;
      setReview(next);
      setHistorical(null);
      const f = next.selected
        ? (JSON.parse(next.selected.contents) as Frozen)
        : null;
      setPlaces(
        Object.fromEntries(
          next.source.entries.map((e) => [
            e.id,
            String(f?.placements.find((p) => p.entryId === e.id)?.place ?? ""),
          ]),
        ),
      );
      setNote(f?.note ?? "");
      setRules(f?.rulesReference ?? "");
      return next;
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "Division review could not be loaded. Retry the current division."
          : (e as Error).message,
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  const workspace = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/v1/division-finalizations", {
          cache: "no-store",
        }),
        data = await r.json();
      if (!r.ok)
        throw new Error(data.error ?? "Workspace could not be loaded.");
      setDivisions(data.divisions);
      setActorId(data.actorId);
      const wanted = new URLSearchParams(window.location.search).get(
          "division",
        ),
        selected =
          data.divisions.find((d: Division) => d.id === wanted)?.id ??
          data.divisions[0]?.id ??
          "";
      setId(selected);
      if (selected) await load(selected);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    void workspace();
  }, [workspace]);
  const command = useAuthorityCommand(
    actorId && id ? `wcp027-finalization:${actorId}:${id}` : null,
    actorId,
    async () => {
      if (!(await load(id)))
        throw new Error("Saved view could not be refreshed.");
    },
    async (saved) => {
      const path = "/api/v1/division-finalizations";
      if (saved.path !== path || saved.actorId !== actorId) return false;
      const body = JSON.parse(saved.body);
      if (
        body.divisionId !== id ||
        !Number.isSafeInteger(body.version) ||
        typeof body.note !== "string" ||
        typeof body.rulesReference !== "string"
      )
        return false;
      const r = await fetch(
        `${path}?division=${encodeURIComponent(body.divisionId)}`,
        { cache: "no-store" },
      );
      if (!r.ok) return false;
      const data = (await r.json()) as Review;
      if (
        data.actorId !== saved.actorId ||
        data.source.division.id !== body.divisionId
      )
        return false;
      const commandDigest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(canonicalJson(finalizationCommand(body))),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (
        !data.receipts?.some(
          (v) =>
            v.actorId === saved.actorId &&
            v.requestId === body.requestId &&
            v.path === saved.path &&
            v.divisionId === body.divisionId &&
            v.version === body.version + 1 &&
            v.commandDigest === commandDigest &&
            data.history.some(
              (h) =>
                h.version === v.version &&
                h.actorId === v.actorId &&
                h.requestId === v.requestId,
            ),
        )
      )
        return false;
      const refreshed = await load(body.divisionId);
      return (
        !!refreshed &&
        refreshed.actorId === saved.actorId &&
        refreshed.source.division.id === body.divisionId
      );
    },
  );
  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!review) return;
    await command.submit(
      "/api/v1/division-finalizations",
      {
        divisionId: id,
        version: review.version,
        sourceDigest: review.sourceDigest,
        requestId: crypto.randomUUID(),
        placements: review.source.entries.map((e) => ({
          entryId: e.id,
          place: Number(places[e.id]),
        })),
        note,
        rulesReference: rules,
      },
      `Finalization ${review.version + 1} saved.`,
    );
  }
  async function history(version: number) {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(
          `/api/v1/division-finalizations?division=${encodeURIComponent(id)}&version=${version}`,
          { cache: "no-store" },
        ),
        data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "History could not be loaded.");
      setHistorical(data.selected);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const frozen = command.locked || loading;
  return (
    <main id="main" className="workspace finalization-workspace">
      <p className="eyebrow">Organizer · completed competition</p>
      <h1>Finalize division results</h1>
      <p>
        Review one division’s outcomes and record its final places. Later
        scorekeeper corrections remain available. Every finalization preserves
        its own exact contents.
      </p>
      <p>
        <a href="/admin">Your workspace</a>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <AuthorityRecovery state={command} label="finalization" />
      {loading && <p role="status">Loading division review…</p>}
      {!divisions.length && !loading ? (
        <>
          <p className="empty">
            No divisions are available in your organizer scope.
          </p>
          <button onClick={() => void workspace()}>Retry workspace</button>
        </>
      ) : null}
      {!!divisions.length && (
        <>
          <label htmlFor="final-division">Division</label>
          <select
            id="final-division"
            disabled={frozen}
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setReview(null);
              void load(e.target.value);
              historyUrl(e.target.value);
            }}
          >
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.eventName} · {d.name}
              </option>
            ))}
          </select>
          <button
            className="secondary"
            disabled={frozen}
            onClick={() => void load(id)}
          >
            Reload current division
          </button>
        </>
      )}
      {review && (
        <>
          <h2>
            {review.source.division.eventName} · {review.source.division.name}
          </h2>
          <p>
            {review.source.division.format} ·{" "}
            {review.source.division.origin === "fictional_demo"
              ? "Fictional review records"
              : "Operated sporting records"}
          </p>
          {review.dirty && (
            <p className="notice" role="status">
              Changed since finalization {review.version}. The frozen results
              remain unchanged. Review current outcomes and places before
              creating a direct replacement. Wider historical ranking impacts
              remain unresolved.
            </p>
          )}
          {review.version > 0 && !review.dirty && (
            <p className="notice">
              Finalization {review.version} matches the currently reviewed
              sporting source.
            </p>
          )}
          <p>
            <a href={`/divisions/${id}/results`}>Public final results</a> ·{" "}
            <a
              href={`/events/${review.source.division.eventId}?division=${id}`}
            >
              Current division scores
            </a>
          </p>
          <section aria-label="Current sporting review">
            <h2>Current outcomes</h2>
            {review.source.games.length ? (
              <ResultRows source={review.source} />
            ) : (
              <p className="empty">No games have been recorded.</p>
            )}
          </section>
          {!!review.prerequisites.length && (
            <div className="notice">
              <h3>Before finalizing</h3>
              <ul>
                {review.prerequisites.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <form onSubmit={save} className="form-card">
            <fieldset disabled={frozen}>
              <legend>Final placements</legend>
              <p>
                Place every recorded game participant. Entry submission or
                admission is separate from recorded sporting participation.
                Shared places use 1, 2, 2, 4 and need an explanation in the
                review note. No automatic playoff tiebreak is applied.
              </p>
              {review.source.entries.length ? (
                review.source.entries.map((entry) => (
                  <div className="placement-row" key={entry.id}>
                    <label htmlFor={`place-${entry.id}`}>
                      <a href={`/entries/${entry.id}`}>{entry.name}</a>
                      <span className="muted">
                        Entry version {entry.version} · lineup{" "}
                        {entry.lineup?.status ?? "not recorded"}
                      </span>
                      <span>Final place for {entry.name}</span>
                    </label>
                    <input
                      id={`place-${entry.id}`}
                      aria-label={`Final place for ${entry.name}`}
                      type="number"
                      min={1}
                      max={review.source.entries.length}
                      required
                      value={places[entry.id] ?? ""}
                      onChange={(e) =>
                        setPlaces({ ...places, [entry.id]: e.target.value })
                      }
                    />
                  </div>
                ))
              ) : (
                <p className="empty">No entries have been recorded.</p>
              )}
              <label htmlFor="final-rules">Competition rules reference</label>
              <textarea
                id="final-rules"
                value={rules}
                maxLength={2000}
                required
                onChange={(e) => setRules(e.target.value)}
              />
              <p className="muted">
                Record the exact sporting rules edition or published event terms
                used for these placements. This does not establish ranking
                eligibility.
              </p>
              <label htmlFor="final-note">Public review note</label>
              <textarea
                id="final-note"
                value={note}
                maxLength={2000}
                required
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="muted">
                This note and the frozen sporting contents appear in public
                result history.
              </p>
              <button
                type="submit"
                disabled={
                  !!review.prerequisites.length || !review.source.entries.length
                }
              >
                {command.busy
                  ? "Finalizing…"
                  : review.version
                    ? "Finalize replacement"
                    : "Finalize division"}
              </button>
            </fieldset>
          </form>
          <section aria-label="Separate ranking review" className="notice">
            <h2>Ranking review is separate</h2>
            <p>{review.ranking?.note}</p>
            {review.ranking?.issues.length ? (
              <ul>
                {review.ranking.issues.map((issue, i) => (
                  <li key={i}>
                    {issue.entryId
                      ? `${review.source.entries.find((e) => e.id === issue.entryId)?.name ?? "Entry"}: `
                      : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No scoped source issue was found. Finalization still grants no
                ranking approval.
              </p>
            )}
          </section>
          <section aria-label="Finalization history">
            <h2>Finalization history</h2>
            {review.history.length ? (
              <div className="history-actions">
                {review.history.map((v) => (
                  <button
                    className="secondary"
                    key={v.version}
                    disabled={frozen}
                    onClick={() => void history(v.version)}
                  >
                    Review revision {v.version}
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty">This division has no finalization yet.</p>
            )}
            {(historical ?? review.selected) && (
              <Snapshot revision={(historical ?? review.selected)!} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
function historyUrl(id: string) {
  window.history.replaceState(null, "", `?division=${encodeURIComponent(id)}`);
}
export function PublicFinalResults({ id }: { id: string }) {
  const [review, setReview] = useState<Review | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const version = new URLSearchParams(window.location.search).get(
          "version",
        ),
        r = await fetch(
          `/api/v1/public/divisions/${encodeURIComponent(id)}/results${version ? `?version=${encodeURIComponent(version)}` : ""}`,
          { cache: "no-store" },
        ),
        data = await r.json();
      if (!r.ok)
        throw new Error(data.error ?? "Final results could not be loaded.");
      setReview(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <main id="main" className="workspace finalization-workspace">
      <p className="eyebrow">Division result history</p>
      <h1>Final results</h1>
      {loading && <p role="status">Loading final results…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button
        className="secondary"
        disabled={loading}
        onClick={() => void load()}
      >
        Refresh final results
      </button>
      {review && (
        <>
          <h2>
            {review.source.division.eventName} · {review.source.division.name}
          </h2>
          <p>
            {review.source.division.origin === "fictional_demo"
              ? "Fictional demonstration records. "
              : ""}
            Sporting finalization is separate from ranking approval.
          </p>
          <p>
            <a
              href={`/events/${review.source.division.eventId}?division=${id}`}
            >
              Current scores and division navigation
            </a>
          </p>
          {review.dirty && (
            <p role="status" className="notice">
              Changed since finalization {review.version}. Current sporting
              records differ; an organizer’s revised finalization is pending.
              Earlier snapshots remain unchanged.
            </p>
          )}
          {review.selected && review.selected.version < review.version && (
            <p className="notice">
              You are viewing an earlier frozen version.{" "}
              <a href={`/divisions/${id}/results`}>
                Open latest revision {review.version}
              </a>
              .
            </p>
          )}
          <nav aria-label="Result revisions" className="history-actions">
            {review.history.map((v) => (
              <a
                key={v.version}
                href={`/divisions/${id}/results?version=${v.version}`}
              >
                Revision {v.version}
              </a>
            ))}
          </nav>
          {review.selected ? (
            <Snapshot revision={review.selected} />
          ) : (
            <p className="empty">
              No finalization has been recorded for this division. Current
              scores remain available.
            </p>
          )}
        </>
      )}
    </main>
  );
}
