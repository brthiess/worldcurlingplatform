import { ScoresView } from '@/components/scores-view';
export default async function Game({params}:{params:Promise<{id:string}>}) { return <ScoresView gameId={(await params).id}/>; }
