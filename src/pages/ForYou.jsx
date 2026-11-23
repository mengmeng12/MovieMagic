import { Link } from 'react-router-dom';
import { listUserMovies } from '../lib/favorites';
import { listUserReviews } from '../lib/reviews';
import { getRecommendations } from '../lib/recommend';
import { getMovieRecommendations, getTrending } from '../lib/tmdb';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import Status from '../components/Status';

async function loadRecommendations(user) {
  const profile = user ? await Promise.all([
    listUserMovies(user.uid, 'favorites'),
    listUserMovies(user.uid, 'watchlist'),
    listUserMovies(user.uid, 'watched'),
    listUserReviews(user.uid),
  ]).then(([favorites, watchlist, watched, reviews]) => ({
    favorites, watchlist, watched, reviews,
  })) : {};
  const recs = await getRecommendations(profile, getMovieRecommendations);
  if (recs.length) return { recs, fallback: false };
  // Fall back to trending when there are no positive matches.
  const trending = await getTrending();
  return { recs: trending.map((movie) => ({ movie, because: [] })), fallback: true };
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
            : <><Link to="/login">Sign in</Link> to favorite movies, add movies to your Want to Watch list, or rate them</>} to get personalized picks. Watched movies are excluded from recommendations. Meanwhile, here’s what’s trending:
        </p>
      )}
      {state.data && (
        <div className="grid">
          {state.data.recs.map(({ movie, because }) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              note={because.length ? `Based on your ${because.join(' and ')}` : null}
            />
          ))}
        </div>
      )}
    </>
  );
}
