import { useState } from 'react';

// PWA register hook with fallback for testing
interface PWARegisterHook {
  needRefresh: [boolean, (value: boolean) => void];
  offlineReady: [boolean, (value: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export const usePWARegister = (): PWARegisterHook => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  // Check if we're in a test environment
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
    return {
      needRefresh: [needRefresh, setNeedRefresh],
      offlineReady: [offlineReady, setOfflineReady],
      updateServiceWorker: async () => {},
    };
  }

  try {
    // Try to use the actual PWA register hook in production
    // This will be handled by Vite's virtual module system
    const { useRegisterSW } = eval('require')('virtual:pwa-register/react');
    return useRegisterSW({
      onRegistered(r: any) {
        console.log('SW Registered: ' + r);
      },
      onRegisterError(error: any) {
        console.log('SW registration error', error);
      },
    });
  } catch (error) {
    // Fallback implementation for development/testing
    return {
      needRefresh: [needRefresh, setNeedRefresh],
      offlineReady: [offlineReady, setOfflineReady],
      updateServiceWorker: async (reloadPage?: boolean) => {
        if (reloadPage) {
          window.location.reload();
        }
      },
    };
  }
};