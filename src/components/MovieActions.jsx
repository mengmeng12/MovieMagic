import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { firebaseEnabled } from '../lib/firebase';
import { addMovieToList, isMovieInList, removeMovieFromList } from '../lib/favorites';
import { useAuth } from '../context/AuthContext';

const ACTIONS = [
  { list: 'favorites', active: '★ Saved', inactive: '☆ Add to favorites' },
  { list: 'watched', active: '✓ Watched', inactive: 'Mark as watched' },
  { list: 'watchlist', active: '✓ In watchlist', inactive: 'Want to watch' },
];

const emptyLists = { favorites: false, watched: false, watchlist: false };

export default function MovieActions({ movie, recommendation }) {
  const { user } = useAuth();
  const [lists, setLists] = useState(emptyLists);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!firebaseEnabled || !user) {
      setLists(emptyLists);
      setLoading(false);
      setError('');
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError('');
    Promise.all(ACTIONS.map(({ list }) => isMovieInList(user.uid, list, movie.id))).then(
      (values) => {
        if (!cancelled) {
          setLists(Object.fromEntries(ACTIONS.map(({ list }, i) => [list, values[i]])));
        }
      },
      (loadError) => {
        if (!cancelled) setError(loadError.message);
      },
    ).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user, movie.id]);

  if (!firebaseEnabled) return null;
  if (!user) return <Link to="/login">Sign in to save movies</Link>;

  async function toggle(list) {
    setBusy(true);
    setError('');
    try {
      if (lists[list]) await removeMovieFromList(user.uid, list, movie.id);
      else await addMovieToList(user.uid, list, movie, recommendation);
      setLists((current) => ({ ...current, [list]: !current[list] }));
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="movie-actions">
        {ACTIONS.map(({ list, active, inactive }) => (
          <button
            key={list}
            type="button"
            aria-pressed={lists[list]}
            onClick={() => toggle(list)}
            disabled={loading || busy}
          >
            {lists[list] ? active : inactive}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
