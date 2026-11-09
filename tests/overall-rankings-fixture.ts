import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { assessmentFixture } from "./event-assessments-fixture";
import { source } from "./ranking-inputs-fixtures";
export function overallReviewEvidence(
  review: any,
  f: { divisionId: string; seasonIds: string[] },
) {
  return {
    policyId: "wcp.four-overall-policy.2026-27.v1",
    sources: [source],
    reviewNote:
      "Fictional full-universe source review; documentary metadata is synthetic.",
    events: review.events.map((e: any) => ({
      divisionId: e.divisionId,
      state: e.divisionId === f.divisionId ? "assessed" : "excluded",
      sourceId: "official",
      note: "Fictional actual assessment or independent exclusion decision",
    })),
    subjects: review.subjects.map((s: any) => ({
      registrationId: s.registrationId,
      eligibility: f.seasonIds.includes(s.registrationId)
        ? "eligible"
        : "excluded",
      sourceId: "official",
      note: "Fictional complete individual ownership/eligibility decision",
      continuity: {
        state: "none",
        sourceId: "official",
        note: "No applicable continuity floor",
        prior: null,
      },
      adjustments: {
        state: "none",
        sourceId: "official",
        note: "No outstanding ordinary changes, penalties or exemptions",
        exclusions: [],
      },
    })),
  };
}
export async function overallFixture(
  db: Pool,
  send: (
    path: string,
    body?: unknown,
  ) => Promise<{
    status: number;
    json(): Promise<any>;
    text(): Promise<string>;
  }>,
  discipline: "men_four" | "women_four" = "women_four",
) {
  const f = await assessmentFixture(db, send, { discipline });
  async function json(path: string, body?: unknown) {
    const r = await send(path, body);
    if (r.status !== 200)
      throw new Error(`${path}: ${r.status} ${await r.text()}`);
    return r.json();
  }
  const w = await json(
    `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
  );
  await json("/api/v1/event-assessments", {
    action: "calculate",
    divisionId: f.divisionId,
    version: 0,
    sourceDigest: w.review.sourceDigest,
    requestId: randomUUID(),
    evidence: f.evidence,
  });
  const end = Date.now() + 25000;
  let state = "";
  while (Date.now() < end) {
    const done = await json(
      `/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`,
    );
    state = done.selected.state;
    if (state === "completed") break;
    if (state === "blocked" || state === "failed")
      throw new Error(done.selected.resultContents ?? done.selected.error);
    await new Promise((r) => setTimeout(r, 100));
  }
  if (state !== "completed")
    throw new Error("Actual event awards did not complete");
  for (let i = 0; i < 8; i++) {
    const v = await json(`/api/v1/ranking-inputs?id=${f.reviewIds[i]}`);
    v.data.contributions.forEach(
      (c: { amount: string }) => (c.amount = String(50 + i * 10)),
    );
    await json("/api/v1/ranking-inputs", {
      id: v.id,
      kind: "season",
      version: v.version,
      requestId: randomUUID(),
      state: "reviewed",
      data: v.data,
    });
  }
  return { ...f, discipline };
}
