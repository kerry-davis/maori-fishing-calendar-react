import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to track Firebase sync status and queue information
 */
export function useSyncStatus() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueueLength, setSyncQueueLength] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isFirebaseReachable, setIsFirebaseReachable] = useState<boolean | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check sync queue status
  const updateSyncStatus = useCallback(() => {
    if (!user) {
      setSyncQueueLength(0);
      return;
    }

    try {
      const queueKey = `syncQueue_${user.uid}`;
      const queueData = localStorage.getItem(queueKey);

      if (queueData) {
        const queue = JSON.parse(queueData);
        setSyncQueueLength(Array.isArray(queue) ? queue.length : 0);
      } else {
        setSyncQueueLength(0);
      }

      // Check last sync time
      const lastSyncKey = `lastSync_${user.uid}`;
      const lastSyncData = localStorage.getItem(lastSyncKey);
      if (lastSyncData) {
        setLastSyncTime(new Date(lastSyncData));
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
      setSyncQueueLength(0);
    }
  }, [user]);

  // Test Firebase connectivity
  const testFirebaseConnectivity = useCallback(async () => {
    if (!isOnline) {
      setIsFirebaseReachable(false);
      return;
    }

    try {
      // Simple connectivity test - try to access a Firestore collection
      const { collection, getDocs, query } = await import('firebase/firestore');
      const { firestore } = await import('../services/firebase');

      // Test with a simple query that should work even with restrictive rules
      const testQuery = query(collection(firestore, '_test'));
      await getDocs(testQuery);

      setIsFirebaseReachable(true);
    } catch (error: any) {
      // If we get a permission error, Firebase is reachable but rules are restrictive
      // If we get a network error, Firebase is not reachable
      const isNetworkError = error?.message?.includes('network') ||
                           error?.message?.includes('unreachable') ||
                           error?.code === 'unavailable';

      setIsFirebaseReachable(!isNetworkError);
    }
  }, [isOnline]);

  // Update sync status when user changes or online status changes
  useEffect(() => {
    updateSyncStatus();
    testFirebaseConnectivity();
  }, [user, isOnline, updateSyncStatus, testFirebaseConnectivity]);

  // Listen for storage changes (sync queue updates)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (user && e.key?.startsWith(`syncQueue_${user.uid}`)) {
        updateSyncStatus();
      }
    };

    // Listen for custom sync queue clear events
    const handleSyncQueueClear = () => {
      updateSyncStatus();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('syncQueueCleared', handleSyncQueueClear);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('syncQueueCleared', handleSyncQueueClear);
    };
  }, [user, updateSyncStatus]);

  // Mark sync as completed
  const markSyncComplete = useCallback(() => {
    if (user) {
      const now = new Date().toISOString();
      localStorage.setItem(`lastSync_${user.uid}`, now);
      setLastSyncTime(new Date(now));
      setSyncQueueLength(0);
    }
  }, [user]);

  // Expose refresh function to window for debugging
  useEffect(() => {
    (window as any).refreshSyncStatus = updateSyncStatus;
  }, [updateSyncStatus]);

  return {
    isOnline,
    syncQueueLength,
    lastSyncTime,
    isFirebaseReachable,
    markSyncComplete,
    refreshStatus: updateSyncStatus
  };
}