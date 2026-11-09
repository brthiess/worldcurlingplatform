import { test } from "node:test";
import assert from "node:assert/strict";
import { overallContribution, orderOverall, continuityStarting, transferEntitlement } from "../src/domain/overall-rankings";
import { wctrs2026 } from "../src/domain/wctrs-2026";

test("F4 inclusive overall checkpoints count best awards and retain exact dated carryover", () => {
  const expected = [
    ["2026-09-14", "200", 1, "160"], ["2026-09-15", "190", 2, "120"],
    ["2026-10-05", "190", 2, "120"], ["2026-10-06", "190", 3, "100"],
    ["2026-10-27", "170", 3, "80"], ["2026-11-17", "150", 3, "60"],
    ["2026-12-08", "130", 3, "40"], ["2026-12-29", "110", 3, "20"],
    ["2027-01-19", "90", 3, "0"],
  ] as const;
  for (const [date,total,count,carryover] of expected) {
    const r = overallContribution(wctrs2026(), date, "160", [
      {id:"a", date:"2026-09-01", points:"40"},
      {id:"b", date:"2026-09-02", points:"30"},
      {id:"c", date:"2026-09-03", points:"20"},
    ]);
    assert.equal(r.total,total); assert.equal(r.counted.length,count); assert.equal(r.carryover,carryover);
  }
});

test("F6 fewer actual events then repeated smallest-result removal order exact ties; exhausted vectors remain unresolved",()=>{
  const row=(id:string,points:string[],carry="0")=>({id,...overallContribution(wctrs2026(),"2027-01-19",carry,points.map((points,i)=>({id:String(i),date:"2026-09-01",points})))});
  assert.deepEqual(orderOverall([row("B",["35","25","20","10"]),row("A",["40","30","20"])]).rows.map(x=>x.id),["A","B"]);
  assert.deepEqual(orderOverall([row("C",["40","30","20"]),row("D",["45","30","15"])]).rows.map(x=>x.id),["D","C"]);
  assert.deepEqual(orderOverall([row("F",["45","30","15"]),row("E",["50","25","15"])]).rows.map(x=>x.id),["E","F"]);
  const tie=orderOverall([row("Z",["40","30","20"]),row("A",["40","30","20"])]);
  assert.equal(tie.unresolved.length,1); assert.equal(tie.rows[0].rank,null); assert.equal(tie.rows[1].rank,null);
});

test("F7 continuity uses exact prior rights and retained roster evidence independently of identity",()=>{
  const prior={total:"200",members:["a","b","c","d"].map(playerId=>({playerId,share:"1/4"}))};
  assert.equal(continuityStarting([{playerId:"a",amount:"50"},{playerId:"b",amount:"50"},{playerId:"c",amount:"50"},{playerId:"x",amount:"80"}],prior).starting,"230");
  assert.equal(continuityStarting([{playerId:"a",amount:"50"},{playerId:"b",amount:"50"},{playerId:"c",amount:"50"},{playerId:"x",amount:"30"}],prior).starting,"200");
  assert.throws(()=>continuityStarting([{playerId:"a",amount:"51"},{playerId:"b",amount:"50"},{playerId:"c",amount:"50"},{playerId:"x",amount:"80"}],prior),/retained/i);
  assert.throws(()=>continuityStarting([{playerId:"a",amount:"50"},{playerId:"b",amount:"50"},{playerId:"x",amount:"50"},{playerId:"y",amount:"80"}],prior),/three of four|four of five/);
  assert.equal(continuityStarting(["20","24","28","32","36"].map((amount,i)=>({playerId:String(i),amount})),null).starting,"140");
  assert.equal(transferEntitlement("pre-post","80","120",null,null),"30");
  assert.equal(transferEntitlement("post-post","80","120","200",null),"40");
  assert.equal(transferEntitlement("pre-none","80","0",null,null),"20");
  assert.equal(transferEntitlement("pre-pre","0","0",null,"200"),"50");
  assert.equal(transferEntitlement("post-none","0","0","200",null),"40");
});
