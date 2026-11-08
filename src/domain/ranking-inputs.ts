import { EntryError, identifier, plainText } from "./entries";
export { EntryError as RankingInputError };
type Q = [bigint, bigint];
function gcd(a: bigint, b: bigint): bigint {
  return b ? gcd(b, a % b) : a;
}
function reduce([n, d]: Q): Q {
  const g = gcd(n, d);
  return [n / g, d / g];
}
function q(v: unknown): Q {
  if (typeof v !== "string" || !/^(0|[1-9]\d*)(\/(?:[1-9]\d*)|\.\d+)?$/.test(v))
    throw new EntryError("Use a nonnegative exact fraction or decimal.");
  if (v.includes("/")) {
    const [n, d] = v.split("/");
    return reduce([BigInt(n), BigInt(d)]);
  }
  const [n, d] = v.split(".");
  return reduce([BigInt(n + (d ?? "")), 10n ** BigInt(d?.length ?? 0)]);
}
function str([n, d]: Q) {
  return d === 1n ? String(n) : `${n}/${d}`;
}
export const exact = {
  value: (v: unknown) => {
    if (
      typeof v !== "string" ||
      !/^(0|[1-9]\d{0,127})(\/(?:[1-9]\d{0,127})|\.\d{1,12})?$/.test(v)
    )
      throw new EntryError(
        "Use a nonnegative exact fraction (up to 128 digits per integer) or decimal (up to 12 fractional digits).",
      );
    const parsed = q(v);
    if (parsed.some((n) => String(n).length > 128))
      throw new EntryError(
        "The exact canonical numerator and denominator must each fit 128 digits.",
      );
    return str(parsed);
  },
  add: (a: string, b: string) => {
    const [n, d] = q(a),
      [m, e] = q(b);
    return str(reduce([n * e + m * d, d * e]));
  },
  multiply: (a: string, b: string) => {
    const [n, d] = q(a),
      [m, e] = q(b);
    return str(reduce([n * m, d * e]));
  },
};
export type Allocation = { playerId: string; share: string };
export const allocationOptions = [
  "four-equal",
  "five-equal",
  "front-rotation",
  "one-rotation",
  "majority-four",
  "skip-fixed",
  "unresolved",
] as const;
export type AllocationOption = (typeof allocationOptions)[number];
const patterns: Record<string, string[]> = {
  "four-equal": ["1/4", "1/4", "1/4", "1/4"],
  "five-equal": ["1/5", "1/5", "1/5", "1/5", "1/5"],
  "front-rotation": ["1/4", "1/4", "1/6", "1/6", "1/6"],
  "one-rotation": ["1/4", "1/4", "1/4", "1/8", "1/8"],
  "majority-four": ["1/4", "1/4", "1/5", "1/5", "1/10"],
  "skip-fixed": ["1/4", "3/16", "3/16", "3/16", "3/16"],
};
export function validateAllocation(
  members: string[],
  allocations: Allocation[],
  option: AllocationOption,
) {
  if (
    allocations.length !== members.length ||
    new Set(allocations.map((a) => a.playerId)).size !== members.length ||
    allocations.some((a) => !members.includes(a.playerId))
  )
    throw new EntryError(
      "Ownership must list each registered regular once; alternates and coaches cannot own this allocation.",
    );
  const shares = allocations.map((a) => exact.value(a.share));
  if (shares.reduce((a, b) => exact.add(a, b), "0") !== "1")
    throw new EntryError(
      "Ownership shares must sum to exactly one. Rounded percentages are not normalized.",
    );
  if (
    option !== "unresolved" &&
    JSON.stringify(shares.sort()) !==
      JSON.stringify([...(patterns[option] ?? [])].sort())
  )
    throw new EntryError("Shares do not match the sourced allocation option.");
}
export type Source = {
  id: string;
  title: string;
  url: string;
  edition: string;
  retrievedAt: string;
  sha256: string;
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new EntryError("Provide a review record.");
  return v as Record<string, unknown>;
}
function list(v: unknown, max = 100): unknown[] {
  if (!Array.isArray(v) || v.length > max)
    throw new EntryError(`Provide at most ${max} records.`);
  return v;
}
export function calendarDate(v: unknown): string {
  if (
    typeof v !== "string" ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(v) ||
    Number.isNaN(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw new EntryError("Use a valid calendar date.");
  return v;
}
export function sourceInput(raw: unknown): Source {
  const s = object(raw);
  let url: URL;
  try {
    url = new URL(String(s.url));
  } catch {
    throw new EntryError("Use an HTTPS source URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw new EntryError(
      "Use an HTTPS source URL without credentials or fragments.",
    );
  if (typeof s.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(s.sha256))
    throw new EntryError("Retain the retrieved source SHA-256.");
  if (
    typeof s.retrievedAt !== "string" ||
    !/^20\d{2}-\d{2}-\d{2}T/.test(s.retrievedAt) ||
    Number.isNaN(Date.parse(s.retrievedAt)) ||
    Date.parse(s.retrievedAt) > Date.now() + 300000
  )
    throw new EntryError(
      "Record a valid retrieval timestamp, not a future retrieval.",
    );
  return {
    id: identifier(s.id),
    title: plainText(s.title, 180),
    url: url.href,
    edition: plainText(s.edition, 200),
    retrievedAt: s.retrievedAt,
    sha256: s.sha256,
  };
}
function sourcesInput(raw: unknown): Source[] {
  const sources = list(raw, 30).map(sourceInput);
  if (new Set(sources.map((s) => s.id)).size !== sources.length)
    throw new EntryError("Source identifiers must be unique.");
  return sources;
}
export type Family = "four_overall" | "four_series" | "mixed_doubles";
export type Checkpoint = {
  family: Family;
  from: string;
  maxEvents: number;
  priorWeight: string;
  sourceId: string;
};
export type Interpretation = {
  code: string;
  state: "supported" | "unresolved";
  sourceIds: string[];
  note: string;
};
export type RulesInput = {
  title: string;
  season: string;
  effectiveFrom: string;
  effectiveTo: string;
  sources: Source[];
  checkpoints: Checkpoint[];
  interpretations: Interpretation[];
  reviewNote: string;
};
export function rulesInput(raw: unknown): RulesInput {
  const r = object(raw),
    season = plainText(r.season, 7);
  if (
    !/^20\d{2}-\d{2}$/.test(season) ||
    Number(season.slice(5)) !== (Number(season.slice(0, 4)) + 1) % 100
  )
    throw new EntryError("Use a consecutive season such as 2026-27.");
  const effectiveFrom = calendarDate(r.effectiveFrom),
    effectiveTo = calendarDate(r.effectiveTo);
  if (effectiveTo <= effectiveFrom)
    throw new EntryError(
      "Rules effective interval must have a later exclusive end.",
    );
  const sources = sourcesInput(r.sources);
  if (!sources.length)
    throw new EntryError("At least one retrieved source edition is required.");
  const checkpoints = list(r.checkpoints, 30).map((raw) => {
    const c = object(raw),
      family = c.family as Family,
      from = calendarDate(c.from),
      sourceId = identifier(c.sourceId),
      priorWeight = exact.value(c.priorWeight);
    if (
      !["four_overall", "four_series", "mixed_doubles"].includes(family) ||
      !Number.isSafeInteger(c.maxEvents) ||
      Number(c.maxEvents) < 1 ||
      Number(c.maxEvents) >
        (family === "four_overall" ? 8 : family === "four_series" ? 5 : 6)
    )
      throw new EntryError(
        "Use a supported checkpoint family and event limit.",
      );
    const [n, d] = q(priorWeight);
    if (n > d || (family === "four_series" && n !== 0n))
      throw new EntryError(
        "Checkpoint prior weight must be between zero and one; series have no carryover.",
      );
    if (from < effectiveFrom || from >= effectiveTo)
      throw new EntryError(
        "Checkpoint is outside the rules effective interval.",
      );
    if (!sources.some((s) => s.id === sourceId))
      throw new EntryError(
        "Each checkpoint requires an inspected source edition.",
      );
    return {
      family,
      from,
      maxEvents: Number(c.maxEvents),
      priorWeight,
      sourceId,
    };
  });
  for (const family of ["four_overall", "four_series", "mixed_doubles"]) {
    const rows = checkpoints.filter((c) => c.family === family);
    if (
      rows.some(
        (c, i) =>
          i > 0 &&
          (c.from <= rows[i - 1].from || c.maxEvents < rows[i - 1].maxEvents),
      )
    )
      throw new EntryError(
        "Checkpoint dates must be unique and in increasing order per family.",
      );
  }
  const interpretations = list(r.interpretations, 30).map((raw) => {
    const v = object(raw),
      code = identifier(v.code),
      state = v.state as Interpretation["state"],
      sourceIds = list(v.sourceIds, 30).map(identifier);
    if (
      !["supported", "unresolved"].includes(state) ||
      !sourceIds.length ||
      sourceIds.some((id) => !sources.some((s) => s.id === id))
    )
      throw new EntryError(
        "Interpretations require a supported/unresolved state and source references.",
      );
    return { code, state, sourceIds, note: plainText(v.note, 2000) };
  });
  if (
    new Set(interpretations.map((i) => i.code)).size !== interpretations.length
  )
    throw new EntryError("Interpretation codes must be unique.");
  return {
    title: plainText(r.title, 180),
    season,
    effectiveFrom,
    effectiveTo,
    sources,
    checkpoints,
    interpretations,
    reviewNote: plainText(r.reviewNote, 2000, true),
  };
}
/** Calendar-date lookup only. Cutoff timezone/event completion policy belongs to the later reviewed calculation context. */
export function checkpointAt(
  r: RulesInput,
  family: Family,
  date: string,
): Checkpoint | null {
  calendarDate(date);
  if (date < r.effectiveFrom || date >= r.effectiveTo) return null;
  return (
    r.checkpoints.filter((c) => c.family === family && c.from <= date).at(-1) ??
    null
  );
}
export type Contribution = {
  playerId: string;
  amount: string | null;
  basis:
    | "documented-individual"
    | "prior-team-share"
    | "historical-aggregate"
    | "unknown";
  sourceId: string;
  ownershipSourceId: string;
  eligibilitySourceId: string;
  note: string;
  priorTotal: string | null;
  priorShare: string | null;
};
export type SeasonInput = {
  registrationId: string;
  rosterVersion: number;
  rulesId: string;
  rulesVersion: number;
  effectiveFrom: string;
  effectiveTo: string;
  rankingPlayerIds: string[];
  rankingAlternateIds: string[];
  rosterSourceId: string;
  allocationOption: AllocationOption;
  allocations: Allocation[];
  sources: Source[];
  contributions: Contribution[];
  reviewNote: string;
  biographyMissing: boolean;
};
export function positiveVersion(v: unknown) {
  if (!Number.isSafeInteger(v) || Number(v) < 1)
    throw new EntryError("Select an exact positive record version.");
  return Number(v);
}
export function seasonInput(raw: unknown): SeasonInput {
  const r = object(raw),
    sources = sourcesInput(r.sources),
    rankingPlayerIds = list(r.rankingPlayerIds, 5).map(identifier),
    rankingAlternateIds = list(r.rankingAlternateIds ?? [], 10).map(identifier),
    allocationOption = r.allocationOption as AllocationOption;
  if (
    new Set([...rankingPlayerIds, ...rankingAlternateIds]).size !==
      rankingPlayerIds.length + rankingAlternateIds.length ||
    !allocationOptions.includes(allocationOption)
  )
    throw new EntryError(
      "List each ranking regular once and choose an allocation option.",
    );
  const allocations = list(r.allocations, 5).map((raw) => {
    const a = object(raw);
    return { playerId: identifier(a.playerId), share: exact.value(a.share) };
  });
  if (allocations.length)
    validateAllocation(rankingPlayerIds, allocations, allocationOption);
  const reference = (v: unknown) => {
    if (v === "") return "";
    const id = identifier(v);
    if (!sources.some((s) => s.id === id))
      throw new EntryError(
        "Contribution references require a recorded source edition.",
      );
    return id;
  };
  const contributions = list(r.contributions, 5).map((raw) => {
    const c = object(raw),
      playerId = identifier(c.playerId),
      basis = c.basis as Contribution["basis"];
    if (
      !rankingPlayerIds.includes(playerId) ||
      ![
        "documented-individual",
        "prior-team-share",
        "historical-aggregate",
        "unknown",
      ].includes(basis)
    )
      throw new EntryError(
        "Starting contributions belong to registered regulars and require a recognized evidence basis.",
      );
    return {
      playerId,
      amount:
        c.amount === null || c.amount === "" ? null : exact.value(c.amount),
      basis,
      sourceId: reference(c.sourceId),
      ownershipSourceId: reference(c.ownershipSourceId),
      eligibilitySourceId: reference(c.eligibilitySourceId),
      note: plainText(c.note, 2000, true),
      priorTotal:
        c.priorTotal == null || c.priorTotal === ""
          ? null
          : exact.value(c.priorTotal),
      priorShare:
        c.priorShare == null || c.priorShare === ""
          ? null
          : exact.value(c.priorShare),
    };
  });
  if (
    new Set(contributions.map((c) => c.playerId)).size !== contributions.length
  )
    throw new EntryError("List each starting contributor once.");
  const effectiveFrom = calendarDate(r.effectiveFrom),
    effectiveTo = calendarDate(r.effectiveTo);
  if (effectiveTo <= effectiveFrom)
    throw new EntryError(
      "Input effective interval needs a later exclusive end.",
    );
  return {
    registrationId: identifier(r.registrationId),
    rosterVersion: positiveVersion(r.rosterVersion),
    rulesId: identifier(r.rulesId),
    rulesVersion: positiveVersion(r.rulesVersion),
    effectiveFrom,
    effectiveTo,
    rankingPlayerIds,
    rankingAlternateIds,
    rosterSourceId: reference(r.rosterSourceId ?? ""),
    allocationOption,
    allocations,
    sources,
    contributions,
    reviewNote: plainText(r.reviewNote, 2000, true),
    biographyMissing: r.biographyMissing === true,
  };
}
export type ReviewContext = {
  discipline: string;
  season: string;
  rosterVersion: number;
  members: { playerId: string; role: string; identityStatus: string }[];
  rules: RulesInput;
  rulesReviewed: boolean;
};
export type ReadinessIssue = {
  code: string;
  severity: "blocker" | "informational";
  message: string;
  action: string;
};
export function readiness(input: SeasonInput, c: ReviewContext) {
  const issues: ReadinessIssue[] = [];
  const issue = (
    code: string,
    message: string,
    action: string,
    severity: ReadinessIssue["severity"] = "blocker",
  ) => issues.push({ code, message, action, severity });
  if (!c.rulesReviewed)
    issue(
      "rules-review",
      "This rule/source edition has not been reviewed.",
      "Review and save the exact rules version first.",
    );
  if (
    c.rules.season !== c.season ||
    input.effectiveFrom < c.rules.effectiveFrom ||
    input.effectiveTo > c.rules.effectiveTo
  )
    issue(
      "effective-interval",
      "Sources do not cover this season/effective interval.",
      "Select an applicable rules edition and dates.",
    );
  if (
    !checkpointAt(
      c.rules,
      c.discipline === "mixed_doubles" ? "mixed_doubles" : "four_overall",
      input.effectiveFrom,
    )
  )
    issue(
      "checkpoint",
      "No applicable discipline checkpoint covers the beginning of this input interval.",
      "Record the sourced discipline checkpoint in the selected rules edition.",
    );
  if (c.rosterVersion !== input.rosterVersion)
    issue(
      "roster-stale",
      "The season roster has changed since this input was reviewed.",
      "Reload the current season roster and save a new input revision.",
    );
  if (
    input.rankingPlayerIds.length !==
      (c.discipline === "mixed_doubles" ? 2 : 4) &&
    !(c.discipline !== "mixed_doubles" && input.rankingPlayerIds.length === 5)
  )
    issue(
      "ranking-roster",
      "The registered ranking roster is incomplete.",
      "Record four/five regulars or both mixed doubles partners.",
    );
  if (!input.rosterSourceId)
    issue(
      "ranking-roster-source",
      "The separately registered ranking roster has no source evidence.",
      "Cite the official roster declaration/decision for these regular and alternate assignments; platform core membership alone does not establish registration.",
    );
  if (
    input.rankingPlayerIds.some(
      (id) => !c.members.some((m) => m.playerId === id),
    )
  )
    issue(
      "ranking-player-missing",
      "A registered ranking player cannot be resolved.",
      "Select an existing identified player record without altering the platform core.",
    );
  if (
    c.members.some(
      (m) =>
        input.rankingPlayerIds.includes(m.playerId) &&
        m.identityStatus !== "identified",
    )
  )
    issue(
      "identity",
      "A ranking player has an unresolved provisional identity.",
      "Resolve the player identity before reviewing complete evidence.",
    );
  if (!input.allocations.length || input.allocationOption === "unresolved")
    issue(
      "allocation",
      "Exact point ownership is unresolved.",
      "Choose a sourced allocation and provide every regular’s exact share.",
    );
  if (
    input.allocationOption === "front-rotation" &&
    !c.rules.interpretations.some(
      (i) => i.code === "front-rotation" && i.state === "supported",
    )
  )
    issue(
      "front-rotation",
      "The rounded front-rotation example needs an explicit exact-share interpretation.",
      "Review the one-sixth interpretation in this rules edition.",
    );
  if (c.discipline === "mixed_doubles")
    issue(
      "md-ownership",
      "Normative mixed-doubles individual/pair ownership and partner-change evidence is incomplete.",
      "Retain the input as unresolved; a field-strength 50/50 example is not ownership policy.",
    );
  for (const id of input.rankingPlayerIds) {
    const v = input.contributions.find((v) => v.playerId === id);
    if (!v || v.amount === null || !v.sourceId)
      issue(
        `starting-${id}`,
        "A sourced starting amount (including any zero) is missing.",
        "Record the documented entitlement source and exact amount for this player.",
      );
    if (
      !v ||
      !v.ownershipSourceId ||
      !v.note ||
      ["historical-aggregate", "unknown"].includes(v.basis)
    )
      issue(
        `ownership-${id}`,
        "A historical aggregate or unknown amount does not establish this player’s rights.",
        "Cite ownership evidence with its applicability; do not infer or normalize rights from an old team total.",
      );
    if (!v?.eligibilitySourceId)
      issue(
        `eligibility-${id}`,
        "Eligibility/transfer/exemption evidence is unresolved.",
        "Record the applicable season eligibility evidence or authorized decision source.",
      );
    if (
      v?.basis === "prior-team-share" &&
      (v.priorTotal === null ||
        v.priorShare === null ||
        exact.multiply(v.priorTotal, v.priorShare) !== v.amount ||
        (v.priorShare !== null &&
          (() => {
            const [n, d] = q(v.priorShare);
            return n > d;
          })()))
    )
      issue(
        `prior-share-${id}`,
        "The prior-team share does not support this exact entitlement.",
        "Retain the prior total, exact prior share and ownership provenance; the amount must match their product.",
      );
  }
  if (!input.reviewNote)
    issue(
      "review-note",
      "No review rationale is recorded.",
      "Record which source/effective/ownership evidence was checked.",
    );
  if (input.biographyMissing)
    issue(
      "biography",
      "Optional biography is missing.",
      "Biography can be completed independently; this does not affect starting ownership.",
      "informational",
    );
  const complete = !issues.some((i) => i.severity === "blocker");
  return {
    scope: "starting-input-evidence" as const,
    complete,
    startingInput: complete
      ? input.contributions.reduce((s, v) => exact.add(s, v.amount!), "0")
      : null,
    issues,
  };
}
