import type { End } from "./scoring";
export type Side = "a" | "b";
export type Placement = {
  decider: Side | null;
  choice: "A" | "B" | null;
  powerPlay: boolean;
  blankReason: "unknown" | "ordinary" | "equal-measure";
};
const sides = [null, "a", "b"];
const other = (s: Side): Side => (s === "a" ? "b" : "a");
function text(v: unknown, required = true) {
  if (
    typeof v !== "string" ||
    v.length > 500 ||
    /[<>\u0000-\u001f]/.test(v) ||
    (required && !v.trim())
  )
    throw Error("Record a plain-text source or reason (1–500 characters)");
  return v.trim();
}
export function placementHammer(p: Placement | null): Side | null {
  return p?.decider && p.choice
    ? p.choice === "B"
      ? p.decider
      : other(p.decider)
    : null;
}
export function nextPlacementDecider(
  e: End,
  hammer: Side | null,
  p: Placement | null,
): Side | null {
  if (e.state !== "played") return null;
  if (e.a! > 0) return "b";
  if (e.b! > 0) return "a";
  if (p?.blankReason === "equal-measure") return p.decider;
  return p?.blankReason === "ordinary" && hammer ? other(hammer) : null;
}
export function validatePlacements(
  value: unknown,
  regulationEnds: number,
): (Placement | null)[] {
  if (!Array.isArray(value) || value.length > 20)
    throw Error("Provide at most twenty placement records");
  const used = new Set<Side>();
  return value.map((p, i) => {
    if (p === null) return null;
    if (
      !p ||
      !sides.includes(p.decider) ||
      ![null, "A", "B"].includes(p.choice) ||
      typeof p.powerPlay !== "boolean" ||
      !["unknown", "ordinary", "equal-measure"].includes(p.blankReason)
    )
      throw Error(
        "Record placement decision, A/B choice, power play and blank reason",
      );
    if (p.choice && !p.decider)
      throw Error("A placement choice needs its decision owner");
    if (p.powerPlay) {
      if (!p.decider || !p.choice)
        throw Error("Power play needs a placement decision and choice");
      if (i >= regulationEnds)
        throw Error("Power play is unavailable in extra ends");
      if (used.has(p.decider))
        throw Error("Power play is available once per team");
      used.add(p.decider);
    }
    return {
      decider: p.decider,
      choice: p.choice,
      powerPlay: p.powerPlay,
      blankReason: p.blankReason,
    };
  });
}
export type LSD = {
  kind: "unknown" | "measured-centre" | "measured-edge" | "assigned-maximum";
  playerId: string | null;
  rotation: "cw" | "ccw" | null;
  value: number | null;
  unit: "mm" | "cm" | "m" | null;
  centreCm: number | null;
  source: string;
  reason: string;
};
export function lsdObservation(raw: unknown): LSD {
  const p = raw as LSD;
  if (
    !p ||
    ![
      "unknown",
      "measured-centre",
      "measured-edge",
      "assigned-maximum",
    ].includes(p.kind)
  )
    throw Error("Choose LSD observation state");
  if (p.kind === "unknown")
    return {
      kind: "unknown",
      playerId: null,
      rotation: null,
      value: null,
      unit: null,
      centreCm: null,
      source: "",
      reason: "",
    };
  if (
    typeof p.playerId !== "string" ||
    !/^[-\w]{1,80}$/.test(p.playerId) ||
    !["cw", "ccw"].includes(p.rotation!)
  )
    throw Error("Record LSD player and clockwise/counter-clockwise rotation");
  const source = text(p.source);
  if (p.kind === "assigned-maximum")
    return {
      kind: p.kind,
      playerId: p.playerId,
      rotation: p.rotation,
      value: null,
      unit: null,
      centreCm: 199.6,
      source,
      reason: text(p.reason),
    };
  if (
    !["mm", "cm", "m"].includes(p.unit!) ||
    typeof p.value !== "number" ||
    !Number.isFinite(p.value) ||
    p.value < 0
  )
    throw Error("Use a nonnegative measurement in mm, cm or m");
  const centreCm =
    Math.round(
      (p.value * (p.unit === "mm" ? 0.1 : p.unit === "m" ? 100 : 1) +
        (p.kind === "measured-edge" ? 14.2 : 0)) *
        10000,
    ) / 10000;
  if (centreCm > 199.6)
    throw Error(
      "An LSD centre distance cannot exceed 199.6 cm; use an explicit assigned maximum",
    );
  return {
    kind: p.kind,
    playerId: p.playerId,
    rotation: p.rotation,
    value: p.value,
    unit: p.unit,
    centreCm,
    source,
    reason: "",
  };
}
export function drawShotChallenge(
  games: (number | null)[][],
  coverage: number,
) {
  if (
    !Number.isInteger(coverage) ||
    coverage < 1 ||
    coverage > 13 ||
    games.length < coverage
  )
    throw Error("Provide complete first-game coverage from 1 to 13 games");
  const stones = games.slice(0, coverage).flat();
  if (
    games.slice(0, coverage).some((g) => g.length !== 2) ||
    stones.some((v) => v === null)
  )
    return {
      valueCm: null,
      consideredGames: coverage,
      discarded: 0,
      stones: stones.length,
    };
  return { ...dscFromStones(stones), consideredGames: coverage };
}
export function dscFromStones(stones: (number | null)[]) {
  if (stones.length < 2 || stones.some((v) => v === null))
    return { valueCm: null, discarded: 0, stones: stones.length };
  if (
    stones.some(
      (v) => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 199.6,
    )
  )
    throw Error("Use centre distances from 0 to 199.6 cm");
  const sorted = (stones as number[]).toSorted((a, b) => a - b),
    discard = sorted.length > 11 ? 2 : 1;
  return {
    valueCm:
      sorted.slice(0, -discard).reduce((a, b) => a + b, 0) /
      (sorted.length - discard),
    discarded: discard,
    stones: stones.length,
  };
}
/** Informational C8 review, never an automatic penalty/assignment or qualification decision.
 * Alternate combination and eligibility require an attributed official determination. */
