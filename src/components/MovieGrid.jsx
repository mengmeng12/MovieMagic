import MovieCard from './MovieCard';

export default function MovieGrid({ movies, row = false }) {
  if (!movies.length) return <p className="muted">No results.</p>;
  return (
    <div className={row ? 'row' : 'grid'}>
      {movies.map((m) => (
        <MovieCard key={m.id} movie={m} />
      ))}
    </div>
  );
}
