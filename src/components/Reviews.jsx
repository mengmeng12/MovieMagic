import { useState } from 'react';
import { Link } from 'react-router-dom';
import { firebaseEnabled } from '../lib/firebase';
import { deleteReview, listReviews, saveReview } from '../lib/reviews';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../context/AuthContext';
import Status from './Status';

export default function Reviews({ movieId }) {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const reviews = useAsync(
    () => (firebaseEnabled ? listReviews(movieId) : Promise.resolve([])),
    [movieId, version],
  );

  if (!firebaseEnabled) return <p className="muted">Configure Firebase to enable reviews.</p>;

  const mine = reviews.data?.find((r) => r.uid === user?.uid);

  async function run(action) {
    setError('');
    try {
      await action();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    run(() => saveReview(user, movieId, {
      rating: Number(form.get('rating')),
      text: form.get('text').trim(),
    }));
  }

  return (
    <section>
      <h2>Reviews</h2>
      {user ? (
        <form className="review-form" onSubmit={onSubmit} key={mine ? 'edit' : 'new'}>
          <label>
            Rating
            <select name="rating" defaultValue={mine?.rating ?? 8}>
              {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <textarea name="text" required maxLength={1000} defaultValue={mine?.text ?? ''} placeholder="What did you think?" />
          <div>
            <button type="submit">{mine ? 'Update review' : 'Post review'}</button>
            {mine && <button type="button" onClick={() => run(() => deleteReview(user.uid, movieId))}>Delete</button>}
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <p><Link to="/login">Sign in</Link> to write a review.</p>
      )}
      <Status state={reviews} />
      {reviews.data?.length === 0 && <p className="muted">No reviews yet.</p>}
      {reviews.data?.map((r) => (
        <div key={r.uid} className="review">
          <strong>{r.displayName}</strong> <span className="muted">★ {r.rating}/10</span>
          <p>{r.text}</p>
        </div>
      ))}
    </section>
  );
}
