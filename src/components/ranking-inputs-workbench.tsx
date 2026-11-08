"use client";
import { useEffect, useState } from "react";
import {
  allocationOptions,
  type Source,
  type RulesInput,
  type SeasonInput,
  type Contribution,
  type ReadinessIssue,
} from "@/domain/ranking-inputs";
import { wctrs2026 } from "@/domain/wctrs-2026";
type Member = {
  playerId: string;
  name: string;
  role: string;
  position: string;
  identityStatus: string;
};
type Registration = {
  id: string;
  teamId: string;
  name: string;
  season: string;
  version: number;
  discipline: string;
  members: Member[];
  platformCore: string[];
  reviewId: string | null;
};
type RuleSummary = {
  id: string;
  version: number;
  state: string;
  data: RulesInput;
};
type Workspace = { rules: RuleSummary[]; registrations: Registration[] };
type RecordView = {
  rankingPlayers: Member[];
  rosterSnapshot: Member[] | null;
  id: string;
  kind: "rules" | "season";
  version: number;
  latestVersion: number;
  state: string;
  data: RulesInput | SeasonInput;
  createdAt: string;
  actorId: string;
  history: {
    version: number;
    state: string;
    createdAt: string;
    actorId: string;
  }[];
  currentReadiness: {
    complete: boolean;
    startingInput: string | null;
    issues: ReadinessIssue[];
  } | null;
  savedReadiness: RecordView["currentReadiness"];
};
type Command = {
  id: string;
  kind: "rules" | "season";
  version: number;
  requestId: string;
  state: string;
  data: RulesInput | SeasonInput;
};
function Sources({
  value,
  onChange,
}: {
  value: Source[];
  onChange: (s: Source[]) => void;
}) {
  const update = (i: number, key: keyof Source, v: string) =>
    onChange(value.map((s, n) => (n === i ? { ...s, [key]: v } : s)));
  return (
    <section className="ranking-sources">
      <h3>Source editions</h3>
      <p>
        Keep the URL, edition, retrieval time and SHA-256 of the evidence
        actually inspected. A hash identifies retrieved bytes; staff review
        establishes applicability.
      </p>
      {value.length === 0 && (
        <p className="notice">
          No sources recorded. Required starting amounts remain unresolved.
        </p>
      )}
      {value.map((s, i) => (
        <details key={i}>
          <summary>
            {s.title || `Source ${i + 1}`}{" "}
            <span className="muted">{s.edition}</span>
          </summary>
          <div className="ranking-grid">
            {(
              [
                "id",
                "title",
                "url",
                "edition",
                "retrievedAt",
                "sha256",
              ] as const
            ).map((key) => (
              <label key={key}>
                {`Source ${i + 1} ${key === "retrievedAt" ? "retrieved at (ISO time)" : key === "sha256" ? "SHA-256" : key}`}
                <input
                  value={s[key]}
                  onChange={(e) => update(i, key, e.target.value)}
                />
              </label>
            ))}
          </div>
          {s.url.startsWith("https://") && (
            <p>
              <a href={s.url} target="_blank" rel="noreferrer">
                Inspect source in new tab
              </a>
            </p>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            Remove source {i + 1}
          </button>
        </details>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          onChange([
            ...value,
            {
              id: `source-${value.length + 1}`,
              title: "",
              url: "",
              edition: "",
              retrievedAt: new Date().toISOString(),
              sha256: "",
            },
          ])
        }
      >
        Add source edition
      </button>
    </section>
  );
}
function Reference({
  label,
  value,
  sources,
  onChange,
}: {
  label: string;
  value: string;
  sources: Source[];
  onChange: (s: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Unresolved / no source</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title || s.id} ({s.id})
          </option>
        ))}
      </select>
    </label>
  );
}
export function RankingInputsWorkbench() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [tab, setTab] = useState<"rules" | "season">("season"),
    [record, setRecord] = useState<RecordView | null>(null),
    [rule, setRule] = useState<RulesInput | null>(null),
    [input, setInput] = useState<SeasonInput | null>(null),
    [registration, setRegistration] = useState<Registration | null>(null),
    [id, setId] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState<Command | null>(null),
    [dirty, setDirty] = useState(false);
  const [extraPlayers, setExtraPlayers] = useState<Member[]>([]);
  const frozen = busy || !!retry;
  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/v1/ranking-inputs", { cache: "no-store" });
      if (!r.ok)
        throw new Error(
          r.status === 401
            ? "Sign in to review ranking inputs."
            : r.status === 403
              ? "World Curling staff authority is required."
              : "Ranking review could not be loaded. Retry the read.",
        );
      setWorkspace(await r.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function clear() {
    setExtraPlayers([]);
    setRecord(null);
    setRule(null);
    setInput(null);
    setRegistration(null);
    setError("");
    setMessage("");
    setDirty(false);
    setVersion(0);
    setId("");
  }
  function editRule(v: RulesInput) {
    setRule(v);
    setDirty(true);
    setMessage("Unsaved rule/source changes.");
  }
  function editInput(v: SeasonInput) {
    setInput(v);
    setDirty(true);
    setMessage("Unsaved team-season changes. Save a draft to refresh issues.");
  }
  function applyRecord(v: RecordView) {
    setRecord(v);
    setId(v.id);
    setVersion(v.latestVersion);
    if (v.kind === "rules") {
      setRule(v.data as RulesInput);
      setInput(null);
    } else {
      setInput(v.data as SeasonInput);
      setRule(null);
    }
    setDirty(false);
  }
  async function open(id: string, v?: number) {
    setBusy(true);
    setError("");
    setMessage("Loading recorded evidence…");
    try {
      const r = await fetch(
        `/api/v1/ranking-inputs?id=${encodeURIComponent(id)}${v ? `&version=${v}` : ""}`,
        { cache: "no-store" },
      );
      if (!r.ok)
        throw new Error(
          "Recorded evidence could not be loaded. Retry opening it.",
        );
      const saved = await r.json();
      applyRecord(saved);
      setMessage(
        v
          ? "Historical revision is read-only. Open the latest revision to amend."
          : "Recorded evidence loaded.",
      );
    } catch (e) {
      setError((e as Error).message);
      setMessage("");
    } finally {
      setBusy(false);
    }
  }
  async function selectRegistration(reg: Registration) {
    clear();
    setRegistration(reg);
    if (reg.reviewId) {
      await open(reg.reviewId);
      return;
    }
    const selected = workspace?.rules.find((r) => r.data.season === reg.season);
    setId(crypto.randomUUID());
    setInput({
      registrationId: reg.id,
      rosterVersion: reg.version,
      rulesId: selected?.id ?? "",
      rulesVersion: selected?.version ?? 1,
      effectiveFrom: "2026-08-01",
      effectiveTo: "2027-08-01",
      rankingPlayerIds: reg.members
        .filter((m) => m.role === "core")
        .map((m) => m.playerId),
      rankingAlternateIds: reg.members
        .filter((m) => m.role === "alternate")
        .map((m) => m.playerId),
      rosterSourceId: "",
      allocationOption: "unresolved",
      allocations: [],
      sources: [],
      contributions: reg.members
        .filter((m) => m.role === "core")
        .map((m) => ({
          playerId: m.playerId,
          amount: null,
          basis: "unknown",
          sourceId: "",
          ownershipSourceId: "",
          eligibilitySourceId: "",
          note: "",
          priorTotal: null,
          priorShare: null,
        })),
      reviewNote: "",
      biographyMissing: false,
    });
    setDirty(true);
  }
  async function save(state: string, command?: Command) {
    const data = tab === "rules" ? rule : input;
    if (!data && !command) return;
    const cmd = command ?? {
      id,
      kind: tab,
      version,
      requestId: crypto.randomUUID(),
      state,
      data: data!,
    };
    setBusy(true);
    setError("");
    setMessage("Saving evidence…");
    try {
      const r = await fetch("/api/v1/ranking-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmd),
      });
      if (r.status >= 500)
        throw new Error(
          "Your save could not be confirmed. Retry the same evidence request.",
        );
      const result = await r.json();
      if (!r.ok) {
        setRetry(null);
        setError(result.error ?? "Evidence could not be saved.");
        setMessage(
          r.status === 409
            ? "Reload the latest evidence before revising."
            : "Changes remain unsaved.",
        );
        return;
      }
      setRetry(null);
      applyRecord(result);
      setMessage(
        state === "reviewed"
          ? "Reviewed evidence saved. This is not a ranking publication."
          : "Draft saved. Required evidence issues remain visible.",
      );
      if (result.kind === "rules")
        setWorkspace((w) =>
          w
            ? {
                ...w,
                rules: [
                  {
                    id: result.id,
                    version: result.version,
                    state: result.state,
                    data: result.data,
                  },
                  ...w.rules.filter((x) => x.id !== result.id),
                ],
              }
            : w,
        );
      else
        setWorkspace((w) =>
          w
            ? {
                ...w,
                registrations: w.registrations.map((reg) =>
                  reg.id === result.data.registrationId
                    ? { ...reg, reviewId: result.id }
                    : reg,
                ),
              }
            : w,
        );
    } catch (e) {
      setRetry(cmd);
      setError((e as Error).message);
      setMessage(
        "Uncertain save: editing is frozen until the original request is acknowledged.",
      );
    } finally {
      setBusy(false);
    }
  }
  const historical = !!record && record.version !== record.latestVersion;
  const rosterMembers =
    record?.rosterSnapshot && input?.rosterVersion !== registration?.version
      ? record.rosterSnapshot
      : (registration?.members ?? []);
  const rankingCandidates = [
    ...new Map(
      [
        ...rosterMembers,
        ...(record?.rankingPlayers ?? []),
        ...extraPlayers,
      ].map((m) => [m.playerId, m]),
    ).values(),
  ];
  function assignRankingRole(playerId: string, role: string) {
    if (!input) return;
    editInput({
      ...input,
      rankingPlayerIds: [
        ...input.rankingPlayerIds.filter((id) => id !== playerId),
        ...(role === "regular" ? [playerId] : []),
      ],
      rankingAlternateIds: [
        ...input.rankingAlternateIds.filter((id) => id !== playerId),
        ...(role === "alternate" ? [playerId] : []),
      ],
      allocations: [],
      contributions:
        role === "regular"
          ? [
              ...input.contributions.filter((c) => c.playerId !== playerId),
              input.contributions.find((c) => c.playerId === playerId) ?? {
                playerId,
                amount: null,
                basis: "unknown",
                sourceId: "",
                ownershipSourceId: "",
                eligibilitySourceId: "",
                note: "",
                priorTotal: null,
                priorShare: null,
              },
            ]
          : input.contributions.filter((c) => c.playerId !== playerId),
    });
  }
  const updateContribution = (
    playerId: string,
    key: keyof Contribution,
    value: string,
  ) => {
    if (input)
      editInput({
        ...input,
        contributions: input.contributions.map((c) =>
          c.playerId === playerId ? { ...c, [key]: value } : c,
        ),
      });
  };
  return (
    <main id="main" className="workspace ranking-workspace">
      <p className="eyebrow">World Curling staff · Ranking evidence</p>
      <h1>Season inputs & rule editions</h1>
      <p>
        Review registered ranking rosters and sourced starting entitlements
        independently of event lineups. Team identity does not grant point
        rights.
      </p>
      <p>
        <a href="/admin">Workspace</a> ·{" "}
        <a href="/admin/entries">
          Maintain season registration through manual entries
        </a>
      </p>
      <div className="notice">
        Fictional review environment. This screen records evidence; event
        calculations and ranking publication are separate workflows.
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {retry && (
        <button disabled={busy} onClick={() => void save(retry.state, retry)}>
          Retry original save
        </button>
      )}
      {loading ? (
        <p role="status">Loading rule editions and team-seasons…</p>
      ) : !workspace ? (
        <>
          <p>
            <a href="/admin">Sign in with staff access</a>
          </p>
          <button onClick={() => void load()}>Retry loading review</button>
        </>
      ) : (
        <>
          <fieldset className="ranking-navigation" disabled={frozen}>
            <legend>Review area</legend>
            <button
              className={tab === "season" ? "" : "secondary"}
              onClick={() => {
                clear();
                setTab("season");
              }}
            >
              Team-season review
            </button>
            <button
              className={tab === "rules" ? "" : "secondary"}
              onClick={() => {
                clear();
                setTab("rules");
              }}
            >
              Rule editions
            </button>
          </fieldset>
          <fieldset className="ranking-navigation" disabled={frozen}>
            <legend>
              {tab === "rules" ? "Choose source edition" : "Choose team-season"}
            </legend>
            {tab === "rules" ? (
              <>
                <label>
                  Rule edition
                  <select
                    value={rule && version > 0 ? id : ""}
                    onChange={(e) => {
                      clear();
                      if (e.target.value) void open(e.target.value);
                    }}
                  >
                    <option value="">Choose a recorded edition</option>
                    {workspace.rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.data.title} · v{r.version} · {r.state}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary"
                  onClick={() => {
                    clear();
                    setId(crypto.randomUUID());
                    setRule(wctrs2026());
                    setDirty(true);
                  }}
                >
                  Start 2026-27 source edition
                </button>
                {workspace.rules.length === 0 && (
                  <p>
                    No rule editions recorded. Start the sourced 2026-27
                    edition, inspect its evidence and save your review.
                  </p>
                )}
              </>
            ) : (
              <>
                <label>
                  Team-season
                  <select
                    value={registration?.id ?? ""}
                    onChange={(e) => {
                      const reg = workspace.registrations.find(
                        (r) => r.id === e.target.value,
                      );
                      if (reg) void selectRegistration(reg);
                      else clear();
                    }}
                  >
                    <option value="">Choose a season registration</option>
                    {workspace.registrations.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.season} · roster v{r.version}
                      </option>
                    ))}
                  </select>
                </label>
                {workspace.registrations.length === 0 && (
                  <p>
                    No season registrations. Create a known core and season
                    registration through manual entries first.
                  </p>
                )}
              </>
            )}
          </fieldset>
          {record && (
            <section className="ranking-history">
              <h2>Recorded revision {record.version}</h2>
              <p>
                {record.state === "reviewed" ? "Staff reviewed" : "Draft"} ·{" "}
                {new Date(record.createdAt).toISOString()} · actor{" "}
                {record.actorId}
              </p>
              <p>
                Rule and roster references remain pinned. New factual changes
                create new revisions.
              </p>
              <div className="ranking-actions">
                {record.history.map((h) => (
                  <button
                    className="secondary"
                    key={h.version}
                    disabled={frozen}
                    onClick={() =>
                      void open(
                        record.id,
                        h.version === record.latestVersion
                          ? undefined
                          : h.version,
                      )
                    }
                  >
                    Open v{h.version} · {h.state}
                  </button>
                ))}
              </div>
              {historical && (
                <p className="notice">
                  Historical revision. Open v{record.latestVersion} to amend the
                  latest evidence.
                </p>
              )}
            </section>
          )}
          {(rule || input) && (
            <form
              className="form-card ranking-form"
              onSubmit={(e) => {
                e.preventDefault();
                void save("draft");
              }}
            >
              <fieldset disabled={frozen || historical}>
                {rule && (
                  <>
                    <h2>Rule/source edition</h2>
                    <div className="ranking-grid">
                      <label>
                        Edition title
                        <input
                          value={rule.title}
                          onChange={(e) =>
                            editRule({ ...rule, title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Season
                        <input
                          value={rule.season}
                          onChange={(e) =>
                            editRule({ ...rule, season: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Effective from (inclusive)
                        <input
                          type="date"
                          value={rule.effectiveFrom}
                          onChange={(e) =>
                            editRule({ ...rule, effectiveFrom: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Effective to (exclusive)
                        <input
                          type="date"
                          value={rule.effectiveTo}
                          onChange={(e) =>
                            editRule({ ...rule, effectiveTo: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <Sources
                      value={rule.sources}
                      onChange={(sources) => editRule({ ...rule, sources })}
                    />
                    <details>
                      <summary>
                        Effective checkpoints ({rule.checkpoints.length})
                      </summary>
                      <p>
                        Calendar dates only. This record does not invent a
                        cutoff timezone or decide which event completion belongs
                        to a date.
                      </p>
                      {rule.checkpoints.map((c, i) => (
                        <fieldset className="ranking-checkpoint" key={i}>
                          <legend>
                            Checkpoint {i + 1} · {c.family}
                          </legend>
                          <div className="ranking-grid">
                            <label>
                              Family
                              <select
                                value={c.family}
                                onChange={(e) =>
                                  editRule({
                                    ...rule,
                                    checkpoints: rule.checkpoints.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            family: e.target
                                              .value as typeof c.family,
                                          }
                                        : v,
                                    ),
                                  })
                                }
                              >
                                <option value="four_overall">
                                  Men / women overall
                                </option>
                                <option value="four_series">
                                  Men / women series
                                </option>
                                <option value="mixed_doubles">
                                  Mixed doubles
                                </option>
                              </select>
                            </label>
                            <label>
                              From date
                              <input
                                type="date"
                                value={c.from}
                                onChange={(e) =>
                                  editRule({
                                    ...rule,
                                    checkpoints: rule.checkpoints.map((v, n) =>
                                      n === i
                                        ? { ...v, from: e.target.value }
                                        : v,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Maximum events
                              <input
                                type="number"
                                min="1"
                                max="8"
                                value={c.maxEvents}
                                onChange={(e) =>
                                  editRule({
                                    ...rule,
                                    checkpoints: rule.checkpoints.map((v, n) =>
                                      n === i
                                        ? {
                                            ...v,
                                            maxEvents: Number(e.target.value),
                                          }
                                        : v,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Prior-season weight (exact)
                              <input
                                value={c.priorWeight}
                                onChange={(e) =>
                                  editRule({
                                    ...rule,
                                    checkpoints: rule.checkpoints.map((v, n) =>
                                      n === i
                                        ? { ...v, priorWeight: e.target.value }
                                        : v,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <Reference
                              label="Checkpoint source"
                              value={c.sourceId}
                              sources={rule.sources}
                              onChange={(sourceId) =>
                                editRule({
                                  ...rule,
                                  checkpoints: rule.checkpoints.map((v, n) =>
                                    n === i ? { ...v, sourceId } : v,
                                  ),
                                })
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              editRule({
                                ...rule,
                                checkpoints: rule.checkpoints.filter(
                                  (_, n) => n !== i,
                                ),
                              })
                            }
                          >
                            Remove checkpoint {i + 1}
                          </button>
                        </fieldset>
                      ))}
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          editRule({
                            ...rule,
                            checkpoints: [
                              ...rule.checkpoints,
                              {
                                family: "four_overall",
                                from: rule.effectiveFrom,
                                maxEvents: 1,
                                priorWeight: "1",
                                sourceId: rule.sources[0]?.id ?? "",
                              },
                            ],
                          })
                        }
                      >
                        Add checkpoint
                      </button>
                    </details>
                    <h3>Supported interpretations & unresolved branches</h3>
                    <p>
                      Supported means an explicit application interpretation
                      with evidence. It does not claim an official
                      clarification.
                    </p>
                    {rule.interpretations.map((v, i) => (
                      <details key={v.code}>
                        <summary>
                          {v.code} · {v.state}
                        </summary>
                        <label>
                          Interpretation state
                          <select
                            value={v.state}
                            onChange={(e) =>
                              editRule({
                                ...rule,
                                interpretations: rule.interpretations.map(
                                  (x, n) =>
                                    n === i
                                      ? {
                                          ...x,
                                          state: e.target
                                            .value as typeof v.state,
                                        }
                                      : x,
                                ),
                              })
                            }
                          >
                            <option value="supported">
                              Supported interpretation
                            </option>
                            <option value="unresolved">Unresolved</option>
                          </select>
                        </label>
                        <label>
                          Interpretation rationale
                          <textarea
                            value={v.note}
                            onChange={(e) =>
                              editRule({
                                ...rule,
                                interpretations: rule.interpretations.map(
                                  (x, n) =>
                                    n === i
                                      ? { ...x, note: e.target.value }
                                      : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <p>Sources: {v.sourceIds.join(", ")}</p>
                      </details>
                    ))}
                    <label>
                      Rule review rationale
                      <textarea
                        value={rule.reviewNote}
                        onChange={(e) =>
                          editRule({ ...rule, reviewNote: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {input && registration && (
                  <>
                    <h2>
                      {registration.name} · {registration.season}
                    </h2>
                    <p>
                      Platform core: {registration.platformCore.length}{" "}
                      regulars. Season roster v{input.rosterVersion}. Event
                      lineups and profile ownership cannot amend this evidence.
                    </p>
                    <ul className="public-roster">
                      {rosterMembers.map((m) => (
                        <li key={m.playerId}>
                          <span>{m.name}</span>
                          <strong>
                            {m.role === "core"
                              ? "Regular core"
                              : m.role === "alternate"
                                ? "Designated alternate"
                                : "Coach"}
                          </strong>
                        </li>
                      ))}
                    </ul>
                    {input.rosterVersion !== registration.version && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          editInput({
                            ...input,
                            rosterVersion: registration.version,
                          })
                        }
                      >
                        Use current platform season snapshot v
                        {registration.version} and recheck evidence
                      </button>
                    )}
                    <div className="ranking-grid">
                      <label>
                        Rule/source version
                        <select
                          value={`${input.rulesId}:${input.rulesVersion}`}
                          onChange={(e) => {
                            const selected = workspace.rules.find(
                              (r) => `${r.id}:${r.version}` === e.target.value,
                            );
                            if (selected)
                              editInput({
                                ...input,
                                rulesId: selected.id,
                                rulesVersion: selected.version,
                              });
                          }}
                        >
                          <option value=":1">Choose reviewed sources</option>
                          {!workspace.rules.some(
                            (r) =>
                              r.id === input.rulesId &&
                              r.version === input.rulesVersion,
                          ) &&
                            input.rulesId && (
                              <option
                                value={`${input.rulesId}:${input.rulesVersion}`}
                              >
                                Pinned source edition v{input.rulesVersion}{" "}
                                (open rule history to inspect)
                              </option>
                            )}
                          {workspace.rules.map((r) => (
                            <option key={r.id} value={`${r.id}:${r.version}`}>
                              {r.data.title} · v{r.version} · {r.state}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Input effective from
                        <input
                          type="date"
                          value={input.effectiveFrom}
                          onChange={(e) =>
                            editInput({
                              ...input,
                              effectiveFrom: e.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Input effective to (exclusive)
                        <input
                          type="date"
                          value={input.effectiveTo}
                          onChange={(e) =>
                            editInput({ ...input, effectiveTo: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <h3>Separately registered ranking roster</h3>
                    <p>
                      Official ranking roles are recorded independently of
                      platform core/alternate roles. A roster declaration source
                      is required. Ownership belongs only to the explicitly
                      registered ranking regulars.
                    </p>
                    <Reference
                      label="Ranking roster declaration source"
                      value={input.rosterSourceId}
                      sources={input.sources}
                      onChange={(rosterSourceId) =>
                        editInput({ ...input, rosterSourceId })
                      }
                    />
                    <div className="ranking-grid">
                      {rankingCandidates.map((m) => (
                        <label key={m.playerId}>
                          {m.name} official ranking role
                          <select
                            value={
                              input.rankingPlayerIds.includes(m.playerId)
                                ? "regular"
                                : input.rankingAlternateIds.includes(m.playerId)
                                  ? "alternate"
                                  : "none"
                            }
                            onChange={(e) =>
                              assignRankingRole(m.playerId, e.target.value)
                            }
                          >
                            <option value="regular">Registered regular</option>
                            <option value="alternate">
                              Designated ranking alternate
                            </option>
                            <option value="none">Not on ranking roster</option>
                          </select>
                        </label>
                      ))}
                    </div>
                    <p>
                      To include a separately registered player outside this
                      platform season roster, enter their existing player ID.
                      This leaves platform core and season history unchanged.
                    </p>
                    <label>
                      Existing ranking player ID
                      <input name="ranking-player-id" id="ranking-player-id" />
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={async () => {
                        const field = document.getElementById(
                          "ranking-player-id",
                        ) as HTMLInputElement;
                        const playerId = field.value.trim();
                        setBusy(true);
                        setError("");
                        try {
                          const r = await fetch(
                            "/api/v1/public/players/" +
                              encodeURIComponent(playerId),
                          );
                          if (!r.ok)
                            throw new Error(
                              "Existing player not found. Select a recorded player ID.",
                            );
                          const p = await r.json();
                          setExtraPlayers((old) => [
                            ...old.filter((m) => m.playerId !== p.id),
                            {
                              playerId: p.id,
                              name: p.name,
                              identityStatus: p.identityStatus,
                              role: "ranking",
                              position: "",
                            },
                          ]);
                          assignRankingRole(p.id, "regular");
                          field.value = "";
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Add existing ranking regular
                    </button>
                    <label>
                      Declared allocation option
                      <select
                        value={input.allocationOption}
                        onChange={(e) =>
                          editInput({
                            ...input,
                            allocationOption: e.target
                              .value as SeasonInput["allocationOption"],
                          })
                        }
                      >
                        {allocationOptions.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>
                      Enter exact rights per player (for example 1/4 or 1/6).
                      Empty ownership stays unresolved. Rounded percentages are
                      never normalized.
                    </p>
                    <div className="ranking-grid">
                      {input.rankingPlayerIds.map((playerId) => (
                        <label key={playerId}>
                          {
                            rankingCandidates.find(
                              (m) => m.playerId === playerId,
                            )?.name
                          }{" "}
                          exact share
                          <input
                            value={
                              input.allocations.find(
                                (a) => a.playerId === playerId,
                              )?.share ?? ""
                            }
                            onChange={(e) =>
                              editInput({
                                ...input,
                                allocations: input.rankingPlayerIds.map(
                                  (id) => ({
                                    playerId: id,
                                    share:
                                      id === playerId
                                        ? e.target.value
                                        : (input.allocations.find(
                                            (a) => a.playerId === id,
                                          )?.share ?? ""),
                                  }),
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <Sources
                      value={input.sources}
                      onChange={(sources) => editInput({ ...input, sources })}
                    />
                    <h3>Sourced starting entitlements</h3>
                    <p>
                      Record individual source inputs, including evidenced zero
                      entitlements. An old team total alone cannot establish
                      ownership. No editable ranking total is provided.
                    </p>
                    {input.contributions.map((c) => (
                      <details key={c.playerId}>
                        <summary>
                          {
                            rankingCandidates.find(
                              (m) => m.playerId === c.playerId,
                            )?.name
                          }{" "}
                          · {c.amount ?? "amount unresolved"} · {c.basis}
                        </summary>
                        <div className="ranking-grid">
                          <label>
                            Evidence basis
                            <select
                              value={c.basis}
                              onChange={(e) =>
                                updateContribution(
                                  c.playerId,
                                  "basis",
                                  e.target.value,
                                )
                              }
                            >
                              <option value="unknown">Unknown</option>
                              <option value="historical-aggregate">
                                Historical aggregate only (incomplete)
                              </option>
                              <option value="documented-individual">
                                Documented individual entitlement
                              </option>
                              <option value="prior-team-share">
                                Sourced prior-team share
                              </option>
                            </select>
                          </label>
                          <label>
                            Exact sourced amount
                            <input
                              value={c.amount ?? ""}
                              onChange={(e) =>
                                updateContribution(
                                  c.playerId,
                                  "amount",
                                  e.target.value,
                                )
                              }
                            />
                          </label>
                          <Reference
                            label="Amount source"
                            value={c.sourceId}
                            sources={input.sources}
                            onChange={(v) =>
                              updateContribution(c.playerId, "sourceId", v)
                            }
                          />
                          <Reference
                            label="Ownership source"
                            value={c.ownershipSourceId}
                            sources={input.sources}
                            onChange={(v) =>
                              updateContribution(
                                c.playerId,
                                "ownershipSourceId",
                                v,
                              )
                            }
                          />
                          <Reference
                            label="Eligibility / decision source"
                            value={c.eligibilitySourceId}
                            sources={input.sources}
                            onChange={(v) =>
                              updateContribution(
                                c.playerId,
                                "eligibilitySourceId",
                                v,
                              )
                            }
                          />
                          {c.basis === "prior-team-share" && (
                            <>
                              <label>
                                Prior team total (sourced)
                                <input
                                  value={c.priorTotal ?? ""}
                                  onChange={(e) =>
                                    updateContribution(
                                      c.playerId,
                                      "priorTotal",
                                      e.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Prior exact ownership share
                                <input
                                  value={c.priorShare ?? ""}
                                  onChange={(e) =>
                                    updateContribution(
                                      c.playerId,
                                      "priorShare",
                                      e.target.value,
                                    )
                                  }
                                />
                              </label>
                            </>
                          )}
                        </div>
                        <label>
                          Ownership / eligibility applicability notes
                          <textarea
                            value={c.note}
                            onChange={(e) =>
                              updateContribution(
                                c.playerId,
                                "note",
                                e.target.value,
                              )
                            }
                          />
                        </label>
                      </details>
                    ))}
                    <label>
                      Input review rationale
                      <textarea
                        value={input.reviewNote}
                        onChange={(e) =>
                          editInput({ ...input, reviewNote: e.target.value })
                        }
                      />
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={input.biographyMissing}
                        onChange={(e) =>
                          editInput({
                            ...input,
                            biographyMissing: e.target.checked,
                          })
                        }
                      />
                      Optional biography missing (informational)
                    </label>
                  </>
                )}
                <div className="ranking-actions">
                  <button type="submit">Save draft evidence</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void save("reviewed")}
                  >
                    Record staff review
                  </button>
                  {record && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void open(record.id)}
                    >
                      Reload latest evidence
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
          )}
          {input && (
            <section className="ranking-issues" aria-label="Ranking readiness">
              <h2>Starting-input readiness</h2>
              {dirty ? (
                <p className="notice">
                  Unsaved changes. Save a draft to see current server-checked
                  issues.
                </p>
              ) : record?.currentReadiness ? (
                <>
                  <p
                    className={
                      record.currentReadiness.complete ? "notice" : "error"
                    }
                  >
                    {record.currentReadiness.complete
                      ? "Required starting evidence is complete."
                      : "Required evidence is unresolved. Publication must remain blocked."}
                  </p>
                  {record.currentReadiness.startingInput !== null && (
                    <p>
                      Sum of sourced starting inputs:{" "}
                      <strong>{record.currentReadiness.startingInput}</strong>.
                      This is an input sum, not a calculated ranking total or
                      continuity award.
                    </p>
                  )}
                  {record.savedReadiness?.complete &&
                    !record.currentReadiness.complete && (
                      <p>
                        The earlier review remains in history; current readiness
                        changed.
                      </p>
                    )}
                  <ul>
                    {record.currentReadiness.issues.map((i) => (
                      <li key={i.code}>
                        <strong>
                          {i.severity === "blocker"
                            ? "Blocker"
                            : "Informational"}
                          : {i.message}
                        </strong>
                        <p>{i.action}</p>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  Save a draft to inspect evidence issues. Unrecorded inputs are
                  unresolved.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
