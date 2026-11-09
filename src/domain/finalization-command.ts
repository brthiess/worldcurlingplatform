/** Exact private finalization receipt command: whitelist and trim match the write API. */
export function finalizationCommand(input: {
  divisionId: string;
  version: number;
  requestId: string;
  sourceDigest: string;
  placements: unknown;
  note: string;
  rulesReference: string;
}) {
  return {
    divisionId: input.divisionId,
    version: input.version,
    requestId: input.requestId,
    sourceDigest: input.sourceDigest,
    placements: input.placements,
    note: input.note.trim(),
    rulesReference: input.rulesReference.trim(),
  };
}
