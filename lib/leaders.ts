import type { Movie } from './boxoffice';

export const FILM_GROUPS = [
  { id: 'south', label: 'South Indian films', industries: ['Kollywood', 'Tollywood', 'Mollywood', 'Sandalwood'] },
  { id: 'north', label: 'North Indian films', industries: ['Bollywood', 'Pollywood'] },
] as const;

// Both groups use the same metric. These are global totals, never territorial takings.
export function filmLeaders(movies: Movie[]) {
  return FILM_GROUPS.map(group => {
    const candidates = movies.filter(movie =>
      (group.industries as readonly string[]).includes(movie.industry ?? '') &&
      movie.worldwide !== null && Number.isFinite(movie.worldwide) && movie.worldwide > 0 &&
      movie.status !== 'review' && movie.status !== 'unavailable' && !movie.fetchError
    );
    const gross = candidates.length ? Math.max(...candidates.map(movie => movie.worldwide!)) : null;
    return {
      id: group.id, label: group.label, gross, compared: candidates.length,
      movies: candidates.filter(movie => movie.worldwide === gross).sort((a, b) => a.title.localeCompare(b.title)),
    };
  });
}
