import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@app/providers/AuthContext';
import { firestore } from '@shared/services/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import type { TackleItem } from '../types';
import { DEFAULT_GEAR_TYPES } from '../types';

// Generate a stable numeric ID from a string (e.g., Firestore doc.id) to satisfy TackleItem.id:number
function stableNumericId(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Ensure positive 32-bit integer
  return (hash >>> 0);
}

/**
 * Firebase-based hook for tackle box management
 * Replaces localStorage with Firestore for cloud sync
 */
export function useFirebaseTackleBox(): [
  TackleItem[],
  (tacklebox: TackleItem[] | ((prev: TackleItem[]) => TackleItem[])) => void,
  () => void,
  string | null,
  boolean // loading state
] {
  const { user } = useAuth();
  const [tacklebox, setTacklebox] = useState<TackleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const dedupeByComposite = useCallback((items: TackleItem[]): TackleItem[] => {
    const seen = new Set<string>();
    const norm = (v?: string) => (v || '').trim().toLowerCase();
    const out: TackleItem[] = [];
    for (const it of items) {
      const key = [norm(it.name), norm(it.brand), norm(it.type), norm(it.colour)].join('|');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(it);
      }
    }
    return out;
  }, []);

  // Load tackle box from Firestore or localStorage
  const loadTackleBox = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (user) {
        // Authenticated user - load from Firestore
        const q = query(
          collection(firestore, 'tackleItems'),
          where('userId', '==', user.uid),
          orderBy('name', 'asc')
        );

        const querySnapshot = await getDocs(q);
        const items: TackleItem[] = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Always derive a stable numeric id from doc id to avoid parseInt collisions
          const idNum = stableNumericId(docSnap.id);
          items.push({ id: idNum, gearId: docSnap.id, ...(data as any) } as TackleItem);
        });

        setTacklebox(dedupeByComposite(items));
      } else {
        // Guest user - load from localStorage
        const localData = localStorage.getItem('tacklebox');
        if (localData) {
          const items = JSON.parse(localData);
          setTacklebox(dedupeByComposite(items));
        } else {
          setTacklebox([]);
        }
      }
    } catch (err) {
      console.error('Error loading tackle box:', err);
      setError('Failed to load tackle box');

      // Fallback to localStorage
      try {
        const localData = localStorage.getItem('tacklebox');
        if (localData) {
          const items = JSON.parse(localData);
          setTacklebox(dedupeByComposite(items));
        } else {
          setTacklebox([]);
        }
      } catch (localErr) {
        console.error('Error loading local tackle box:', localErr);
        setTacklebox([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load data when user changes
  useEffect(() => {
    loadTackleBox();
  }, [loadTackleBox]);

  // Update tackle box in Firestore or localStorage
  const updateTackleBox = useCallback(async (
    value: TackleItem[] | ((prev: TackleItem[]) => TackleItem[])
  ) => {
    const newValue = dedupeByComposite(value instanceof Function ? value(tacklebox) : value);
    setTacklebox(newValue);
    setError(null);

    try {
      if (user) {
        // Authenticated user - save to Firestore
        const q = query(
          collection(firestore, 'tackleItems'),
          where('userId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        // Build maps keyed by composite key
        const existingByKey = new Map<string, { ref: any; data: any }>();
        const duplicatesByKey = new Map<string, any[]>();
        const norm = (v?: string) => (v || '').trim().toLowerCase();
        const mkKey = (d: any) => [norm(d.name), norm(d.brand), norm(d.type), norm(d.colour)].join('|');

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const key = mkKey(data);
          if (existingByKey.has(key)) {
            // Track duplicates to be deleted later
            const arr = duplicatesByKey.get(key) || [];
            arr.push(docSnap.ref);
            duplicatesByKey.set(key, arr);
          } else {
            existingByKey.set(key, { ref: docSnap.ref, data });
          }
        });

        const batch = writeBatch(firestore);
        const newKeys = new Set<string>();

        // Upsert new/updated items by composite key
        for (const item of newValue) {
          const payload: any = { ...item };
          delete payload.id; // don't persist local numeric id
          const itemData = {
            ...payload,
            userId: user.uid,
            updatedAt: serverTimestamp()
          };
          const key = mkKey(itemData);
          newKeys.add(key);

          const existing = existingByKey.get(key);
          if (existing) {
            batch.update(existing.ref, { ...itemData, gearId: existing.ref.id });
            // Remove tracked duplicate refs for this key (will be deleted below)
          } else {
            const docRef = doc(collection(firestore, 'tackleItems'));
            batch.set(docRef, { ...itemData, gearId: docRef.id, createdAt: serverTimestamp() });
          }
        }

        // Delete items not present anymore
        existingByKey.forEach((val, key) => {
          if (!newKeys.has(key)) {
            batch.delete(val.ref);
          }
        });

        // Delete duplicate docs for same key
        duplicatesByKey.forEach((refs) => {
          refs.forEach(ref => batch.delete(ref));
        });

        await batch.commit();
        await loadTackleBox();
      } else {
        // Guest user - save to localStorage
        localStorage.setItem('tacklebox', JSON.stringify(newValue));
      }
    } catch (err) {
      console.error('Error updating tackle box:', err);
      setError('Failed to save tackle box changes');

      // Fallback to localStorage
      try {
        localStorage.setItem('tacklebox', JSON.stringify(newValue));
      } catch (localErr) {
        console.error('Error saving to localStorage:', localErr);
      }
    }
  }, [user, tacklebox, loadTackleBox]);

  // Clear tackle box
  const clearTackleBox = useCallback(async () => {
    setTacklebox([]);
    setError(null);

    try {
      if (user) {
        // Authenticated user - clear from Firestore
        const q = query(
          collection(firestore, 'tackleItems'),
          where('userId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);

        const batch = writeBatch(firestore);
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      } else {
        // Guest user - clear from localStorage
        localStorage.removeItem('tacklebox');
      }
    } catch (err) {
      console.error('Error clearing tackle box:', err);
      setError('Failed to clear tackle box');

      // Fallback to localStorage
      try {
        localStorage.removeItem('tacklebox');
      } catch (localErr) {
        console.error('Error clearing localStorage:', localErr);
      }
    }
  }, [user]);

  return [tacklebox, updateTackleBox, clearTackleBox, error, loading];
}

/**
 * Firebase-based hook for gear types management
 */
export function useFirebaseGearTypes(): [
  string[],
  (gearTypes: string[] | ((prev: string[]) => string[])) => void,
  () => void,
  string | null,
  boolean // loading state
] {
  const { user } = useAuth();
  const [gearTypes, setGearTypes] = useState<string[]>([...DEFAULT_GEAR_TYPES]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load gear types from Firestore or localStorage
  const loadGearTypes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (user) {
        // Authenticated user - load from Firestore
        const docRef = doc(firestore, 'userSettings', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const types = data.gearTypes || [...DEFAULT_GEAR_TYPES];
          setGearTypes(types);
        } else {
          // Create default settings for new user (merge ensures idempotency)
          await setDoc(docRef, {
            userId: user.uid,
            gearTypes: [...DEFAULT_GEAR_TYPES],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          setGearTypes([...DEFAULT_GEAR_TYPES]);
        }
      } else {
        // Guest user - load from localStorage
        const localData = localStorage.getItem('gearTypes');
        if (localData) {
          const types = JSON.parse(localData);
          setGearTypes(types);
        } else {
          setGearTypes([...DEFAULT_GEAR_TYPES]);
        }
      }
    } catch (err) {
      console.error('Error loading gear types:', err);
      setError('Failed to load gear types');

      // Fallback to localStorage
      try {
        const localData = localStorage.getItem('gearTypes');
        if (localData) {
          const types = JSON.parse(localData);
          setGearTypes(types);
        } else {
          setGearTypes([...DEFAULT_GEAR_TYPES]);
        }
      } catch (localErr) {
        console.error('Error loading local gear types:', localErr);
        setGearTypes([...DEFAULT_GEAR_TYPES]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load data when user changes
  useEffect(() => {
    loadGearTypes();
  }, [loadGearTypes]);

  // Update gear types in Firestore or localStorage
  const updateGearTypes = useCallback(async (
    value: string[] | ((prev: string[]) => string[])
  ) => {
    const newValue = value instanceof Function ? value(gearTypes) : value;
    setGearTypes(newValue);
    setError(null);

    try {
      if (user) {
        // Authenticated user - save to Firestore
        const docRef = doc(firestore, 'userSettings', user.uid);
        await setDoc(docRef, {
          userId: user.uid,
          gearTypes: newValue,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Guest user - save to localStorage
        localStorage.setItem('gearTypes', JSON.stringify(newValue));
      }
    } catch (err) {
      console.error('Error updating gear types:', err);
      setError('Failed to save gear types');

      // Fallback to localStorage
      try {
        localStorage.setItem('gearTypes', JSON.stringify(newValue));
      } catch (localErr) {
        console.error('Error saving to localStorage:', localErr);
      }
    }
  }, [user, gearTypes]);

  // Reset gear types to defaults
  const resetGearTypes = useCallback(async () => {
    const defaultTypes = [...DEFAULT_GEAR_TYPES];
    setGearTypes(defaultTypes);
    setError(null);

    try {
      if (user) {
        // Authenticated user - save to Firestore
        const docRef = doc(firestore, 'userSettings', user.uid);
        await setDoc(docRef, {
          userId: user.uid,
          gearTypes: defaultTypes,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Guest user - save to localStorage
        localStorage.setItem('gearTypes', JSON.stringify(defaultTypes));
      }
    } catch (err) {
      console.error('Error resetting gear types:', err);
      setError('Failed to reset gear types');

      // Fallback to localStorage
      try {
        localStorage.setItem('gearTypes', JSON.stringify(defaultTypes));
      } catch (localErr) {
        console.error('Error saving to localStorage:', localErr);
      }
    }
  }, [user]);

  return [gearTypes, updateGearTypes, resetGearTypes, error, loading];
}