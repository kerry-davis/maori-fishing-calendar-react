import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestore } from '../services/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
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

  // Load tackle box from Firestore
  const loadTackleBox = useCallback(async () => {
    if (!user) {
      setTacklebox([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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
    } catch (err) {
      console.error('Error loading tackle box:', err);
      setError('Failed to load tackle box');
      // Fallback to localStorage if Firestore fails
      try {
        const localData = localStorage.getItem('tacklebox');
        if (localData) {
          setTacklebox(JSON.parse(localData));
        }
      } catch (localErr) {
        console.error('Error loading local tackle box:', localErr);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load data when user changes
  useEffect(() => {
    loadTackleBox();
  }, [loadTackleBox]);

  // Update tackle box in Firestore
  const updateTackleBox = useCallback(async (
    value: TackleItem[] | ((prev: TackleItem[]) => TackleItem[])
  ) => {
    if (!user) return;

    const newValue = value instanceof Function ? value(tacklebox) : value;
    setTacklebox(newValue);
    setError(null);

    try {
      // Get current items from Firestore to compare
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

      // Add or update items
      for (const item of newValue) {
        const { id, ...itemWithoutId } = item; // Extract id separately
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
          // Add new (we'll use a generated ID and then map it back)
          const docRef = doc(collection(firestore, 'tackleItems'));
          batch.set(docRef, {
            ...itemData,
            createdAt: serverTimestamp()
          });
          // Note: We'll need to handle ID mapping after batch commit
        }
      }

      await batch.commit();

      // Reload to get updated IDs
      await loadTackleBox();
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
    if (!user) return;

    setTacklebox([]);
    setError(null);

    try {
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

  // Load gear types from Firestore
  const loadGearTypes = useCallback(async () => {
    if (!user) {
      setGearTypes([...DEFAULT_GEAR_TYPES]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const docRef = doc(firestore, 'userSettings', user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setGearTypes(data.gearTypes || [...DEFAULT_GEAR_TYPES]);
      } else {
        // Create default settings for new user
        await updateDoc(docRef, {
          gearTypes: [...DEFAULT_GEAR_TYPES],
          updatedAt: serverTimestamp()
        });
        setGearTypes([...DEFAULT_GEAR_TYPES]);
      }
    } catch (err) {
      console.error('Error loading gear types:', err);
      setError('Failed to load gear types');

      // Fallback to localStorage
      try {
        const localData = localStorage.getItem('gearTypes');
        if (localData) {
          setGearTypes(JSON.parse(localData));
        }
      } catch (localErr) {
        console.error('Error loading local gear types:', localErr);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load data when user changes
  useEffect(() => {
    loadGearTypes();
  }, [loadGearTypes]);

  // Update gear types in Firestore
  const updateGearTypes = useCallback(async (
    value: string[] | ((prev: string[]) => string[])
  ) => {
    if (!user) return;

    const newValue = value instanceof Function ? value(gearTypes) : value;
    setGearTypes(newValue);
    setError(null);

    try {
      const docRef = doc(firestore, 'userSettings', user.uid);
      await updateDoc(docRef, {
        gearTypes: newValue,
        updatedAt: serverTimestamp()
      });
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
    if (!user) return;

    const defaultTypes = [...DEFAULT_GEAR_TYPES];
    setGearTypes(defaultTypes);
    setError(null);

    try {
      const docRef = doc(firestore, 'userSettings', user.uid);
      await updateDoc(docRef, {
        gearTypes: defaultTypes,
        updatedAt: serverTimestamp()
      });
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