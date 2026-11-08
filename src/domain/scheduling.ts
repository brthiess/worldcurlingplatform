export class ScheduleError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function drawEvidenceState(states: string[]) {
  if (states.length && states.every((s) => s === "confirmed"))
    return "completed";
  if (states.some((s) => s === "live" || s === "confirmed")) return "live";
  return "scheduled";
}
export function venueFields(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const value = (name: string) => parts.find((p) => p.type === name)!.value;
  const local = `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
  const minutes = Math.round(
    (Date.parse(local + "Z") - Date.parse(instant)) / 60000,
  );
  const offset = `${minutes < 0 ? "-" : "+"}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
  return { local, offset };
}
/** Offset is explicit: DST folds have two valid answers; gaps have none. Never uses browser/host local time. */
export function venueInstant(local: string, timezone: string, offset: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ||
    !/^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset) ||
    (offset.slice(1, 3) === "14" && !offset.endsWith(":00"))
  )
    throw new ScheduleError(
      "Provide a venue date/time and explicit UTC offset (±HH:MM).",
    );
  const date = new Date(local + offset);
  try {
    if (
      !Number.isFinite(date.getTime()) ||
      venueFields(date.toISOString(), timezone).local !== local
    )
      throw new Error();
  } catch {
    throw new ScheduleError(
      "Date/time or UTC offset does not match this venue timezone. Check daylight-saving changes.",
    );
  }
  return date.toISOString();
}
export type Availability = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  sheet: string;
  entries: string[];
  players: string[];
};
export type ScheduleConflict = {
  gameIds: string[];
  kind: "sheet" | "entry" | "player";
  resource: string;
};
export function scheduleConflicts(games: Availability[]) {
  const conflicts: ScheduleConflict[] = [];
  for (let i = 0; i < games.length; i++)
    for (let j = i + 1; j < games.length; j++) {
      const a = games[i],
        b = games[j],
        startA = Date.parse(a.startsAt),
        startB = Date.parse(b.startsAt);
      if (
        startA >= startB + b.durationMinutes * 60000 ||
        startB >= startA + a.durationMinutes * 60000
      )
        continue;
      const gameIds = [a.id, b.id];
      if (a.sheet.trim().toUpperCase() === b.sheet.trim().toUpperCase())
        conflicts.push({
          gameIds,
          kind: "sheet",
          resource: a.sheet.trim().toUpperCase(),
        });
      for (const resource of new Set(
        a.entries.filter((id) => b.entries.includes(id)),
      ))
        conflicts.push({ gameIds, kind: "entry", resource });
      for (const resource of new Set(
        a.players.filter((id) => b.players.includes(id)),
      ))
        conflicts.push({ gameIds, kind: "player", resource });
    }
  return conflicts;
}
