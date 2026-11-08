import type { RulesInput, Checkpoint } from "./ranking-inputs";
/** Factual source register, not a verified calculation engine. Hashes are of bytes retrieved 2026-11-08. */
export function wctrs2026(): RulesInput {
  const sources = [
    {
      id: "eligibility",
      title: "Team and Player Eligibility Rules",
      url: "https://worldcurling.org/wp-content/uploads/2026/07/WCTRS-Team-and-Player-Eligibility-Rules-2026-2027.pdf",
      edition: "June 2026 internal edition, 2026-27 season",
      sha256:
        "c13342eef3033965562db54038e46a86e4090d00fd11e5cba27d02c6ac77fc99",
    },
    {
      id: "four",
      title: "Four-player calculations",
      url: "https://worldcurling.org/teamrankings/ranking-calculations-four-player/",
      edition: "2026-27 dated table, mutable HTML",
      sha256:
        "3bdc981ab5c7b098e7faff0b8d815d4cf2b4aa33243ef2d411d0c55b30ac8118",
    },
    {
      id: "mixed",
      title: "Mixed doubles calculations",
      url: "https://worldcurling.org/teamrankings/ranking-calculations-mixed-doubles/",
      edition: "2026-27 dated table, mutable HTML",
      sha256:
        "1bb58dccd7da5969279e9d790effbf59a03bb1167db463ccb774c4f61c9c2000",
    },
    {
      id: "md2024",
      title: "Mixed doubles 2024-25 adopted changes",
      url: "https://worldcurling.org/wp-content/uploads/2024/07/MD-Points-Group-2024-2025-changes.pdf",
      edition: "2024-25 change document corroborating six events",
      sha256:
        "cac15e5c9f0233ab928c17546b2ce4eacd8c34394fb34048309341653bfdf15f",
    },
  ].map((s) => ({ ...s, retrievedAt: "2026-11-08T19:02:37Z" }));
  const checkpoints: Checkpoint[] = [];
  for (const [i, from] of [
    "2026-08-01",
    "2026-09-15",
    "2026-10-06",
    "2026-10-27",
    "2026-11-17",
    "2026-12-08",
    "2026-12-29",
    "2027-01-19",
  ].entries())
    checkpoints.push({
      family: "four_overall",
      from,
      maxEvents: i + 1,
      priorWeight: ["1", "3/4", "5/8", "1/2", "3/8", "1/4", "1/8", "0"][i],
      sourceId: "four",
    });
  for (const [i, from] of [
    "2026-09-01",
    "2026-10-01",
    "2026-11-01",
    "2026-12-01",
    "2027-01-01",
  ].entries())
    checkpoints.push({
      family: "four_series",
      from,
      maxEvents: i + 1,
      priorWeight: "0",
      sourceId: "four",
    });
  for (const [i, from] of [
    "2026-08-01",
    "2026-10-01",
    "2026-11-01",
    "2026-12-01",
    "2027-01-01",
    "2027-02-01",
  ].entries())
    checkpoints.push({
      family: "mixed_doubles",
      from,
      maxEvents: i + 1,
      priorWeight: ["1", "4/5", "3/5", "2/5", "1/5", "0"][i],
      sourceId: "mixed",
    });
  return {
    title: "WCTRS 2026-27 source review",
    season: "2026-27",
    effectiveFrom: "2026-08-01",
    effectiveTo: "2027-08-01",
    sources,
    checkpoints,
    reviewNote: "",
    interpretations: [
      {
        code: "md-six",
        state: "supported",
        sourceIds: ["mixed", "md2024"],
        note: "Application interpretation: follow the dated six-event schedule and adopted 2024-25 changes. The current introduction still says eight; this is not an official erratum.",
      },
      {
        code: "front-rotation",
        state: "supported",
        sourceIds: ["eligibility"],
        note: "Application interpretation: two exact one-quarter and three equal one-sixth shares. The printed 16.67% values are rounded display, not silently normalized inputs. Requires staff review for the declared player assignments.",
      },
      {
        code: "rounding-stage",
        state: "unresolved",
        sourceIds: ["four", "mixed"],
        note: "Final SFM nearest-tenth examples do not establish midpoint convention or stage order. Preserve exact rational inputs; stage-sensitive event calculations remain blocked until policy is reviewed.",
      },
      {
        code: "md-ownership",
        state: "unresolved",
        sourceIds: ["mixed", "eligibility"],
        note: "Field-strength 50/50 contributions do not establish individual/pair starting ownership after partner changes. No ownership formula is asserted.",
      },
      {
        code: "cutoff-instant",
        state: "unresolved",
        sourceIds: ["four", "mixed"],
        note: "These are inclusive calendar checkpoints only. Timezone, event completion/start cutoff, and deadline instants need calculation-context evidence.",
      },
    ],
  };
}
