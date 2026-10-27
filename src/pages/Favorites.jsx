import { Link } from 'react-router-dom';
import { listFavorites } from '../lib/favorites';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import MovieGrid from '../components/MovieGrid';
import Status from '../components/Status';

export default function Favorites() {
  const { user } = useAuth();
  const state = useAsync(() => (user ? listFavorites(user.uid) : Promise.resolve([])), [user]);

  if (!user) return <p><Link to="/login">Sign in</Link> to see your favorites.</p>;

  // Favorites store only the fields a card needs; map them to the shape MovieCard expects
  const movies = state.data?.map((f) => ({ id: f.movieId, title: f.title, poster_path: f.posterPath }));
  return (
    <>
      <h1>My Favorites</h1>
      <Status state={state} />
      {movies && <MovieGrid movies={movies} />}
    </>
  );
}
