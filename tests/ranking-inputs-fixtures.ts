export const source = {
  id: "official",
  title: "Synthetic entitlement evidence for test fixture",
  url: "https://example.com/wcp032-test-evidence",
  edition: "Synthetic test edition 1",
  retrievedAt: "2026-11-08T00:00:00Z",
  sha256: "a".repeat(64),
};
export const rulesFixture = () => ({
  title: "Fictional API rule-source fixture",
  season: "2026-27",
  effectiveFrom: "2026-08-01",
  effectiveTo: "2027-08-01",
  sources: [source],
  checkpoints: [
    {
      family: "four_overall",
      from: "2026-08-01",
      maxEvents: 1,
      priorWeight: "1",
      sourceId: "official",
    },
  ],
  interpretations: [],
  reviewNote: "Fictional fixture, not an official publication.",
});
