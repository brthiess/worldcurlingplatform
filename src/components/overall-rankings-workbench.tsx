"use client";
import { useEffect, useState } from "react";
import { overallPolicy } from "@/domain/overall-rankings";
import {
  overallEvidence,
  type OverallEvidence,
  type SubjectReview,
} from "@/domain/overall-ranking-input";
import type {
  OverallSource,
  calculateOverall,
} from "@/domain/overall-calculation";
import type { Source } from "@/domain/ranking-inputs";
import { useAuthorityCommand, AuthorityRecovery } from "./authority-command";
type Saved = {
  id: string;
  version: number;
  effectiveDate: string;
  manifestDigest: string;
  resultDigest: string;
  manifest: {
    evidence: OverallEvidence;
    engineIdentity: { codeRevision: string };
    policy: typeof overallPolicy;
  };
  result: ReturnType<typeof calculateOverall>;
};
type Workspace = {
  actorId: string;
  rules: {
    id: string;
    version: number;
    data: { title: string };
    state: string;
  }[];
  review?: OverallSource & { sourceDigest: string };
  version?: number;
  history?: { id: string; version: number; state: string }[];
  receipts?: { actorId: string; requestId: string; runId: string }[];
  selected?: Saved | null;
};
const path = "/api/v1/overall-rankings";
async function read<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" }),
    data = await r.json();
  if (!r.ok)
    throw new Error(data.error ?? "Overall review could not be loaded.");
  return data;
}
function fresh(r: OverallSource): OverallEvidence {
  return {
    policyId: overallPolicy.id,
    sources: [],
    reviewNote: "",
    subjects: r.subjects.map((s) => ({
      registrationId: s.registrationId,
      eligibility: "unknown",
      sourceId: "",
      note: "",
      continuity: { state: "unknown", sourceId: "", note: "", prior: null },
      adjustments: {
        state: "unknown",
        sourceId: "",
        note: "",
        exclusions: [],
        rosterChanges: [],
      },
    })),
    events: r.events.map((e) => ({
      divisionId: e.divisionId,
      state: "unknown",
      sourceId: "",
      note: "",
    })),
  };
}
function amount(v: string) {
  const [n, d = "1"] = v.split("/");
  const scaled = (BigInt(n) * 1000000n) / BigInt(d),
    whole = scaled / 1000000n,
    fraction = String(scaled % 1000000n)
      .padStart(6, "0")
      .replace(/0+$/, "");
  return `${whole}${fraction ? "." + fraction : ""}${BigInt(n) > 0n && scaled === 0n ? " (<0.000001)" : ""}${d !== "1" ? ` · exact ${v}` : ""}`;
}
export function OverallRankingsWorkbench() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [discipline, setDiscipline] = useState("men_four"),
    [date, setDate] = useState("2026-11-23"),
    [rules, setRules] = useState(""),
    [evidence, setEvidence] = useState<OverallEvidence | null>(null),
    [selected, setSelected] = useState<Saved | null>(null),
    [subjectId, setSubjectId] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [stale, setStale] = useState(false),
    [detailId, setDetailId] = useState(""),
    [importText, setImportText] = useState("");
  async function load(d = discipline, dt = date, r = rules, reset = false, recovery = false) {
    setLoading(true);
    try {
      const next = await read<Workspace>(
        r ? `${path}?discipline=${d}&date=${dt}&rules=${r}` : path,
      );
      setWorkspace(next);
      setSelected(next.selected ?? null);
      setError("");
      setStale(false);
      if (next.review && (reset || !evidence)) {
        const value = next.selected?.manifest.evidence ?? fresh(next.review);
        setEvidence(value);
        setSubjectId(value.subjects[0]?.registrationId ?? "");
      }
    } catch (e) {
      setError((e as Error).message);
      setStale(true);
      if(recovery)throw e;
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []); // initial private workspace; subsequent loads are explicit operator actions
  const command = useAuthorityCommand(
    workspace?.actorId ? `overall-ranking-command:${workspace.actorId}` : null,
    workspace?.actorId,
    async (saved) => {
      const b = JSON.parse(saved.body);
      await load(b.discipline, b.effectiveDate, b.rulesId ?? rules, true, true);
    },
    async (pending) => {
      const b = JSON.parse(pending.body);
      const current = await read<Workspace>(
        `${path}?discipline=${b.discipline}&date=${b.effectiveDate}&rules=${b.rulesId ?? rules}`,
      );
      return !!current.receipts?.some(
        (r) => r.actorId === pending.actorId && r.requestId === b.requestId,
      );
    },
    (status) => {
      if (status === 409) setStale(true);
    },
  );
  useEffect(() => {
    if (!command.pending) return;
    const b = JSON.parse(command.pending.body);
    setDiscipline(b.discipline);
    setDate(b.effectiveDate);
    if (b.rulesId) setRules(b.rulesId);
  }, [command.pending]);
  const locked = loading || command.locked;
  const subject = evidence?.subjects.find(
      (s) => s.registrationId === subjectId,
    ),
    current = workspace?.review?.subjects.find(
      (s) => s.registrationId === subjectId,
    );
  function change(patch: Partial<SubjectReview>) {
    if (evidence && subject)
      setEvidence({
        ...evidence,
        subjects: evidence.subjects.map((s) =>
          s.registrationId === subjectId ? { ...s, ...patch } : s,
        ),
      });
  }
  const sourceSelect = (
    label: string,
    value: string,
    change: (id: string) => void,
  ) => (
    <label>
      {label}
      <select value={value} onChange={(e) => change(e.target.value)}>
        <option value="">Unresolved source</option>
        {evidence?.sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title || s.id}
          </option>
        ))}
      </select>
    </label>
  );
  const ownedAwards =
    workspace?.review?.events.flatMap((e) => {
      if (!e.assessment?.resultContents) return [];
      const input = JSON.parse(e.assessment.contents),
        result = JSON.parse(e.assessment.resultContents).result;
      return result.awards
        .filter((a: { entryId: string }) =>
          input.source.current.entries.some(
            (x: { id: string; lineup?: { registrationId: string } }) =>
              x.id === a.entryId && x.lineup?.registrationId === subjectId,
          ),
        )
        .map((a: { entryId: string; points: string }) => ({
          id: `${e.assessment!.id}:${a.entryId}`,
          label: `${e.name} · ${e.date} · ${amount(a.points)}`,
        }));
    }) ?? [];
  async function calculate() {
    if (!evidence || !workspace?.review) return;
    await command.submit(
      path,
      {
        action: "calculate",
        discipline,
        effectiveDate: date,
        rulesId: rules,
        version: workspace.version ?? 0,
        sourceDigest: workspace.review.sourceDigest,
        requestId: crypto.randomUUID(),
        evidence,
      },
      "Overall draft and immutable contributions saved.",
    );
  }
  const detail = selected?.result.rows.find((r) => r.id === detailId);
  return (
    <main id="main" className="workspace overall-workbench">
      <p className="eyebrow">World Curling staff · private review</p>
      <h1>Four-player overall drafts</h1>
      <p>
        Review men's and women's 2026–27 overall lists. Starting rights,
        continuity and ordinary adjustments need separate evidence. Drafts
        remain private until a later publication review.
      </p>
      <p>
        <a href="/admin/ranking-inputs">
          Starting ownership and official rosters
        </a>{" "}
        · <a href="/admin/event-assessments">Event assessments</a> ·{" "}
        <a href="/admin">Workspace</a>
      </p>
      {error && <p role="alert">{error}</p>}
      {stale && (
        <p role="status">
          Stale review. Last successful data remains visible; reload current
          sources before calculating.
        </p>
      )}
      {loading && <p role="status">Loading overall review…</p>}
      <AuthorityRecovery state={command} label="overall ranking" />
      <fieldset disabled={locked}>
        <legend>List context</legend>
        <div className="overall-fields">
          <label>
            Discipline
            <select
              value={discipline}
              onChange={(e) => {
                setDiscipline(e.target.value);
                setEvidence(null);
                setSelected(null);
                setWorkspace((w) =>
                  w ? { actorId: w.actorId, rules: w.rules } : w,
                );
              }}
            >
              <option value="men_four">Men's four-player overall</option>
              <option value="women_four">Women's four-player overall</option>
            </select>
          </label>
          <label>
            Effective date
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setEvidence(null);
                setSelected(null);
                setStale(true);
              }}
            />
          </label>
          <label>
            Rule-source edition
            <select
              value={rules}
              onChange={(e) => {
                setRules(e.target.value);
                setEvidence(null);
                setStale(true);
              }}
            >
              <option value="">Choose reviewed rules</option>
              {workspace?.rules.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.data.title} · revision {r.version} · {r.state}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={!rules}
          onClick={() => void load(discipline, date, rules, true)}
        >
          Load current review
        </button>
      </fieldset>
      {!workspace && !loading && (
        <button type="button" onClick={() => void load()}>
          Retry review loading
        </button>
      )}
      {workspace?.review && evidence && (
        <>
          <section aria-labelledby="overall-sources">
            <h2 id="overall-sources">Sources and coverage</h2>
            <p>
              Inclusive effective date {workspace.review.effectiveDate}. Events
              count when their recorded completion date is on or before it. This
              cutoff and carryover tie handling are explicit application
              interpretations.
            </p>
            <details>
              <summary>Calculation policy</summary>
              {Object.entries(overallPolicy).map(([k, v]) => (
                <p key={k}>
                  <strong>{k}: </strong>
                  {v}
                </p>
              ))}
            </details>
            <fieldset disabled={locked}>
              <legend>Retrieved evidence sources</legend>
              {evidence.sources.map((s, i) => (
                <fieldset key={i}>
                  <legend>Source {i + 1}</legend>
                  <div className="overall-fields">
                    {(
                      [
                        ["Source identifier", "id"],
                        ["Source title", "title"],
                        ["Source HTTPS URL", "url"],
                        ["Inspected edition", "edition"],
                        ["Actual retrieval timestamp", "retrievedAt"],
                        ["Retrieved SHA-256", "sha256"],
                      ] as const
                    ).map(([label, key]) => (
                      <label key={key}>
                        {label}
                        <input
                          value={s[key]}
                          onChange={(e) =>
                            setEvidence({
                              ...evidence,
                              sources: evidence.sources.map((v, j) =>
                                i === j ? { ...v, [key]: e.target.value } : v,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEvidence({
                        ...evidence,
                        sources: evidence.sources.filter((_, j) => i !== j),
                      })
                    }
                  >
                    Remove source {i + 1}
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                onClick={() =>
                  setEvidence({
                    ...evidence,
                    sources: [
                      ...evidence.sources,
                      {
                        id: `source-${evidence.sources.length + 1}`,
                        title: "",
                        url: "",
                        edition: "",
                        retrievedAt: "",
                        sha256: "",
                      },
                    ],
                  })
                }
              >
                Add evidence source
              </button>
              <label>
                Overall review rationale
                <textarea
                  value={evidence.reviewNote}
                  onChange={(e) =>
                    setEvidence({ ...evidence, reviewNote: e.target.value })
                  }
                />
              </label>
            </fieldset>
            {!workspace.review.events.length && (
              <p>
                No completed divisions exist in this discipline/date interval.
                Starting rights still need review.
              </p>
            )}
            {workspace.review.events.map((event) => {
              const row = evidence.events.find(
                (e) => e.divisionId === event.divisionId,
              );
              if (!row)
                return (
                  <p key={event.divisionId}>
                    New event requires reloading evidence.
                  </p>
                );
              const update = (patch: Partial<typeof row>) =>
                setEvidence({
                  ...evidence,
                  events: evidence.events.map((e) =>
                    e.divisionId === event.divisionId ? { ...e, ...patch } : e,
                  ),
                });
              return (
                <fieldset key={event.divisionId} disabled={locked}>
                  <legend>
                    {event.name} · {event.date}
                  </legend>
                  <p>
                    Latest assessment: {event.assessment?.state ?? "Absent"}.
                    Finalization revision:{" "}
                    {event.finalizationVersion ?? "Absent"}.
                  </p>
                  <div className="overall-fields">
                    <label>
                      Event coverage
                      <select
                        value={row.state}
                        onChange={(e) =>
                          update({ state: e.target.value as typeof row.state })
                        }
                      >
                        <option value="unknown">Unresolved</option>
                        <option value="assessed">
                          Include frozen assessed awards
                        </option>
                        <option value="excluded">
                          Sourced exclusion from this list
                        </option>
                      </select>
                    </label>
                    {sourceSelect(
                      "Event coverage source",
                      row.sourceId,
                      (sourceId) => update({ sourceId }),
                    )}
                    <label>
                      Event coverage rationale
                      <textarea
                        value={row.note}
                        onChange={(e) => update({ note: e.target.value })}
                      />
                    </label>
                  </div>
                </fieldset>
              );
            })}
          </section>
          <section aria-labelledby="overall-ownership">
            <h2 id="overall-ownership">Season ownership review</h2>
            <p>
              All {workspace.review.subjects.length} current season
              registrations are included in this review. Exclusions need a
              source and rationale; completed awards confer no starting
              entitlement.
            </p>
            <fieldset disabled={locked}>
              <legend>Review subject</legend>
              <label>
                Season subject
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  {workspace.review.subjects.map((s) => (
                    <option key={s.registrationId} value={s.registrationId}>
                      {s.name} · {s.registrationId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              {current && subject && (
                <>
                  <h3>{current.name}</h3>
                  <p>
                    Starting evidence: {current.starting?.state ?? "Missing"} ·{" "}
                    {current.starting?.currentReadiness.complete
                      ? "Current and complete"
                      : "Required inputs unresolved"}
                    . Official regulars and platform core remain separate.
                  </p>
                  {current.starting?.currentReadiness.issues.map((i, index) => (
                    <p key={index}>
                      {i.severity}: {i.message}
                    </p>
                  ))}
                  <div className="overall-fields">
                    <label>
                      Subject eligibility
                      <select
                        value={subject.eligibility}
                        onChange={(e) =>
                          change({
                            eligibility: e.target
                              .value as SubjectReview["eligibility"],
                          })
                        }
                      >
                        <option value="unknown">Unresolved</option>
                        <option value="eligible">
                          Eligible with complete starting rights
                        </option>
                        <option value="excluded">Sourced list exclusion</option>
                      </select>
                    </label>
                    {sourceSelect(
                      "Subject eligibility source",
                      subject.sourceId,
                      (sourceId) => change({ sourceId }),
                    )}
                    <label>
                      Subject eligibility rationale
                      <textarea
                        value={subject.note}
                        onChange={(e) => change({ note: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="overall-fields">
                    <label>
                      Continuity decision
                      <select
                        value={subject.continuity.state}
                        onChange={(e) =>
                          change({
                            continuity: {
                              ...subject.continuity,
                              state: e.target
                                .value as SubjectReview["continuity"]["state"],
                              prior:
                                e.target.value === "retained"
                                  ? {
                                      total: "0",
                                      members: (
                                        current.starting?.data
                                          .rankingPlayerIds ?? []
                                      ).map((playerId) => ({
                                        playerId,
                                        share:
                                          current.starting?.data
                                            .rankingPlayerIds.length === 5
                                            ? "1/5"
                                            : "1/4",
                                      })),
                                    }
                                  : null,
                            },
                          })
                        }
                      >
                        <option value="unknown">Unresolved</option>
                        <option value="none">
                          Sourced individual rights, no continuity floor
                        </option>
                        <option value="retained">
                          Retained three of four / four of five
                        </option>
                      </select>
                    </label>
                    {sourceSelect(
                      "Continuity source",
                      subject.continuity.sourceId,
                      (sourceId) =>
                        change({
                          continuity: { ...subject.continuity, sourceId },
                        }),
                    )}
                    <label>
                      Continuity rationale
                      <textarea
                        value={subject.continuity.note}
                        onChange={(e) =>
                          change({
                            continuity: {
                              ...subject.continuity,
                              note: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                  {subject.continuity.prior && (
                    <fieldset>
                      <legend>
                        Sourced previous official roster and rights
                      </legend>
                      <label>
                        Prior final team total
                        <input
                          value={subject.continuity.prior.total}
                          onChange={(e) =>
                            change({
                              continuity: {
                                ...subject.continuity,
                                prior: {
                                  ...subject.continuity.prior!,
                                  total: e.target.value,
                                },
                              },
                            })
                          }
                        />
                      </label>
                      {subject.continuity.prior.members.map((m, i) => (
                        <div className="overall-fields" key={i}>
                          <label>
                            Prior player {i + 1}
                            <input
                              value={m.playerId}
                              onChange={(e) =>
                                change({
                                  continuity: {
                                    ...subject.continuity,
                                    prior: {
                                      ...subject.continuity.prior!,
                                      members:
                                        subject.continuity.prior!.members.map(
                                          (v, j) =>
                                            i === j
                                              ? {
                                                  ...v,
                                                  playerId: e.target.value,
                                                }
                                              : v,
                                        ),
                                    },
                                  },
                                })
                              }
                            />
                          </label>
                          <label>
                            Prior exact share {i + 1}
                            <input
                              value={m.share}
                              onChange={(e) =>
                                change({
                                  continuity: {
                                    ...subject.continuity,
                                    prior: {
                                      ...subject.continuity.prior!,
                                      members:
                                        subject.continuity.prior!.members.map(
                                          (v, j) =>
                                            i === j
                                              ? { ...v, share: e.target.value }
                                              : v,
                                        ),
                                    },
                                  },
                                })
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </fieldset>
                  )}
                  <div className="overall-fields">
                    <label>
                      Ordinary adjustments
                      <select
                        value={subject.adjustments.state}
                        onChange={(e) =>
                          change({
                            adjustments: {
                              ...subject.adjustments,
                              state: e.target
                                .value as SubjectReview["adjustments"]["state"],
                            },
                          })
                        }
                      >
                        <option value="unknown">
                          Unresolved applicability
                        </option>
                        <option value="none">
                          Sourced no outstanding adjustments
                        </option>
                        <option value="reviewed">
                          Sourced ordinary decisions below
                        </option>
                      </select>
                    </label>
                    {sourceSelect(
                      "Adjustment applicability source",
                      subject.adjustments.sourceId,
                      (sourceId) =>
                        change({
                          adjustments: { ...subject.adjustments, sourceId },
                        }),
                    )}
                    <label>
                      Adjustment applicability rationale
                      <textarea
                        value={subject.adjustments.note}
                        onChange={(e) =>
                          change({
                            adjustments: {
                              ...subject.adjustments,
                              note: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                  <p>
                    Unknown penalty/exemption arithmetic cannot be waived here.
                    A changed official roster requires an exact award
                    retain/exclude decision. No points follow another core
                    identity automatically.
                  </p>
                  {(subject.adjustments.rosterChanges ?? []).map((a, i) => (
                    <fieldset key={i}>
                      <legend>Award ownership decision {i + 1}</legend>
                      <div className="overall-fields">
                        <label>
                          Frozen award
                          <select
                            value={a.awardId}
                            onChange={(e) =>
                              change({
                                adjustments: {
                                  ...subject.adjustments,
                                  rosterChanges:
                                    subject.adjustments.rosterChanges!.map(
                                      (v, j) =>
                                        i === j
                                          ? { ...v, awardId: e.target.value }
                                          : v,
                                    ),
                                },
                              })
                            }
                          >
                            <option value="">Choose exact award</option>
                            {ownedAwards.map((a) => (
                              <option value={a.id} key={a.id}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Award decision
                          <select
                            value={a.decision}
                            onChange={(e) =>
                              change({
                                adjustments: {
                                  ...subject.adjustments,
                                  rosterChanges:
                                    subject.adjustments.rosterChanges!.map(
                                      (v, j) =>
                                        i === j
                                          ? {
                                              ...v,
                                              decision: e.target.value as
                                                | "retain"
                                                | "exclude",
                                            }
                                          : v,
                                    ),
                                },
                              })
                            }
                          >
                            <option value="retain">
                              Retain for this registered subject
                            </option>
                            <option value="exclude">Exclude award</option>
                          </select>
                        </label>
                        {sourceSelect(
                          "Award decision source",
                          a.sourceId,
                          (sourceId) =>
                            change({
                              adjustments: {
                                ...subject.adjustments,
                                rosterChanges:
                                  subject.adjustments.rosterChanges!.map(
                                    (v, j) =>
                                      i === j ? { ...v, sourceId } : v,
                                  ),
                              },
                            }),
                        )}
                        <label>
                          Award decision rationale
                          <textarea
                            value={a.note}
                            onChange={(e) =>
                              change({
                                adjustments: {
                                  ...subject.adjustments,
                                  rosterChanges:
                                    subject.adjustments.rosterChanges!.map(
                                      (v, j) =>
                                        i === j
                                          ? { ...v, note: e.target.value }
                                          : v,
                                    ),
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          change({
                            adjustments: {
                              ...subject.adjustments,
                              rosterChanges:
                                subject.adjustments.rosterChanges!.filter(
                                  (_, j) => i !== j,
                                ),
                            },
                          })
                        }
                      >
                        Remove award decision {i + 1}
                      </button>
                    </fieldset>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      change({
                        adjustments: {
                          ...subject.adjustments,
                          state: "reviewed",
                          rosterChanges: [
                            ...(subject.adjustments.rosterChanges ?? []),
                            {
                              awardId: "",
                              decision: "retain",
                              sourceId: "",
                              note: "",
                            },
                          ],
                        },
                      })
                    }
                  >
                    Add award ownership decision
                  </button>
                </>
              )}
            </fieldset>
          </section>
          <details>
            <summary>Optional evidence JSON import</summary>
            <fieldset disabled={locked}>
              <label>
                Evidence JSON
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  try {
                    const value = overallEvidence(JSON.parse(importText));
                    setEvidence(value);
                    setSubjectId(value.subjects[0]?.registrationId ?? "");
                    setError("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Import evidence for review
              </button>
            </fieldset>
          </details>
          <button
            type="button"
            disabled={locked || stale}
            onClick={() => void calculate()}
          >
            Calculate overall draft
          </button>
        </>
      )}
      {selected && (
        <section aria-labelledby="overall-result">
          <h2 id="overall-result">
            {selected.result.state === "ready"
              ? "Ready overall draft"
              : "Blocked overall draft"}{" "}
            · revision {selected.version}
          </h2>
          <p>
            Effective {selected.effectiveDate}. This is a calculated private
            draft. {selected.result.awardCount} frozen event awards inspected.
          </p>
          {selected.result.issues.length > 0 && (
            <div role="alert">
              <h3>Required calculation blockers</h3>
              <ul>
                {selected.result.issues.map((i, j) => (
                  <li key={j}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          {selected.result.warnings.length > 0 && (
            <details>
              <summary>
                Nonmaterial warnings ({selected.result.warnings.length})
              </summary>
              <ul>
                {selected.result.warnings.map((i, j) => (
                  <li key={j}>{i}</li>
                ))}
              </ul>
            </details>
          )}
          <div
            className="overall-table-scroll"
            tabIndex={0}
            aria-label="Overall draft table"
          >
            <table>
              <caption>
                Men's / women's overall · exact contribution totals
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Total</th>
                  <th scope="col">Events</th>
                  <th scope="col">Carryover</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {selected.result.rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.rank ?? "Unresolved tie"}</td>
                    <th scope="row">
                      <a href={`/teams/${r.teamId}`}>{r.name}</a>
                    </th>
                    <td>{amount(r.total)}</td>
                    <td>
                      {r.counted.length}/{r.checkpoint.maxEvents}
                    </td>
                    <td>{amount(r.carryover)}</td>
                    <td>
                      <button type="button" onClick={() => setDetailId(r.id)}>
                        Inspect {r.name}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail && (
            <section aria-label="Subject contributions">
              <h3>{detail.name} · contributions</h3>
              <p>
                Checkpoint from {detail.checkpoint.from}: best{" "}
                {detail.checkpoint.maxEvents} events + prior weight{" "}
                {detail.checkpoint.priorWeight}. Starting entitlement{" "}
                {amount(detail.starting)}; weighted carryover{" "}
                {amount(detail.carryover)}. Individual sum{" "}
                {amount(detail.ownership.individualSum)}; continuity floor{" "}
                {amount(detail.ownership.floor)}; floor addition{" "}
                {amount(detail.ownership.extra)}.
              </p>
              <p>
                {detail.ordering}. Starting record {detail.startingRecord.id},
                revision {detail.startingRecord.version}.
              </p>
              <h4>Counted awards</h4>
              {!detail.counted.length && (
                <p>No counted current-season awards.</p>
              )}
              {detail.counted.map((a) => (
                <p key={a.id}>
                  {a.date} · {amount(a.points)} · frozen award{" "}
                  <code>{a.id}</code>
                </p>
              ))}
              <h4>Excluded awards</h4>
              {!detail.excluded.length && <p>No excluded awards.</p>}
              {detail.excluded.map((a) => (
                <p key={a.id}>
                  {a.date} · {amount(a.points)} · {a.reason}
                </p>
              ))}
            </section>
          )}
          {selected.result.excludedSubjects.length > 0 && (
            <details>
              <summary>
                Sourced subject exclusions (
                {selected.result.excludedSubjects.length})
              </summary>
              {selected.result.excludedSubjects.map((s) => (
                <p key={s.id}>
                  {s.name}: {s.reason}
                </p>
              ))}
            </details>
          )}
          <fieldset disabled={locked}>
            <legend>Immutable history and replay</legend>
            <label>
              Draft revision
              <select
                value={selected.id}
                onChange={async (e) => {
                  try {
                    setSelected(
                      await read<Saved>(`${path}?id=${e.target.value}`),
                    );
                    setDetailId("");
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {workspace?.history?.map((h) => (
                  <option value={h.id} key={h.id}>
                    Revision {h.version} · {h.state}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                void command.submit(
                  path,
                  {
                    action: "replay",
                    runId: selected.id,
                    discipline,
                    effectiveDate: selected.effectiveDate,
                      rulesId: rules,
                    requestId: crypto.randomUUID(),
                  },
                  "Frozen replay matched the original contributions and result digest.",
                )
              }
            >
              Replay frozen draft
            </button>
          </fieldset>
          <details>
            <summary>Frozen run manifest and digests</summary>
            <p>
              Manifest SHA-256 <code>{selected.manifestDigest}</code>
            </p>
            <p>
              Result SHA-256 <code>{selected.resultDigest}</code>
            </p>
            <p>Engine {selected.manifest.engineIdentity.codeRevision}</p>
            <pre>{JSON.stringify(selected.manifest, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  );
}
