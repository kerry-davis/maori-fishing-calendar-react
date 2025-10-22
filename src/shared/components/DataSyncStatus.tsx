import React from 'react';
import { useAuth } from '../../app/providers/AuthContext';

interface DataSyncStatusProps {
  className?: string;
}

export const DataSyncStatus: React.FC<DataSyncStatusProps> = ({ className = '' }) => {
  const { user } = useAuth();

  if (user) {
    return (
      <div className={`flex items-center space-x-2 text-xs text-green-600 dark:text-green-400 ${className}`}>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>Synced to cloud</span>
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