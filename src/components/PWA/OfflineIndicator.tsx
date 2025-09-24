import React from 'react';
import { usePWA } from '../../contexts/PWAContext';
import { useSyncStatus } from '../../hooks/useSyncStatus';

export const OfflineIndicator: React.FC = () => {
  const { isOnline } = usePWA();
  const { syncQueueLength, lastSyncTime, isFirebaseReachable } = useSyncStatus();

  // Determine status and styling
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        bgColor: 'bg-amber-500',
        textColor: 'text-white',
        icon: '⚠️',
        message: 'You\'re offline. Changes will sync when connection returns.',
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

  if (!statusInfo) {
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
        {statusInfo.showDetails && (
          <div className="hidden sm:flex items-center space-x-4 ml-4 text-xs opacity-90">
            {lastSyncTime && (
              <span>Last sync: {formatLastSync(lastSyncTime)}</span>
            )}
            {syncQueueLength > 0 && (
              <span>{syncQueueLength} pending</span>
            )}
          </div>
        )}
      </div>

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