import { Route, Routes } from 'react-router-dom';
import { hasTmdbToken } from './lib/tmdb';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Search from './pages/Search';
import MovieDetail from './pages/MovieDetail';
import Login from './pages/Login';
import Favorites from './pages/Favorites';
import ForYou from './pages/ForYou';

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        {!hasTmdbToken && (
          <p className="error">TMDb token missing: copy .env.example to .env.local, set VITE_TMDB_TOKEN, then restart the dev server.</p>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/for-you" element={<ForYou />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
      <footer className="muted small">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </>
  );
}
