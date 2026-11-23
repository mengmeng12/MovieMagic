import { NavLink } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, firebaseEnabled } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();
  return (
    <nav className="navbar">
      <NavLink to="/" className="brand">Movie Magic</NavLink>
      <NavLink to="/search">Search</NavLink>
      {firebaseEnabled && <NavLink to="/for-you">For You</NavLink>}
      {firebaseEnabled && <NavLink to="/favorites">Favorites</NavLink>}
      {firebaseEnabled && <NavLink to="/watched">Watched</NavLink>}
      {firebaseEnabled && <NavLink to="/watchlist">Want to Watch</NavLink>}
      <span className="spacer" />
      {firebaseEnabled && (user ? (
        <>
          <span className="muted small">{user.displayName || user.email}</span>
          <button onClick={() => signOut(auth)}>Sign out</button>
        </>
      ) : (
        <NavLink to="/login">Sign in</NavLink>
      ))}
    </nav>
  );
}
