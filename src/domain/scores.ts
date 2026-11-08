export type DrawSummary = { id: string; startsAt: string; state: string };
export type Score = { state: string; points: number | null };
export function scoreCell(score: Score) {
  if (score.state === 'played' && score.points !== null) return { text: String(score.points), label: `${score.points} points` };
  if (score.state === 'upcoming') return { text: '·', label: 'Upcoming end' };
  if (score.state === 'unplayed') return { text: '—', label: 'End not played' };
  return { text: '?', label: 'Score unknown' };
}
export function selectDraws(draws: DrawSummary[]) {
  const sorted = [...draws].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const live = sorted.filter(d => d.state === 'live').at(-1);
  const completed = sorted.filter(d => d.state === 'completed').at(-1);
  const next = sorted.find(d => d.state === 'scheduled');
  return { selected: (live ?? completed ?? next)?.id ?? null, next: next?.id ?? null,
    label: live ? 'Current draw' : completed ? 'Latest draw' : 'Next draw' };
}
