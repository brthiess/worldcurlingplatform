export class ProfileError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function canEditProfile(actor: string, owner: string | null) {
  return actor === owner;
}
export function profileInput(value: unknown) {
  const v = value as Record<string, unknown>;
  if (
    !v ||
    typeof v !== "object" ||
    Object.keys(v).sort().join(",") !== "biography,handedness,version" ||
    typeof v.biography !== "string" ||
    v.biography.trim().length > 500 ||
    /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v.biography) ||
    ![null, "left", "right"].includes(v.handedness as string | null) ||
    !Number.isSafeInteger(v.version) ||
    (v.version as number) < 0
  )
    throw new ProfileError(
      "Provide a biography of up to 500 plain-text characters, left/right/unknown handedness and the current version.",
    );
  return {
    biography: v.biography.trim(),
    handedness: v.handedness as string | null,
    version: v.version as number,
  };
}
export function claimDecision(current: string, next: string) {
  if (!["approved", "rejected"].includes(next))
    throw new ProfileError("Choose approve or reject.");
  if (current === "pending") return "apply";
  if (current === next) return "replay";
  throw new ProfileError("This claim already has a final decision.", 409);
}
