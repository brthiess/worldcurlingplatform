import { EntryError } from "./entries";
export type JsonRecord = Record<string, any>;
export const crawlerTranslatorVersion = "wcp-crawler-game-v1";
export function sourceKey(
  value: unknown,
  kind: "event" | "entry" | "game" | "person",
) {
  const sizes = { event: 1, entry: 2, game: 3, person: 1 };
  if (
    typeof value !== "string" ||
    !new RegExp(
      `^src:cz:${kind}:[0-9]+${":[0-9]+".repeat(sizes[kind] - 1)}$`,
    ).test(value)
  )
    throw new EntryError(`Malformed fully scoped ${kind} key.`);
  return value;
}
function object(v: unknown): asserts v is JsonRecord {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new EntryError("Malformed source object.");
}
function pair(v: unknown): asserts v is [number, number] {
  if (
    !Array.isArray(v) ||
    v.length !== 2 ||
    v.some((n) => !Number.isInteger(n) || n < 0 || n > 99)
  )
    throw new EntryError("Malformed accepted score pair.");
}
export function translateCrawlerGame(
  raw: unknown,
  interpretation?: JsonRecord,
) {
  object(raw);
  const g = raw;
  const id = sourceKey(g.id, "game"),
    eventId = sourceKey(g.event_id, "event");
  const parts = id.split(":");
  if (eventId !== `src:cz:event:${parts[3]}` || g.source_draw_id !== parts[4])
    throw new EntryError("Game parent scope disagrees with its source key.");
  if (
    !Array.isArray(g.entry_ids) ||
    g.entry_ids.length !== 2 ||
    new Set(g.entry_ids).size !== 2
  )
    throw new EntryError("A game requires two distinct scoped entries.");
  const entryIds = g.entry_ids.map((v: unknown) => sourceKey(v, "entry"));
  if (entryIds.some((k: string) => k.split(":")[3] !== parts[3]))
    throw new EntryError("Entry parent differs from the game's event.");
  if (!Array.isArray(g.lineups) || g.lineups.length !== 2)
    throw new EntryError("Malformed source lineups.");
  for (const l of g.lineups)
    if (l !== null) {
      object(l);
      if (
        !["partial", "complete", "unknown"].includes(l.completeness) ||
        !Array.isArray(l.person_ids)
      )
        throw new EntryError("Malformed source lineup.");
      l.person_ids.forEach((p: unknown) => sourceKey(p, "person"));
    }
  let ends: [number, number][] | null = null,
    totals: [number, number] | null = null;
  if (g.scoreline !== null) {
    object(g.scoreline);
    pair(g.scoreline.totals);
    totals = g.scoreline.totals;
    if (g.scoreline.ends !== null) {
      if (
        !Array.isArray(g.scoreline.ends) ||
        g.scoreline.ends.length < 1 ||
        g.scoreline.ends.length > 40
      )
        throw new EntryError("Malformed accepted ends.");
      for (const e of g.scoreline.ends) {
        pair(e);
        if (e[0] && e[1])
          throw new EntryError("An end cannot award points to both sides.");
      }
      ends = g.scoreline.ends;
      if (
        g.scoreline.played_end_count !== ends!.length ||
        ends!.reduce((n, e) => n + e[0], 0) !== totals![0] ||
        ends!.reduce((n, e) => n + e[1], 0) !== totals![1]
      )
        throw new EntryError("Accepted ends disagree with count or totals.");
    } else if (g.scoreline.played_end_count !== null)
      throw new EntryError("Unknown ends require an unknown played-end count.");
  }
  if (
    !Array.isArray(g.issues) ||
    g.issues.some((i: unknown) => typeof i !== "string") ||
    !Array.isArray(g.evidence_ids) ||
    g.evidence_ids.some((i: unknown) => typeof i !== "string")
  )
    throw new EntryError("Malformed source issues or evidence identifiers.");
  object(g.missing);
  object(g.field_evidence);
  let firstEndHammer: null | {
    entryId: string;
    basis: string;
    interpretationId: string;
  } = null;
  if (interpretation) {
    if (
      interpretation.gameId !== id ||
      !entryIds.includes(interpretation.entryId) ||
      interpretation.basis !==
        "reported_marker_with_same_game_publisher_corroboration" ||
      !/^[a-f0-9]{64}$/.test(interpretation.bodySha256) ||
      !interpretation.id ||
      typeof interpretation.observedAt !== "string" ||
      !Number.isFinite(Date.parse(interpretation.observedAt))
    )
      throw new EntryError(
        "Hammer interpretation does not identify this game and its reported evidence.",
      );
    for (const url of [
      interpretation.sourceUrl,
      interpretation.corroboratingUrl,
    ]) {
      if (
        typeof url !== "string" ||
        !/^https:\/\/www\.curlingzone\.com\/(game|post)\.php\?/.test(url)
      )
        throw new EntryError(
          "Hammer interpretation requires retained source URLs.",
        );
    }
    firstEndHammer = {
      entryId: interpretation.entryId,
      basis: interpretation.basis,
      interpretationId: interpretation.id,
    };
  }
  return {
    id,
    eventId,
    entryIds,
    drawId: g.draw_id ?? null,
    sourceDrawId: g.source_draw_id,
    sourceState: g.state,
    completeness: ends
      ? "complete_line_score"
      : totals
        ? "final_score_only"
        : "missing_score",
    ends,
    totals,
    lineups: g.lineups,
    firstEndHammer,
    coreIdentity: null,
    certification: null,
    issues: [
      ...new Set<string>([
        ...g.issues,
        ...(firstEndHammer
          ? interpretation?.historicalParserVersion == null
            ? ["historical_hammer_parser_unknown"]
            : []
          : ["hammer_unknown"]),
        "core_identity_unresolved",
        "player_identity_unresolved",
        ...(totals ? [] : ["score_missing"]),
      ]),
    ],
    translatorVersion: crawlerTranslatorVersion,
  };
}
