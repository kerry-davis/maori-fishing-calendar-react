import { firestore } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DEV_LOG, DEV_WARN } from '@shared/utils/loggingHelpers';

export type ThemePreference = 'light' | 'dark';

const USER_SETTINGS_COLLECTION = 'userSettings';
const THEME_FIELD = 'themePreference';

function resolveDocRef(userId: string) {
  if (!firestore) {
    DEV_WARN('[ThemePreference] Firestore not configured; skipping');
    return null;
  }

  return doc(firestore, USER_SETTINGS_COLLECTION, userId);
}

export async function getThemePreference(userId: string): Promise<ThemePreference | null> {
  if (!userId) {
    return null;
  }

  const docRef = resolveDocRef(userId);
  if (!docRef) {
    return null;
  }

  try {
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as { [THEME_FIELD]?: ThemePreference };
    const value = data?.[THEME_FIELD];
    return value === 'dark' || value === 'light' ? value : null;
  } catch (error) {
    DEV_WARN('[ThemePreference] Failed to read preference:', error);
    return null;
  }
}

export async function setThemePreference(userId: string, preference: ThemePreference): Promise<void> {
  if (!userId) {
    return;
  }

  const docRef = resolveDocRef(userId);
  if (!docRef) {
    return;
  }

  try {
    await setDoc(docRef, {
      userId,
      [THEME_FIELD]: preference,
      updatedAt: serverTimestamp(),
      themePreferenceUpdatedAt: serverTimestamp()
    }, { merge: true });

    DEV_LOG('[ThemePreference] Persisted preference for user:', userId, preference);
  } catch (error) {
    DEV_WARN('[ThemePreference] Failed to persist preference:', error);
  }
}
