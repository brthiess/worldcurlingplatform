import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from 'pg';
import {hashPassword} from 'better-auth/crypto';
const base = process.env.BETTER_AUTH_URL!;
const sessions=new Map<string,string>();
async function login(role: string) {
  if(sessions.has(role))return sessions.get(role)!;
  const r = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({
      email: `${role}@demo.invalid`,
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(r.status, 200);
  const cookie=r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  sessions.set(role,cookie);return cookie;
}
async function request(path: string, cookie = "", body?: unknown) {
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { cookie, Origin: base, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}
test("organizer creates next year, responsible administrator admits it, corrections preserve independent states and immutable history", async () => {
  const organizer = await login("organizer"),
    admin = await login("administrator"),
    unrelated = await login("scorekeeper");
  const before = await (
    await request("/api/v1/public/events/prairie-2026")
  ).json();
  const id = randomUUID();
  const application = {
    organizationId: "prairie-club",
    seriesId: "prairie",
    name: `Prairie Open 2027 ${id.slice(0, 8)}`,
    startsOn: "2027-11-08",
    endsOn: "2027-11-10",
    city: "Regina",
    country: "Canada",
    venue: "",
    timezone: "America/Regina",
    divisions: [
      { id: randomUUID(), name: "Men", discipline: "men_four" },
      { id: randomUUID(), name: "Women", discipline: "women_four" },
    ],
  };
  const command = {
    requestId: randomUUID(),
    id,
    action: "create",
    application,
  };
  assert.equal(
    (await request("/api/v1/applications", unrelated, command)).status,
    403,
  );
  let r = await request("/api/v1/applications", organizer, command);
  assert.equal(r.status, 201);
  let saved = await r.json();
  assert.equal(saved.status, "draft");
  assert.equal(saved.history.length, 1);
  assert.equal(saved.history[0].actorName, "Demo organizer");
  assert.equal(
    (await request("/api/v1/applications", organizer, command)).status,
    201,
  );
  assert.equal(
    (await request(`/api/v1/applications/${id}`, unrelated)).status,
    403,
  );
  assert.equal((await request(`/api/v1/public/events/${id}`)).status, 404);
  const submit = {
    requestId: randomUUID(),
    action: "submit",
    version: saved.version,
  };
  r = await request(`/api/v1/applications/${id}`, organizer, submit);
  assert.equal(r.status, 200);
  saved = await r.json();
  assert.equal(
    (
      await request(`/api/v1/applications/${id}`, organizer, {
        requestId: randomUUID(),
        action: "approve",
        version: saved.version,
      })
    ).status,
    403,
  );
  const approve = {
    requestId: randomUUID(),
    action: "approve",
    version: saved.version,
  };
  r = await request(`/api/v1/applications/${id}`, admin, approve);
  assert.equal(r.status, 200);
  saved = await r.json();
  assert.equal(saved.status, "approved");
  assert.equal(saved.registrationStatus, "closed");
  assert.deepEqual(
    saved.divisions.map((d: { rankingStatus: string }) => d.rankingStatus),
    ["unresolved", "unresolved"],
  );
  assert.equal(saved.history.length, 3);
  assert.equal(saved.history[2].actorName, "Demo administrator");
  assert.equal(
    (await request(`/api/v1/applications/${id}`, admin, approve)).status,
    200,
  );
  const calendar = await (await request("/api/v1/public/calendar")).json();
  assert(calendar.events.some((e: { id: string }) => e.id === id));
  const publicEvent = await (
    await request(`/api/v1/public/events/${id}`)
  ).json();
  assert.equal(publicEvent.divisions.length, 2);
  assert.equal(publicEvent.event.origin, "operated");
  assert.doesNotMatch(
    JSON.stringify(publicEvent),
    /actor|requestId|reviewerId|email|history/,
  );
  const originalSnapshot = saved.history[2].snapshot;
  const edit = {
    requestId: randomUUID(),
    action: "edit",
    version: saved.version,
    application: { ...application, city: "Saskatoon" },
  };
  r = await request(`/api/v1/applications/${id}`, organizer, edit);
  assert.equal(r.status, 200);
  saved = await r.json();
  assert.equal(saved.city, "Saskatoon");
  assert.equal(saved.status, "approved");
  assert.deepEqual(saved.history[2].snapshot, originalSnapshot);
  assert.equal(
    (
      await request(`/api/v1/applications/${id}`, admin, {
        ...edit,
        requestId: randomUUID(),
      })
    ).status,
    409,
  );
  r = await request(`/api/v1/applications/${id}`, admin, {
    ...edit,
    requestId: randomUUID(),
    version: saved.version,
    application: { ...application, venue: "Confirmed Ice", city: "Saskatoon" },
  });
  assert.equal(r.status, 200);
  saved = await r.json();
  assert.equal(saved.venue, "Confirmed Ice");
  assert.equal(saved.history.length, 5);
  assert.deepEqual(
    (await (await request("/api/v1/public/events/prairie-2026")).json()).event,
    before.event,
  );
});
test('validation, responsible reviewer scope, rejection/resubmission and concurrent stale requests remain private and audited',async()=>{
  const organizer=await login('organizer'),admin=await login('administrator');
  assert.equal((await request('/api/v1/applications')).status,401);
  assert.equal((await request('/api/v1/applications',organizer,{requestId:randomUUID(),action:'create'})).status,400);
  assert.equal((await request('/api/v1/applications',organizer,{id:randomUUID(),requestId:randomUUID(),action:'create',application:{organizationId:'other-club'}})).status,403);
  const id=randomUUID(),seriesId=randomUUID();
  const application={organizationId:'prairie-club',seriesId,newSeriesName:'New application series',name:'Rejected and corrected application',startsOn:'2028-02-28',endsOn:'2028-02-29',city:'Winnipeg',country:'Canada',venue:'',timezone:'America/Winnipeg',divisions:[{id:randomUUID(),name:'Mixed doubles',discipline:'mixed_doubles'}]};
  const create={id,requestId:randomUUID(),action:'create',application};
  const invalid=await request('/api/v1/applications',organizer,{...create,application:{...application,name:'',endsOn:'2028-02-20'}}); assert.equal(invalid.status,400); assert.equal((await invalid.json()).fields.endsOn,'End date must be on or after the start date.');
  let r=await request('/api/v1/applications',organizer,create);assert.equal(r.status,201);let saved=await r.json();
  assert.equal((await request('/api/v1/applications',organizer,{...create,application:{...application,name:'Other content'}})).status,409);
  assert.equal((await request(`/api/v1/applications/${id}`,admin,{requestId:randomUUID(),action:'approve',version:saved.version})).status,409);
  r=await request(`/api/v1/applications/${id}`,organizer,{requestId:randomUUID(),action:'submit',version:saved.version});saved=await r.json();
  const database=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const otherId=`wcp004-reviewer-${randomUUID()}`;
  try {
    await database.query('INSERT INTO auth_user(id,name,email,email_verified) VALUES($1,$2,$3,true)',[otherId,'Other administrator',`${otherId}@demo.invalid`]);
    await database.query("INSERT INTO auth_account(id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES($1,$2,'credential',$2,$3,now(),now())",[randomUUID(),otherId,await hashPassword(process.env.DEMO_PASSWORD!)]);
    await database.query("INSERT INTO role_grant(id,user_id,role,event_id,game_id) VALUES($1,$2,'administrator',NULL,NULL)",[randomUUID(),otherId]);
    const other=await login(otherId);
    assert.equal((await request(`/api/v1/applications/${id}`,other,{requestId:randomUUID(),action:'approve',version:saved.version})).status,403);
    assert.equal((await request(`/api/v1/applications/${id}`,admin,{requestId:randomUUID(),action:'reject',version:saved.version})).status,400);
    r=await request(`/api/v1/applications/${id}`,admin,{requestId:randomUUID(),action:'reject',version:saved.version,reason:'Confirm the proposed dates.'});assert.equal(r.status,200);saved=await r.json();assert.equal(saved.status,'rejected');assert.equal(saved.history.at(-1).reason,'Confirm the proposed dates.');
    assert.equal((await request(`/api/v1/public/events/${id}`)).status,404);
    const calendar=await (await request('/api/v1/public/calendar')).json();assert.equal(calendar.events.some((e:{id:string})=>e.id===id),false);
    const version=saved.version;
    const concurrent=await Promise.all(['First venue','Second venue'].map(venue=>request(`/api/v1/applications/${id}`,organizer,{requestId:randomUUID(),action:'edit',version,application:{...application,venue}})));
    assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
    saved=await (await request(`/api/v1/applications/${id}`,organizer)).json();assert.equal(saved.version,version+1);assert.equal(saved.history.length,4);
    r=await request(`/api/v1/applications/${id}`,organizer,{requestId:randomUUID(),action:'submit',version:saved.version});assert.equal(r.status,200);saved=await r.json();assert.equal(saved.status,'submitted');
    const cross=await fetch(`${base}/api/v1/applications/${id}`,{method:'POST',headers:{cookie:admin,Origin:'https://untrusted.invalid','Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),action:'approve',version:saved.version})});assert.equal(cross.status,403);
  } finally {await database.query('DELETE FROM auth_user WHERE id=$1',[otherId]);await database.end();}
});
test('audit failure rolls back edition, new series, divisions and grant; retry commits one attributed history record',async()=>{
  const organizer=await login('organizer'),admin=await login('administrator');
  const id=randomUUID();const database=new pg.Pool({connectionString:process.env.DATABASE_URL});
  const application={organizationId:'prairie-club',seriesId:randomUUID(),newSeriesName:'Atomic series',name:'Atomic audit rollback',startsOn:'2029-10-01',endsOn:'2029-10-02',city:'Regina',country:'Canada',venue:'',timezone:'UTC',divisions:[{id:randomUUID(),name:'Women',discipline:'women_four'}]};
  const create={id,requestId:randomUUID(),action:'create',application};
  try {
    await database.query(`CREATE FUNCTION wcp004_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id=TG_ARGV[0] THEN RAISE EXCEPTION 'Injected audit failure'; END IF; RETURN NEW; END $$`);
    await database.query(`CREATE TRIGGER wcp004_test_fail_audit BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION wcp004_test_fail_audit('${id}')`);
    assert.equal((await request('/api/v1/applications',organizer,create)).status,503);
    assert.equal((await request(`/api/v1/applications/${id}`,admin)).status,404);
    const workspace=await (await request('/api/v1/applications',organizer)).json();assert.equal(workspace.series.some((s:{id:string})=>s.id===application.seriesId),false);
    await database.query('DROP TRIGGER wcp004_test_fail_audit ON audit_record');
    const retry=await request('/api/v1/applications',organizer,create);assert.equal(retry.status,201);const saved=await retry.json();assert.equal(saved.history.length,1);assert.equal(saved.history[0].auditAction,'application_create');
    await assert.rejects(database.query('UPDATE event_application_history SET reason=$1 WHERE event_id=$2',['tampered',id]),/immutable/);
    assert.equal((await request(`/api/v1/applications/${id}`,organizer)).status,200);
  } finally {await database.query('DROP TRIGGER IF EXISTS wcp004_test_fail_audit ON audit_record');await database.query('DROP FUNCTION IF EXISTS wcp004_test_fail_audit()');await database.end();}
});
