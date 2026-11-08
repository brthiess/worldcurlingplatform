import { freezeContents } from "@/domain/finalization";
type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
/** Explicit scalar and recursive allowlists: adding private evidence fields to
 * stored snapshots never implicitly expands the public sporting contract. */
function fields(value: unknown, keys: string[]) {
  const input = row(value),
    result: Row = {};
  for (const key of keys) {
    const v = input[key];
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    )
      result[key] = v;
    else if (v instanceof Date) result[key] = v.toISOString();
  }
  return result;
}
const ends = (value: unknown) =>
  list(value).map((e) => fields(e, ["state", "a", "b"]));
const hammers = (value: unknown) =>
  list(value).map((h) => (h === "a" || h === "b" ? h : null));
function lineup(value: unknown): unknown {
  if (!value) return null;
  const input = row(value);
  return {
    ...fields(input, [
      "entryId",
      "eventLineupVersion",
      "version",
      "status",
      "name",
      "mode",
      "teamId",
      "coreKnown",
      "recordedAt",
    ]),
    members: list(input.members).map((m) =>
      fields(m, [
        "playerId",
        "name",
        "position",
        "role",
        "participation",
        "identityStatus",
      ]),
    ),
  };
}
function result(value: unknown): unknown {
  if (!value) return null;
  const input = row(value);
  return {
    ...fields(input, [
      "outcome",
      "winnerEntryId",
      "entryA",
      "entryB",
      "nameA",
      "nameB",
      "totalA",
      "totalB",
      "correction",
      "reason",
    ]),
    ends: ends(input.ends),
    endHammer: hammers(input.endHammer),
    lineupA: lineup(input.lineupA),
    lineupB: lineup(input.lineupB),
    ...(input.legacyBefore
      ? {
          legacyBefore: {
            ...fields(input.legacyBefore, [
              "entryA",
              "entryB",
              "nameA",
              "nameB",
              "totalA",
              "totalB",
              "attribution",
            ]),
            ends: ends(row(input.legacyBefore).ends),
            endHammer: hammers(row(input.legacyBefore).endHammer),
          },
        }
      : {}),
  };
}
export function publicSportingSource(value: unknown) {
  const input = row(value);
  return {
    division: fields(input.division, [
      "id",
      "eventId",
      "name",
      "discipline",
      "format",
      "eventName",
      "origin",
      "startsOn",
      "endsOn",
    ]),
    draws: list(input.draws).map((d) =>
      fields(d, ["id", "number", "startsAt"]),
    ),
    entries: list(input.entries).map((e) => ({
      ...fields(e, ["id", "name", "version", "teamId"]),
      lineup: lineup(row(e).lineup),
    })),
    games: list(input.games).map((g) => ({
      ...fields(g, [
        "id",
        "drawId",
        "sheet",
        "phase",
        "state",
        "version",
        "entryA",
        "entryB",
        "resultVersion",
        "confirmedBy",
        "confirmedAt",
      ]),
      result: result(row(g).result),
    })),
  };
}
export function publicFinalizationRevision(value: unknown) {
  if (!value) return null;
  const input = row(value),
    frozen = row(JSON.parse(String(input.contents)));
  const projection = freezeContents({
    schema: "wcp.division-results-public.v1",
    source: publicSportingSource(frozen.source),
    placements: list(frozen.placements).map((p) =>
      fields(p, ["entryId", "place"]),
    ),
    ...fields(frozen, ["rulesReference", "note"]),
  });
  return {
    ...fields(input, [
      "version",
      "replacesVersion",
      "finalizedBy",
      "createdAt",
    ]),
    visibility: "public-sporting-projection",
    ...projection,
    snapshotDigest: input.digest,
  };
}
export function publicFinalizationResponse(value: unknown) {
  const input = row(value);
  return {
    ...fields(input, ["version", "dirty"]),
    source: publicSportingSource(input.source),
    prerequisites: list(input.prerequisites).filter(
      (p) => typeof p === "string",
    ),
    selected: publicFinalizationRevision(input.selected),
    history: list(input.history).map((h) => ({
      ...fields(h, ["version", "replacesVersion", "finalizedBy", "createdAt"]),
      snapshotDigest: row(h).digest,
    })),
  };
}
