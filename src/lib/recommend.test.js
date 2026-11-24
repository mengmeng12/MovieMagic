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
