# Movie Magic

Browse and search movies using the TMDb API, save favorites, mark movies as watched or wanted, write reviews, and get recommendations based on your favorites.

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

### 2. Firebase (for sign-in, favorites, watched and watchlist status, reviews and recommendations)
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
  lib/tmdb.js          TMDb API client, including movie reviews
  lib/firebase.js      Firebase setup (related features are disabled when not configured)
  lib/favorites.js     User movie lists: users/{uid}/{favorites|watched|watchlist}/{movieId}
  lib/reviews.js       Reviews: reviews/{movieId}_{uid}
  lib/recommend.js     Recommendation algorithm (with unit tests)
  pages/               Home / Search / MovieDetail / Login / Favorites / Watched / Watchlist / ForYou
  components/          MovieCard, MovieActions, Reviews, ...
```

## Recommendation algorithm
Build a preference profile from favorites, watchlist entries, and review ratings, then fetch TMDb `/movie/{id}/recommendations` for up to 8 signals (up to 6 positive and 2 negative).
Favorites are strong positive signals, watchlist entries are weaker positive signals, ratings of 6–10 are positive, ratings of 1–4 are negative, and a rating of 5 is neutral. Watched movies are excluded from candidates but are not treated as liked unless they also have a positive rating or favorite status.
Watched or reviewed movies are excluded, even if also saved. Favorites and watchlist movies remain eligible, with a card reminder for either or both lists. Candidates rank by their weighted match score, then TMDb rating and vote count. With no positive matches, the page falls back to trending movies using the same exclusions and list reminders. If filtering leaves no trending picks, the page shows an empty-state message.

Favorites (base weight 3) and watchlist saves (base weight 1) decay independently from their own `addedAt` timestamps: `max(0.25, 2 ** (-ageDays / 90))`. Their influence halves after 90 days and retains a minimum of 25% after 180 days. Missing timestamps keep the original weight; future timestamps cannot boost it. Ratings do not decay, low ratings still override saves, and multiple positive signals on one movie use the strongest weight rather than adding together. Decayed weights affect both seed selection and candidate ranking.

Recommendation cards explain up to two strongest positive movie sources, naming the actual action and movie (or “a movie” for older reviews without titles). Saves within the past 30 days are described as recent. Trending fallback cards are labeled “Trending this week”.

This product uses the TMDB API but is not endorsed or certified by TMDB.
