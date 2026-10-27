# Movie Magic

Browse, search, save and review movies using the TMDb API, and get recommendations based on your favorites.

Tech stack: React + Vite + React Router, Firebase Auth + Firestore, deployed on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:5173
npm test                     # recommendation unit tests
```

### 1. TMDb (required)
Sign up at https://www.themoviedb.org → Settings → API → copy the **API Read Access Token** into `VITE_TMDB_TOKEN`.
With only this set, the home, search and detail pages work.

### 2. Firebase (for sign-in, favorites, reviews and recommendations)
1. Create a project at https://console.firebase.google.com
2. Authentication → Sign-in method: enable **Email/Password** and **Google**
3. Firestore Database → Create database → paste `firestore.rules` into the Rules tab and publish
4. Project settings → Add a web app → copy `apiKey`, `authDomain`, `projectId` and `appId` into `.env.local`

## Deploy to Vercel
1. Push to GitHub and import the repo in Vercel (it detects Vite automatically)
2. Add the variables from `.env.local` under the project's Environment Variables
3. In Firebase → Authentication → Settings → Authorized domains, add your Vercel domain

`vercel.json` rewrites all routes to the SPA, so refreshing a page like `/movie/123` doesn't 404.

## Project structure

```
src/
  lib/tmdb.js          TMDb API client
  lib/firebase.js      Firebase setup (related features are disabled when not configured)
  lib/favorites.js     Favorites: users/{uid}/favorites/{movieId}
  lib/reviews.js       Reviews: reviews/{movieId}_{uid}
  lib/recommend.js     Recommendation algorithm (with unit tests)
  pages/               Home / Search / MovieDetail / Login / Favorites / ForYou
  components/          MovieCard, FavoriteButton, Reviews, ...
```

## Recommendation algorithm
Take the 5 most recently saved favorites, fetch TMDb `/movie/{id}/recommendations` for each, and merge the results.
Movies recommended by more favorites rank higher (ties broken by rating), and movies already in favorites are excluded.
Each card shows "Because you liked X". With no favorites, the page falls back to trending movies.

This product uses the TMDB API but is not endorsed or certified by TMDB.
