import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { firebaseEnabled } from '../lib/firebase';
import { addFavorite, isFavorite, removeFavorite } from '../lib/favorites';
import { useAuth } from '../context/AuthContext';

export default function FavoriteButton({ movie }) {
  const { user } = useAuth();
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) isFavorite(user.uid, movie.id).then(setFavorite);
  }, [user, movie.id]);

  if (!firebaseEnabled) return null;
  if (!user) return <Link to="/login">Sign in to save</Link>;

  async function toggle() {
    setBusy(true);
    try {
      if (favorite) await removeFavorite(user.uid, movie.id);
      else await addFavorite(user.uid, movie);
      setFavorite(!favorite);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={toggle} disabled={busy}>
      {favorite ? '★ Saved' : '☆ Add to favorites'}
    </button>
  );
}
