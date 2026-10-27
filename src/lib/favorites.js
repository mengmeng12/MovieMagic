import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';

const favoritesCol = (uid) => collection(db, 'users', uid, 'favorites');

// Most recent first: [{ movieId, title, posterPath, addedAt }]
export async function listFavorites(uid) {
  const snap = await getDocs(query(favoritesCol(uid), orderBy('addedAt', 'desc')));
  return snap.docs.map((d) => d.data());
}

export async function isFavorite(uid, movieId) {
  const snap = await getDoc(doc(favoritesCol(uid), String(movieId)));
  return snap.exists();
}

export const addFavorite = (uid, movie) =>
  setDoc(doc(favoritesCol(uid), String(movie.id)), {
    movieId: movie.id,
    title: movie.title,
    posterPath: movie.poster_path ?? null,
    addedAt: serverTimestamp(),
  });

export const removeFavorite = (uid, movieId) => deleteDoc(doc(favoritesCol(uid), String(movieId)));
