import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@app/providers/AuthContext';

export const BiometricLockScreen: React.FC = () => {
  const { unlockWithBiometrics, logout } = useAuth();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoAttemptedRef = useRef(false);

  const handleUnlock = useCallback(async () => {
    setIsUnlocking(true);
    setError(null);
    try {
      const success = await unlockWithBiometrics();
      if (!success) {
        setError('Authentication failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setIsUnlocking(false);
    }
  }, [unlockWithBiometrics]);

  useEffect(() => {
    if (autoAttemptedRef.current) {
      return;
    }
    autoAttemptedRef.current = true;
    void handleUnlock();
  }, [handleUnlock]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900 text-white p-6">
      <div className="w-full max-w-sm text-center space-y-8">
        
        {/* Icon */}
        <div className="mx-auto w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/50 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold">App Locked</h2>
        <p className="text-slate-300">Use your fingerprint or face ID to unlock</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 pt-4">
          <button
            onClick={handleUnlock}
            disabled={isUnlocking}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl font-semibold text-lg transition-all transform active:scale-[0.98] shadow-xl"
          >
            {isUnlocking ? 'Verifying...' : 'Unlock App'}
          </button>

          <button
            onClick={() => logout()}
            className="text-sm text-slate-400 hover:text-white underline decoration-slate-600 underline-offset-4 py-2"
          >
            Log out instead
          </button>
        </div>
      </div>
    </div>
  );
};
