import { Link } from 'react-router-dom';
import { listFavorites } from '../lib/favorites';
import { getRecommendations } from '../lib/recommend';
import { getMovieRecommendations, getTrending } from '../lib/tmdb';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import MovieCard from '../components/MovieCard';
import Status from '../components/Status';

async function loadRecommendations(user) {
  const favorites = user ? await listFavorites(user.uid) : [];
  const recs = await getRecommendations(favorites, getMovieRecommendations);
  if (recs.length) return { recs, fallback: false };
  // Fall back to trending when there are no favorites or no recommendations
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
          {user ? 'Add a few movies to your favorites' : <><Link to="/login">Sign in</Link> and add a few movies to your favorites</>} to get personalized picks. Meanwhile, here's what's trending:
        </p>
      )}
      {state.data && (
        <div className="grid">
          {state.data.recs.map(({ movie, because }) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              note={because.length ? `Because you liked ${because.join(', ')}` : null}
            />
          ))}
        </div>
      )}
    </>
  );
}
