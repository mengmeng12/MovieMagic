import { describe, expect, it, vi } from 'vitest';
import { formatRecommendationReason, getRecommendations, rankRecommendations, SEED_COUNT } from './recommend';

const movie = (id, vote_average = 7) => ({ id, title: `M${id}`, vote_average });
const seeds = [{ movieId: 1, title: 'A' }, { movieId: 2, title: 'B' }];

describe('rankRecommendations', () => {
  it('ranks movies recommended by several favorites first and records why', () => {
    const lists = [[movie(10, 9), movie(20)], [movie(20)]];
    const result = rankRecommendations(seeds, lists, new Set([1, 2]));
    expect(result.map((r) => r.movie.id)).toEqual([20, 10]);
    expect(result[0]).toMatchObject({ count: 2, because: ['A', 'B'] });
  });

  it('excludes movies already in favorites', () => {
    const lists = [[movie(2), movie(30)], []];
    const result = rankRecommendations(seeds, lists, new Set([1, 2]));
    expect(result.map((r) => r.movie.id)).toEqual([30]);
  });

  it('breaks ties by rating and truncates to limit', () => {
    const lists = [[movie(10, 6), movie(11, 8), movie(12, 7)], []];
    const result = rankRecommendations(seeds, lists, new Set(), 2);
    expect(result.map((r) => r.movie.id)).toEqual([11, 12]);
  });
});

