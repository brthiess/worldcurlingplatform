import {publicTeams} from "@/modules/entries/entries";
export async function GET(r:Request){return Response.json(await publicTeams(undefined,(new URL(r.url).searchParams.get("q")??"").slice(0,160)),{headers:{"Cache-Control":"no-store"}});}

