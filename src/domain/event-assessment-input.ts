import { EntryError, identifier, plainText } from "./entries";
import {
  calendarDate,
  exact,
  positiveVersion,
  sourceInput,
  type Source,
} from "./ranking-inputs";
import type { EventKind } from "./event-assessments";
export const assessmentPolicy = {
  id: "wcp.four-event-policy.2026-27.v1",
  authority:
    "Application interpretation; not an official World Curling clarification",
  stages:
    "Exact contributions → 24/N → teams factor → tour prior/current floor → category cap/importance → single knockout ×3/4 → final nearest tenth, positive midpoint half-up. Awards retain exact rational values.",
  cutoff:
    "Strict preceding Tuesday in the event venue timezone; reviewed ranking snapshot effective on that Tuesday at its explicit recorded instant. Tuesday starts use the previous week. No historical-list selection is inferred.",
  classification:
    "Tour series uses final rounded SFM; special/set strength is Champion. Series membership is assessment metadata, not list publication.",
  exclusions:
    "All competing entries remain in N; only eligible entries contribute strength or receive points. Explicit exclusions do not silently decide a season deduction. Penalty/exemption and forfeit branches remain blocked.",
  split:
    "Shared last qualifier group receives remaining placement slots divided equally; top four entitlement is retained. Only actual losing-record playoff qualifiers receive the first-game reduction.",
} as const;
export type AssessmentEvidence = {
  rulesId: string;
  rulesVersion: number;
  policyId: string;
  reviewNote: string;
  sources: Source[];
  preEvent: {
    effectiveDate: string;
    cutoffInstant: string;
    sourceId: string;
    family: string;
    rows: { entryId: string; rank: number | null; points: string | null }[];
  };
  event: {
    kind: EventKind;
    kindSourceId: string;
    newEvent: boolean | null;
    previous: null | {
      editionId: string;
      sfm: string;
      sourceId: string;
      digest: string;
    };
    registrationDate: string | null;
    eligibilitySourceId: string;
    complianceNote: string;
    resultsUrl: string;
    singleKnockout: boolean;
    qualificationGameIds: string[];
    playoffGameIds: string[];
    bronzeGameId: string | null;
  };
  entries: {
    entryId: string;
    eligibility: "eligible" | "excluded" | "unknown";
    sourceId: string;
    note: string;
    rosterReview: null | {
      recordId: string;
      version: number;
      sourceId: string;
      note: string;
    };
    firstPlayoffGameId: string | null;
    games: { gameId: string; segments: string[][] }[];
  }[];
};
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new EntryError("Provide assessment evidence.");
  return v as Record<string, unknown>;
}
function arr(v: unknown, max = 512): unknown[] {
  if (!Array.isArray(v) || v.length > max)
    throw new EntryError(`Provide at most ${max} records.`);
  return v;
}
function text(v: unknown, max = 2000) {
  return plainText(v ?? "", max, true);
}
function ids(v: unknown) {
  const rows = arr(v).map(identifier);
  if (new Set(rows).size !== rows.length)
    throw new EntryError("Duplicate evidence identifiers.");
  return rows;
}
export function assessmentEvidence(raw: unknown): AssessmentEvidence {
  const r = obj(raw),
    p = obj(r.preEvent),
    e = obj(r.event),
    sources = arr(r.sources, 30).map(sourceInput);
  if (new Set(sources.map((s) => s.id)).size !== sources.length)
    throw new EntryError("Duplicate source identifiers.");
  const reference = (v: unknown) => {
    if (v === "" || v == null) return "";
    const id = identifier(v);
    if (!sources.some((s) => s.id === id))
      throw new EntryError("Evidence reference needs a recorded source.");
    return id;
  };
  if (r.policyId !== assessmentPolicy.id)
    throw new EntryError(
      "Review the current explicit application calculation policy.",
    );
  const kind = e.kind as EventKind;
  if (
    ![
      "tour",
      "nationals",
      "world_qualifier",
      "slam",
      "europeans",
      "trials",
      "olympics",
      "worlds",
    ].includes(kind) ||
    typeof e.singleKnockout !== "boolean" ||
    ![true, false, null].includes(e.newEvent as null)
  )
    throw new EntryError(
      "Select the event category, edition linkage and knockout profile.",
    );
  const previous = e.previous == null ? null : obj(e.previous);
  const digest = (v: unknown) => {
    if (typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v))
      throw new EntryError("Retain the exact source digest.");
    return v;
  };
  let cutoffInstant = text(p.cutoffInstant, 80);
  if (
    cutoffInstant &&
    (!/^20\d{2}-.+T.+(?:Z|[+-]\d{2}:\d{2})$/.test(cutoffInstant) ||
      !Number.isFinite(Date.parse(cutoffInstant)))
  )
    throw new EntryError(
      "Use an explicit cutoff instant with timezone offset.",
    );
  let resultsUrl = text(e.resultsUrl, 500);
  if (resultsUrl) {
    let u: URL;
    try {
      u = new URL(resultsUrl);
    } catch {
      throw new EntryError("Use an HTTPS results evidence URL.");
    }
    if (u.protocol !== "https:" || u.username || u.password || u.hash)
      throw new EntryError("Use an HTTPS results evidence URL.");
    resultsUrl = u.href;
  }
  const rows = arr(p.rows).map((raw) => {
    const row = obj(raw);
    if (
      row.rank !== null &&
      (!Number.isSafeInteger(row.rank) || Number(row.rank) < 1)
    )
      throw new EntryError(
        "Rank must be a positive integer or unresolved null.",
      );
    return {
      entryId: identifier(row.entryId),
      rank: row.rank as number | null,
      points: row.points == null ? null : exact.value(row.points),
    };
  });
  const entries = arr(r.entries).map((raw) => {
    const x = obj(raw),
      eligibility = x.eligibility as "eligible" | "excluded" | "unknown";
    if (!["eligible", "excluded", "unknown"].includes(eligibility))
      throw new EntryError("Choose eligibility or unresolved.");
    const rr = x.rosterReview ? obj(x.rosterReview) : null;
    return {
      entryId: identifier(x.entryId),
      eligibility,
      sourceId: reference(x.sourceId),
      note: text(x.note),
      rosterReview: rr
        ? {
            recordId: identifier(rr.recordId),
            version: positiveVersion(rr.version),
            sourceId: reference(rr.sourceId),
            note: text(rr.note),
          }
        : null,
      firstPlayoffGameId: x.firstPlayoffGameId
        ? identifier(x.firstPlayoffGameId)
        : null,
      games: arr(x.games).map((raw) => {
        const g = obj(raw);
        return {
          gameId: identifier(g.gameId),
          segments: arr(g.segments, 100).map((raw) => ids(raw)),
        };
      }),
    };
  });
  for (const list of [
    rows.map((x) => x.entryId),
    entries.map((x) => x.entryId),
  ])
    if (new Set(list).size !== list.length)
      throw new EntryError("List each competing entry once.");
  return {
    rulesId: identifier(r.rulesId),
    rulesVersion: positiveVersion(r.rulesVersion),
    policyId: assessmentPolicy.id,
    reviewNote: text(r.reviewNote),
    sources,
    preEvent: {
      effectiveDate: p.effectiveDate ? calendarDate(p.effectiveDate) : "",
      cutoffInstant,
      sourceId: reference(p.sourceId),
      family: text(p.family, 30),
      rows,
    },
    event: {
      kind,
      kindSourceId: reference(e.kindSourceId),
      newEvent: e.newEvent as boolean | null,
      previous: previous
        ? {
            editionId: identifier(previous.editionId),
            sfm: exact.value(previous.sfm),
            sourceId: reference(previous.sourceId),
            digest: digest(previous.digest),
          }
        : null,
      registrationDate: e.registrationDate
        ? calendarDate(e.registrationDate)
        : null,
      eligibilitySourceId: reference(e.eligibilitySourceId),
      complianceNote: text(e.complianceNote),
      resultsUrl,
      singleKnockout: e.singleKnockout,
      qualificationGameIds: ids(e.qualificationGameIds),
      playoffGameIds: ids(e.playoffGameIds),
      bronzeGameId: e.bronzeGameId ? identifier(e.bronzeGameId) : null,
    },
    entries,
  };
}
export function precedingTuesday(date: string) {
  const d = new Date(calendarDate(date) + "T12:00:00Z");
  const back = (d.getUTCDay() + 5) % 7 || 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}
