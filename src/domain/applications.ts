export type ProposedDivision = { id: string; name: string; discipline: string };
export type ApplicationInput = {
  organizationId: string;
  seriesId: string;
  newSeriesName?: string;
  name: string;
  startsOn: string;
  endsOn: string;
  city: string;
  country: string;
  venue: string;
  timezone: string;
  divisions: ProposedDivision[];
};
export const disciplines = {
  men_four: "Men’s four-player",
  women_four: "Women’s four-player",
  mixed_doubles: "Mixed doubles",
};
export function applicationTransition(status: string, action: string) {
  if (
    action === "edit" &&
    ["draft", "submitted", "approved", "rejected"].includes(status)
  )
    return { status, published: status === "approved" };
  if (action === "submit" && ["draft", "rejected"].includes(status))
    return { status: "submitted", published: false };
  if (status === "submitted" && ["approve", "reject"].includes(action))
    return {
      status: action === "approve" ? "approved" : "rejected",
      published: action === "approve",
    };
  throw new Error("This application transition is not allowed.");
}
export function nextEdition(
  source: ApplicationInput,
  startsOn: string,
  endsOn: string,
  divisionIds: string[],
): ApplicationInput {
  return {
    ...source,
    name: `${source.name.replace(/\s+\d{4}$/, "")} ${startsOn.slice(0, 4)}`,
    startsOn,
    endsOn,
    divisions: source.divisions.map((d, i) => ({ ...d, id: divisionIds[i] })),
  };
}
export function validateApplication(value: unknown): Record<string, string> {
  const input = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const errors: Record<string, string> = {};
  if (
    input.newSeriesName !== undefined &&
    (typeof input.newSeriesName !== "string" ||
      !input.newSeriesName.trim() ||
      input.newSeriesName.length > 160 ||
      /[\u0000-\u001f]/.test(input.newSeriesName))
  )
    errors.newSeriesName =
      "Enter a new recurring series name (1–160 characters).";
  for (const [key, label, max] of [
    ["organizationId", "organization", 80],
    ["seriesId", "event series", 80],
    ["name", "edition name", 160],
    ["city", "city", 80],
    ["country", "country", 80],
  ] as const) {
    const text = input[key];
    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > max ||
      /[\u0000-\u001f]/.test(text)
    )
      errors[key] =
        `Enter ${key === "name" || key === "organizationId" || key === "seriesId" ? "an" : "a"} ${label} (1–${max} characters).`;
  }
  const validDate = (date: unknown) =>
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number(date.slice(0, 4)) >= 1900 &&
    Number(date.slice(0, 4)) <= 2200 &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(input.startsOn)) errors.startsOn = "Enter a valid start date.";
  if (!validDate(input.endsOn)) errors.endsOn = "Enter a valid end date.";
  else if (!errors.startsOn && String(input.endsOn) < String(input.startsOn))
    errors.endsOn = "End date must be on or after the start date.";
  if (
    typeof input.venue !== "string" ||
    input.venue.length > 160 ||
    /[\u0000-\u001f]/.test(input.venue)
  )
    errors.venue = "Use at most 160 characters for the venue.";
  try {
    if (typeof input.timezone !== "string" || !input.timezone)
      throw new Error();
    new Intl.DateTimeFormat("en", { timeZone: input.timezone });
  } catch {
    errors.timezone = "Enter an IANA time zone, for example America/Regina.";
  }
  if (
    !Array.isArray(input.divisions) ||
    input.divisions.length < 1 ||
    input.divisions.length > 12
  )
    errors.divisions = "Propose between 1 and 12 divisions.";
  else {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const [i, division] of input.divisions.entries()) {
      if (
        !division ||
        typeof division !== "object" ||
        typeof division.id !== "string" ||
        !/^[\w-]{1,80}$/.test(division.id) ||
        ids.has(division.id) ||
        typeof division.name !== "string" ||
        !division.name.trim() ||
        division.name.length > 80 ||
        /[\u0000-\u001f]/.test(division.name) ||
        names.has(division.name.trim().toLowerCase()) ||
        !Object.hasOwn(disciplines, division.discipline)
      )
        errors[`divisions.${i}`] =
          "Give each division a unique name and supported discipline.";
      else {
        ids.add(division.id);
        names.add(division.name.trim().toLowerCase());
      }
    }
  }
  return errors;
}
