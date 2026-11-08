export type SaveState =
  | "saved"
  | "unsent"
  | "saving"
  | "uncertain"
  | "conflict";
export function saveTransition(
  state: SaveState,
  event:
    | "edit"
    | "send"
    | "interrupted"
    | "acknowledged"
    | "conflict"
    | "reload",
): SaveState {
  if (event === "acknowledged") return "saved";
  if (event === "conflict") return "conflict";
  if (event === "interrupted") return state === "saving" ? "uncertain" : state;
  if (event === "reload") return "unsent";
  if (event === "send")
    return state === "unsent" || state === "uncertain" ? "saving" : state;
  return state === "saved" ? "unsent" : state;
}
