export type Grant = { role: string; eventId: string | null; gameId: string | null };
export type Resource = { eventId: string; gameId: string };
export function permitted(grants: Grant[], action: 'read' | 'score' | 'manage', resource: Resource) {
  return grants.some(g => {
    if (g.role === 'administrator' && g.eventId === null && g.gameId === null) return true;
    if (g.eventId !== resource.eventId || (g.gameId !== null && g.gameId !== resource.gameId)) return false;
    if (g.role === 'organizer') return true;
    if (g.role === 'scorekeeper') return action !== 'manage' && g.gameId === resource.gameId;
    return g.role === 'reviewer' && action === 'read';
  });
}
