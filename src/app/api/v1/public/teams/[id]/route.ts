import {publicTeams} from "@/modules/entries/entries";
export async function GET(_r:Request,ctx:{params:Promise<{id:string}>}){const data=await publicTeams((await ctx.params).id);return Response.json(data??{error:"Team not found."},{status:data?200:404,headers:{"Cache-Control":"no-store"}});}

