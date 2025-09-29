import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestore } from '../services/firebase.ts';
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

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: parseInt(doc.id), // Convert Firebase ID to number for compatibility
            ...data
          } as TackleItem);
        });

        setTacklebox(items);
      } else {
        // Guest user - load from localStorage
        const localData = localStorage.getItem('tacklebox');
        if (localData) {
          const items = JSON.parse(localData);
          setTacklebox(items);
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
          setTacklebox(items);
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
    const newValue = value instanceof Function ? value(tacklebox) : value;
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
        const existingItems = new Map();

        querySnapshot.forEach((doc) => {
          existingItems.set(parseInt(doc.id), doc.ref);
        });

        const batch = writeBatch(firestore);

        // Delete items that are no longer in the new value
        existingItems.forEach((ref, id) => {
          if (!newValue.find(item => item.id === id)) {
            batch.delete(ref);
          }
        });

        // Track new items to map their IDs after commit
        const newItemMappings = new Map<number, string>();

        // Add or update items
        for (const item of newValue) {
          const { id, ...itemWithoutId } = item;
          const itemData = {
            ...itemWithoutId,
            userId: user.uid,
            updatedAt: serverTimestamp()
          };

          if (existingItems.has(item.id)) {
            // Update existing
            const ref = existingItems.get(item.id);
            batch.update(ref, itemData);
          } else {
            // Add new item with generated Firebase ID
            const docRef = doc(collection(firestore, 'tackleItems'));
            const numericId = item.id;
            newItemMappings.set(numericId, docRef.id);
            batch.set(docRef, {
              ...itemData,
              createdAt: serverTimestamp()
            });
          }
        }

        await batch.commit();

        // Update local state with correct Firebase IDs for new items
        if (newItemMappings.size > 0) {
          const updatedItems = newValue.map(item => {
            const firebaseId = newItemMappings.get(item.id);
            if (firebaseId) {
              return { ...item };
            }
            return item;
          });
          setTacklebox(updatedItems);
        } else {
          await loadTackleBox();
        }
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