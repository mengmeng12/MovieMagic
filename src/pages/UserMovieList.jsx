import { Link } from 'react-router-dom';
import { listUserMovies } from '../lib/favorites';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import MovieGrid from '../components/MovieGrid';
import Status from '../components/Status';

export default function UserMovieList({ list, title, listDescription }) {
  const { user } = useAuth();
  const state = useAsync(
    () => (user ? listUserMovies(user.uid, list) : Promise.resolve([])),
    [user, list],
  );

  if (!user) {
    return <p><Link to="/login">Sign in</Link> to see {listDescription}.</p>;
  }

  const movies = state.data?.map((item) => ({
    id: item.movieId,
    title: item.title,
    poster_path: item.posterPath,
  }));

  return (
    <>
      <h1>{title}</h1>
      <Status state={state} />
      {movies && <MovieGrid movies={movies} />}
    </>
  );
}
