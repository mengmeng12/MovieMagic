import { describe, expect, it, vi } from 'vitest';
import { getRecommendations, rankRecommendations, SEED_COUNT } from './recommend';

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
