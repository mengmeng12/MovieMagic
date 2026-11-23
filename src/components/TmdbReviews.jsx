import { useEffect, useState } from 'react';
import { getMovieReviews } from '../lib/tmdb';
import ExpandableReviewText from './ExpandableReviewText';

const PAGE_SIZE = 5;

function getAuthor(review) {
  return review.author || review.author_details?.username || 'TMDb user';
}

export default function TmdbReviews({ movieId }) {
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setReviews([]);
    setPage(0);
    setTotalPages(0);
    setVisibleCount(PAGE_SIZE);
    setLoading(true);
    setError('');

    getMovieReviews(movieId, 1).then((data) => {
      if (cancelled) return;
      setReviews(data.results ?? []);
      setPage(data.page ?? 1);
      setTotalPages(data.total_pages ?? 1);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [movieId]);

  async function loadMore() {
    if (visibleCount < reviews.length) {
      setVisibleCount((count) => count + PAGE_SIZE);
      return;
    }
    if (page >= totalPages || loadingMore) return;

    setLoadingMore(true);
    setError('');
    try {
      const data = await getMovieReviews(movieId, page + 1);
      setReviews((current) => [...current, ...(data.results ?? [])]);
      setPage(data.page ?? page + 1);
      setTotalPages(data.total_pages ?? totalPages);
      setVisibleCount((count) => count + PAGE_SIZE);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingMore(false);
    }
  }

  const hasMore = visibleCount < reviews.length || page < totalPages;

  return (
    <div>
      {loading && <p className="muted">Loading reviews…</p>}
      {!loading && error && <p className="error">{error}</p>}
      {!loading && !error && reviews.length === 0 && (
        <p className="muted">No reviews yet.</p>
      )}
      {reviews.slice(0, visibleCount).map((review, index) => (
        <article className="tmdb-review" key={review.id || `${getAuthor(review)}-${index}`}>
          <div className="tmdb-review-meta">
            <strong>{getAuthor(review)}</strong>
            {review.author_details?.rating != null && (
              <span className="muted">★ {review.author_details.rating}/10</span>
            )}
            {review.created_at && (
              <time className="muted small" dateTime={review.created_at}>
                {new Date(review.created_at).toLocaleDateString()}
              </time>
            )}
          </div>
          <ExpandableReviewText text={review.content ?? ''} />
        </article>
      ))}
      {hasMore && !loading && (
        <button type="button" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more reviews'}
        </button>
      )}
    </div>
  );
}