describe('personalized recommendations', () => {
  const now = Date.UTC(2026, 10, 23);
  const daysAgo = (days) => ({ seconds: (now - days * 86400000) / 1000 });
  const saved = (movieId, days, title = `Source ${movieId}`) => ({ movieId, title, addedAt: daysAgo(days) });
  const fetchUnique = async (id) => [movie(100 + id)];
  const recommend = (profile, fetchRecs = fetchUnique) => getRecommendations(profile, fetchRecs, 20, now);

  it.each(['favorites', 'watchlist'])('decays %s with a 90-day half-life and 25%% floor', async (list) => {
    const base = list === 'favorites' ? 3 : 1;
    const result = await recommend({ [list]: [saved(1, 900), saved(2, 90), saved(3, 0), saved(4, 180)] });
    expect(result.map((entry) => entry.movie.id)).toEqual([103, 102, 104, 101]);
    expect(result.map((entry) => entry.score)).toEqual([base, base / 2, base / 4, base / 4]);
  });

  it('uses decayed weights when selecting the six positive seeds', async () => {
    const fetchRecs = vi.fn(fetchUnique);
    await recommend({ favorites: Array.from({ length: 7 }, (_, i) => saved(i + 1, 180 - i * 30)) }, fetchRecs);
    expect(fetchRecs.mock.calls.map(([id]) => id)).toEqual([7, 6, 5, 4, 3, 2]);
  });

  it('keeps favorite and watchlist dates independent and explains the strongest action', async () => {
    const [entry] = await recommend({ favorites: [saved(1, 180)], watchlist: [saved(1, 0)] });
    expect(entry.score).toBe(1);
    expect(entry.reasons).toEqual([expect.objectContaining({ type: 'watchlist', recent: true })]);
    expect(formatRecommendationReason(entry.reasons)).toBe('Because you recently added “Source 1” to Want to Watch');
  });

  it('does not decay ratings or let recent saves override negative ratings', async () => {
    const result = await recommend({
      favorites: [saved(1, 0), saved(2, 180)],
      reviews: [
        { movieId: 1, rating: 2, createdAt: daysAgo(900) },
        { movieId: 2, rating: 9, createdAt: daysAgo(900) },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].score).toBeCloseTo(2.4);
    expect(formatRecommendationReason(result[0].reasons)).toBe('Because you rated “Source 2” 9/10');
  });

  it('handles missing, invalid, and future timestamps without boosts or false recency', async () => {
    const result = await recommend({ favorites: [
      { movieId: 1 }, { movieId: 2, addedAt: { seconds: Number.NaN } }, saved(3, -1),
    ] });
    expect(result.map((entry) => entry.score)).toEqual([3, 3, 3]);
    expect(result.every((entry) => !entry.reasons[0].recent)).toBe(true);
  });

  it('explains only the two strongest positive sources while subtracting negative matches', async () => {
    const [entry] = await recommend({
      favorites: [saved(1, 90), saved(2, 0)],
      watchlist: [saved(3, 0)],
      reviews: [{ movieId: 4, rating: 4 }],
    }, async () => [movie(100), movie(100)]);
    expect(entry.score).toBe(4.5);
    expect(entry.reasons.map((reason) => reason.movieId)).toEqual([2, 1]);
    expect(formatRecommendationReason(entry.reasons)).toBe('Because you recently favorited “Source 2” and you favorited “Source 1”');
  });

  it('excludes watched/reviewed movies and nonpositive candidates', async () => {
    const result = await recommend({
      favorites: [saved(1, 180)], watchlist: [saved(2, 180)],
      watched: [{ movieId: 3 }], reviews: [{ movieId: 4, rating: 4 }],
    }, async (id) => [movie(1), movie(2), movie(3), movie(4), movie(100), ...(id === 1 ? [movie(101)] : [])]);
    expect(result.map((entry) => entry.movie.id)).toEqual([101]);
  });

  it('keeps saved candidates eligible but excludes saved movies that are watched or rated', async () => {
    const result = await recommend({
      favorites: [saved(1, 0), saved(3, 0)],
      watchlist: [saved(2, 0), saved(4, 0)],
      watched: [{ movieId: '3' }], reviews: [{ movieId: '4', rating: 8 }],
    }, async () => [movie(1), movie(2), movie(3), movie(4), movie(100)]);
    expect(result.map((entry) => entry.movie.id)).toEqual([1, 2, 100]);
  });

  it('uses recency wording only for saves within the last 30 days', async () => {
    const result = await recommend({ watchlist: [saved(1, 30), saved(2, 31)] });
    expect(result.map((entry) => entry.reasons[0].recent)).toEqual([true, false]);
  });

  it('handles reviews without titles and empty explanations', async () => {
    const [entry] = await recommend({ reviews: [{ movieId: 1, rating: 8 }] });
    expect(formatRecommendationReason(entry.reasons)).toBe('Because you rated a movie 8/10');
    expect(formatRecommendationReason()).toBeNull();
  });
});

describe('getRecommendations', () => {
  it('uses only the most recent favorites and tolerates a failed request', async () => {
    const favorites = Array.from({ length: 8 }, (_, i) => ({ movieId: i + 1, title: `F${i + 1}` }));
    const fetchRecs = vi.fn(async (id) => {
      if (id === 1) throw new Error('network');
      return [movie(100 + id)];
    });
    const result = await getRecommendations(favorites, fetchRecs);
    expect(fetchRecs).toHaveBeenCalledTimes(SEED_COUNT);
    expect(result).toHaveLength(SEED_COUNT - 1);
  });

  it('returns an empty list when there are no favorites', async () => {
    expect(await getRecommendations([], vi.fn())).toEqual([]);
  });
});

describe('exploration and surprise learning', () => {
  const now = Date.UTC(2026, 10, 25);
  const timestamp = (days = 0) => ({ seconds: (now - days * 86400000) / 1000 });
  const qualityMovie = (id, rating = 8, votes = 500) => ({ ...movie(id, rating), vote_count: votes });
  const familiar = Array.from({ length: 20 }, (_, i) => qualityMovie(100 + i));

  it('reserves at most two slots, ranks exploration by rating then votes, and deduplicates', async () => {
    const result = await getRecommendations({ favorites: [{ movieId: 1 }] }, async () => familiar, 20, now,
      [qualityMovie(200, 8, 600), qualityMovie(201, 9), qualityMovie(202, 8, 800), qualityMovie(201, 9), qualityMovie(100, 10)]);
    expect(result).toHaveLength(20);
    expect(result.filter((entry) => entry.exploration).map((entry) => entry.movie.id)).toEqual([201, 202]);
    expect(result[9]).toMatchObject({ movie: { id: 201 }, score: 0.05 });
    expect(result[19]).toMatchObject({ movie: { id: 202 } });
    expect(new Set(result.map((entry) => entry.movie.id)).size).toBe(20);
    expect(result[0].score).toBe(3);
  });

  it('does not turn a sparse result into mostly exploration', async () => {
    for (const size of [1, 9, 10, 19, 20]) {
      const result = await getRecommendations({ favorites: [{ movieId: 1 }] }, async () => familiar.slice(0, size), 20, now,
        Array.from({ length: 20 }, (_, i) => qualityMovie(200 + i)));
      expect(result.filter((entry) => entry.exploration).length / result.length).toBeLessThanOrEqual(0.1);
    }
  });

  it('does not explore saved, watched, reviewed, low-confidence, or negatively matched movies', async () => {
    const result = await getRecommendations({
      favorites: [{ movieId: 1 }], watchlist: [{ movieId: 2 }],
      watched: [{ movieId: '3' }], reviews: [{ movieId: 4, rating: 1 }],
    }, async (id) => id === 1 ? familiar : id === 4 ? [qualityMovie(5)] : [], 20, now,
    [1, 2, 3, 4, 5].map((id) => qualityMovie(id, 10)).concat(qualityMovie(6, 10, 99), qualityMovie(7, 8)));
    expect(result.filter((entry) => entry.exploration).map((entry) => entry.movie.id)).toEqual([7]);
    expect(result.some((entry) => entry.movie.id === 5)).toBe(false);
  });

  it('ranks weak matches by quality and shares exploration slots with unrelated candidates', async () => {
    const result = await getRecommendations({ watchlist: [{ movieId: 1 }, { movieId: 2, addedAt: timestamp(90) }] },
      async (id) => id === 1 ? familiar : [qualityMovie(200, 9, 800), qualityMovie(201, 9, 1000)], 20, now,
      [qualityMovie(300, 9, 900)]);
    expect(result.filter((entry) => entry.exploration).map((entry) => entry.movie.id)).toEqual([201, 300]);
    expect(result[0].movie.id).toBe(200);
    expect(result[0].score).toBe(0.5);
  });

  it('adds only a small decaying surprise bonus to an accepted discovery', async () => {
    for (const [days, decay] of [[0, 1], [90, 0.5], [900, 0.25]]) {
      const [entry] = await getRecommendations({ watchlist: [{ movieId: 1, surprise: true, addedAt: timestamp(days) }] },
        async () => [movie(100)], 20, now);
      expect(entry.score).toBeCloseTo(1.1 * decay);
      expect(entry.score - decay).toBeLessThan(decay);
      expect(entry.reasons[0].type).toBe('watchlist');
    }
  });

  it('does not stack duplicate surprise saves or override negative ratings', async () => {
    const saved = { movieId: 1, surprise: true, addedAt: timestamp() };
    const [entry] = await getRecommendations({ watchlist: [saved, saved], favorites: [{ movieId: 1 }] }, async () => [movie(100)], 20, now);
    expect(entry.score).toBeCloseTo(3.1);
    const negative = await getRecommendations({ watchlist: [saved], reviews: [{ movieId: 1, rating: 2 }] },
      async () => [qualityMovie(100)], 20, now, [qualityMovie(100)]);
    expect(negative).toEqual([]);
    const [ordinary] = await getRecommendations({ favorites: [{ movieId: 1, surprise: true }] }, async () => [movie(100)], 20, now);
    expect(ordinary.score).toBe(3);
  });

  it('lets one accepted discovery contribute within the six-positive-seed budget', async () => {
    const fetchRecs = vi.fn(async () => []);
    await getRecommendations({
      favorites: Array.from({ length: 8 }, (_, i) => ({ movieId: i + 1 })),
      watchlist: [{ movieId: 9, surprise: true, addedAt: timestamp(10) }, { movieId: 10, surprise: true, addedAt: timestamp() }],
      reviews: [{ movieId: 11, rating: 1 }, { movieId: 12, rating: 2 }],
    }, fetchRecs, 20, now);
    expect(fetchRecs).toHaveBeenCalledTimes(8);
    expect(fetchRecs.mock.calls.map(([id]) => id)).toEqual([1, 2, 3, 4, 5, 10, 11, 12]);
  });
});
