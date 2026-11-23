export const SEED_COUNT = 5;
const MAX_PROFILE_POSITIVE_SEEDS = 6;
const MAX_PROFILE_NEGATIVE_SEEDS = 2;

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
export async function getRecommendations(profileInput, fetchRecs, limit = 20) {
  const isLegacyInput = Array.isArray(profileInput);
  const profile = isLegacyInput ? { favorites: profileInput } : (profileInput ?? {});
  const listsByName = {
    favorites: profile.favorites ?? [],
    watchlist: profile.watchlist ?? [],
    watched: profile.watched ?? [],
    reviews: profile.reviews ?? [],
  };
  const seedsById = new Map();

  function addItem(item) {
    const movieId = item.movieId ?? item.id;
    if (movieId == null) return null;
    const key = String(movieId);
    const seed = seedsById.get(key) ?? {
      movieId,
      title: item.title ?? item.movieTitle ?? '',
      favorite: false,
      watchlist: false,
      rating: null,
      updatedAt: 0,
    };
    seed.title ||= item.title ?? item.movieTitle ?? '';
    seed.updatedAt = Math.max(seed.updatedAt, item.addedAt?.seconds ?? item.createdAt?.seconds ?? 0);
    seedsById.set(key, seed);
    return seed;
  }

  for (const item of listsByName.favorites) {
    const seed = addItem(item);
    if (seed) seed.favorite = true;
  }
  for (const item of listsByName.watchlist) {
    const seed = addItem(item);
    if (seed) seed.watchlist = true;
  }
  for (const item of listsByName.reviews) {
    const seed = addItem(item);
    const rating = item.rating == null ? Number.NaN : Number(item.rating);
    if (seed && Number.isFinite(rating)) seed.rating = Math.max(1, Math.min(10, rating));
  }

  const scoredSeeds = [...seedsById.values()].map((seed) => {
    let weight;
    if (seed.rating != null && seed.rating <= 4) {
      // A low explicit rating is stronger negative feedback than a save signal.
      weight = seed.rating - 5;
    } else {
      const ratingWeight = seed.rating >= 6 ? (seed.rating - 5) * 0.6 : 0;
      weight = Math.max(seed.favorite ? 3 : 0, seed.watchlist ? 1 : 0, ratingWeight);
    }

    const because = [];
    if (weight > 0) {
      if (seed.favorite) because.push('favorites');
      if (seed.watchlist) because.push('watchlist');
      if (seed.rating >= 6) because.push('ratings');
    }
    return { ...seed, weight, because };
  }).filter((seed) => seed.weight !== 0)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight) || b.updatedAt - a.updatedAt);
  const seeds = isLegacyInput
    ? scoredSeeds.filter((seed) => seed.weight > 0).slice(0, SEED_COUNT)
    : [
      ...scoredSeeds.filter((seed) => seed.weight > 0).slice(0, MAX_PROFILE_POSITIVE_SEEDS),
      ...scoredSeeds.filter((seed) => seed.weight < 0).slice(0, MAX_PROFILE_NEGATIVE_SEEDS),
    ];

  const knownIds = new Set([
    ...listsByName.favorites,
    ...listsByName.watchlist,
    ...listsByName.watched,
    ...listsByName.reviews,
  ].map((item) => item.movieId ?? item.id).filter((id) => id != null).map(String));

  const recommendations = await Promise.all(seeds.map(async (seed) => {
    try {
      return await fetchRecs(seed.movieId);
    } catch {
      return [];
    }
  }));

  const scores = new Map();
  recommendations.forEach((movies, index) => {
    const seed = seeds[index];
    const seenForSeed = new Set();
    for (const movie of movies) {
      const key = String(movie.id);
      if (movie.id == null || knownIds.has(key) || seenForSeed.has(key)) continue;
      seenForSeed.add(key);

      const entry = scores.get(key) ?? { movie, score: 0, count: 0, because: new Set() };
      entry.score += seed.weight;
      entry.count += 1;
      if (seed.weight > 0) seed.because.forEach((reason) => entry.because.add(reason));
      scores.set(key, entry);
    }
  });

  return [...scores.values()]
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score
      || (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0)
      || (b.movie.vote_count ?? 0) - (a.movie.vote_count ?? 0))
    .slice(0, limit)
    .map((entry) => ({ ...entry, because: [...entry.because] }));
}
