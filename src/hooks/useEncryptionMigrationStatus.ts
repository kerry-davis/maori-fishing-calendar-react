import { useState, useEffect, useCallback } from 'react';
import { encryptionService } from '../services/encryptionService';
import { firebaseDataService } from '../services/firebaseDataService';
import { useAuth } from '../contexts/AuthContext';

interface CollectionProgress { processed: number; updated: number; done: boolean; }
interface MigrationStatusResult {
  running: boolean;
  allDone: boolean;
  collections: Record<string, CollectionProgress>;
  totalProcessed: number;
  totalUpdated: number;
  totalRemaining: number | null;
  start: () => void;
  forceRestart: () => void;
}

/**
 * Hook to expose encryption migration progress.
 * Starts automatically once user + key ready, online, and not yet completed.
 */
export function useEncryptionMigrationStatus(pollMs = 4000): MigrationStatusResult {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [collections, setCollections] = useState<Record<string, CollectionProgress>>({});
  const [allDone, setAllDone] = useState(false);
  const [lastTrigger, setLastTrigger] = useState<number>(0);

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
    if (!encryptionService.isReady()) return;
    firebaseDataService.startBackgroundEncryptionMigration?.();
    setLastTrigger(Date.now());
  }, [user]);

  const forceRestart = useCallback(() => {
    if (!user) return;
    firebaseDataService.resetEncryptionMigrationState?.();
    setCollections({});
    setAllDone(false);
    start();
  }, [user, start]);

  // Auto-start logic
  useEffect(() => {
    if (!user) return;
    if (!encryptionService.isReady()) return;
    // If not all done and not currently running, attempt start once
    const status = firebaseDataService.getEncryptionMigrationStatus?.();
    if (status && !status.allDone && !status.running) {
      firebaseDataService.startBackgroundEncryptionMigration?.();
      setLastTrigger(Date.now());
    }
  }, [user]);

  // Poll
  useEffect(() => {
    refresh();
    if (allDone) return; // stop polling when complete
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, [pollMs, allDone, lastTrigger, refresh]);

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
    start,
    forceRestart
  };
}
