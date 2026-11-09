import "dotenv/config";
import {test,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import pg from "pg";
import {authRequest} from "./auth-request";
import {assessmentFixture} from "./event-assessments-fixture";
import {source} from "./ranking-inputs-fixtures";
const db=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3}),base=process.env.BETTER_AUTH_URL!;
after(()=>db.end());
let cookie="";
async function send(path:string,body?:unknown){
 if(!cookie){const r=await authRequest(base+"/api/auth/sign-in/email",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({email:"administrator@demo.invalid",password:process.env.DEMO_PASSWORD})});assert.equal(r.status,200);cookie=r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");}
 return fetch(base+path,{method:body?"POST":"GET",headers:{cookie,Origin:base,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
}
async function json(path:string,body?:unknown){const r=await send(path,body);assert.equal(r.status,200,await r.clone().text());return r.json();}
test("real persisted awards produce immutable overall contributions, command retries and frozen replay",async()=>{
 const f=await assessmentFixture(db,send);
 const review=await json(`/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`);
 await json("/api/v1/event-assessments",{action:"calculate",divisionId:f.divisionId,version:0,sourceDigest:review.review.sourceDigest,requestId:randomUUID(),evidence:f.evidence});
 let completed:any;const end=Date.now()+25000;
 while(Date.now()<end){completed=await json(`/api/v1/event-assessments?division=${f.divisionId}&rules=${f.rulesId}`);if(completed.selected?.state==="completed")break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(completed.selected.state,"completed");
 // Distinct independently sourced prior entitlements avoid exhausted fixture ties.
 for(let i=0;i<8;i++){const v=await json(`/api/v1/ranking-inputs?id=${f.reviewIds[i]}`);v.data.contributions.forEach((c:any)=>c.amount=String(50+i*10));await json("/api/v1/ranking-inputs",{id:v.id,kind:"season",version:v.version,requestId:randomUUID(),state:"reviewed",data:v.data});}
 const path=`/api/v1/overall-rankings?discipline=men_four&date=2026-11-23&rules=${f.rulesId}`;
 const w=await json(path);
 const evidence={policyId:"wcp.four-overall-policy.2026-27.v1",sources:[source],reviewNote:"Fictional full list including separately sourced exclusions, not official results.",events:w.review.events.map((e:any)=>({divisionId:e.divisionId,state:e.divisionId===f.divisionId?"assessed":"excluded",sourceId:"official",note:"Fictional full-universe assessment/exclusion decision."})),subjects:w.review.subjects.map((s:any)=>({registrationId:s.registrationId,eligibility:f.seasonIds.includes(s.registrationId)?"eligible":"excluded",sourceId:"official",note:"Fictional full-universe eligibility and no unrecorded transfers or penalties.",continuity:{state:"none",sourceId:"official",note:"Independently reviewed individual starting rights; no continuity floor.",prior:null},adjustments:{state:"none",sourceId:"official",note:"No outstanding ownership changes, ordinary adjustments, penalties or exemptions.",exclusions:[]}}))};
 const cmd={action:"calculate",discipline:"men_four",effectiveDate:"2026-11-23",rulesId:f.rulesId,version:w.version,sourceDigest:w.review.sourceDigest,requestId:randomUUID(),evidence};
 const done=await json("/api/v1/overall-rankings",cmd);
 assert.equal(done.result.state,"ready",JSON.stringify(done.result.issues));
 assert.equal(done.result.rows.find((r:any)=>r.id===f.seasonIds[0]).total,"102"); //27 + 200 ×3/8
 assert.equal(done.result.rows.find((r:any)=>r.id===f.seasonIds[0]).counted[0].points,"27");
 assert.equal((await json("/api/v1/overall-rankings",cmd)).id,done.id);
 assert.equal((await send("/api/v1/overall-rankings",{...cmd,evidence:{...evidence,reviewNote:"Conflict"}})).status,409);
 const replay=await json("/api/v1/overall-rankings",{action:"replay",runId:done.id,discipline:"men_four",effectiveDate:"2026-11-23",requestId:randomUUID()});assert.equal(replay.resultDigest,done.resultDigest);
 assert.equal((await send("/api/v1/overall-rankings",{...cmd,requestId:randomUUID()})).status,409);
 const old=await json(`/api/v1/overall-rankings?id=${done.id}`);assert.equal(old.manifestDigest,done.manifestDigest);assert.equal(old.resultDigest,done.resultDigest);
});
