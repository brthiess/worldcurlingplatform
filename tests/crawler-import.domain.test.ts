import { test } from "node:test";
import assert from "node:assert/strict";
import { translateCrawlerGame, sourceKey } from "../src/domain/crawler-import";
const game = () => ({
  id: "src:cz:game:9205:13:366859",
  event_id: "src:cz:event:9205",
  source_draw_id: "13",
  draw_id: null,
  entry_ids: ["src:cz:entry:9205:192891", "src:cz:entry:9205:192887"],
  lineups: [
    {
      completeness: "partial",
      person_ids: ["src:cz:person:1"],
      deliveries: null,
      expected_person_count: null,
    },
    null,
  ],
  identity: "provisional",
  state: "completed",
  scoreline: {
    ends: [
      [0, 0],
      [2, 0],
      [0, 2],
      [0, 0],
      [1, 0],
      [0, 0],
      [0, 1],
      [2, 0],
    ],
    totals: [5, 3],
    listed_final: [5, 3],
    played_end_count: 8,
    totals_basis: "sum_of_ends",
  },
  evidence_ids: ["p-134743"],
  field_evidence: { "/scoreline": ["p-134743"] },
  missing: { "/draw_id": "not_reported" },
  issues: ["lineup_incomplete"],
  last_successful_observed_at: "2026-10-09T21:46:05.222721Z",
});
export { game };
test("complete source score retains blank ends and unresolved identity without certifying participants or hammer", () => {
  const p = translateCrawlerGame(game());
  assert.deepEqual(p.totals, [5, 3]);
  assert.deepEqual(p.ends, [
    [0, 0],
    [2, 0],
    [0, 2],
    [0, 0],
    [1, 0],
    [0, 0],
    [0, 1],
    [2, 0],
  ]);
  assert.equal(p.completeness, "complete_line_score");
  assert.equal(p.firstEndHammer, null);
  assert.equal(p.certification, null);
  assert.equal(p.coreIdentity, null);
  assert.equal(p.drawId, null);
  assert.equal(p.sourceDrawId, "13");
  assert.equal(p.lineups[0]?.completeness, "partial");
  assert.equal(p.lineups[0]?.deliveries, null);
  assert.ok(p.issues.includes("hammer_unknown"));
  assert.ok(p.issues.includes("core_identity_unresolved"));
});
test("specific scoped reported hammer evidence preserves its separate interpretation and never becomes human certification", () => {
  const p = translateCrawlerGame(game(), {
    id: "baden-interpretation",
    gameId: "src:cz:game:9205:13:366859",
    entryId: "src:cz:entry:9205:192891",
    basis: "reported_marker_with_same_game_publisher_corroboration",
    bodySha256:
      "f73d059f96fdbe9217d190cf7aa5335b5498c529a1d6c39090204a10b4b84b4f",
    sourceUrl: "https://www.curlingzone.com/game.php?showgameid=366859",
    corroboratingUrl: "https://www.curlingzone.com/post.php?postid=11280",
    observedAt: "2026-10-09T21:46:05.222721Z",
    historicalParserVersion: null,
  });
  assert.deepEqual(p.firstEndHammer, {
    entryId: "src:cz:entry:9205:192891",
    basis: "reported_marker_with_same_game_publisher_corroboration",
    interpretationId: "baden-interpretation",
  });
  assert.equal(p.certification, null);
  assert.ok(!p.issues.includes("hammer_unknown"));
  assert.ok(p.issues.includes("historical_hammer_parser_unknown"));
});
test("totals-only source keeps null ends, partial evidence and unverified profile membership", () => {
  const g = game();
  g.scoreline = {
    ends: null,
    totals: [7, 3],
    listed_final: [7, 3],
    played_end_count: null,
    totals_basis: "listed_final",
  } as any;
  g.lineups = [null, null] as any;
  g.issues = ["partial_source_ends", "score_requires_review"];
  const p = translateCrawlerGame(g);
  assert.equal(p.completeness, "final_score_only");
  assert.deepEqual(p.totals, [7, 3]);
  assert.equal(p.ends, null);
  assert.deepEqual(p.lineups, [null, null]);
  assert.ok(p.issues.includes("score_requires_review"));
});
test("missing accepted scores remain missing rather than promoting partial displayed results", () => {
  const g = game() as any;
  g.scoreline = null;
  g.partial_score_evidence = { listed_final: [3, 7], raw_cells: [["3", "1"]] };
  const p = translateCrawlerGame(g);
  assert.equal(p.completeness, "missing_score");
  assert.equal(p.ends, null);
  assert.equal(p.totals, null);
  assert.equal(p.firstEndHammer, null);
});
test("parent-scoped entry leaves remain distinct and malformed or foreign parents are rejected", () => {
  assert.notEqual(
    sourceKey("src:cz:entry:9133:1004524", "entry"),
    sourceKey("src:cz:entry:9479:1004524", "entry"),
  );
  for (const value of [
    "1004524",
    "src:cz:entry:1004524",
    " src:cz:entry:9133:1004524",
    "src:cz:entry:9133:1004524:9",
  ])
    assert.throws(() => sourceKey(value, "entry"), /scoped/);
  for (const change of [
    { event_id: "src:cz:event:8" },
    { source_draw_id: "14" },
    { entry_ids: ["src:cz:entry:9479:192891", "src:cz:entry:9205:192887"] },
    { entry_ids: ["src:cz:entry:9205:192891", "src:cz:entry:9205:192891"] },
  ])
    assert.throws(
      () => translateCrawlerGame({ ...game(), ...change }),
      /scope|parent|distinct/,
    );
});
test("malformed accepted ends are rejected rather than silently normalized", () => {
  for (const ends of [[[1, 1]], [[null, 0]], [[-1, 0]], [["0", 0]], [[1]], []])
    assert.throws(() =>
      translateCrawlerGame({
        ...game(),
        scoreline: { ends, totals: [5, 3], played_end_count: 8 },
      }),
    );
  assert.throws(
    () =>
      translateCrawlerGame({
        ...game(),
        scoreline: { ends: [[0, 0]], totals: [5, 3], played_end_count: 1 },
      }),
    /disagree/,
  );
  assert.throws(
    () => translateCrawlerGame({ ...game(), lineups: [{}, null] }),
    /lineup/,
  );
});
test("hammer interpretation cannot cross source game or parent scope", () => {
  for (const v of [
    { gameId: "src:cz:game:9205:14:366859" },
    { gameId: game().id, entryId: "src:cz:entry:9479:192891" },
  ])
    assert.throws(() => translateCrawlerGame(game(), v), /interpretation/);
});
