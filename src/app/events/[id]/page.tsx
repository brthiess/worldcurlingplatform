import { ScoresView } from '@/components/scores-view';
export default async function Event({params}:{params:Promise<{id:string}>}) { return <ScoresView eventId={(await params).id}/>; }
