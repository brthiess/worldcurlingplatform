import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export function overallEngineIdentity() {
  const paths = [
    "scripts/overall-engine-identity.mjs",
    "src/domain/overall-rankings.ts",
    "src/domain/overall-ranking-input.ts",
    "src/domain/overall-calculation.ts",
    "src/domain/ranking-inputs.ts",
    "src/domain/finalization.ts",
    "src/domain/entries.ts",
    "src/modules/rankings/overall.ts",
    "src/modules/rankings/inputs.ts",
    "src/modules/competition/finalization.ts",
    "src/domain/overall-sources.ts",
    "package-lock.json",
    "tsconfig.json",
    "next.config.mjs",
  ].sort();
  const files = paths.map((path) => ({
      path,
      sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    })),
    fingerprint = createHash("sha256")
      .update(JSON.stringify(files))
      .digest("hex");
  return {
    schema: "wcp.overall-engine-identity.v1",
    fingerprint,
    codeRevision: `sha256:${fingerprint}`,
    files,
    node: process.version,
  };
}
