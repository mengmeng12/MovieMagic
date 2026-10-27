export const SEED_COUNT = 5;

// seeds: favorites [{ movieId, title }]; lists[i]: TMDb recommendations for seeds[i]
// Movies recommended by more favorites rank higher; ties are broken by TMDb rating
export function rankRecommendations(seeds, lists, favIds, limit = 20) {
  const scores = new Map();
  lists.forEach((results, i) => {
    for (const movie of results) {
      if (favIds.has(movie.id)) continue;
      const entry = scores.get(movie.id) ?? { movie, count: 0, because: [] };
      entry.count += 1;
      entry.because.push(seeds[i].title);
      scores.set(movie.id, entry);
    }
  });
  return [...scores.values()]
    .sort((a, b) => b.count - a.count || b.movie.vote_average - a.movie.vote_average)
    .slice(0, limit);
}

// favorites must be most-recent first; fetchRecs(movieId) returns TMDb recommendations
export async function getRecommendations(favorites, fetchRecs, limit = 20) {
  const seeds = favorites.slice(0, SEED_COUNT);
  const favIds = new Set(favorites.map((f) => f.movieId));
  const lists = await Promise.all(seeds.map((s) => fetchRecs(s.movieId).catch(() => [])));
  return rankRecommendations(seeds, lists, favIds, limit);
}
