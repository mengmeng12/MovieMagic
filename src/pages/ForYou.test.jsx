import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import MovieCard from '../components/MovieCard';
import { loadRecommendations } from './ForYou';
import { listUserMovies } from '../lib/favorites';
import { listUserReviews } from '../lib/reviews';
import { getMovieRecommendations, getTrending } from '../lib/tmdb';

vi.mock('../lib/favorites', () => ({ listUserMovies: vi.fn() }));
vi.mock('../lib/reviews', () => ({ listUserReviews: vi.fn() }));
vi.mock('../lib/tmdb', () => ({ getMovieRecommendations: vi.fn(), getTrending: vi.fn(), posterUrl: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

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

  it('does not request trending when personalized recommendations are available', async () => {
    getMovieRecommendations.mockResolvedValue([movie(7)]);
    const result = await loadRecommendations({ uid: 'user' });
    expect(result.fallback).toBe(false);
    expect(result.recs.map(({ movie }) => movie.id)).toEqual([7]);
    expect(getTrending).not.toHaveBeenCalled();
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
});
