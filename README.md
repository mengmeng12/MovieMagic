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
Watched or reviewed movies are excluded, even if also saved. Favorites and watchlist movies remain eligible, with a card reminder for either or both lists. Strong candidates rank by their weighted match score, then TMDb rating and vote count. Candidates with scores of 1 or less rank by rating, then vote count, within that weaker tier. With no positive matches, the page falls back to trending movies using the same exclusions and list reminders. If filtering leaves no trending picks, the page shows an empty-state message.

Favorites (base weight 3) and watchlist saves (base weight 1) decay independently from their own `addedAt` timestamps: `max(0.25, 2 ** (-ageDays / 90))`. Their influence halves after 90 days and retains a minimum of 25% after 180 days. Missing timestamps keep the original weight; future timestamps cannot boost it. Ratings do not decay, low ratings still override saves, and multiple positive signals on one movie use the strongest weight rather than adding together. Decayed weights affect both seed selection and candidate ranking.

Recommendation cards explain up to two strongest positive movie sources, naming the actual action and movie (or “a movie” for older reviews without titles). Saves within the past 30 days are described as recent. Trending fallback cards are labeled “Trending this week”.

### Exploration and surprise feedback

Personalized lists reserve up to 10% of their slots for discoveries (at most 2 in the default 20, at positions 10 and 20). Lists with fewer than 10 personalized candidates do not add exploration. The discovery pool combines weekly trending movies absent from the fetched seed recommendations with weak matches from exactly one positive seed, with score at most 1. This is an operational approximation of unfamiliarity, not a claim that the movies are semantically unrelated.

Discoveries must have at least 100 TMDb votes and a positive rating. They rank by rating first, then vote count; vote count measures ratings, not actual viewers. Saved, watched, reviewed, and negatively matched movies cannot enter discovery slots. Existing saved movies remain eligible for normal personalized recommendations. Results are deduplicated, and discoveries are labeled “Discover something different”. If trending fails, personalized recommendations remain available.

Opening a discovery card passes its movie ID and user ID to the detail page. Adding that movie to Want to Watch records `surprise: true` on the saved record. Opening the detail page alone, saving a normal recommendation, or adding a favorite does not award surprise. The bonus is `0.1 * watchlistDecay`, added once to the movie's strongest positive seed weight, so a fresh discovery saved to Want to Watch has weight 1.1 instead of 1. The bonus remains smaller than the corresponding watchlist signal and follows its 90-day half-life and 25% floor. Low ratings still override the bonus. Removing the watchlist entry removes its surprise signal; repeated saves do not accumulate bonuses.

At most one of the six positive seed slots is reserved for the most recently saved discovery if it would otherwise miss the cutoff. This lets a new interest influence related recommendations while retaining five other positive seeds and the two negative slots. Surprise feedback currently requires the discovery-card navigation context; independently finding the movie through search or opening a copied URL does not carry that context.

This product uses the TMDB API but is not endorsed or certified by TMDB.
