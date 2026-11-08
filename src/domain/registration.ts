import { EntryError, plainText } from "./entries";
export type RegistrationMode = "open" | "reviewed" | "invited";
export type AdmissionState =
  | "pending"
  | "invited"
  | "held"
  | "accepted"
  | "expired"
  | "waitlisted";
export type RegistrationTerms = {
  mode: RegistrationMode;
  capacity: number;
  requirements: string;
  feeMinor: number;
  currency: string;
  paymentTerms: string;
  paymentWindowMinutes: number;
  format: string;
  formatNotes: string;
};
export function registrationTerms(raw: unknown): RegistrationTerms {
  if (!raw || typeof raw !== "object")
    throw new EntryError("Complete the entry terms before opening.");
  const v = raw as RegistrationTerms;
  if (!["open", "reviewed", "invited"].includes(v.mode))
    throw new EntryError("Choose open, reviewed or invited entry.");
  if (!Number.isSafeInteger(v.capacity) || v.capacity < 1 || v.capacity > 256)
    throw new EntryError("Capacity must be 1–256 entries.");
  if (
    !Number.isSafeInteger(v.feeMinor) ||
    v.feeMinor < 0 ||
    v.feeMinor > 100000000
  )
    throw new EntryError("Enter a nonnegative fee in currency minor units.");
  if (typeof v.currency !== "string" || !/^[A-Z]{3}$/.test(v.currency))
    throw new EntryError("Enter a three-letter currency code.");
  if (
    !Number.isSafeInteger(v.paymentWindowMinutes) ||
    v.paymentWindowMinutes < 1 ||
    v.paymentWindowMinutes > 43200
  )
    throw new EntryError("Set a payment window of 1–43200 minutes.");
  if (
    ![
      "single_knockout",
      "double_knockout",
      "triple_knockout",
      "round_robin",
      "page_playoff",
      "swiss",
      "pool_playoff",
    ].includes(v.format)
  )
    throw new EntryError(
      "Select a supported format family and document its configuration.",
    );
  return {
    mode: v.mode,
    capacity: v.capacity,
    feeMinor: v.feeMinor,
    currency: v.currency,
    paymentWindowMinutes: v.paymentWindowMinutes,
    requirements: plainText(v.requirements, 2000),
    paymentTerms: plainText(v.paymentTerms, 2000),
    format: v.format,
    formatNotes: plainText(v.formatNotes, 2000),
  };
}
export function effectiveAdmission(
  state: AdmissionState,
  deadline: string | Date | null,
  now: Date,
): AdmissionState {
  return state === "held" &&
    deadline &&
    new Date(deadline).getTime() <= now.getTime()
    ? "expired"
    : state;
}
export function occupiedPlaces(
  entries: { state: AdmissionState; deadline: string | Date | null }[],
  now: Date,
): number {
  return entries.filter((e) =>
    ["accepted", "held"].includes(effectiveAdmission(e.state, e.deadline, now)),
  ).length;
}
export function requestAdmission(
  mode: RegistrationMode,
  state: AdmissionState,
  fee: number,
  minutes: number,
  remaining: number,
  now: Date,
  staffAccept: boolean,
): { state: AdmissionState; deadline: string | null } {
  if (["accepted", "held", "expired", "waitlisted"].includes(state))
    throw new EntryError(
      `This entry is ${state}. Reload its current status; expired places and waitlists need a separate staff decision.`,
      409,
    );
  if (mode === "invited" && state !== "invited")
    throw new EntryError(
      "An explicit invitation is required before requesting a place.",
      403,
    );
  if (mode === "reviewed" && !staffAccept)
    return { state: "pending", deadline: null };
  if (remaining < 1) {
    if (staffAccept)
      throw new EntryError("No capacity remains for acceptance.", 409);
    return { state: "waitlisted", deadline: null };
  }
  return fee === 0
    ? { state: "accepted", deadline: null }
    : {
        state: "held",
        deadline: new Date(now.getTime() + minutes * 60000).toISOString(),
      };
}
/** A late provider event must be recorded for staff attention; it cannot reclaim a released place. */
export function paymentDisposition(state: AdmissionState) {
  return state === "held" ? "within_reservation" : "staff_attention";
}
export function canEnterDraw(entry: {
  entryAdmission: string;
  admissionState: AdmissionState;
  registrationConfigured: boolean;
}): boolean {
  return entry.registrationConfigured
    ? entry.admissionState === "accepted"
    : entry.entryAdmission === "organizer_recorded";
}
