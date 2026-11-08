import { pool } from '@/db';
import { publicEvent } from '@/modules/public/scores';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const id=(await params).id;
    const result=await pool.query('SELECT d.event_id FROM game g JOIN draw_session ds ON ds.id=g.draw_id JOIN division d ON d.id=ds.division_id WHERE g.id=$1',[id]);
    const data=result.rows[0]?await publicEvent(result.rows[0].event_id):null;
    if(!data) return Response.json({error:'Game not found'},{status:404});
    return Response.json({...data,games:data.games.filter(g=>g.id===id)},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Scores are temporarily unavailable'},{status:503});}
}
