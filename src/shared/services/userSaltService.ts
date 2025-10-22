import { firestore } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { DEV_WARN } from '../utils/loggingHelpers';

/**
 * Ensures a stable per-user encryption salt exists and is shared across devices.
 * Strategy:
 * 1) Try to read from Firestore userSettings/<uid>.encSaltB64 (or encSalt fallback).
 * 2) If found, write to localStorage enc_salt_<uid> so encryptionService reuses it.
 * 3) If not found, but localStorage has one, upsert it to Firestore with userId.
 * 4) If neither exist, generate a new one, persist to both localStorage and Firestore.
 */
export async function ensureUserSalt(uid: string): Promise<void> {
  const saltKey = `enc_salt_${uid}`;
  const localSalt = localStorage.getItem(saltKey);

  try {
    const ref = doc(firestore, 'userSettings', uid);
    const snap = await getDoc(ref);
    const fromFs = snap.exists() ? (snap.data() as any) : null;
    const fsSalt: string | undefined = fromFs?.encSaltB64 || fromFs?.encSalt;

    if (fsSalt) {
      // Trust Firestore as source of truth; sync to local
      if (localSalt !== fsSalt) {
        localStorage.setItem(saltKey, fsSalt);
      }
      return;
    }

    // No Firestore salt yet
    if (localSalt) {
      // Promote local salt to Firestore
      await setDoc(ref, { userId: uid, encSaltB64: localSalt }, { merge: true });
      return;
    }

    // Generate brand new salt and persist both places
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const b64 = btoa(String.fromCharCode(...saltBytes));
    localStorage.setItem(saltKey, b64);
    await setDoc(ref, { userId: uid, encSaltB64: b64 }, { merge: true });
  } catch (e) {
    DEV_WARN('[Salt] Failed to sync user salt; falling back to local only:', e);
    if (!localStorage.getItem(saltKey)) {
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const b64 = btoa(String.fromCharCode(...saltBytes));
      localStorage.setItem(saltKey, b64);
    }
  }
}
