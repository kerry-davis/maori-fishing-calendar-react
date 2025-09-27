import { useState, useEffect, useCallback } from 'react';

export const useExitConfirmation = (initialIsConfirming = true) => {
  const [isConfirming, setIsConfirming] = useState(initialIsConfirming);

  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (isConfirming) {
        event.preventDefault();
        event.returnValue = '';
      }
    },
    [isConfirming]
  );

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  return { setIsConfirming };
};