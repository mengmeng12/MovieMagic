export const SEED_COUNT = 5;
const MAX_PROFILE_POSITIVE_SEEDS = 6;
const MAX_PROFILE_NEGATIVE_SEEDS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
export const SAVE_HALF_LIFE_DAYS = 90;
export const MIN_SAVE_WEIGHT = 0.25;
const RECENT_DAYS = 30;

export function getExcludedMovieIds(profile = {}) {
  return new Set(['watched', 'reviews']
    .flatMap((list) => profile[list] ?? [])
    .map((item) => item.movieId ?? item.id)
    .filter((id) => id != null)
    .map(String));
}

function timestampMs(timestamp) {
  return Number.isFinite(timestamp?.seconds) ? timestamp.seconds * 1000 : null;
}

function saveDecay(addedAt, now) {
  if (addedAt == null) return 1;
  const ageDays = Math.max(0, now - addedAt) / DAY_MS;
  return Math.max(MIN_SAVE_WEIGHT, 2 ** (-ageDays / SAVE_HALF_LIFE_DAYS));
}

export function formatRecommendationReason(reasons = []) {
  const phrases = reasons.slice(0, 2).map((reason) => {
    const title = reason.title ? `“${reason.title}”` : 'a movie';
    const recent = reason.recent ? 'recently ' : '';
    if (reason.type === 'favorites') return `you ${recent}favorited ${title}`;
    if (reason.type === 'watchlist') return `you ${recent}added ${title} to Want to Watch`;
    return `you rated ${title} ${reason.rating}/10`;
  });
  return phrases.length ? `Because ${phrases.join(' and ')}` : null;
}

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
export async function getRecommendations(profileInput, fetchRecs, limit = 20, now = Date.now()) {
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
      favoriteAt: null,
      watchlistAt: null,
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
    if (seed) {
      seed.favorite = true;
      seed.favoriteAt = timestampMs(item.addedAt);
    }
  }
  for (const item of listsByName.watchlist) {
    const seed = addItem(item);
    if (seed) {
      seed.watchlist = true;
      seed.watchlistAt = timestampMs(item.addedAt);
    }
  }
  for (const item of listsByName.reviews) {
    const seed = addItem(item);
    const rating = item.rating == null ? Number.NaN : Number(item.rating);
    if (seed && Number.isFinite(rating)) seed.rating = Math.max(1, Math.min(10, rating));
  }

  const scoredSeeds = [...seedsById.values()].map((seed) => {
    let weight;
    let reason = null;
    if (seed.rating != null && seed.rating <= 4) {
      // A low explicit rating is stronger negative feedback than a save signal.
      weight = seed.rating - 5;
    } else {
      const signals = [
        { type: 'favorites', weight: seed.favorite ? 3 * saveDecay(seed.favoriteAt, now) : 0, at: seed.favoriteAt },
        { type: 'watchlist', weight: seed.watchlist ? saveDecay(seed.watchlistAt, now) : 0, at: seed.watchlistAt },
        { type: 'ratings', weight: seed.rating >= 6 ? (seed.rating - 5) * 0.6 : 0, at: null },
      ].sort((a, b) => b.weight - a.weight || (b.at ?? 0) - (a.at ?? 0));
      const strongest = signals[0];
      weight = strongest.weight;
      if (weight > 0) {
        reason = {
          movieId: seed.movieId,
          title: seed.title,
          type: strongest.type,
          rating: seed.rating,
          weight,
          recent: strongest.at != null && strongest.at <= now && now - strongest.at <= RECENT_DAYS * DAY_MS,
        };
      }
    }

    const because = [];
    if (weight > 0) {
      if (seed.favorite) because.push('favorites');
      if (seed.watchlist) because.push('watchlist');
      if (seed.rating >= 6) because.push('ratings');
    }
    return { ...seed, weight, because, reason };
  }).filter((seed) => seed.weight !== 0)
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight) || b.updatedAt - a.updatedAt);
  const seeds = isLegacyInput
    ? scoredSeeds.filter((seed) => seed.weight > 0).slice(0, SEED_COUNT)
    : [
      ...scoredSeeds.filter((seed) => seed.weight > 0).slice(0, MAX_PROFILE_POSITIVE_SEEDS),
      ...scoredSeeds.filter((seed) => seed.weight < 0).slice(0, MAX_PROFILE_NEGATIVE_SEEDS),
    ];

  const excludedIds = getExcludedMovieIds(listsByName);

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
      if (movie.id == null || excludedIds.has(key) || seenForSeed.has(key)) continue;
      seenForSeed.add(key);

      const entry = scores.get(key) ?? { movie, score: 0, count: 0, because: new Set(), reasons: [] };
      entry.score += seed.weight;
      entry.count += 1;
      if (seed.weight > 0) {
        seed.because.forEach((reason) => entry.because.add(reason));
        entry.reasons.push(seed.reason);
      }
      scores.set(key, entry);
    }
  });

  return [...scores.values()]
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score
      || (b.movie.vote_average ?? 0) - (a.movie.vote_average ?? 0)
      || (b.movie.vote_count ?? 0) - (a.movie.vote_count ?? 0))
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      because: [...entry.because],
      reasons: entry.reasons.sort((a, b) => b.weight - a.weight).slice(0, 2),
    }));
}
