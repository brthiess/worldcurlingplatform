import "dotenv/config";
import {test,before,after} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import pg from "pg";
import {authRequest} from "./auth-request";
import {drawFixtureEvent} from "./draws-fixture";
import {tripleResults,expectedTripleSources} from "./triple-draws-fixture";
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const base=process.env.BETTER_AUTH_URL!;
let event:Awaited<ReturnType<typeof drawFixtureEvent>>,cookie:string;
before(async()=>{
 event=await drawFixtureEvent(pool);
 const r=await authRequest(base+"/api/auth/sign-in/email",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({email:"organizer@demo.invalid",password:process.env.DEMO_PASSWORD})});
 assert.equal(r.status,200);
 cookie=r.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
});
test("forty confirmed scoring API games follow all stored routes, eight qualifiers and final joint placements; correction preserves played opponents",async()=>{
 const {id,seeds}=await create();
 const path="/api/v1/divisions/"+id+"/draw",publicPath=base+"/api/v1/public/divisions/"+id+"/draw";
 for(const body of [
  {requestId:randomUUID(),expectedVersion:0,action:"preview",template:"application-tko16-q8-233-v1",seedEntryIds:seeds,reason:"Full reviewed literal result fixture"},
  {requestId:randomUUID(),expectedVersion:1,action:"publish",reason:"Publish full forty-game fixture"}
 ]) {const r=await post(path,body);assert.equal(r.status,200,await r.clone().text());}
 const read=async()=>await (await fetch(publicPath)).json();
 const completed=new Map<string,{winner:string;loser:string}>();
 const qSources:Record<string,string>={QA1:"A13",QA2:"A14",QB1:"B09",QB2:"B10",QB3:"B11",QC1:"C06",QC2:"C07",QC3:"C08"};
 let gameIds:Record<string,string>={};
 for(const row of tripleResults){
  const data=await read(),g=data.games.find((g:any)=>g.key===row.key); gameIds[row.key]=g.id;
  assert.equal(g.entryA,seeds[row.a-1],row.key+" actual slot A");assert.equal(g.entryB,seeds[row.b-1],row.key+" actual slot B");
  const scorePath="/api/v1/games/"+g.id+"/scoring";
  const end={state:"played",a:row.winner===row.a?2:0,b:row.winner===row.b?2:0};
  for(const command of [
   {requestId:randomUUID(),expectedVersion:g.version,action:"start",hammer:null},
   {requestId:randomUUID(),expectedVersion:g.version+1,action:"end",hammer:null,endNumber:1,end},
  ]) {const r=await post(scorePath,command);assert.equal(r.status,200,await r.clone().text());}
  const confirm={requestId:randomUUID(),expectedVersion:g.version+2,action:"confirm",hammer:null,outcome:"conceded",winnerEntryId:seeds[row.winner-1],reason:"Literal fictional fixture concession after one end"};
  const r=await post(scorePath,confirm);assert.equal(r.status,200,await r.clone().text());
  const confirmed=await r.json();
  assert.deepEqual(await (await post(scorePath,confirm)).json(),confirmed);
  completed.set(row.key,{winner:seeds[row.winner-1],loser:seeds[(row.winner===row.a?row.b:row.a)-1]});
  const advanced=await read();
  for(const line of expectedTripleSources.split("\n")){
   const [key,a,b]=line.split(" ");
   for(const [token,side] of [[a,"entryA"],[b,"entryB"]]) {
    const upstream=qSources[token]??token.slice(1);
    if(upstream!==row.key)continue;
    const expected=completed.get(upstream)![token.startsWith("L")?"loser":"winner"];
    assert.equal(advanced.games.find((g:any)=>g.key===key)[side],expected,`${row.key} -> ${key}.${side}`);
   }
  }
 }
 const complete=await read();
 assert.equal(complete.games.filter((g:any)=>g.state==="confirmed").length,40);
 assert.deepEqual(complete.terminals.filter((t:any)=>t.kind==="qualified").map((t:any)=>[t.label,seeds.indexOf(t.entryId)+1]).sort(),[
  ["QA1",1],["QA2",2],["QB1",4],["QB2",3],["QB3",8],["QC1",5],["QC2",16],["QC3",13]
 ]);
 assert.deepEqual(complete.terminals.filter((t:any)=>t.kind==="placed").map((t:any)=>[seeds.indexOf(t.entryId)+1,t.place]).sort((a:any,b:any)=>a[0]-b[0]),[[1,2],[2,5],[3,3],[4,5],[5,3],[8,5],[13,5],[16,1]]);
 assert.deepEqual(complete.terminals.filter((t:any)=>t.kind==="eliminated").map((t:any)=>seeds.indexOf(t.entryId)+1).sort((a:number,b:number)=>a-b),[6,7,9,10,11,12,14,15]);
 const t16games=complete.games.filter((g:any)=>g.entryA===seeds[15] || g.entryB===seeds[15]);
 assert.equal(t16games.filter((g:any)=>g.winnerEntryId===seeds[15]).length,6);assert.equal(t16games.length,8);
 const beforeDownstream=await (await fetch(base+"/api/v1/public/games/"+gameIds.C04)).json();
 const g=complete.games.find((g:any)=>g.key==="B05");
 const correction=await post("/api/v1/games/"+g.id+"/scoring",{requestId:randomUUID(),expectedVersion:g.version,action:"correct",hammer:null,outcome:"conceded",winnerEntryId:seeds[15],reason:"Correct upstream after C games were actually played",ends:[{state:"played",a:2,b:0}]});
 assert.equal(correction.status,200,await correction.clone().text());
 const changed=await read();
 assert.equal(changed.games.find((g:any)=>g.key==="C04").entryB,seeds[15]);
 assert.equal(changed.games.find((g:any)=>g.key==="C04").attention,true);
 const afterDownstream=await (await fetch(base+"/api/v1/public/games/"+gameIds.C04)).json();
 assert.deepEqual(afterDownstream.results,beforeDownstream.results);
 assert.deepEqual(changed.terminals,complete.terminals);
});
after(async()=>{if(event)await event.cleanup();await pool.end();});
async function post(path:string,body:object){return fetch(base+path,{method:"POST",headers:{cookie,Origin:base,"Content-Type":"application/json","X-WCP-Actor":"demo-organizer"},body:JSON.stringify(body)});}
async function create(){
 const id="tko-"+randomUUID();
 await pool.query("INSERT INTO division(id,event_id,name,discipline,format) VALUES($1,$2,'Main sixteen team triple knockout','men_four','triple knockout')",[id,event.id]);
 const seeds=[];
 for(let n=1;n<=16;n++) { const entry=id+"-"+n;seeds.push(entry);await pool.query("INSERT INTO event_entry(id,division_id,display_name) VALUES($1,$2,$3)",[entry,id,"Fictional T"+String(n).padStart(2,"0")]); }
 return {id,seeds};
}
test("organizer previews and publishes the exact sixteen-team profile with stored loser and qualification feeds",async()=>{
 const {id,seeds}=await create();
 const path="/api/v1/divisions/"+id+"/draw";
 const preview={requestId:randomUUID(),expectedVersion:0,action:"preview",template:"application-tko16-q8-233-v1",seedEntryIds:seeds,reason:"Adopt reviewed exact sixteen-team profile"};
 const r=await post(path,preview);assert.equal(r.status,200,await r.clone().text());
 const data=await r.json();assert.equal(data.graph.games.length,40);assert.equal(data.template,"application-tko16-q8-233-v1");
 assert.deepEqual(await (await post(path,preview)).json(),data);
 assert.equal((await fetch(base+"/api/v1/public/divisions/"+id+"/draw")).status,404);
 const p=await post(path,{requestId:randomUUID(),expectedVersion:1,action:"publish",reason:"Publish reviewed triple graph"});assert.equal(p.status,200,await p.clone().text());
 const publicData=await (await fetch(base+"/api/v1/public/divisions/"+id+"/draw")).json();
 assert.equal(publicData.games.length,40);assert.equal(publicData.graph.games.find((g:any)=>g.key==="B01").a.loser,"A01");
 assert.equal(publicData.graph.games.find((g:any)=>g.key==="P03").b.qualifier,"QC2");
 assert.ok(publicData.games.every((g:any)=>g.drawId===null && g.startsAt===null && g.totalA===null));
 assert.doesNotMatch(JSON.stringify(publicData),/actorId|requestId|command|demo-organizer/);
});
