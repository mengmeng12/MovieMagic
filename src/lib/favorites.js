import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const userMoviesCol = (uid, list) => collection(db, 'users', uid, list);

export async function listUserMovies(uid, list) {
  const snap = await getDocs(query(userMoviesCol(uid, list), orderBy('addedAt', 'desc')));
  return snap.docs.map((d) => d.data());
}

export async function isMovieInList(uid, list, movieId) {
  const snap = await getDoc(doc(userMoviesCol(uid, list), String(movieId)));
  return snap.exists();
}

export const addMovieToList = (uid, list, movie) =>
  setDoc(doc(userMoviesCol(uid, list), String(movie.id)), {
    movieId: movie.id,
    title: movie.title,
    posterPath: movie.poster_path ?? null,
    addedAt: serverTimestamp(),
  });

export const removeMovieFromList = (uid, list, movieId) =>
  deleteDoc(doc(userMoviesCol(uid, list), String(movieId)));

// Most recent first: [{ movieId, title, posterPath, addedAt }]
export const listFavorites = (uid) => listUserMovies(uid, 'favorites');
export const isFavorite = (uid, movieId) => isMovieInList(uid, 'favorites', movieId);
export const addFavorite = (uid, movie) => addMovieToList(uid, 'favorites', movie);
export const removeFavorite = (uid, movieId) => removeMovieFromList(uid, 'favorites', movieId);
