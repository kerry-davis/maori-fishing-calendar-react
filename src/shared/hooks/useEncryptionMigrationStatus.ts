import { useState, useEffect, useCallback, useRef } from 'react';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import { useAuth } from '@app/providers/AuthContext';

interface CollectionProgress { processed: number; updated: number; done: boolean; }
interface MigrationError {
  error: string;
  collection: string;
  userId: string | null;
  consoleUrl: string;
}
interface MigrationStatusResult {
  running: boolean;
  allDone: boolean;
  collections: Record<string, CollectionProgress>;
  totalProcessed: number;
  totalUpdated: number;
  totalRemaining: number | null;
  error: MigrationError | null;
  start: () => void;
  forceRestart: () => void;
}

/**
 * Hook to expose encryption migration progress.
 * Starts automatically once user + key ready, online, and not yet completed.
 */
export function useEncryptionMigrationStatus(pollMs = 4000): MigrationStatusResult {
  const { user, encryptionReady } = useAuth();
  const [running, setRunning] = useState(false);
  const [collections, setCollections] = useState<Record<string, CollectionProgress>>({});
  const [allDone, setAllDone] = useState(false);
  const [error, setError] = useState<MigrationError | null>(null);
  const [lastTrigger, setLastTrigger] = useState<number>(0);

  // Stable refs for polling dependencies
  const valuesRef = useRef({ user, encryptionReady, allDone, lastTrigger });

  // Keep refs in sync with state values
  useEffect(() => {
    valuesRef.current = { user, encryptionReady, allDone, lastTrigger };
  }, [user, encryptionReady, allDone, lastTrigger]);

  const refresh = useCallback(() => {
    try {
      const status = firebaseDataService.getEncryptionMigrationStatus?.();
      if (status) {
        setRunning(status.running);
        setCollections(status.collections || {});
        setAllDone(status.allDone);
      }
    } catch (e) {
      // non-critical
      console.warn('[enc-migration] status read failed', e);
    }
  }, []);

  const start = useCallback(() => {
    if (!user) return;
    if (!encryptionReady) return;
    firebaseDataService.startBackgroundEncryptionMigration?.();
    setLastTrigger(Date.now());
  }, [user, encryptionReady]);

  const forceRestart = useCallback(() => {
    if (!user) return;
    firebaseDataService.resetEncryptionMigrationState?.();
    setCollections({});
    setAllDone(false);
    setError(null); // Clear any previous errors
    start();
  }, [user, start]);

  // Listen for migration completion and error events
  useEffect(() => {
    const handleMigrationCompleted = (event: CustomEvent) => {
      console.log('[enc-migration] Migration completion event received:', event.detail);
      setAllDone(true);
      setRunning(false);
      setError(null); // Clear any previous errors
      refresh(); // Final status refresh
    };

    const handleIndexError = (event: CustomEvent) => {
      console.log('[enc-migration] Index error event received:', event.detail);
      setError(null); // Clear previous error
      
      const errorData: MigrationError = {
        error: event.detail.error || 'Database index error occurred',
        collection: event.detail.collection || 'trips',
        userId: event.detail.userId || null,
        consoleUrl: event.detail.consoleUrl || 'https://console.firebase.google.com/'
      };
      
      setError(errorData);
      setRunning(false); // Stop running state

      // Mark the affected collection as done to prevent indefinite hanging
      setCollections(prev => ({
        ...prev,
        [event.detail.collection]: {
          ...(prev[event.detail.collection] || { processed: 0, updated: 0, done: false }),
          done: true
        }
      }));
    };

    window.addEventListener('encryptionMigrationCompleted', handleMigrationCompleted as EventListener);
    window.addEventListener('encryptionIndexError', handleIndexError as EventListener);
    
    return () => {
      window.removeEventListener('encryptionMigrationCompleted', handleMigrationCompleted as EventListener);
      window.removeEventListener('encryptionIndexError', handleIndexError as EventListener);
    };
  }, [refresh]);

  // Update state when encryption becomes ready (AuthContext handles auto-start)
  useEffect(() => {
    if (encryptionReady) {
      console.log('[enc-migration] Encryption ready, refreshing status');
      refresh();
    }
  }, [encryptionReady, refresh]);
  
  // Reset polling when user changes (auth state changes)
  useEffect(() => {
    console.log('[enc-migration] User changed, resetting migration polling');
    setLastTrigger(Date.now());
  }, [user]);

  // Poll only when user is logged in AND encryption service is ready
  useEffect(() => {
    const { user: currentUser, encryptionReady: isReady, allDone: isDone } = valuesRef.current;
    
    if (!currentUser) {
      console.log('[enc-migration] Polling disabled: no user (guest mode)');
      return;
    }
    if (!isReady) {
      console.log('[enc-migration] Polling disabled: encryption not ready');
      return;
    }
    
    console.log('[enc-migration] Starting polling');
    refresh();
    if (isDone) {
      console.log('[enc-migration] Polling stopped: migration complete');
      return; // stop polling when complete
    }
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs, refresh, encryptionReady, lastTrigger]); // encryptionReady included exactly once, lastTrigger resets polling

  const totals = Object.values(collections).reduce((acc, c) => {
    acc.processed += c.processed || 0;
    acc.updated += c.updated || 0;
    return acc;
  }, { processed: 0, updated: 0 });

  // Remaining is best-effort: processed - updated gives skipped or already encrypted.
  // We can't know total docs without an extra count query, so we expose null when done.
  const totalRemaining = allDone ? 0 : null;

  return {
    running,
    allDone,
    collections,
    totalProcessed: totals.processed,
    totalUpdated: totals.updated,
    totalRemaining,
    error,
    start,
    forceRestart
  };
}
