import {exact,type RulesInput,type SeasonInput} from "./ranking-inputs";
import {overallContribution,continuityStarting,orderOverall} from "./overall-rankings";
import type {OverallEvidence} from "./overall-ranking-input";
export type OverallSource={
 discipline:string;effectiveDate:string;rules:{id:string;version:number;state:string;data:RulesInput};
 subjects:{registrationId:string;teamId:string;name:string;rosterVersion:number;starting:null|{id:string;version:number;state:string;data:SeasonInput;currentReadiness:{complete:boolean;startingInput:string|null;issues:{severity:string;message:string}[]}}}[];
 events:{divisionId:string;name:string;date:string;assessment:null|{id:string;state:string;contents:string;digest:string;resultContents:string|null;resultDigest:string|null;inputDigest:string|null};finalizationVersion:number|null}[];
};
export function calculateOverall(source:OverallSource,evidence:OverallEvidence){
 const issues:string[]=[],warnings:string[]=[],rows:(ReturnType<typeof overallContribution>&{id:string;name:string;teamId:string;ownership:ReturnType<typeof continuityStarting>;startingRecord:{id:string;version:number};adjustments:unknown})[]=[],excludedSubjects:{id:string;name:string;reason:string}[]=[];
 if(source.rules.state!=="reviewed")issues.push("Review the exact rules/source revision.");
 if(!evidence.reviewNote||!evidence.sources.length)issues.push("Record sourced overall review rationale.");
 const same=(a:string[],b:string[])=>a.length===b.length&&a.every(x=>b.includes(x));
 if(!same(source.subjects.map(s=>s.registrationId),evidence.subjects.map(s=>s.registrationId)))issues.push("Review the entire current season subject universe exactly once.");
 if(!same(source.events.map(s=>s.divisionId),evidence.events.map(s=>s.divisionId)))issues.push("Review every completed-season division, including sourced exclusions.");
 const awards:{id:string;date:string;points:string;registrationId:string;regulars:string[];assessmentId:string;entryId:string;sourceDigest:string;resultDigest:string;excluded?:string}[]=[];
 for(const e of source.events){
  const decision=evidence.events.find(x=>x.divisionId===e.divisionId);
  if(!decision||decision.state==="unknown"||!decision.sourceId||!decision.note){issues.push(`${e.name}: event coverage/eligibility is unresolved.`);continue;}
  if(decision.state==="excluded")continue;
  const a=e.assessment;
  if(!a||a.state!=="completed"||!a.resultContents||a.inputDigest!==a.digest){issues.push(`${e.name}: a completed frozen event assessment is required.`);continue;}
  const input=JSON.parse(a.contents),result=JSON.parse(a.resultContents).result;
  if(input.source.finalization.version!==e.finalizationVersion){issues.push(`${e.name}: latest sporting finalization requires a direct revised event assessment.`);continue;}
  if(result.state!=="completed"){issues.push(`${e.name}: frozen awards are blocked.`);continue;}
  for(const award of result.awards){
   const entry=input.source.current.entries.find((x:{id:string})=>x.id===award.entryId),roster=input.source.starting.find((x:{entryId:string})=>x.entryId===award.entryId)?.evidence;
   if(!entry?.lineup?.registrationId){if(award.points!=="0")issues.push(`${e.name}: award subject ownership cannot be resolved.`);continue;}
   awards.push({id:`${a.id}:${award.entryId}`,date:e.date,points:award.points,registrationId:entry.lineup.registrationId,regulars:roster?.data?.rankingPlayerIds??[],assessmentId:a.id,entryId:award.entryId,sourceDigest:a.digest,resultDigest:a.resultDigest!,...(award.points==="0"?{excluded:"Frozen event assessment exclusion"}:{})});
  }
 }
 for(const s of source.subjects){
  const r=evidence.subjects.find(x=>x.registrationId===s.registrationId);
  if(!r||r.eligibility==="unknown"||!r.sourceId||!r.note){issues.push(`${s.name}: current ranking eligibility/ownership review is unresolved.`);continue;}
  if(r.eligibility==="excluded"){excludedSubjects.push({id:s.registrationId,name:s.name,reason:r.note});continue;}
  const input=s.starting;
  if(!input||input.state!=="reviewed"||!input.currentReadiness.complete){issues.push(`${s.name}: current complete reviewed starting entitlements, allocation and eligibility are required.`);if(input)issues.push(...input.currentReadiness.issues.filter(x=>x.severity==="blocker").map(x=>`${s.name}: ${x.message}`));continue;}
  warnings.push(...input.currentReadiness.issues.filter(x=>x.severity!=="blocker").map(x=>`${s.name}: ${x.message}`));
  if(input.data.effectiveFrom>source.effectiveDate||input.data.effectiveTo<=source.effectiveDate){issues.push(`${s.name}: starting input does not cover the effective date.`);continue;}
  if(r.continuity.state==="unknown"||!r.continuity.sourceId||!r.continuity.note||r.continuity.state==="retained"&&!r.continuity.prior){issues.push(`${s.name}: continuity/previous ownership evidence is unresolved.`);continue;}
  if(r.adjustments.state==="unknown"||!r.adjustments.sourceId||!r.adjustments.note){issues.push(`${s.name}: outstanding ordinary adjustment/transfer/penalty applicability is unresolved.`);continue;}
  const owned=awards.filter(a=>a.registrationId===s.registrationId);
  for(const d of [...r.adjustments.exclusions,...r.adjustments.rosterChanges??[]])if(!owned.some(a=>a.id===d.awardId)||!d.sourceId||!d.note)issues.push(`${s.name}: an adjustment lacks its exact owned frozen award/source/rationale.`);
  for(const a of owned){
   const change=r.adjustments.rosterChanges?.find(d=>d.awardId===a.id);
   if(!same(a.regulars,input.data.rankingPlayerIds)&&!change)issues.push(`${s.name}: official ranking roster changed; a sourced retain/exclude decision for ${a.id} is required.`);
   const exclude=r.adjustments.exclusions.find(d=>d.awardId===a.id);
   if(exclude||change?.decision==="exclude")a.excluded=exclude?.note??change!.note;
  }
  try{
   const ownership=continuityStarting(input.data.contributions.map(c=>({playerId:c.playerId,amount:c.amount!})),r.continuity.prior);
   rows.push({id:s.registrationId,name:s.name,teamId:s.teamId,ownership,startingRecord:{id:input.id,version:input.version},adjustments:r.adjustments,...overallContribution(source.rules.data,source.effectiveDate,ownership.starting,owned)});
  }catch(e){issues.push(`${s.name}: ${(e as Error).message}`);}
 }
 if(!source.subjects.length)issues.push("No registered season subjects exist for this list.");
 const ordered=orderOverall(rows);
 for(const group of ordered.unresolved)issues.push(`Exhausted ranking tie remains unresolved: ${group.join(", ")}. No sourced final sporting criterion is available.`);
 return {state:issues.length?"blocked" as const:"ready" as const,issues,warnings,rows:ordered.rows,excludedSubjects,unresolvedTies:ordered.unresolved,awardCount:awards.length};
}