export function reviewLsdDistribution(
  discipline: string,
  players: string[],
  games: { playerId: string | null; rotation: string | null }[][],
) {
  const n = games.length,
    issues: string[] = [];
  const minimumPerPlayer =
    discipline === "mixed_doubles"
      ? n
      : n === 3
        ? 1
        : n <= 6
          ? 2
          : n <= 8
            ? 3
            : n <= 11
              ? 4
              : n === 12
                ? 5
                : 6;
  const minimumPerRotation =
    discipline === "mixed_doubles"
      ? Math.floor(n / 2)
      : n === 3
        ? null
        : n <= 8
          ? 1
          : n <= 12
            ? 2
            : 3;
  if (n < 3 || n > 13)
    issues.push(
      "This review supports three through thirteen considered games; record other official determinations explicitly.",
    );
  if (
    players.length !== (discipline === "mixed_doubles" ? 2 : 4) ||
    new Set(players).size !== players.length
  )
    issues.push(
      "A complete reviewed two/four-player LSD population is needed; alternate combination is manual.",
    );
  if (
    games.some(
      (g) =>
        g.length !== 2 ||
        g.some(
          (p) =>
            !p.playerId ||
            !players.includes(p.playerId) ||
            !["cw", "ccw"].includes(p.rotation!),
        ) ||
        g[0]?.rotation !== "cw" ||
        g[1]?.rotation !== "ccw" ||
        g[0]?.playerId === g[1]?.playerId,
    )
  )
    issues.push(
      "Each considered game needs different known players, clockwise then counter-clockwise.",
    );
  const stones = games.flat();
  if (discipline !== "mixed_doubles" && n === 3) {
    const possible = players.some((a, i) =>
      players.some(
        (b, j) =>
          i < j &&
          stones.some((p) => p.playerId === a && p.rotation === "cw") &&
          stones.some((p) => p.playerId === b && p.rotation === "cw") &&
          players
            .filter((p) => p !== a && p !== b)
            .every((id) =>
              stones.some((p) => p.playerId === id && p.rotation === "ccw"),
            ),
      ),
    );
    if (!possible)
      issues.push(
        "The four required stones need two clockwise and two counter-clockwise deliveries.",
      );
  }
  for (const id of players) {
    const own = stones.filter((p) => p.playerId === id),
      cw = own.filter((p) => p.rotation === "cw").length,
      ccw = own.filter((p) => p.rotation === "ccw").length;
    if (
      discipline === "mixed_doubles"
        ? own.length !== n || Math.abs(cw - ccw) > 1
        : own.length < minimumPerPlayer ||
          (minimumPerRotation !== null &&
            (cw < minimumPerRotation || ccw < minimumPerRotation))
    )
      issues.push(
        discipline === "mixed_doubles"
          ? "Each mixed doubles player needs balanced rotations (odd-game difference one)."
          : `Each four-player player needs minimum ${minimumPerPlayer} stones${minimumPerRotation === null ? "; three-game starred team requirement is 2 CW / 2 CCW among the four required stones" : ` and ${minimumPerRotation} of each rotation`}.`,
      );
  }
  return {
    consideredGames: n,
    minimumPerPlayer,
    minimumPerRotation,
    issues: [...new Set(issues)],
  };
}
export type Participation = {
  kind: "unknown" | "observed";
  playerIds: string[];
  source: string;
};
export function participationEvidence(
  raw: unknown,
  discipline: string,
): Participation {
  const p = raw as Participation;
  if (p?.kind === "unknown")
    return { kind: "unknown", playerIds: [], source: "" };
  if (
    p?.kind !== "observed" ||
    !Array.isArray(p.playerIds) ||
    p.playerIds.some(
      (id) => typeof id !== "string" || !/^[-\w]{1,80}$/.test(id),
    ) ||
    new Set(p.playerIds).size !== p.playerIds.length
  )
    throw Error("Record distinct observed players");
  if (
    discipline === "mixed_doubles"
      ? p.playerIds.length !== 2
      : ![3, 4].includes(p.playerIds.length)
  )
    throw Error(
      discipline === "mixed_doubles"
        ? "Observed mixed doubles participation needs two players"
        : "Observed four-player participation needs three or four players",
    );
  return { kind: "observed", playerIds: p.playerIds, source: text(p.source) };
}
export type SportingEvidence = {
  ruleset: "world-curling-2026";
  regulationEnds: 8 | 10;
  lsdRequired: boolean;
  stage: string;
  placements: (Placement | null)[];
  lsd: Record<Side, LSD[]>;
  participation: Record<Side, Participation>;
  dsc: Record<
    Side,
    { kind: "unknown" | "sourced"; valueCm: number | null; source: string }
  >;
};
export function sportingEvidence(
  raw: unknown,
  discipline: string,
): SportingEvidence {
  const v = raw as SportingEvidence;
  if (
    !v ||
    v.ruleset !== "world-curling-2026" ||
    ![8, 10].includes(v.regulationEnds) ||
    (discipline === "mixed_doubles" && v.regulationEnds !== 8) ||
    typeof v.lsdRequired !== "boolean"
  )
    throw Error(
      "Choose the World Curling 2026 eight/ten-end profile (mixed doubles uses eight)",
    );
  const stage = text(v.stage),
    placements = validatePlacements(v.placements, v.regulationEnds);
  if (discipline !== "mixed_doubles" && placements.some(Boolean))
    throw Error("Placement and power play apply only to mixed doubles");
  const lsd = {} as SportingEvidence["lsd"],
    participation = {} as SportingEvidence["participation"],
    dsc = {} as SportingEvidence["dsc"];
  for (const side of ["a", "b"] as const) {
    if (!Array.isArray(v.lsd?.[side]) || v.lsd[side].length !== 2)
      throw Error(
        "Record two LSD observations per side; use unknown for missing evidence",
      );
    lsd[side] = v.lsd[side].map(lsdObservation);
    const known = lsd[side].filter((p) => p.kind !== "unknown");
    if (
      new Set(known.map((p) => p.playerId)).size !== known.length ||
      known.some(
        (p) => p.rotation !== (lsd[side].indexOf(p) === 0 ? "cw" : "ccw"),
      )
    )
      throw Error(
        "Two different players deliver LSDs clockwise then counter-clockwise",
      );
    participation[side] = participationEvidence(
      v.participation?.[side],
      discipline,
    );
    const d = v.dsc?.[side];
    if (d?.kind === "unknown")
      dsc[side] = { kind: "unknown", valueCm: null, source: "" };
    else if (
      d?.kind === "sourced" &&
      typeof d.valueCm === "number" &&
      Number.isFinite(d.valueCm) &&
      d.valueCm >= 0 &&
      d.valueCm <= 199.6
    )
      dsc[side] = {
        kind: "sourced",
        valueCm: d.valueCm,
        source: text(d.source),
      };
    else
      throw Error(
        "Record an unknown DSC or a sourced centre-distance aggregate in cm",
      );
  }
  return {
    ruleset: v.ruleset,
    regulationEnds: v.regulationEnds,
    lsdRequired: v.lsdRequired,
    stage,
    placements,
    lsd,
    participation,
    dsc,
  };
}
export function emptySportingEvidence(): SportingEvidence {
  const unknown = () => lsdObservation({ kind: "unknown" });
  return {
    ruleset: "world-curling-2026",
    regulationEnds: 8,
    lsdRequired: false,
    stage: "Not specified",
    placements: [],
    lsd: { a: [unknown(), unknown()], b: [unknown(), unknown()] },
    participation: {
      a: { kind: "unknown", playerIds: [], source: "" },
      b: { kind: "unknown", playerIds: [], source: "" },
    },
    dsc: {
      a: { kind: "unknown", valueCm: null, source: "" },
      b: { kind: "unknown", valueCm: null, source: "" },
    },
  };
}
