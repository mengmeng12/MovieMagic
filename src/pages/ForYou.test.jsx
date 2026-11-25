import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import MovieCard from '../components/MovieCard';
import ForYou, { loadRecommendations } from './ForYou';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import { listUserMovies } from '../lib/favorites';
import { listUserReviews } from '../lib/reviews';
import { getMovieRecommendations, getTrending } from '../lib/tmdb';

vi.mock('../lib/favorites', () => ({ listUserMovies: vi.fn() }));
vi.mock('../lib/reviews', () => ({ listUserReviews: vi.fn() }));
vi.mock('../lib/tmdb', () => ({ getMovieRecommendations: vi.fn(), getTrending: vi.fn(), posterUrl: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../lib/useAsync', () => ({ useAsync: vi.fn() }));

const movie = (id) => ({ id, title: `Movie ${id}` });

beforeEach(() => {
  vi.resetAllMocks();
  listUserMovies.mockImplementation(async (_, list) => ({
    favorites: [{ movieId: '1' }],
    watchlist: [{ movieId: 2 }],
    watched: [{ id: '3' }],
  })[list]);
  listUserReviews.mockResolvedValue([{ movieId: 4, rating: 5 }]);
  getMovieRecommendations.mockResolvedValue([]);
  getTrending.mockResolvedValue([movie(1), movie(5), movie(2), movie(3), movie(6), movie(4)]);
});

describe('For You trending fallback', () => {
  it('excludes watched/reviewed movies, retains saved movies, and preserves trending order', async () => {
    const result = await loadRecommendations({ uid: 'user' });
    expect(result.fallback).toBe(true);
    expect(result.recs.map(({ movie }) => movie.id)).toEqual([1, 5, 2, 6]);
    expect(result.recs.map(({ listNote }) => listNote)).toEqual([
      'Also in your Favorites list', null, 'Also in your Want to Watch list', null,
    ]);
  });

  it('returns no movies when all trending movies are watched or reviewed', async () => {
    getTrending.mockResolvedValue([movie(3), movie(4)]);
    expect(await loadRecommendations({ uid: 'user' })).toEqual({ recs: [], fallback: true });
  });

  it('keeps trending results for signed-out users without loading a profile', async () => {
    const result = await loadRecommendations(null);
    expect(result.recs.map(({ movie }) => movie.id)).toEqual([1, 5, 2, 3, 6, 4]);
    expect(result.recs.every(({ listNote }) => listNote === null)).toBe(true);
    expect(listUserMovies).not.toHaveBeenCalled();
    expect(listUserReviews).not.toHaveBeenCalled();
  });

  it('loads an exploration pool but keeps very short personalized lists focused', async () => {
    getMovieRecommendations.mockResolvedValue([movie(7)]);
    const result = await loadRecommendations({ uid: 'user' });
    expect(result.fallback).toBe(false);
    expect(result.recs.map(({ movie }) => movie.id)).toEqual([7]);
    expect(getTrending).toHaveBeenCalledTimes(1);
  });

  it('keeps personalized results available when the exploration request fails', async () => {
    getMovieRecommendations.mockResolvedValue([movie(7)]);
    getTrending.mockRejectedValue(new Error('offline'));
    const result = await loadRecommendations({ uid: 'user' });
    expect(result.fallback).toBe(false);
    expect(result.recs.map(({ movie }) => movie.id)).toEqual([7]);
  });

  it('reports trending failure when no personalized results are available', async () => {
    getTrending.mockRejectedValue(new Error('offline'));
    await expect(loadRecommendations({ uid: 'user' })).rejects.toThrow('offline');
  });

  it('includes labeled exploration alongside personalized results', async () => {
    getMovieRecommendations.mockResolvedValue(Array.from({ length: 20 }, (_, i) => movie(100 + i)));
    getTrending.mockResolvedValue([{ ...movie(9), vote_average: 8, vote_count: 500 }]);
    const result = await loadRecommendations({ uid: 'user' });
    expect(result.fallback).toBe(false);
    expect(result.recs).toHaveLength(20);
    expect(result.recs[9]).toMatchObject({ movie: { id: 9 }, exploration: true });
  });

  it.each([true, false])('handles overlapping lists and watched/reviewed precedence (fallback=%s)', async (fallback) => {
    listUserMovies.mockImplementation(async (_, list) => ({
      favorites: [{ movieId: '1' }, { movieId: 3 }, { movieId: 4 }],
      watchlist: [{ id: 1 }, { movieId: '3' }, { movieId: '4' }],
      watched: [{ movieId: 3 }],
    })[list]);
    const candidates = [movie(1), movie(3), movie(4)];
    if (fallback) getTrending.mockResolvedValue(candidates);
    else getMovieRecommendations.mockResolvedValue(candidates);
    const result = await loadRecommendations({ uid: 'user' });
    expect(result.fallback).toBe(fallback);
    expect(result.recs.map(({ movie }) => movie.id)).toEqual([1]);
    expect(result.recs[0].listNote).toBe('Also in your Want to Watch and Favorites lists');
  });

  it('renders both the recommendation reason and list reminder on a card', () => {
    const html = renderToStaticMarkup(
      <StaticRouter location="/for-you">
        <MovieCard movie={movie(1)} note="Trending this week" listNote="Also in your Favorites list" />
      </StaticRouter>,
    );
    expect(html).toContain('Trending this week');
    expect(html).toContain('Also in your Favorites list');
  });

  it('renders a discovery label without pretending it matched an existing favorite', () => {
    useAuth.mockReturnValue({ user: { uid: 'user' } });
    useAsync.mockReturnValue({ data: { fallback: false, recs: [{ movie: movie(9), exploration: true }] } });
    const html = renderToStaticMarkup(<StaticRouter location="/for-you"><ForYou /></StaticRouter>);
    expect(html).toContain('Discover something different');
    expect(html).toContain('/movie/9');
    expect(html).not.toContain('Because');
  });
});
