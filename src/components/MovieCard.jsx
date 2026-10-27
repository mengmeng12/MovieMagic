import { Link } from 'react-router-dom';
import { posterUrl } from '../lib/tmdb';

export default function MovieCard({ movie, note }) {
  const poster = posterUrl(movie.poster_path);
  const year = movie.release_date?.slice(0, 4);
  return (
    <Link to={`/movie/${movie.id}`} className="card">
      {poster ? <img src={poster} alt={movie.title} loading="lazy" /> : <div className="no-poster">No poster</div>}
      <div className="card-title">{movie.title}</div>
      <div className="muted small">
        {year}
        {movie.vote_average ? ` · ★ ${movie.vote_average.toFixed(1)}` : ''}
      </div>
      {note && <div className="note small">{note}</div>}
    </Link>
  );
}
