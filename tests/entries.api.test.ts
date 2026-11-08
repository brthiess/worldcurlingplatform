import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const base=process.env.BETTER_AUTH_URL!;
const sessions=new Map<string,string>();
async function login(role:string) {
 if(sessions.has(role))return sessions.get(role)!;
 const r=await fetch(base+"/api/auth/sign-in/email",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({email:`${role}@demo.invalid`,password:process.env.DEMO_PASSWORD})});
 assert.equal(r.status,200); const cookie=r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");sessions.set(role,cookie);return cookie;
}
async function request(path:string,cookie="",body?:unknown) {return fetch(base+path,{method:body?"POST":"GET",headers:{cookie,Origin:base,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});}
const members=(ids:string[])=>ids.map(playerId=>({playerId,role:"core",position:"",participation:"declared"}));
function assembled() {
 const ids=Array.from({length:4},()=>randomUUID());
 return {divisionId:"prairie-men",name:"WCP006 North",coreKnown:true,corePlayerIds:ids,members:members(ids),newPlayers:ids.map((id,i)=>({id,name:`WCP006 Player ${i+1}`,provisional:false})),registerSeason:{season:"2026-27",version:0}};
}
test("organizer assembles account-free players, creates/reuses team and season roster, and preserves versioned temporary event substitutes",async()=>{
 const cookie=await login("organizer"), id=randomUUID(),entry=assembled();
 const create={id,requestId:randomUUID(),version:0,entry};
 let r=await request("/api/v1/entries",cookie,create); assert.equal(r.status,201);
 const first=await r.json(); assert.equal(first.version,1);assert.equal(first.status,"declared");assert.equal(first.core.length,4);assert.equal(first.lineup.members.length,4);assert.equal(first.registration.version,1);
 assert.equal((await request("/api/v1/entries",cookie,create)).status,201);
 const returning={...entry,corePlayerIds:[...entry.corePlayerIds].reverse(),newPlayers:[],registerSeason:undefined};
 r=await request("/api/v1/entries",cookie,{id:randomUUID(),requestId:randomUUID(),version:0,entry:returning});assert.equal(r.status,201);
 assert.equal((await r.json()).teamId,first.teamId);
 const subId=randomUUID();
 const edit={version:1,requestId:randomUUID(),entry:{...returning,name:"North with guest",teamId:first.teamId,registrationId:first.registration.id,members:[...members(entry.corePlayerIds.slice(0,3)),{playerId:subId,role:"substitute",position:"fourth",participation:"declared"}],newPlayers:[{id:subId,name:"New Guest",provisional:true}]}};
 r=await request(`/api/v1/entries/${id}`,cookie,edit);assert.equal(r.status,200);const saved=await r.json();
 assert.equal(saved.teamId,first.teamId);assert.equal(saved.version,2);assert.equal(saved.status,"provisional");assert.equal(saved.registration.version,1);assert.equal(saved.registration.members.length,4);assert.equal(saved.lineup.members[3].role,"substitute");
 const old=await(await request(`/api/v1/entries/${id}?version=1`,cookie)).json();assert.equal(old.name,"WCP006 North");assert.deepEqual(old.lineup.members.map((m:{playerId:string})=>m.playerId),entry.corePlayerIds);
 const pub=await(await request(`/api/v1/public/entries/${id}`)).json();assert.equal(pub.name,"North with guest");assert.equal(pub.lineup.version,2);assert.equal(pub.lineup.members[3].identityStatus,"provisional");assert.doesNotMatch(JSON.stringify(pub),/requestId|actorId|email|commandDigest/);
 const team=await(await request(`/api/v1/public/teams/${first.teamId}`)).json();assert.equal(team.core.length,4);assert.equal(team.registrations[0].members.length,4);assert(team.entries.some((e:{id:string})=>e.id===id));
});

test("identity races and duplicate deliveries produce one core identity; stale writes and unrelated/profile-owner requests are denied atomically",async()=>{
 const organizer=await login("organizer"),other=await login("ungranted"),scorer=await login("scorekeeper"), entry=assembled();
 const id=randomUUID(),command={id,requestId:randomUUID(),version:0,entry:{...entry,registerSeason:undefined}};
 assert.equal((await request("/api/v1/entries","",command)).status,401);
 assert.equal((await request("/api/v1/entries",other,command)).status,403);
 assert.equal((await request("/api/v1/entries",scorer,command)).status,403);
 assert.equal((await request("/api/v1/entries",organizer,{...command,entry:{...entry,divisionId:"other-men"}})).status,403);
 const duplicate=await Promise.all([request("/api/v1/entries",organizer,command),request("/api/v1/entries",organizer,command)]);
 assert.deepEqual(duplicate.map(r=>r.status),[201,201]);const [a,b]=await Promise.all(duplicate.map(r=>r.json()));assert.equal(a.teamId,b.teamId);assert.equal(a.version,1);assert.equal(b.version,1);
 assert.equal((await request("/api/v1/entries",organizer,{...command,entry:{...command.entry,name:"Changed request"}})).status,409);
 const racing=await Promise.all([1,2].map(()=>request("/api/v1/entries",organizer,{id:randomUUID(),requestId:randomUUID(),version:0,entry:{...entry,newPlayers:[],registerSeason:undefined}})));
 assert.deepEqual(racing.map(r=>r.status),[201,201]);for(const r of racing)assert.equal((await r.json()).teamId,a.teamId);
 const competing=await Promise.all(["Version A","Version B"].map(name=>request(`/api/v1/entries/${id}`,organizer,{version:1,requestId:randomUUID(),entry:{...entry,name,newPlayers:[],registerSeason:undefined}})));
 assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
 const latest=await(await request(`/api/v1/entries/${id}`,organizer)).json();assert.equal(latest.version,2);
 assert.equal((await request(`/api/v1/entries/${id}`,other)).status,403);
 const invalid=await request("/api/v1/entries",organizer,{id:randomUUID(),requestId:randomUUID(),version:0,entry:{...entry,newPlayers:[],corePlayerIds:[...entry.corePlayerIds.slice(0,3),randomUUID()]}});assert.equal(invalid.status,400);
 const incomplete=await request("/api/v1/entries",organizer,{id:randomUUID(),requestId:randomUUID(),version:0,entry:{divisionId:"prairie-men",name:"Unresolved entry",coreKnown:false,corePlayerIds:[],members:[]}});assert.equal(incomplete.status,201);const pending=await incomplete.json();assert.equal(pending.teamId,null);assert.equal(pending.status,"provisional");assert.deepEqual(pending.lineup.members,[]);
});
