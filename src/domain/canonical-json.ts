/** Existing frozen-manifest canonicalization: code-unit key ordering, not locale collation. */
export function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value))
    return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
