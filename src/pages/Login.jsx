import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup,
} from 'firebase/auth';
import { auth, firebaseEnabled } from '../lib/firebase';

export default function Login() {
  const navigate = useNavigate();
  const [signUp, setSignUp] = useState(false);
  const [error, setError] = useState('');

  if (!firebaseEnabled) return <p className="muted">Configure Firebase in .env.local first.</p>;

  async function run(action) {
    setError('');
    try {
      await action();
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = form.get('email');
    const password = form.get('password');
    run(() => (signUp
      ? createUserWithEmailAndPassword(auth, email, password)
      : signInWithEmailAndPassword(auth, email, password)));
  }

  return (
    <div className="login">
      <h1>{signUp ? 'Sign up' : 'Sign in'}</h1>
      <form onSubmit={onSubmit}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password (at least 6 characters)" minLength={6} required />
        <button type="submit">{signUp ? 'Sign up' : 'Sign in'}</button>
      </form>
      <button onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}>
        Continue with Google
      </button>
      <p>
        <button className="link" onClick={() => setSignUp(!signUp)}>
          {signUp ? 'Already have an account? Sign in' : 'No account? Sign up'}
        </button>
      </p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
