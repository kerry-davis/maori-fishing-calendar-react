/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { collection, doc, getDocs, getDoc, query } from 'firebase/firestore';
import { firestore } from '../services/firebase';

type WaitableTimeout = ReturnType<typeof setTimeout> | null;
type WaitableInterval = ReturnType<typeof setInterval> | null;

export interface SyncStatusValue {
  isOnline: boolean;
  isFirebaseReachable: boolean | null;
  syncQueueLength: number;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  refreshStatus: () => void;
  markSyncComplete: () => void;
  beginConnectivityCheck: () => void;
}

const SyncStatusContext = createContext<SyncStatusValue | undefined>(undefined);

interface SyncStatusProviderProps {
  userId: string | null;
  children: React.ReactNode;
  syncQueueKeyPrefix?: string;
}

const connectivityCacheKey = '__lastFirebaseConnectivityCheck';
const CONNECTIVITY_RECHECK_INTERVAL_MS = 60_000;

export const SyncStatusProvider: React.FC<SyncStatusProviderProps> = ({
  userId,
  children,
  syncQueueKeyPrefix = 'syncQueue'
}) => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [syncQueueLength, setSyncQueueLength] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFirebaseReachable, setIsFirebaseReachable] = useState<boolean | null>(null);
  const refreshDebounceRef = useRef<WaitableTimeout>(null);
  const connectivityCheckRef = useRef<WaitableInterval>(null);
  const previousQueueLengthRef = useRef(0);

  const queueKey = useMemo(() => (userId ? `${syncQueueKeyPrefix}_${userId}` : null), [userId, syncQueueKeyPrefix]);
  const lastSyncKey = useMemo(() => (userId ? `lastSync_${userId}` : null), [userId]);

  const clearRefreshTimeout = useCallback(() => {
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = null;
    }
  }, []);

  const readQueueLength = useCallback(() => {
    if (!queueKey) {
      setSyncQueueLength(0);
      setIsSyncing(false);
      if (previousQueueLengthRef.current !== 0) {
        previousQueueLengthRef.current = 0;
        window.dispatchEvent(new CustomEvent('syncQueueUpdated'));
      }
      return;
    }

    try {
      const queueData = localStorage.getItem(queueKey);
      const parsed = queueData ? JSON.parse(queueData) : [];
      const length = Array.isArray(parsed) ? parsed.length : 0;
      setSyncQueueLength(length);
      setIsSyncing(length > 0);
      if (previousQueueLengthRef.current !== length) {
        previousQueueLengthRef.current = length;
        window.dispatchEvent(new CustomEvent('syncQueueUpdated'));
      }
    } catch (error) {
      console.error('SyncStatusProvider: failed reading queue data', error);
      setSyncQueueLength(0);
      setIsSyncing(false);
      if (previousQueueLengthRef.current !== 0) {
        previousQueueLengthRef.current = 0;
        window.dispatchEvent(new CustomEvent('syncQueueUpdated'));
      }
    }
  }, [queueKey]);

  const readLastSync = useCallback(() => {
    if (!lastSyncKey) {
      setLastSyncTime(null);
      return;
    }
    try {
      const stored = localStorage.getItem(lastSyncKey);
      setLastSyncTime(stored ? new Date(stored) : null);
    } catch (error) {
      console.error('SyncStatusProvider: failed reading last sync', error);
      setLastSyncTime(null);
    }
  }, [lastSyncKey]);

  const refreshStatus = useCallback(() => {
    readQueueLength();
    readLastSync();
  }, [readLastSync, readQueueLength]);

  const markSyncComplete = useCallback(() => {
    if (!lastSyncKey || !queueKey) {
      return;
    }

    try {
      const now = new Date();
      localStorage.setItem(lastSyncKey, now.toISOString());
      localStorage.setItem(queueKey, JSON.stringify([]));
      setLastSyncTime(now);
      setSyncQueueLength(0);
      setIsSyncing(false);
      previousQueueLengthRef.current = 0;
      window.dispatchEvent(new CustomEvent('syncQueueUpdated'));
    } catch (error) {
      console.warn('SyncStatusProvider: failed to mark sync complete', error);
    }
  }, [lastSyncKey, queueKey]);

  const performConnectivityCheck = useCallback(async () => {
    if (!navigator.onLine) {
      setIsFirebaseReachable(false);
      return;
    }

    if (!firestore) {
      setIsFirebaseReachable(false);
      return;
    }

    try {
      const heartbeatDoc = doc(collection(firestore, '__status__'), 'ping');
      const snapshot = await getDoc(heartbeatDoc);
      if (!snapshot.exists()) {
        await getDocs(query(collection(firestore, '__status__')));
      }
      setIsFirebaseReachable(true);
      localStorage.setItem(connectivityCacheKey, Date.now().toString());
    } catch (unknownError: unknown) {
      const error = unknownError as { code?: string; message?: string } | undefined;
      const message = error?.message ?? '';
      const isNetworkIssue =
        error?.code === 'unavailable' ||
        message.includes('network') ||
        message.includes('unreachable');

      setIsFirebaseReachable(isNetworkIssue ? false : true);
    }
  }, []);

  const beginConnectivityCheck = useCallback(() => {
    performConnectivityCheck();
    if (connectivityCheckRef.current) {
      clearInterval(connectivityCheckRef.current);
    }
    connectivityCheckRef.current = setInterval(() => {
      performConnectivityCheck();
    }, CONNECTIVITY_RECHECK_INTERVAL_MS);
  }, [performConnectivityCheck]);

  const scheduleRefresh = useCallback(() => {
    clearRefreshTimeout();
    refreshDebounceRef.current = setTimeout(() => {
      refreshStatus();
    }, 100);
  }, [clearRefreshTimeout, refreshStatus]);

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

  useEffect(() => {
    refreshStatus();

    if (navigator.onLine) {
      const lastCheck = localStorage.getItem(connectivityCacheKey);
      if (!lastCheck || Date.now() - Number(lastCheck) > CONNECTIVITY_RECHECK_INTERVAL_MS) {
        performConnectivityCheck();
      } else {
        setIsFirebaseReachable(true);
      }
    } else {
      setIsFirebaseReachable(false);
    }

    beginConnectivityCheck();

    return () => {
      if (connectivityCheckRef.current) {
        clearInterval(connectivityCheckRef.current);
        connectivityCheckRef.current = null;
      }
    };
  }, [beginConnectivityCheck, performConnectivityCheck, refreshStatus]);

  useEffect(() => {
    if (!queueKey) {
      setSyncQueueLength(0);
      setIsSyncing(false);
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === queueKey || event.key === lastSyncKey) {
        scheduleRefresh();
      }
    };

    const handleCustomUpdate = () => {
      scheduleRefresh();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('syncQueueCleared', handleCustomUpdate);
    window.addEventListener('syncQueueUpdated', handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('syncQueueCleared', handleCustomUpdate);
      window.removeEventListener('syncQueueUpdated', handleCustomUpdate);
    };
  }, [queueKey, lastSyncKey, scheduleRefresh]);

  useEffect(() => () => clearRefreshTimeout(), [clearRefreshTimeout]);

  const value = useMemo<SyncStatusValue>(() => ({
    isOnline,
    isFirebaseReachable,
    syncQueueLength,
    lastSyncTime,
    isSyncing,
    refreshStatus,
    markSyncComplete,
    beginConnectivityCheck
  }), [
    isOnline,
    isFirebaseReachable,
    syncQueueLength,
    lastSyncTime,
    isSyncing,
    refreshStatus,
    markSyncComplete,
    beginConnectivityCheck
  ]);

  return (
    <SyncStatusContext.Provider value={value}>
      {children}
    </SyncStatusContext.Provider>
  );
};

export const useSyncStatusContext = (): SyncStatusValue => {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error('useSyncStatusContext must be used within a SyncStatusProvider');
  }
  return context;
};
