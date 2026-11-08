export function coreIdentity(discipline: string, players: string[]): string {
  return `${discipline}:${JSON.stringify([...players].sort())}`;
}
export class EntryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type LineupMember = {
  playerId: string;
  role: "core" | "alternate" | "coach" | "substitute";
  position: string;
  participation: "declared" | "defaulted";
};
export type EntryInput = {
  divisionId: string;
  name: string;
  coreKnown: boolean;
  corePlayerIds: string[];
  members: LineupMember[];
  teamId?: string;
  registrationId?: string;
  registerSeason?: { season: string; version: number };
  newPlayers: { id: string; name: string; provisional: boolean }[];
};
export function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(value))
    throw new EntryError("Use a valid record identifier.");
  return value;
}
export function plainText(value: unknown, max: number, empty = false): string {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.trim().length > max ||
    /[<>\u0000-\u001f]/.test(value)
  )
    throw new EntryError(
      `Use ${empty ? "0" : "1"}–${max} plain-text characters.`,
    );
  return value.trim();
}
export function entryInput(value: unknown, discipline: string): EntryInput {
  if (!["men_four", "women_four", "mixed_doubles"].includes(discipline))
    throw new EntryError("Choose a supported discipline.");
  if (!value || typeof value !== "object")
    throw new EntryError("Provide an entry.");
  const v = value as Record<string, unknown>;
  const divisionId = identifier(v.divisionId),
    name = plainText(v.name, 160);
  if (
    typeof v.coreKnown !== "boolean" ||
    !Array.isArray(v.corePlayerIds) ||
    !Array.isArray(v.members) ||
    v.members.length > 20
  )
    throw new EntryError(
      "Provide regular core membership and an event lineup.",
    );
  const corePlayerIds = v.corePlayerIds.map(identifier);
  if (new Set(corePlayerIds).size !== corePlayerIds.length)
    throw new EntryError("List each core player once.");
  if (corePlayerIds.length > (discipline === "mixed_doubles" ? 2 : 5))
    throw new EntryError(
      discipline === "mixed_doubles"
        ? "A mixed doubles core has two players."
        : "A four-player core has four or five regular players.",
    );
  if (
    v.coreKnown &&
    (discipline === "mixed_doubles"
      ? corePlayerIds.length !== 2
      : ![4, 5].includes(corePlayerIds.length))
  )
    throw new EntryError(
      discipline === "mixed_doubles"
        ? "A mixed doubles core has two players."
        : "A four-player core has four or five regular players. Mark incomplete membership as provisional.",
    );
  const members = v.members.map((raw) => {
    if (!raw || typeof raw !== "object")
      throw new EntryError("Provide a valid lineup member.");
    const m = raw as LineupMember;
    identifier(m.playerId);
    if (
      !["core", "alternate", "coach", "substitute"].includes(m.role) ||
      !["declared", "defaulted"].includes(m.participation)
    )
      throw new EntryError(
        "Use a core, alternate, coach or substitute role and declared/defaulted participation.",
      );
    if (m.role === "core" && !corePlayerIds.includes(m.playerId))
      throw new EntryError(
        "An event core member must belong to the regular core.",
      );
    if (m.role !== "core" && corePlayerIds.includes(m.playerId))
      throw new EntryError(
        "A regular core player cannot also be an alternate, coach or substitute.",
      );
    return {
      playerId: m.playerId,
      role: m.role,
      position: plainText(m.position, 40, true),
      participation: m.participation,
    };
  });
  if (new Set(members.map((m) => m.playerId)).size !== members.length)
    throw new EntryError("List each event member once.");
  const newPlayers = (v.newPlayers ?? []) as EntryInput["newPlayers"];
  if (!Array.isArray(newPlayers) || newPlayers.length > 20)
    throw new EntryError("Add at most 20 new players.");
  const players = newPlayers.map((p) => {
    if (!p || typeof p.provisional !== "boolean")
      throw new EntryError("Indicate whether each new player is provisional.");
    return {
      id: identifier(p.id),
      name: plainText(p.name, 160),
      provisional: p.provisional,
    };
  });
  if (
    new Set(players.map((p) => p.id)).size !== players.length ||
    players.some(
      (p) =>
        !corePlayerIds.includes(p.id) &&
        !members.some((m) => m.playerId === p.id),
    )
  )
    throw new EntryError(
      "New players must be distinct and included in this entry.",
    );
  let registerSeason: EntryInput["registerSeason"];
  if (v.registerSeason !== undefined) {
    const r = v.registerSeason as NonNullable<EntryInput["registerSeason"]>;
    if (
      !r ||
      !/^20\d{2}-\d{2}$/.test(r.season) ||
      Number(r.season.slice(5)) !== (Number(r.season.slice(0, 4)) + 1) % 100 ||
      !Number.isSafeInteger(r.version) ||
      r.version < 0 ||
      !v.coreKnown
    )
      throw new EntryError(
        "Choose a season such as 2026-27, a reviewed roster version, and complete core membership.",
      );
    registerSeason = { season: r.season, version: r.version };
  }
  if (v.teamId && !v.coreKnown)
    throw new EntryError(
      "An existing team requires its complete regular core.",
    );
  return {
    divisionId,
    name,
    coreKnown: v.coreKnown,
    corePlayerIds,
    members,
    teamId: v.teamId ? identifier(v.teamId) : undefined,
    registrationId: v.registrationId ? identifier(v.registrationId) : undefined,
    registerSeason,
    newPlayers: players,
  };
}
