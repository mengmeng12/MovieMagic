import {
  collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from './firebase';

const reviewId = (movieId, uid) => `${movieId}_${uid}`;

// Sort locally to avoid needing a Firestore composite index
export async function listReviews(movieId) {
  const snap = await getDocs(query(collection(db, 'reviews'), where('movieId', '==', movieId)));
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export const saveReview = (user, movieId, { rating, text }) =>
  setDoc(doc(db, 'reviews', reviewId(movieId, user.uid)), {
    movieId,
    uid: user.uid,
    displayName: user.displayName || user.email,
    rating,
    text,
    createdAt: serverTimestamp(),
  });

export const deleteReview = (uid, movieId) => deleteDoc(doc(db, 'reviews', reviewId(movieId, uid)));
