import { useEffect, useMemo, useRef, useState } from 'react';
import { usePWA } from '@app/providers/PWAContext';
import { useSyncStatus } from '@shared/hooks/useSyncStatus';
import { firebaseDataService } from '@shared/services/firebaseDataService';

export const OfflineIndicator = () => {
  const { isOnline } = usePWA();
  const { syncQueueLength, lastSyncTime, isFirebaseReachable } = useSyncStatus();

  const [dismissedUntil, setDismissedUntil] = useState<number | null>(() => {
    try { const v = sessionStorage.getItem('hideSyncBannerUntil'); return v ? Number(v) : null; } catch { return null; }
  });
  const firstSeenQueueRef = useRef<number | null>(null);

  useEffect(() => {
    if (syncQueueLength > 0) {
      if (firstSeenQueueRef.current == null) firstSeenQueueRef.current = Date.now();
    } else {
      firstSeenQueueRef.current = null;
    }
  }, [syncQueueLength]);

  const isStuck = useMemo(() => {
    if (syncQueueLength <= 0) return false;
    const started = firstSeenQueueRef.current;
    if (!started) return false;
    return isOnline && (Date.now() - started) > 90_000;
  }, [syncQueueLength, isOnline]);

  const attemptedRepairRef = useRef(false);
  useEffect(() => {
    if (isStuck && !attemptedRepairRef.current) {
      attemptedRepairRef.current = true;
      try { (firebaseDataService as any).drainSyncQueueAggressive?.(); } catch {}
    }
    if (!isStuck) {
      attemptedRepairRef.current = false;
    }
  }, [isStuck]);

  // Determine status and styling
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        bgColor: 'bg-amber-500',
        textColor: 'text-white',
        icon: '⚠️',
        message: "You're offline. Changes will sync when connection returns.",
        showDetails: true
      };
    }

    if (isFirebaseReachable === false) {
      return {
        bgColor: 'bg-red-600',
        textColor: 'text-white',
        icon: '🔴',
        message: 'Firebase connection issue. Some features may be limited.',
        showDetails: true
      };
    }

    if (syncQueueLength > 0) {
      return {
        bgColor: 'bg-blue-500',
        textColor: 'text-white',
        icon: '🔄',
        message: `Syncing ${syncQueueLength} change${syncQueueLength > 1 ? 's' : ''}...`,
        showDetails: true
      };
    }

    // Online and synced
    return null;
  };

  const statusInfo = getStatusInfo();
  const isDismissed = dismissedUntil != null && Date.now() < dismissedUntil;

  if (!statusInfo || isDismissed) {
    return null; // Don't show anything when fully online and synced
  }

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className={`fixed top-0 left-0 right-0 ${statusInfo.bgColor} ${statusInfo.textColor} px-4 py-2 text-center text-sm font-medium z-50 transition-all duration-300`}>
      <div className="flex items-center justify-center space-x-2">
        <span className="text-lg">{statusInfo.icon}</span>
        <span>{statusInfo.message}</span>
        <div className="flex items-center space-x-2 ml-3">
          <button
            type="button"
            className="underline text-xs"
            onClick={() => {
              const until = Date.now() + 10 * 60 * 1000;
              setDismissedUntil(until);
              try { sessionStorage.setItem('hideSyncBannerUntil', String(until)); } catch {}
            }}
          >
            Hide
          </button>
          {isStuck && (
            <button
              type="button"
              className="underline text-xs"
              onClick={() => {
                try { (firebaseDataService as any).drainSyncQueueAggressive?.(); } catch {}
              }}
            >
              Repair sync
            </button>
          )}
        </div>
      </div>

      {/* Desktop details */}
      {statusInfo.showDetails && (
        <div className="hidden sm:flex items-center space-x-4 mt-1 justify-center text-xs opacity-90">
          {lastSyncTime && (
            <span>Last sync: {formatLastSync(lastSyncTime)}</span>
          )}
          {syncQueueLength > 0 && (
            <span>{syncQueueLength} pending</span>
          )}
        </div>
      )}

      {/* Mobile details */}
      {statusInfo.showDetails && (
        <div className="sm:hidden mt-1 text-xs opacity-90">
          {lastSyncTime && <div>Last sync: {formatLastSync(lastSyncTime)}</div>}
          {syncQueueLength > 0 && <div>{syncQueueLength} change{syncQueueLength > 1 ? 's' : ''} pending</div>}
        </div>
      )}
    </div>
  );
};