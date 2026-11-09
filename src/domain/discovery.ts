export type Favorite = { kind: "event" | "team" | "player"; id: string };
export const FAVORITES_KEY = "wcp.favorites.v1";
export function readFavorites(raw: string | null): Favorite[] {
  try {
    const value = JSON.parse(raw ?? "null");
    if (value?.version !== 1 || !Array.isArray(value.items)) return [];
    const result: Favorite[] = [];
    for (const item of value.items.slice(0, 500)) {
      if (
        item &&
        ["event", "team", "player"].includes(item.kind) &&
        typeof item.id === "string" &&
        /^[a-zA-Z0-9-]{1,120}$/.test(item.id) &&
        !result.some((x) => x.kind === item.kind && x.id === item.id)
      )
        result.push({ kind: item.kind, id: item.id });
    }
    return result;
  } catch {
    return [];
  }
}
export function writeFavorites(items: Favorite[]) {
  return JSON.stringify({
    version: 1,
    items: readFavorites(JSON.stringify({ version: 1, items })),
  });
}
export type EventFilters = Partial<
  Record<
    "q" | "discipline" | "division" | "location" | "from" | "to" | "status",
    string
  >
>;
export function eventStatus(
  states: string[],
  startsOn: string,
  endsOn: string,
  today: string,
) {
  if (states.includes("live")) return "live";
  if (states.length && states.every((state) => state === "confirmed"))
    return "completed";
  if (startsOn > today) return "upcoming";
  return "unknown";
}
export function filterEvents<
  T extends {
    name: string;
    seriesName: string;
    location: string;
    startsOn: string;
    endsOn: string;
    status: string;
    divisions: { id: string; name: string; discipline: string; status?:string }[];
  },
>(events: T[], f: EventFilters): T[] {
  if (f.from && f.to && f.from > f.to) return [];
  const q = (f.q ?? "").trim().toLowerCase();
  return events.map(e=>{
    if(!f.division&&!f.discipline) return e;
    const selected=e.divisions.filter(d=>(!f.division||d.id===f.division)&&(!f.discipline||d.discipline===f.discipline));
    if(!selected.length||selected.some(d=>!d.status)) return e;
    const status=selected.some(d=>d.status==="live")?"live":selected.every(d=>d.status==="completed")?"completed":selected.every(d=>d.status==="upcoming")?"upcoming":"unknown";
    return {...e,status};
  }).filter(
    (e) =>
      (!q ||
        `${e.name} ${e.seriesName} ${e.location}`.toLowerCase().includes(q)) &&
      (!f.location || e.location === f.location) &&
      (!f.from || e.endsOn >= f.from) &&
      (!f.to || e.startsOn <= f.to) &&
      (!f.status || e.status === f.status) &&
      ((!f.division && !f.discipline) ||
        e.divisions.some(
          (d) =>
            (!f.division || d.id === f.division) &&
            (!f.discipline || d.discipline === f.discipline),
        )),
  );
}
export function contextLink(path: string, source: string) {
  const target = new URL(path, "http://local.invalid");
  const previous = new URLSearchParams(source);
  const targetEvent = /^\/events\/([^/]+)/.exec(target.pathname)?.[1];
  const changedEvent = !!targetEvent && !!previous.get("event") && previous.get("event") !== targetEvent;
  const changedDivision =
    target.searchParams.has("division") &&
    target.searchParams.get("division") !== previous.get("division");
  for (const key of [
    "division",
    "draw",
    "q",
    "discipline",
    "location",
    "from",
    "to",
    "status",
    "event",
  ]) {
    const value = previous.get(key);
    if (
      value &&
      value.length <= 200 &&
      !(changedDivision && key === "draw") &&
      !(changedEvent && (key === "division" || key === "draw")) &&
      !target.searchParams.has(key)
    )
      target.searchParams.set(key, changedEvent && key === "event" ? targetEvent! : value);
  }
  return (
    target.pathname +
    (target.searchParams.size ? "?" + target.searchParams.toString() : "")
  );
}
