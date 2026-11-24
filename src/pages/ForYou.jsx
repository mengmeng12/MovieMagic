import { Link } from 'react-router-dom';
import { listUserMovies } from '../lib/favorites';
import { listUserReviews } from '../lib/reviews';
import { formatRecommendationReason, getExcludedMovieIds, getRecommendations } from '../lib/recommend';
import { getMovieRecommendations, getTrending } from '../lib/tmdb';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import Status from '../components/Status';

export async function loadRecommendations(user) {
  const profile = user ? await Promise.all([
    listUserMovies(user.uid, 'favorites'),
    listUserMovies(user.uid, 'watchlist'),
    listUserMovies(user.uid, 'watched'),
    listUserReviews(user.uid),
  ]).then(([favorites, watchlist, watched, reviews]) => ({
    favorites, watchlist, watched, reviews,
  })) : {};
  const savedIds = (list) => new Set((profile[list] ?? [])
    .map((item) => item.movieId ?? item.id).filter((id) => id != null).map(String));
  const favoriteIds = savedIds('favorites');
  const watchlistIds = savedIds('watchlist');
  const addListNote = (entry) => {
    const id = String(entry.movie.id);
    const lists = [];
    if (watchlistIds.has(id)) lists.push('Want to Watch');
    if (favoriteIds.has(id)) lists.push('Favorites');
    return { ...entry, listNote: lists.length ? `Also in your ${lists.join(' and ')} ${lists.length > 1 ? 'lists' : 'list'}` : null };
  };
  const recs = await getRecommendations(profile, getMovieRecommendations);
  if (recs.length) return { recs: recs.map(addListNote), fallback: false };
  // Fall back to trending when there are no positive matches.
  const trending = await getTrending();
  const excludedIds = getExcludedMovieIds(profile);
  return {
    recs: trending
      .filter((movie) => movie.id != null && !excludedIds.has(String(movie.id)))
      .map((movie) => addListNote({ movie, because: [] })),
    fallback: true,
  };
}

export default function ForYou() {
  const { user } = useAuth();
  const state = useAsync(() => loadRecommendations(user), [user]);

  return (
    <>
      <h1>For You</h1>
      <Status state={state} />
      {state.data?.fallback && (
        <p className="muted">
          {user
            ? 'Favorite movies, add movies to your Want to Watch list, or rate movies'
            : <><Link to="/login">Sign in</Link> to favorite movies, add movies to your Want to Watch list, or rate them</>} to get personalized picks. Movies you’ve watched or reviewed are excluded. Movies in your Favorites or Want to Watch lists may still appear, with a reminder.
          {' '}{state.data.recs.length
            ? 'Meanwhile, here’s what’s trending:'
            : 'No new trending picks are available right now. Try browsing for something new.'}
        </p>
      )}
      {state.data && (
        <div className="grid">
          {state.data.recs.map(({ movie, reasons, listNote }) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              note={state.data.fallback ? 'Trending this week' : formatRecommendationReason(reasons)}
              listNote={listNote}
            />
          ))}
        </div>
      )}
    </>
  );
}
