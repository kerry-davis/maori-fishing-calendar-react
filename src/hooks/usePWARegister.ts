import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// PWA register hook with fallback for testing
interface PWARegisterHook {
  needRefresh: [boolean, (value: boolean) => void];
  offlineReady: [boolean, (value: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export const usePWARegister = (): PWARegisterHook => {
  // Check if we're in a test environment
  if (typeof window === "undefined" || process.env.NODE_ENV === "test") {
    const [needRefresh, setNeedRefresh] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    return {
      needRefresh: [needRefresh, setNeedRefresh],
      offlineReady: [offlineReady, setOfflineReady],
      updateServiceWorker: async () => {},
    };
  }

  return useRegisterSW({
    onRegistered(r: any) {
      console.log("SW Registered: " + r);
    },
    onRegisterError(error: any) {
      console.log("SW registration error", error);
    },
  });
};
