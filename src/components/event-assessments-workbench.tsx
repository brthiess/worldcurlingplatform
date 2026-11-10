"use client";
import { useCallback, useEffect, useState } from "react";
import { AuthorityRecovery, useAuthorityCommand } from "./authority-command";
import {
  assessmentPolicy,
  assessmentEvidence,
  type AssessmentEvidence,
} from "@/domain/event-assessment-input";
import { canonicalJson } from "@/domain/canonical-json";
import { AssessmentEvidenceEditor } from "./assessment-evidence-editor";
import type { AssessmentResult } from "@/domain/event-assessments";
export type Review = {
  publishedProfile: {
    revision: number;
    templateId: string;
    templateVersion: number;
    definition: { family: string };
  } | null;
  priorEditions?: { id: string; name: string; starts_on: string }[];
  sourceDigest: string;
  current: {
    division: {
      id: string;
      name: string;
      eventName: string;
      discipline: string;
    };
    entries: { id: string; name: string }[];
    games: {
      id: string;
      phase: string;
      entryA: string;
      entryB: string;
      result: {
        lineupA?: {
          members: { playerId: string; name: string; identityStatus: string }[];
        };
        lineupB?: {
          members: { playerId: string; name: string; identityStatus: string }[];
        };
      } | null;
    }[];
  };
  finalization: { version: number; digest: string } | null;
  rules: { id: string; version: number };
  starting: {
    entryId: string;
    evidence: {
      id: string;
      version: number;
      currentRosterVersion: number;
      startingState: string;
      rankingPlayers: {
        playerId: string;
        name: string;
        identityStatus: string;
      }[];
      data: {
        rankingPlayerIds: string[];
        rosterVersion: number;
        rosterSourceId: string;
        sources: {
          id: string;
          title: string;
          url: string;
          edition: string;
          sha256: string;
        }[];
      };
    } | null;
  }[];
};
type Saved = {
  id: string;
  version: number;
  replacesId: string | null;
  contents: string;
  digest: string;
  engine: string;
  state: string;
  attempts: number;
  error: string | null;
  resultContents: string | null;
  resultDigest: string | null;
  createdAt: string;
};
type Workspace = {
  actorId: string;
  divisions: { id: string; name: string; eventName: string }[];
  rules: { id: string; version: number; state: string; title: string }[];
  review?: Review;
  history?: {
    id: string;
    version: number;
    state: string;
    actorId: string;
    requestId: string;
  }[];
  receipts?: {
    actorId: string;
    requestId: string;
    assessmentId: string;
    commandDigest: string;
    divisionId: string;
    version: number;
    path: string;
  }[];
  selected?: Saved | null;
};
const path = "/api/v1/event-assessments";
async function read(url: string): Promise<Workspace> {
  const r = await fetch(url, { cache: "no-store" });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error ?? "Assessment review could not be loaded.");
  return data;
}
function fresh(r: Review): AssessmentEvidence {
  return {
    rulesId: r.rules.id,
    rulesVersion: r.rules.version,
    policyId: assessmentPolicy.id,
    reviewNote: "",
    sources: [],
    preEvent: {
      effectiveDate: "",
      cutoffInstant: "",
      sourceId: "",
      family: r.current.division.discipline,
      rows: r.current.entries.map((e) => ({
        entryId: e.id,
        rank: null,
        points: null,
      })),
    },
    event: {
      kind: "tour",
      kindSourceId: "",
      newEvent: null,
      previous: null,
      registrationDate: null,
      eligibilitySourceId: "",
      complianceNote: "",
      resultsUrl: "",
      singleKnockout:
        r.publishedProfile?.definition.family === "single_knockout",
      formatReview: { family: "unknown", sourceId: "", note: "" },
      qualificationGameIds: [],
      playoffGameIds: [],
      bronzeGameId: null,
    },
    entries: r.current.entries.map((e) => ({
      entryId: e.id,
      eligibility: "unknown",
      sourceId: "",
      note: "",
      rosterReview: null,
      firstPlayoffGameId: null,
      games: [],
    })),
  };
}
function amount(value: string) {
  const [n, d] = value.split("/");
  if (!d) return n;
  const decimal = Number(n) / Number(d);
  return `${decimal.toLocaleString("en", { maximumFractionDigits: 8 })} (${value})`;
}
function editableEvidence(value: AssessmentEvidence): AssessmentEvidence {
  return {
    ...value,
    event: {
      ...value.event,
      formatReview: value.event.formatReview ?? {
        family: "unknown",
        sourceId: "",
        note: "",
      },
    },
  };
}
export function EventAssessmentsWorkbench() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [division, setDivision] = useState(""),
    [rules, setRules] = useState(""),
    [evidence, setEvidence] = useState<AssessmentEvidence | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [importText, setImportText] = useState(""),
    [importError, setImportError] = useState("");
  const load = useCallback(
    async (d = division, r = rules, selected?: string, reset = false) => {
      setLoading(true);
      try {
        const next = await read(
          d
            ? `${path}?division=${d}&rules=${r}${selected ? `&assessment=${selected}` : ""}`
            : path,
        );
        setWorkspace(next);
        setError("");
        setStale(false);
        if (next.review && (reset || !evidence)) {
          const saved = next.selected
            ? JSON.parse(next.selected.contents).evidence
            : null;
          setEvidence(saved ? editableEvidence(saved) : fresh(next.review));
        }
      } catch (e) {
        setError((e as Error).message);
        setStale(true);
      } finally {
        setLoading(false);
      }
    },
    [division, rules, evidence],
  );
  useEffect(() => {
    void read(path)
      .then(setWorkspace)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const command = useAuthorityCommand(
    workspace?.actorId ? `wcp-assessment-command:${workspace.actorId}` : null,
    workspace?.actorId,
    async (saved) => {
      const original = JSON.parse(saved.body),
        d = original.divisionId,
        r = original.evidence?.rulesId ?? original.rulesId ?? rules;
      const next = await read(`${path}?division=${d}&rules=${r}`);
      setDivision(d);
      setRules(r);
      setWorkspace(next);
      setError("");
      setStale(false);
      if (next.selected)
        setEvidence(
          editableEvidence(JSON.parse(next.selected.contents).evidence),
        );
    },
    async (pending) => {
      if (pending.path !== path || pending.actorId !== workspace?.actorId)
        return false;
      const original = JSON.parse(pending.body),
        action = original.action ?? "calculate";
      if (
        !["calculate", "retry"].includes(action) ||
        typeof original.divisionId !== "string" ||
        !Number.isSafeInteger(original.version)
      )
        return false;
      const r = original.evidence?.rulesId ?? original.rulesId ?? rules;
      const state = await read(
        `${path}?division=${encodeURIComponent(original.divisionId)}&rules=${encodeURIComponent(r)}`,
      );
      if (
        state.actorId !== pending.actorId ||
        state.review?.current.division.id !== original.divisionId
      )
        return false;
      const commandDigest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(canonicalJson(original)),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const found = state.receipts?.some(
        (h) =>
          h.actorId === pending.actorId &&
          h.requestId === original.requestId &&
          h.path === pending.path &&
          h.divisionId === original.divisionId &&
          h.commandDigest === commandDigest &&
          h.version ===
            (action === "retry" ? original.version : original.version + 1) &&
          (action !== "retry" || h.assessmentId === original.assessmentId) &&
          state.history?.some(
            (a) => a.id === h.assessmentId && a.version === h.version,
          ),
      );
      if (found) {
        setDivision(original.divisionId);
        setRules(r);
        setWorkspace(state);
        setError("");
        setStale(false);
      }
      return !!found;
    },
    (status) => {
      if (status === 409 || status === 403) setStale(true);
    },
  );
  const locked = command.locked || loading || stale,
    review = workspace?.review,
    selected = workspace?.selected;
  useEffect(() => {
    if (!command.pending || division) return;
    const original = JSON.parse(command.pending.body),
      d = original.divisionId,
      r = original.evidence?.rulesId ?? original.rulesId;
    if (d && r) {
      setDivision(d);
      setRules(r);
      void load(d, r, undefined, true);
    }
  }, [command.pending, division, load]);
  const result: AssessmentResult | null = selected?.resultContents
    ? JSON.parse(selected.resultContents).result
    : null;
  const frozenEntries: { id: string; name: string }[] = selected
    ? JSON.parse(selected.contents).source.current.entries
    : (review?.current.entries ?? []);
  function patch(p: Partial<AssessmentEvidence>) {
    if (evidence) setEvidence({ ...evidence, ...p });
  }
  return (
    <main id="main" className="workspace assessment-workbench">
      <p className="eyebrow">World Curling staff · event review</p>
      <h1>Four-player event assessments</h1>
      <p>
        Calculate field strength and event awards from a frozen sporting result.
        Every revision retains its inputs, rules, application policy and
        calculation evidence.
      </p>
      <p>
        <a href="/admin">← Workspace</a> ·{" "}
        <a href="/admin/ranking-inputs">Official roster and rule evidence</a>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
          {workspace?.review
            ? " The displayed review is stale. Reload before calculating."
            : ""}
        </p>
      )}
      <AuthorityRecovery state={command} label="assessment" />
      {loading && <p role="status">Loading assessment review…</p>}
      {!workspace && !loading && (
        <button type="button" onClick={() => void load()}>
          Retry assessment workspace
        </button>
      )}
      {workspace && (
        <>
          <div className="form-card">
            <label htmlFor="assessment-division">Division</label>
            <select
              id="assessment-division"
              disabled={command.locked || loading}
              value={division}
              onChange={(e) => {
                const id = e.target.value,
                  r = rules || workspace.rules[0]?.id || "";
                setDivision(id);
                setRules(r);
                setEvidence(null);
                if (id && r) void load(id, r, undefined, true);
              }}
            >
              <option value="">Choose a division</option>
              {workspace.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.eventName} · {d.name}
                </option>
              ))}
            </select>
            <label htmlFor="assessment-rules">Rule-source edition</label>
            <select
              id="assessment-rules"
              disabled={command.locked || loading}
              value={rules}
              onChange={(e) => {
                setRules(e.target.value);
                setEvidence(null);
                if (division)
                  void load(division, e.target.value, undefined, true);
              }}
            >
              <option value="">Choose an edition</option>
              {workspace.rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} · revision {r.version} · {r.state}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="secondary"
              disabled={loading || command.busy}
              onClick={() => void load(division, rules, undefined, true)}
            >
              Reload current review
            </button>
          </div>
          {!workspace.divisions.length && (
            <p className="empty">No four-player divisions are available.</p>
          )}
          {!workspace.rules.length && (
            <p className="empty">
              Record a sourced rule edition before calculating an event.
            </p>
          )}
        </>
      )}
      {review && evidence && (
        <>
          <section className="form-card">
            <h2>Reviewed inputs</h2>
            <p>
              {review.current.division.eventName} ·{" "}
              {review.current.division.name}. Sporting snapshot{" "}
              {review.finalization
                ? `revision ${review.finalization.version}`
                : "not finalized"}
              .
            </p>
            <p className="muted">
              The staff event-roster review is separate from season starting
              entitlements. Missing unused carryover amounts do not become
              invented event inputs.
            </p>
            <details>
              <summary>
                Application interpretation and calculation stages
              </summary>
              {Object.entries(assessmentPolicy).map(([k, v]) => (
                <p key={k}>
                  <strong>{k}: </strong>
                  {v}
                </p>
              ))}
            </details>
            <fieldset disabled={locked}>
              <legend>Event assessment evidence</legend>
              <AssessmentEvidenceEditor
                evidence={evidence}
                review={review}
                onChange={setEvidence}
              />
              <details>
                <summary>Import or inspect sourced event evidence</summary>
                <p>
                  Import the complete staff evidence record, including source
                  retrieval hashes, official roster review references, exact
                  rankings, event-edition links and throughout-play
                  participation segments. No manual award totals are accepted.
                </p>
                <label htmlFor="assessment-import">
                  Sourced event evidence JSON
                </label>
                <textarea
                  id="assessment-import"
                  rows={12}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    try {
                      const value = assessmentEvidence(JSON.parse(importText));
                      setEvidence(value);
                      setImportError("");
                    } catch (e) {
                      setImportError((e as Error).message);
                    }
                  }}
                >
                  Apply sourced evidence
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() =>
                    setImportText(JSON.stringify(evidence, null, 2))
                  }
                >
                  Inspect current evidence
                </button>
                {importError && (
                  <p className="error" role="alert">
                    {importError}
                  </p>
                )}
              </details>
              <button
                type="button"
                disabled={!review.finalization}
                onClick={() =>
                  void command.submit(
                    path,
                    {
                      action: "calculate",
                      divisionId: division,
                      version: workspace?.history?.[0]?.version ?? 0,
                      sourceDigest: review.sourceDigest,
                      requestId: crypto.randomUUID(),
                      evidence,
                    },
                    "Event assessment queued. Refresh job status to review the worker result.",
                  )
                }
              >
                Queue {workspace?.history?.length ? "revised " : ""}assessment
              </button>
            </fieldset>
          </section>
          <section className="form-card">
            <h2>Calculation jobs and history</h2>
            {!workspace?.history?.length ? (
              <p className="empty">
                No assessment has been queued for this division.
              </p>
            ) : (
              <>
                <label htmlFor="assessment-history">Assessment revision</label>
                <select
                  id="assessment-history"
                  disabled={loading || command.busy}
                  value={selected?.id ?? ""}
                  onChange={(e) => void load(division, rules, e.target.value)}
                >
                  {workspace.history.map((h) => (
                    <option key={h.id} value={h.id}>
                      Revision {h.version} · {h.state}
                    </option>
                  ))}
                </select>
                {selected && (
                  <>
                    <p role="status">
                      Revision {selected.version} · {selected.state} · delivery
                      attempts {selected.attempts}
                      {selected.replacesId
                        ? " · replaces an earlier assessment"
                        : " · original assessment"}
                    </p>
                    <button
                      type="button"
                      className="secondary"
                      disabled={loading || command.busy}
                      onClick={() => void load(division, rules, selected.id)}
                    >
                      Refresh job status
                    </button>
                    {selected.error && (
                      <p className="error" role="alert">
                        Worker delivery failed: {selected.error}
                      </p>
                    )}
                    {selected.state === "failed" && (
                      <button
                        disabled={locked}
                        onClick={() =>
                          void command.submit(
                            path,
                            {
                              action: "retry",
                              divisionId: division,
                              rulesId: rules,
                              assessmentId: selected.id,
                              version: selected.version,
                              requestId: crypto.randomUUID(),
                            },
                            "Failed delivery queued for retry with its original frozen inputs.",
                          )
                        }
                      >
                        Retry failed delivery
                      </button>
                    )}
                    {result && (
                      <>
                        <h3>
                          {result.state === "blocked"
                            ? "Required issues block this assessment"
                            : `Field strength ${amount(result.sfm!)} · ${result.series}`}
                        </h3>
                        {result.issues.length > 0 && (
                          <ul className="error">
                            {result.issues.map((x, i) => (
                              <li key={i}>{x}</li>
                            ))}
                          </ul>
                        )}
                        {result.state === "completed" && (
                          <>
                            <h3>Calculation stages</h3>
                            <dl>
                              {result.stages.map((s, i) => (
                                <div key={i}>
                                  <dt>{s.stage}</dt>
                                  <dd>{amount(s.value)}</dd>
                                </div>
                              ))}
                            </dl>
                            <h3>Event awards</h3>
                            <ul className="workspace-list">
                              {[...result.awards]
                                .sort((a, b) => a.place - b.place)
                                .map((a) => (
                                  <li key={a.entryId}>
                                    <strong>
                                      Place {a.place} ·{" "}
                                      {frozenEntries.find(
                                        (e) => e.id === a.entryId,
                                      )?.name ?? a.entryId}
                                    </strong>
                                    <p>
                                      {amount(a.points)} points · {a.reason} ·
                                      multiplier {amount(a.multiplier)}
                                    </p>
                                    {a.adjustments.map((x) => (
                                      <p key={x}>{x}</p>
                                    ))}
                                  </li>
                                ))}
                            </ul>
                            <details>
                              <summary>
                                Field contributions and exclusions
                              </summary>
                              <ul>
                                {result.contributions.map((c) => (
                                  <li key={c.entryId}>
                                    {frozenEntries.find(
                                      (e) => e.id === c.entryId,
                                    )?.name ?? c.entryId}
                                    : {amount(c.value)} · {c.reason}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </>
                        )}
                        <p>
                          Frozen input digest: <code>{selected.digest}</code>
                        </p>
                        <p>
                          Frozen result digest:{" "}
                          <code>{selected.resultDigest}</code>
                        </p>
                        <p>
                          Engine: {selected.engine}. Event awards are private
                          staff review evidence. This screen does not publish a
                          world ranking list.
                        </p>
                        <p>
                          Code revision:{" "}
                          <code>
                            {JSON.parse(selected.contents).engineIdentity
                              ?.codeRevision ??
                              "Legacy input without an implementation fingerprint"}
                          </code>
                        </p>
                      </>
                    )}
                    <details>
                      <summary>Replay evidence</summary>
                      <pre>{selected.contents}</pre>
                      {selected.resultContents && (
                        <pre>{selected.resultContents}</pre>
                      )}
                    </details>
                  </>
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  );
}
