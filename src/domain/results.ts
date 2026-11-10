import { validateEnd, scoreTotals, type End } from "./scoring";
export type Outcome = "normal" | "conceded" | "forfeit";
export type ResultInput = {
  outcome: Outcome;
  winnerEntryId: string;
  ends: End[];
  reason: string;
};
export type DifferenceMember = { playerId: string; position: string };
export function lineupDifference(
  value: unknown,
  discipline = "men_four",
): DifferenceMember[] {
  if (
    !Array.isArray(value) ||
    value.length > (discipline === "mixed_doubles" ? 2 : 5) ||
    value.some(
      (m) =>
        !m ||
        typeof m.playerId !== "string" ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(m.playerId) ||
        typeof m.position !== "string" ||
        m.position.length > 60 ||
        /[<>\u0000-\u001f]/.test(m.position),
    )
  )
    throw new Error(
      discipline === "mixed_doubles"
        ? "Choose up to two mixed doubles players"
        : "Choose up to five known players with plain-text positions",
    );
  if (new Set(value.map((m) => m.playerId)).size !== value.length)
    throw new Error("Choose distinct players");
  return value.map((m) => ({
    playerId: m.playerId,
    position: m.position.trim(),
  }));
}
export function defaultLineup<
  T extends { playerId: string; position: string; participation: string },
>(entryId: string, event: { version: number; members: T[] } | null) {
  return {
    entryId,
    eventLineupVersion: event?.version ?? null,
    mode: "defaulted" as const,
    members:
      event?.members.map((m) => ({
        ...m,
        participation: "defaulted" as const,
      })) ?? [],
  };
}
export function validateResult(
  state: string,
  action: "confirm" | "correct",
  participants: (string | null)[],
  input: ResultInput,
  discipline = "men_four",
  regulationEnds = 8,
) {
  if (
    participants.length !== 2 ||
    !participants[0] ||
    !participants[1] ||
    participants[0] === participants[1] ||
    !participants.includes(input.winnerEntryId)
  )
    throw new Error(
      "The winner must be one of two distinct assigned participants",
    );
  if (action === "confirm" && state === "confirmed")
    throw new Error("Use the correction workflow for a confirmed result");
  if (action === "correct" && state !== "confirmed")
    throw new Error("Only confirmed results can be corrected");
  if (!["normal", "conceded", "forfeit"].includes(input.outcome))
    throw new Error("Choose normal, conceded or forfeit");
  if (state === "scheduled" && input.outcome !== "forfeit")
    throw new Error("Start the game before confirming a played result");
  if (
    typeof input.reason !== "string" ||
    input.reason.length > 500 ||
    /[<>\u0000-\u001f]/.test(input.reason)
  )
    throw new Error("Use a plain-text reason up to 500 characters");
  const reason = input.reason.trim();
  if ((action === "correct" || input.outcome !== "normal") && !reason)
    throw new Error("Record a reason for this result or correction");
  if (!Array.isArray(input.ends) || input.ends.length > 20)
    throw new Error("Provide up to 20 end scores");
  const ends = input.ends
    .map((e) => validateEnd(e, discipline))
    .map((e) =>
      e.state === "upcoming"
        ? { state: "unplayed" as const, a: null, b: null }
        : e,
    );
  let stopped = false;
  for (const e of ends) {
    if (e.state === "unplayed") stopped = true;
    else if (stopped)
      throw new Error("Played or unknown ends cannot follow an unplayed end");
  }
  const total = scoreTotals(ends);
  if (discipline === "mixed_doubles") {
    for (let i = regulationEnds; i < ends.length; i++) {
      if (ends[i].state !== "played" && ends[i].state !== "unknown") continue;
      const prior = scoreTotals(ends.slice(0, i));
      if (
        ends.slice(0, i).some((e) => e.state !== "played") ||
        prior.a === null ||
        prior.a !== prior.b
      )
        throw Error(
          i === regulationEnds
            ? "An extra end requires a complete tied regulation score"
            : "No end may follow a decisive extra end",
        );
    }
  }
  if (input.outcome === "normal") {
    if (
      !ends.some((e) => e.state === "played") ||
      ends.some((e) => e.state === "unknown")
    )
      throw new Error("A normal result needs a complete decisive line score");
    if (ends.filter((e) => e.state === "played").length < regulationEnds)
      throw new Error(
        `Normal completion requires ${regulationEnds === 8 ? "eight" : "ten"} played ends in this ${discipline === "mixed_doubles" ? "mixed doubles" : "four-player"} profile; use conceded for an early stop`,
      );
    if (
      total.a === total.b ||
      input.winnerEntryId !== participants[total.a! > total.b! ? 0 : 1]
    )
      throw new Error("The winner must agree with the decisive score");
  }
  return {
    outcome: input.outcome,
    winnerEntryId: input.winnerEntryId,
    ends,
    totalA: input.outcome === "forfeit" ? null : total.a,
    totalB: input.outcome === "forfeit" ? null : total.b,
    reason,
  };
}
