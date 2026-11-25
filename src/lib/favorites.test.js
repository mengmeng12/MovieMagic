import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setDoc } from 'firebase/firestore';
import { addMovieToList } from './favorites';

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'collection'), doc: vi.fn(() => 'document'),
  setDoc: vi.fn(), serverTimestamp: vi.fn(() => 'timestamp'),
  deleteDoc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), orderBy: vi.fn(), query: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

const movie = { id: 1, title: 'Discovery' };
const recommendation = { exploration: true, movieId: 1, userId: 'user' };

describe('saving exploration feedback', () => {
  it('persists surprise only when adding the matching discovery to Want to Watch', async () => {
    await addMovieToList('user', 'watchlist', movie, recommendation);
    expect(setDoc).toHaveBeenCalledWith('document', {
      movieId: 1, title: 'Discovery', posterPath: null, addedAt: 'timestamp', surprise: true,
    });
  });

  it.each([
    ['favorites', recommendation], ['watched', recommendation], ['watchlist', undefined],
    ['watchlist', { ...recommendation, movieId: 2 }],
    ['watchlist', { ...recommendation, userId: 'another-user' }],
    ['watchlist', { ...recommendation, exploration: false }],
  ])('does not award surprise for unrelated actions (%s, %j)', async (list, context) => {
    await addMovieToList('user', list, movie, context);
    expect(setDoc.mock.calls[0][1]).not.toHaveProperty('surprise');
  });
});
