import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicationReadiness,
  comparePublication,
  pointsLabel,
  publicationOutputIssues,
} from "../src/domain/ranking-publication";
import type { PublicRankingList } from "../src/domain/ranking-publication";
import { freezeContents } from "../src/domain/finalization";

test("calculation and eligibility blockers cannot become acknowledgements", () => {
  assert.deepEqual(
    publicationReadiness(
      {
        state: "blocked",
        issues: ["Unresolved ranking eligibility"],
        warnings: ["Missing biography"],
      },
      ["Missing biography"],
    ),
    ["Unresolved ranking eligibility"],
  );
  assert.deepEqual(
    publicationReadiness(
      { state: "ready", issues: [], warnings: ["Missing biography"] },
      [],
    ),
    ["Acknowledge informational issue: Missing biography"],
  );
  assert.deepEqual(
    publicationReadiness(
      { state: "ready", issues: [], warnings: ["Missing biography"] },
      ["Missing biography"],
    ),
    [],
  );
  assert.throws(
    () =>
      publicationReadiness({ state: "ready", issues: [], warnings: [] }, [
        "Eligibility waiver",
      ]),
    /informational/,
  );
});

test("generic publication output requires unique stable subjects, complete ranks and reconciling exact contributions", () => {
  const data: PublicRankingList = {
    schema: "wcp.public-ranking-list.v1",
    list: {
      family: "series",
      subjectType: "pair",
      discipline: "mixed_doubles",
      season: "2026-27",
      seriesId: "synthetic-series",
    },
    title: "Synthetic pair series fixture, not an official calculation",
    effectiveDate: "2026-11-23",
    origin: "calculated",
    rows: [
      {
        subjectId: "pair-a",
        subjectType: "pair",
        name: "Pair A",
        href: null,
        rank: 1,
        total: "1/2",
        starting: "1",
        carryover: "1/3",
        eventTotal: "1/6",
        contributions: [
          {
            id: "event-a",
            label: "Synthetic event",
            date: "2026-11-22",
            points: "1/6",
            counted: true,
            reason: null,
          },
        ],
      },
    ],
  };
  assert.deepEqual(publicationOutputIssues(data), []);
  assert.match(
    publicationOutputIssues({
      ...data,
      rows: [{ ...data.rows[0], total: "2/3" }],
    }).join(" "),
    /reconcile/,
  );
  assert.match(
    publicationOutputIssues({
      ...data,
      rows: [data.rows[0], { ...data.rows[0], rank: 2 }],
    }).join(" "),
    /unique/,
  );
  assert.match(
    publicationOutputIssues({
      ...data,
      rows: [{ ...data.rows[0], rank: 2 }],
    }).join(" "),
    /ranks/,
  );
  assert.match(
    publicationOutputIssues({
      ...data,
      rows: [{ ...data.rows[0], subjectType: "team" }],
    }).join(" "),
    /subject type/,
  );
  assert.match(
    publicationOutputIssues({ ...data, rows: [] }).join(" "),
    /ranked subject/,
  );
});

test("comparison follows stable subject IDs, including renamed and removed individual subjects", () => {
  const old: PublicRankingList = {
    schema: "wcp.public-ranking-list.v1",
    list: {
      family: "mixed-doubles",
      subjectType: "individual",
      discipline: "mixed_doubles",
      season: "2026-27",
      seriesId: null,
    },
    title: "Synthetic individual list",
    effectiveDate: "2026-11-01",
    origin: "calculated",
    rows: [
      {
        subjectId: "alice",
        name: "Same name",
        subjectType: "individual",
        href: null,
        rank: 2,
        total: "1/3",
        starting: "0",
        carryover: "0",
        eventTotal: "1/3",
        contributions: [],
      },
      {
        subjectId: "bob",
        name: "Same name",
        subjectType: "individual",
        href: null,
        rank: 1,
        total: "2",
        starting: "0",
        carryover: "0",
        eventTotal: "2",
        contributions: [],
      },
    ],
  };
  const current = {
    ...old,
    effectiveDate: "2026-11-08",
    rows: [{ ...old.rows[0], name: "Renamed", rank: 1, total: "2/6" }],
  };
  assert.deepEqual(comparePublication(current, old), {
    rows: [
      {
        subjectId: "alice",
        name: "Renamed",
        rank: 1,
        previousRank: 2,
        movement: 1,
        total: "2/6",
        previousTotal: "1/3",
        pointsChanged: false,
      },
    ],
    removed: [{ subjectId: "bob", name: "Same name", rank: 1, total: "2" }],
  });
  assert.deepEqual(
    comparePublication(current, JSON.parse(freezeContents(old).contents)),
    comparePublication(current, old),
  );
  assert.throws(
    () =>
      comparePublication(
        { ...current, list: { ...current.list, subjectType: "pair" } },
        old,
      ),
    /same list/,
  );
  assert.throws(
    () => comparePublication({ ...current, effectiveDate: "2026-10-01" }, old),
    /earlier/,
  );
  assert.equal(pointsLabel("1/10000000"), "<0.000001 (exact 1/10000000)");
  assert.equal(pointsLabel("1/3"), "0.333333 (exact 1/3)");
});
