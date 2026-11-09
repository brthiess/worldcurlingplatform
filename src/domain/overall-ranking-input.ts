import {EntryError,identifier,plainText} from "./entries";
import {sourceInput,exact,type Source} from "./ranking-inputs";
import {overallPolicy,type PriorRoster} from "./overall-rankings";
export type SubjectReview={
 registrationId:string;eligibility:"eligible"|"excluded"|"unknown";sourceId:string;note:string;
 continuity:{state:"none"|"retained"|"unknown";sourceId:string;note:string;prior:PriorRoster|null};
 adjustments:{state:"none"|"reviewed"|"unknown";sourceId:string;note:string;exclusions:{awardId:string;sourceId:string;note:string}[];rosterChanges?:{awardId:string;decision:"retain"|"exclude";sourceId:string;note:string}[]};
};
export type OverallEvidence={policyId:string;sources:Source[];reviewNote:string;subjects:SubjectReview[];events:{divisionId:string;state:"assessed"|"excluded"|"unknown";sourceId:string;note:string}[]};
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v))throw new EntryError("Provide overall review evidence.");return v as Record<string,unknown>;}
function list(v:unknown,max=5000):unknown[]{if(!Array.isArray(v)||v.length>max)throw new EntryError(`Provide at most ${max} review rows.`);return v;}
const text=(v:unknown)=>plainText(v??"",2000,true);
export function overallEvidence(raw:unknown):OverallEvidence {
 const r=obj(raw),sources=list(r.sources,30).map(sourceInput);
 if(r.policyId!==overallPolicy.id)throw new EntryError("Review the current explicit overall application policy.");
 if(new Set(sources.map(s=>s.id)).size!==sources.length)throw new EntryError("Source IDs must be unique.");
 const ref=(v:unknown)=>{if(v===""||v==null)return "";const id=identifier(v);if(!sources.some(s=>s.id===id))throw new EntryError("Review references need a recorded source.");return id;};
 const decision=(raw:unknown)=>{const a=obj(raw);return {awardId:plainText(a.awardId,170),sourceId:ref(a.sourceId),note:text(a.note)};};
 const subjects=list(r.subjects).map(raw=>{
  const s=obj(raw),c=obj(s.continuity),a=obj(s.adjustments),eligibility=s.eligibility as SubjectReview["eligibility"],state=c.state as SubjectReview["continuity"]["state"],adjustmentState=a.state as SubjectReview["adjustments"]["state"];
  if(!["eligible","excluded","unknown"].includes(eligibility)||!["none","retained","unknown"].includes(state)||!["none","reviewed","unknown"].includes(adjustmentState))throw new EntryError("Select explicit eligibility, continuity and adjustment states.");
  let prior:PriorRoster|null=null;
  if(c.prior!=null){const p=obj(c.prior);prior={total:exact.value(p.total),members:list(p.members,5).map(raw=>{const m=obj(raw);return {playerId:identifier(m.playerId),share:exact.value(m.share)};})};}
  const exclusions=list(a.exclusions??[]).map(decision),rosterChanges=list(a.rosterChanges??[]).map(raw=>{const v=obj(raw);if(v.decision!=="retain"&&v.decision!=="exclude")throw new EntryError("Choose a sourced retain/exclude roster-change decision.");return {...decision(raw),decision:v.decision as "retain"|"exclude"};});
  if(new Set(exclusions.map(x=>x.awardId)).size!==exclusions.length||new Set(rosterChanges.map(x=>x.awardId)).size!==rosterChanges.length)throw new EntryError("Award decisions must be unique.");
  if(state!=="retained"&&prior)throw new EntryError("Only retained-roster continuity can supply a prior roster.");
  if(adjustmentState==="none"&&(exclusions.length||rosterChanges.length))throw new EntryError("Recorded adjustments require the reviewed state.");
  return {registrationId:identifier(s.registrationId),eligibility,sourceId:ref(s.sourceId),note:text(s.note),continuity:{state,sourceId:ref(c.sourceId),note:text(c.note),prior},adjustments:{state:adjustmentState,sourceId:ref(a.sourceId),note:text(a.note),exclusions,rosterChanges}};
 });
 const events=list(r.events??[]).map(raw=>{const e=obj(raw),state=e.state as OverallEvidence["events"][number]["state"];if(!["assessed","excluded","unknown"].includes(state))throw new EntryError("Select explicit event coverage.");return {divisionId:identifier(e.divisionId),state,sourceId:ref(e.sourceId),note:text(e.note)};});
 if(new Set(subjects.map(s=>s.registrationId)).size!==subjects.length||new Set(events.map(e=>e.divisionId)).size!==events.length)throw new EntryError("Review each subject and event once.");
 return {policyId:overallPolicy.id,sources,reviewNote:text(r.reviewNote),subjects,events};
}
