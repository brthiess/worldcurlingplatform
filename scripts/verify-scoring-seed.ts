import assert from "node:assert/strict";
import { pool } from "../src/db";
import { publicEvent } from "../src/modules/public/scores";
import { scoringGame, saveScoring } from "../src/modules/scoring/commands";
import { randomUUID } from "node:crypto";
try {
  const edited =
    process.argv.includes("--edited") || process.argv.includes("--edit");
  if (process.argv.includes("--edit")) {
    const current = await scoringGame("demo-scorekeeper", "game-2");
    await saveScoring("demo-scorekeeper", "game-2", {
      requestId: randomUUID(),
      expectedVersion: current.version,
      action: "end",
      endNumber: 1,
      end: { state: "played", a: 4, b: 0 },
      hammer: "a",
    });
  }
  const event = await publicEvent("prairie-2026");
  const game = event!.games.find((g) => g.id === "game-2")!;
  assert.equal(game.totalA, edited ? 7 : 3);
  assert.equal(game.totalB, edited ? 1 : 2);
  assert.equal(game.hammer, "b");
  assert.equal(game.hammerEnd, 5);
  assert.equal(game.endHammer[4], "b");
  const assigned = await scoringGame("demo-scorekeeper", "game-2");
  assert.equal(assigned.endHammer[4], "b");
  assert.equal(assigned.hammerEnd, 5);
  if (edited) {
    assert.deepEqual(assigned.ends[0], { state: "played", a: 4, b: 0 });
    assert.equal(assigned.endHammer[0], "a");
    assert.equal(assigned.version, 1);
  }
  console.log(
    "Fresh demo seed exposes the same known end-five hammer through public and assigned reads",
  );
} finally {
  await pool.end();
}
