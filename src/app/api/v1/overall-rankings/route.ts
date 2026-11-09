import {entryHttp} from "@/modules/entries/http";
import {overallWorkspace,saveOverall} from "@/modules/rankings/overall";
export const GET=(r:Request)=>entryHttp(r,false,userId=>{const q=new URL(r.url).searchParams;return overallWorkspace(userId,{id:q.get("id")??undefined,discipline:q.get("discipline")??undefined,date:q.get("date")??undefined,rules:q.get("rules")??undefined});});
export const POST=(r:Request)=>entryHttp(r,true,async userId=>saveOverall(userId,await r.json()));
