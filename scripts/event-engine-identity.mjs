import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
/** Hash actual source bytes, including dirty changes. No label or git title substitutes for these bytes. */
export function eventEngineIdentity() {
  const paths = [
    "package-lock.json",
    "tsconfig.json",
    "scripts/run-next.mjs",
    "scripts/event-engine-identity.mjs",
    "next.config.mjs",
    "src/domain/event-assessments.ts",
    "src/domain/event-assessment-input.ts",
    "src/domain/event-assessment-snapshot.ts",
    "src/domain/event-assessment-sources.ts",
    "src/domain/ranking-inputs.ts",
    "src/domain/entries.ts",
    "src/domain/finalization.ts",
    "src/modules/rankings/inputs.ts",
    "src/modules/rankings/assessments.ts",
  ].sort();
  const files = paths.map((path) => ({
    path,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  }));
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(files))
    .digest("hex");
  return {
    schema: "wcp.event-engine-identity.v1",
    codeRevision: `sha256:${fingerprint}`,
    fingerprint,
    files,
    node: process.version,
  };
}
