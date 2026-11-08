import { test } from "node:test";
import assert from "node:assert/strict";
import { tripleKnockout, selectedDrawPath, sourceLabel } from "../src/domain/draws";
import { expectedTripleSources, tripleResults } from "./triple-draws-fixture";
const entries = Array.from({length:16}, (_,n)=>`T${n+1}`);
test("the adopted sixteen-team profile exposes every literal source and all eight qualifier destinations",()=>{
  const graph=tripleKnockout(entries);
  assert.equal(graph.template,"application-tko16-q8-233-v1");
  assert.deepEqual(graph.byes,[]);
  assert.equal(graph.games.length,40);
  assert.equal(graph.games.map(g=>`${g.key} ${sourceLabel(g.a,true)} ${sourceLabel(g.b,true)}`).join("\n"),expectedTripleSources);
  assert.deepEqual(graph.games.filter(g=>g.terminals?.winner?.kind==="qualified").map(g=>[g.key,g.terminals!.winner!.label]),[
    ["A13","QA1"],["A14","QA2"],["B09","QB1"],["B10","QB2"],["B11","QB3"],["C06","QC1"],["C07","QC2"],["C08","QC3"]
  ]);
});
test("selected team follows stored A/B/C and playoff branches including a two-loss champion",()=>{
  const graph=tripleKnockout(entries);
  const actual=tripleResults.map(r=>({key:r.key,entryA:`T${r.a}`,entryB:`T${r.b}`,winnerEntryId:`T${r.winner}`}));
  assert.deepEqual(selectedDrawPath(graph,16,"T16",actual),["A01","B01","B05","C04","C07","P03","P06","P07"]);
  assert.deepEqual(selectedDrawPath(graph,11,"T11",actual),["A08","B04","C02"]);
  assert.deepEqual(selectedDrawPath(graph,1,"T1",actual),["A01","A09","A13","P01","P05","P07"]);
});
test("a first A loss exposes its stored B route before an assignment is returned",()=>{
  const path=selectedDrawPath(tripleKnockout(entries),16,"T16",[{key:"A01",entryA:"T1",entryB:"T16",winnerEntryId:"T1"}]);
  assert.ok(path.includes("B01"));
  assert.ok(path.includes("C04"));
  assert.ok(!path.includes("A09"));
});
