import React, { useState } from 'react';
import { useAuth } from '../../app/providers/AuthContext';

export const GuestModeNotice: React.FC = () => {
  const { user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show for guest users (not logged in)
  if (user || isDismissed) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-amber-500 text-lg">📱</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Using Local Storage
          </h3>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Your fishing data is stored locally on this device. 
            <strong> Sign in</strong> to sync across devices and backup to the cloud.
          </p>
        </div>
        <div className="flex-shrink-0 ml-2">
          <button
            onClick={() => setIsDismissed(true)}
            className="text-amber-400 hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-100"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestModeNotice;