import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@app/providers/AuthContext';

type WaitMode = 'idle' | 'waiting' | 'timeout';

interface UseLogoutGuardOptions {
  onAfterLogout?: () => void;
  onCancel?: () => void;
}

interface LogoutGuardDetails {
  isDialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  handleConfirm: () => Promise<void>;
  handleCancel: () => void;
  confirmDisabled: boolean;
  confirmText: string;
  statusMessage: string;
  detailLines: string[];
  waitMode: WaitMode;
  isSyncing: boolean;
  syncQueueLength: number;
  lastSyncTime: Date | null;
  isOnline: boolean;
  isFirebaseReachable: boolean | null;
  canRetry: boolean;
  retryWait: () => void;
}

const WAIT_TIMEOUT_MS = 10_000;
const REFRESH_INTERVAL_MS = 1_000;

type TimeoutRef = ReturnType<typeof setTimeout> | null;
type IntervalRef = ReturnType<typeof setInterval> | null;

export function useLogoutGuard(options: UseLogoutGuardOptions = {}): LogoutGuardDetails {
  const {
    logout,
    forceLogout,
    isFirebaseConfigured,
    lastSyncTime,
    syncQueueLength,
    isSyncing,
    isOnline,
    isFirebaseReachable,
    refreshSyncStatus,
    markSyncComplete
  } = useAuth();

  const { onAfterLogout, onCancel } = options;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [waitMode, setWaitMode] = useState<WaitMode>('idle');
  const [isProcessing, setIsProcessing] = useState(false);

  const waitTimeoutRef = useRef<TimeoutRef>(null);
  const waitIntervalRef = useRef<IntervalRef>(null);

  const clearWaitTimers = useCallback(() => {
    if (waitTimeoutRef.current) {
      clearTimeout(waitTimeoutRef.current);
      waitTimeoutRef.current = null;
    }
    if (waitIntervalRef.current) {
      clearInterval(waitIntervalRef.current);
      waitIntervalRef.current = null;
    }
  }, []);

  const beginWaiting = useCallback(() => {
    clearWaitTimers();
    if (!(isSyncing || syncQueueLength > 0)) {
      setWaitMode('idle');
      return;
    }

    setWaitMode('waiting');
    refreshSyncStatus();

    waitIntervalRef.current = setInterval(() => {
      refreshSyncStatus();
    }, REFRESH_INTERVAL_MS);

    waitTimeoutRef.current = setTimeout(() => {
      clearWaitTimers();
      setWaitMode('timeout');
    }, WAIT_TIMEOUT_MS);
  }, [clearWaitTimers, isSyncing, refreshSyncStatus, syncQueueLength]);

  const closeDialog = useCallback(() => {
    clearWaitTimers();
    setWaitMode('idle');
    setIsDialogOpen(false);
  }, [clearWaitTimers]);

  const performLogout = useCallback(async () => {
    try {
      if (isFirebaseConfigured) {
        markSyncComplete();
        await logout();
      } else {
        markSyncComplete();
        forceLogout();
      }

      alert('Signed out. Local data saved on this device has been cleared.');
      onAfterLogout?.();
      closeDialog();
    } catch (error) {
      console.error('Logout error:', error);
      try {
        markSyncComplete();
        forceLogout();
        alert('Signed out. Local data saved on this device has been cleared.');
        onAfterLogout?.();
        closeDialog();
      } catch (fallbackError) {
        console.error('Force logout failed:', fallbackError);
        alert(`Logout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsDialogOpen(true);
      }
    }
  }, [closeDialog, forceLogout, isFirebaseConfigured, logout, markSyncComplete, onAfterLogout]);

  const handleConfirm = useCallback(async () => {
    if (waitMode === 'waiting' || isProcessing) {
      return;
    }

    if (waitMode !== 'timeout' && (isSyncing || syncQueueLength > 0)) {
      beginWaiting();
      return;
    }

    setIsProcessing(true);
    try {
      clearWaitTimers();
      setWaitMode('idle');
      await performLogout();
    } finally {
      setIsProcessing(false);
    }
  }, [beginWaiting, clearWaitTimers, isProcessing, isSyncing, performLogout, syncQueueLength, waitMode]);

  const handleCancel = useCallback(() => {
    closeDialog();
    onCancel?.();
  }, [closeDialog, onCancel]);

  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const retryWait = useCallback(() => {
    beginWaiting();
  }, [beginWaiting]);

  useEffect(() => {
    if (!isDialogOpen) {
      clearWaitTimers();
      setWaitMode('idle');
      return;
    }

    if (waitMode === 'waiting') {
      return;
    }

    if (waitMode === 'timeout') {
      return;
    }

    if (isSyncing || syncQueueLength > 0) {
      beginWaiting();
    }
  }, [beginWaiting, clearWaitTimers, isDialogOpen, isSyncing, syncQueueLength, waitMode]);

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    if (waitMode !== 'waiting') {
      return;
    }

    if (!isSyncing && syncQueueLength === 0) {
      clearWaitTimers();
      setWaitMode('idle');
    }
  }, [clearWaitTimers, isDialogOpen, isSyncing, syncQueueLength, waitMode]);

  useEffect(() => () => clearWaitTimers(), [clearWaitTimers]);

  const confirmDisabled = waitMode === 'waiting' || isProcessing;
  const confirmText = waitMode === 'timeout' ? 'Sign Out Anyway' : 'Sign Out';

  const formattedLastSync = useMemo(() => {
    if (!lastSyncTime) {
      return 'Never';
    }
    return lastSyncTime.toLocaleString();
  }, [lastSyncTime]);

  const statusMessage = useMemo(() => {
    if (waitMode === 'waiting') {
      if (syncQueueLength > 0) {
        return `We’re finishing ${syncQueueLength} pending change${syncQueueLength === 1 ? '' : 's'} before signing you out.`;
      }
      return 'Checking sync status. Sign out will be available shortly.';
    }

    if (waitMode === 'timeout') {
      return 'Sync is taking longer than expected. You can sign out anyway or try waiting again.';
    }

    if (isSyncing || syncQueueLength > 0) {
      return `Sync in progress (${syncQueueLength} pending). We’ll block sign out until it finishes.`;
    }

    return `Signing out will remove any local-only data stored on this device. Last sync: ${formattedLastSync}.`;
  }, [formattedLastSync, isSyncing, syncQueueLength, waitMode]);

  const detailLines = useMemo(() => {
    const details: string[] = [];
    if (waitMode !== 'idle') {
      details.push(`Last sync: ${formattedLastSync}`);
    }
    if (!isOnline) {
      details.push('You appear to be offline. Sync may take longer than usual.');
    }
    if (waitMode === 'waiting' && syncQueueLength > 0) {
      details.push(`${syncQueueLength} change${syncQueueLength === 1 ? '' : 's'} remaining.`);
    }
    if (waitMode === 'timeout' && syncQueueLength > 0) {
      details.push(`${syncQueueLength} change${syncQueueLength === 1 ? '' : 's'} still pending.`);
    }
    if (waitMode === 'timeout' && isFirebaseReachable === false) {
      details.push('Could not reach Firebase. Consider retrying when connection improves.');
    }
    return details;
  }, [formattedLastSync, isFirebaseReachable, isOnline, syncQueueLength, waitMode]);

  return {
    isDialogOpen,
    openDialog,
    closeDialog,
    handleConfirm,
    handleCancel,
    confirmDisabled,
    confirmText,
    statusMessage,
    detailLines,
    waitMode,
    isSyncing,
    syncQueueLength,
    lastSyncTime,
    isOnline,
    isFirebaseReachable,
    canRetry: waitMode === 'timeout',
    retryWait,
  };
}
