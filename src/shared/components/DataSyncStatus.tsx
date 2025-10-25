import React from 'react';
import { useAuth } from '../../app/providers/AuthContext';
import { useSyncStatusContext } from '../../app/providers/SyncStatusContext';

interface DataSyncStatusProps {
  className?: string;
}

export const DataSyncStatus: React.FC<DataSyncStatusProps> = ({ className = '' }) => {
  const { user } = useAuth();
  const { syncQueueLength, lastSyncTime } = useSyncStatusContext();

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

  if (user) {
    if (syncQueueLength > 0) {
      return (
        <div className={`flex items-center space-x-2 text-xs text-blue-600 dark:text-blue-400 ${className}`} title={`Last sync: ${formatLastSync(lastSyncTime)}`}>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span>Syncing ({syncQueueLength})</span>
        </div>
      );
    }
    return (
      <div className={`flex items-center space-x-2 text-xs text-green-600 dark:text-green-400 ${className}`} title={`Last sync: ${formatLastSync(lastSyncTime)}`}>
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span>Synced</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 text-xs text-amber-600 dark:text-amber-400 ${className}`}>
      <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
      <span>Local data only</span>
    </div>
  );
};

export default DataSyncStatus;