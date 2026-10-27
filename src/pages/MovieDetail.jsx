import { useParams } from 'react-router-dom';
import { getMovie, posterUrl } from '../lib/tmdb';
import { useAsync } from '../lib/useAsync';
import FavoriteButton from '../components/FavoriteButton';
import Reviews from '../components/Reviews';
import Status from '../components/Status';

export default function MovieDetail() {
  const { id } = useParams();
  const state = useAsync(() => getMovie(id), [id]);
  if (!state.data) return <Status state={state} />;

  const movie = state.data;
  const trailer = movie.videos.results.find((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const cast = movie.credits.cast.slice(0, 10);
  const director = movie.credits.crew.find((c) => c.job === 'Director');

  return (
    <>
      <div className="detail">
        {movie.poster_path && <img src={posterUrl(movie.poster_path, 'w500')} alt={movie.title} />}
        <div>
          <h1>{movie.title}</h1>
          <p className="muted">
            {movie.release_date?.slice(0, 4)}
            {movie.runtime ? ` · ${movie.runtime} min` : ''}
            {` · ★ ${movie.vote_average.toFixed(1)}`}
          </p>
          <p className="muted">{movie.genres.map((g) => g.name).join(' / ')}</p>
          {director && <p>Director: {director.name}</p>}
          <p>{movie.overview || 'No overview available.'}</p>
          <FavoriteButton movie={movie} />
        </div>
      </div>

      {trailer && (
        <section>
          <h2>Trailer</h2>
          <iframe
            className="trailer"
            src={`https://www.youtube.com/embed/${trailer.key}`}
            title={trailer.name}
            allowFullScreen
          />
        </section>
      )}

      {cast.length > 0 && (
        <section>
          <h2>Cast</h2>
          <p>{cast.map((c) => `${c.name} (${c.character})`).join(', ')}</p>
        </section>
      )}

      <Reviews movieId={movie.id} />
    </>
  );
}
