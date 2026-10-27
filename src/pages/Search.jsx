import { useSearchParams } from 'react-router-dom';
import { findMovies, getGenres } from '../lib/tmdb';
import { useAsync } from '../lib/useAsync';
import MovieGrid from '../components/MovieGrid';
import Status from '../components/Status';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const genre = params.get('genre') ?? '';
  const year = params.get('year') ?? '';

  const genres = useAsync(getGenres, []);
  const results = useAsync(() => findMovies({ q, genre, year }), [q, genre, year]);

  function onSubmit(e) {
    e.preventDefault();
    const next = {};
    for (const [key, value] of new FormData(e.currentTarget)) {
      if (value) next[key] = value.trim();
    }
    setParams(next);
  }

  return (
    <>
      <form className="search-form" onSubmit={onSubmit} key={params.toString()}>
        <input name="q" defaultValue={q} placeholder="Movie title" />
        <select name="genre" defaultValue={genre}>
          <option value="">All genres</option>
          {genres.data?.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <input name="year" defaultValue={year} placeholder="Release year" type="number" min="1900" max="2100" />
        <button type="submit">Search</button>
      </form>
      <Status state={results} />
      {results.data && <MovieGrid movies={results.data} />}
    </>
  );
}
