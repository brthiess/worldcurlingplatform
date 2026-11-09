"use client";
import type { AssessmentEvidence } from "@/domain/event-assessment-input";
import type { Review } from "./event-assessments-workbench";
type Props = {
  evidence: AssessmentEvidence;
  review: Review;
  onChange: (value: AssessmentEvidence) => void;
};
export function AssessmentEvidenceEditor({
  evidence: v,
  review,
  onChange,
}: Props) {
  const patch = (p: Partial<AssessmentEvidence>) => onChange({ ...v, ...p });
  const event = (p: Partial<AssessmentEvidence["event"]>) =>
    patch({ event: { ...v.event, ...p } });
  const pre = (p: Partial<AssessmentEvidence["preEvent"]>) =>
    patch({ preEvent: { ...v.preEvent, ...p } });
  const entry = (
    i: number,
    p: Partial<AssessmentEvidence["entries"][number]>,
  ) =>
    patch({ entries: v.entries.map((e, j) => (i === j ? { ...e, ...p } : e)) });
  const sourcePicker = (
    label: string,
    value: string,
    change: (s: string) => void,
  ) => (
    <label>
      {label}
      <select value={value} onChange={(e) => change(e.target.value)}>
        <option value="">Unresolved source</option>
        {v.sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title || s.id}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <h3>Source register</h3>
      <p>
        Record the retrieved edition and its actual retrieval timestamp/hash.
        Fictional evidence must identify itself; a URL alone is not authenticity
        verification.
      </p>
      {v.sources.map((s, i) => (
        <fieldset key={s.id}>
          <legend>Source {i + 1}</legend>
          {(
            [
              ["title", "Source title"],
              ["url", "Source HTTPS URL"],
              ["edition", "Inspected edition"],
              ["retrievedAt", "Actual retrieval timestamp"],
              ["sha256", "Retrieved SHA-256"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                value={s[key]}
                onChange={(e) =>
                  patch({
                    sources: v.sources.map((x, j) =>
                      j === i ? { ...x, [key]: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              patch({ sources: v.sources.filter((_, j) => j !== i) })
            }
          >
            Remove source {i + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          patch({
            sources: [
              ...v.sources,
              {
                id: crypto.randomUUID(),
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
      <h3>Event edition and ranking snapshot</h3>
      <label>
        Event category
        <select
          value={v.event.kind}
          onChange={(e) =>
            event({ kind: e.target.value as typeof v.event.kind })
          }
        >
          {[
            ["tour", "Tour event"],
            ["nationals", "National championship"],
            ["world_qualifier", "World qualification event"],
            ["slam", "Grand Slam event"],
            ["europeans", "European championship"],
            ["trials", "National Olympic trials"],
            ["olympics", "Olympic Winter Games"],
            ["worlds", "World championships"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {sourcePicker(
        "Category designation source",
        v.event.kindSourceId,
        (kindSourceId) => event({ kindSourceId }),
      )}
      <label>
        Tour edition status
        <select
          value={
            v.event.newEvent === null ? "unknown" : String(v.event.newEvent)
          }
          onChange={(e) =>
            event({
              newEvent:
                e.target.value === "unknown" ? null : e.target.value === "true",
            })
          }
        >
          <option value="unknown">Unresolved edition linkage</option>
          <option value="true">
            New event without a previous-season edition
          </option>
          <option value="false">
            Existing event with a sourced previous edition
          </option>
        </select>
      </label>
      {v.event.newEvent === false && (
        <fieldset>
          <legend>Previous-season event strength</legend>
          <label>
            Previous event edition
            <select
              value={v.event.previous?.editionId ?? ""}
              onChange={(e) =>
                event({
                  previous: {
                    editionId: e.target.value,
                    sfm: v.event.previous?.sfm ?? "",
                    sourceId: v.event.previous?.sourceId ?? "",
                    digest: v.event.previous?.digest ?? "",
                  },
                })
              }
            >
              <option value="">Select the actual prior edition</option>
              {review.priorEditions?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.starts_on}
                </option>
              ))}
            </select>
          </label>
          <label>
            Exact previous SFM
            <input
              value={v.event.previous?.sfm ?? ""}
              onChange={(e) =>
                event({
                  previous: {
                    editionId: v.event.previous?.editionId ?? "",
                    sourceId: v.event.previous?.sourceId ?? "",
                    digest: v.event.previous?.digest ?? "",
                    sfm: e.target.value,
                  },
                })
              }
            />
          </label>
          {sourcePicker(
            "Previous strength source",
            v.event.previous?.sourceId ?? "",
            (sourceId) =>
              event({
                previous: {
                  editionId: v.event.previous?.editionId ?? "",
                  sfm: v.event.previous?.sfm ?? "",
                  digest: v.event.previous?.digest ?? "",
                  sourceId,
                },
              }),
          )}
          <label>
            Previous strength evidence digest
            <input
              value={v.event.previous?.digest ?? ""}
              onChange={(e) =>
                event({
                  previous: {
                    editionId: v.event.previous?.editionId ?? "",
                    sfm: v.event.previous?.sfm ?? "",
                    sourceId: v.event.previous?.sourceId ?? "",
                    digest: e.target.value,
                  },
                })
              }
            />
          </label>
        </fieldset>
      )}
      <label>
        WCTRS registration date
        <input
          type="date"
          value={v.event.registrationDate ?? ""}
          onChange={(e) => event({ registrationDate: e.target.value || null })}
        />
      </label>
      {sourcePicker(
        "Event eligibility and compliance source",
        v.event.eligibilitySourceId,
        (eligibilitySourceId) => event({ eligibilitySourceId }),
      )}
      <label>
        Event rules and publication compliance evidence
        <textarea
          rows={3}
          value={v.event.complianceNote}
          onChange={(e) => event({ complianceNote: e.target.value })}
        />
      </label>
      <label>
        Published roster, draw and end-score evidence URL
        <input
          value={v.event.resultsUrl}
          onChange={(e) => event({ resultsUrl: e.target.value })}
        />
      </label>
      <label>
        Ranking family
        <select
          value={v.preEvent.family}
          onChange={(e) => pre({ family: e.target.value })}
        >
          <option value="men_four">Men's four-player</option>
          <option value="women_four">Women's four-player</option>
        </select>
      </label>
      <label>
        Pre-event ranking effective date
        <input
          type="date"
          value={v.preEvent.effectiveDate}
          onChange={(e) => pre({ effectiveDate: e.target.value })}
        />
      </label>
      <label>
        Exact cutoff instant with offset
        <input
          value={v.preEvent.cutoffInstant}
          onChange={(e) => pre({ cutoffInstant: e.target.value })}
        />
      </label>
      {sourcePicker(
        "Exact pre-event ranking snapshot source",
        v.preEvent.sourceId,
        (sourceId) => pre({ sourceId }),
      )}
      <label>
        Assessment review rationale
        <textarea
          rows={3}
          value={v.reviewNote}
          onChange={(e) => patch({ reviewNote: e.target.value })}
        />
      </label>
      <h3>Game stages</h3>
      <p>
        Classify frozen games from their sourced competition terms. Phase names
        and planned times do not establish the first playoff game.
      </p>
      {review.publishedProfile ? (
        <div className="notice">
          <p>
            Published competition profile: {review.publishedProfile.templateId}{" "}
            revision {review.publishedProfile.templateVersion}; draw revision{" "}
            {review.publishedProfile.revision}; family{" "}
            {review.publishedProfile.definition.family}. This immutable profile
            must match the frozen field and every game.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              event({
                singleKnockout:
                  review.publishedProfile!.definition.family ===
                  "single_knockout",
              })
            }
          >
            Use the published competition format
          </button>
        </div>
      ) : (
        <fieldset>
          <legend>Sourced actual competition format</legend>
          <p>
            Legacy display text does not establish a ranking format. Review the
            actual event terms; keep unknown format unresolved.
          </p>
          <label>
            Actual calculation format
            <select
              value={v.event.formatReview.family}
              onChange={(e) =>
                event({
                  singleKnockout: e.target.value === "single_knockout",
                  formatReview: {
                    ...v.event.formatReview,
                    family: e.target
                      .value as typeof v.event.formatReview.family,
                  },
                })
              }
            >
              <option value="unknown">Unresolved actual format</option>
              <option value="single_knockout">
                Single knockout with no qualification phase
              </option>
              <option value="not_single_knockout">
                Reviewed format with qualification or another non-single
                structure
              </option>
            </select>
          </label>
          {sourcePicker(
            "Actual format evidence source",
            v.event.formatReview.sourceId,
            (sourceId) =>
              event({ formatReview: { ...v.event.formatReview, sourceId } }),
          )}
          <label>
            Actual format review rationale
            <textarea
              value={v.event.formatReview.note}
              onChange={(e) =>
                event({
                  formatReview: {
                    ...v.event.formatReview,
                    note: e.target.value,
                  },
                })
              }
            />
          </label>
        </fieldset>
      )}
      {review.current.games.map((g, i) => (
        <label key={g.id}>
          Game {i + 1} · {g.phase}
          <select
            aria-label={`Stage for game ${i + 1}`}
            value={
              v.event.qualificationGameIds.includes(g.id)
                ? "qualification"
                : v.event.playoffGameIds.includes(g.id)
                  ? "playoff"
                  : "unknown"
            }
            onChange={(e) =>
              event({
                qualificationGameIds: [
                  ...v.event.qualificationGameIds.filter((id) => id !== g.id),
                  ...(e.target.value === "qualification" ? [g.id] : []),
                ],
                playoffGameIds: [
                  ...v.event.playoffGameIds.filter((id) => id !== g.id),
                  ...(e.target.value === "playoff" ? [g.id] : []),
                ],
              })
            }
          >
            <option value="unknown">Unresolved stage</option>
            <option value="qualification">Qualification</option>
            <option value="playoff">Playoff</option>
          </select>
        </label>
      ))}
      <label>
        Bronze medal game
        <select
          value={v.event.bronzeGameId ?? ""}
          onChange={(e) => event({ bronzeGameId: e.target.value || null })}
        >
          <option value="">No bronze game</option>
          {review.current.games
            .filter((g) => v.event.playoffGameIds.includes(g.id))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.phase} · {g.id}
              </option>
            ))}
        </select>
      </label>
      <h3>Field, official roster and actual participation</h3>
      {v.entries.map((x, i) => {
        const name =
            review.current.entries.find((e) => e.id === x.entryId)?.name ??
            x.entryId,
          rank = v.preEvent.rows.find((e) => e.entryId === x.entryId),
          roster = review.starting.find(
            (e) => e.entryId === x.entryId,
          )?.evidence;
        const games = review.current.games.filter(
          (g) => g.entryA === x.entryId || g.entryB === x.entryId,
        );
        return (
          <fieldset key={x.entryId}>
            <legend>{name}</legend>
            <label>
              Ranking eligibility
              <select
                value={x.eligibility}
                onChange={(e) =>
                  entry(i, {
                    eligibility: e.target.value as typeof x.eligibility,
                  })
                }
              >
                <option value="unknown">Unresolved</option>
                <option value="eligible">
                  Eligible with required evidence
                </option>
                <option value="excluded">Excluded with sourced reason</option>
              </select>
            </label>
            <label>
              Exact pre-event rank
              <input
                type="number"
                min={1}
                value={rank?.rank ?? ""}
                onChange={(e) =>
                  pre({
                    rows: v.preEvent.rows.map((r) =>
                      r.entryId === x.entryId
                        ? {
                            ...r,
                            rank: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }
                        : r,
                    ),
                  })
                }
              />
            </label>
            <label>
              Exact pre-event points
              <input
                value={rank?.points ?? ""}
                onChange={(e) =>
                  pre({
                    rows: v.preEvent.rows.map((r) =>
                      r.entryId === x.entryId
                        ? { ...r, points: e.target.value || null }
                        : r,
                    ),
                  })
                }
              />
            </label>
            {sourcePicker(
              "Entry eligibility and participation source",
              x.sourceId,
              (sourceId) => entry(i, { sourceId, rosterReview: null }),
            )}
            <label>
              Entry eligibility, throughout-play and first-game rationale
              <textarea
                rows={3}
                value={x.note}
                onChange={(e) =>
                  entry(i, { note: e.target.value, rosterReview: null })
                }
              />
            </label>
            <details>
              <summary>Inspect current official roster evidence</summary>
              {roster ? (
                <>
                  <p>
                    Evidence revision {roster.version}; referenced/current
                    platform roster {roster.data.rosterVersion}/
                    {roster.currentRosterVersion}. Starting-input record remains{" "}
                    {roster.startingState}.
                  </p>
                  <p>
                    Official roster source:{" "}
                    {roster.data.rosterSourceId || "unresolved"}
                  </p>
                  <ul>
                    {roster.rankingPlayers
                      .filter((p) =>
                        roster.data.rankingPlayerIds.includes(p.playerId),
                      )
                      .map((p) => (
                        <li key={p.playerId}>
                          {p.name} · {p.identityStatus}
                        </li>
                      ))}
                  </ul>
                  {roster.data.sources.map((s) => (
                    <p key={s.id}>
                      {s.title} · <a href={s.url}>{s.edition}</a> · {s.sha256}
                    </p>
                  ))}
                </>
              ) : (
                <p>
                  Official roster evidence is missing. Record it through the
                  linked roster task.
                </p>
              )}
            </details>
            <button
              type="button"
              className="secondary"
              disabled={!roster || !x.sourceId || !x.note}
              onClick={() =>
                roster &&
                entry(i, {
                  rosterReview: {
                    recordId: roster.id,
                    version: roster.version,
                    sourceId: x.sourceId,
                    note: x.note,
                  },
                })
              }
            >
              Review this sourced roster for this event
            </button>
            <p role="status">
              Event roster review:{" "}
              {x.rosterReview
                ? `recorded for revision ${x.rosterReview.version}`
                : "required"}
            </p>
            <label>
              Sourced first playoff game
              <select
                value={x.firstPlayoffGameId ?? ""}
                onChange={(e) =>
                  entry(i, { firstPlayoffGameId: e.target.value || null })
                }
              >
                <option value="">
                  Unresolved or unnecessary for this record
                </option>
                {games
                  .filter((g) => v.event.playoffGameIds.includes(g.id))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.phase} · {g.id}
                    </option>
                  ))}
              </select>
            </label>
            <details>
              <summary>Record throughout-play participation</summary>
              <p>
                Add each observed lineup segment from the cited source.
                Declared/defaulted names are candidates; checking them
                explicitly records the staff-reviewed observation.
              </p>
              {games.map((g, j) => {
                const record = x.games.find((r) => r.gameId === g.id),
                  members =
                    (g.entryA === x.entryId
                      ? g.result?.lineupA
                      : g.result?.lineupB
                    )?.members ?? [];
                const update = (segments: string[][]) =>
                  entry(i, {
                    rosterReview: null,
                    games: [
                      ...x.games.filter((r) => r.gameId !== g.id),
                      { gameId: g.id, segments },
                    ],
                  });
                return (
                  <fieldset key={g.id}>
                    <legend>
                      Participation game {j + 1} · {g.phase}
                    </legend>
                    {record?.segments.map((segment, k) => (
                      <fieldset key={k}>
                        <legend>Observed segment {k + 1}</legend>
                        {members.map((m) => (
                          <label key={m.playerId}>
                            <input
                              type="checkbox"
                              checked={segment.includes(m.playerId)}
                              onChange={(e) =>
                                update(
                                  record.segments.map((s, index) =>
                                    index === k
                                      ? e.target.checked
                                        ? [...s, m.playerId]
                                        : s.filter((id) => id !== m.playerId)
                                      : s,
                                  ),
                                )
                              }
                            />
                            {m.name} · {m.identityStatus}
                          </label>
                        ))}
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            update(
                              record.segments.filter((_, index) => index !== k),
                            )
                          }
                        >
                          Remove segment {k + 1}
                        </button>
                      </fieldset>
                    ))}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => update([...(record?.segments ?? []), []])}
                    >
                      Add observed participation segment
                    </button>
                  </fieldset>
                );
              })}
            </details>
          </fieldset>
        );
      })}
    </>
  );
}
