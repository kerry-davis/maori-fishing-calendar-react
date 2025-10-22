import { describe, it, expect } from 'vitest';
import { mapFirebaseError } from '../utils/firebaseErrorMessages';

describe('mapFirebaseError', () => {
  it('maps auth/email-already-in-use', () => {
    const err = { code: 'auth/email-already-in-use', message: 'Firebase: Error (auth/email-already-in-use).' };
    expect(mapFirebaseError(err, 'register')).toMatch(/already exists/i);
  });

  it('maps auth/wrong-password', () => {
    const err = { code: 'auth/wrong-password' };
    expect(mapFirebaseError(err, 'login')).toMatch(/incorrect password/i);
  });

  it('falls back for unknown code in login context', () => {
    const err = { code: 'auth/some-unknown-error' };
    expect(mapFirebaseError(err, 'login')).toMatch(/could not sign you in/i);
  });

  it('maps firestore/permission-denied', () => {
    const err = { code: 'firestore/permission-denied' };
    expect(mapFirebaseError(err, 'generic')).toMatch(/permission/i);
  });

  it('extracts code from message parentheses', () => {
    const err = new Error('Firebase: Error (auth/weak-password).');
    expect(mapFirebaseError(err, 'register')).toMatch(/too weak/i);
  });
});
