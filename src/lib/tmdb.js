const BASE = 'https://api.themoviedb.org/3';
const TOKEN = import.meta.env.VITE_TMDB_TOKEN;

export const hasTmdbToken = Boolean(TOKEN);

async function get(path, params = {}) {
  if (!TOKEN) throw new Error('Missing VITE_TMDB_TOKEN. Set it in .env.local');
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`TMDb request failed (${res.status}): ${path}`);
  return res.json();
}

export const getTrending = () => get('/trending/movie/week').then((d) => d.results);
export const getPopular = () => get('/movie/popular').then((d) => d.results);
export const getUpcoming = () => get('/movie/upcoming').then((d) => d.results);
export const getGenres = () => get('/genre/movie/list').then((d) => d.genres);
export const getMovie = (id) => get(`/movie/${id}`, { append_to_response: 'credits,videos' });
export const getMovieRecommendations = (id) =>
  get(`/movie/${id}/recommendations`).then((d) => d.results);
export const getMovieReviews = (id, page = 1) =>
  get(`/movie/${id}/reviews`, { page, language: 'en-US' });

// /search/movie can't filter by genre, so filter locally when there is a query
export async function findMovies({ q, genre, year }) {
  if (!q) {
    const d = await get('/discover/movie', {
      with_genres: genre,
      primary_release_year: year,
      sort_by: 'popularity.desc',
    });
    return d.results;
  }
  const { results } = await get('/search/movie', { query: q, primary_release_year: year });
  return genre ? results.filter((m) => m.genre_ids.includes(Number(genre))) : results;
}

export const posterUrl = (path, size = 'w342') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
