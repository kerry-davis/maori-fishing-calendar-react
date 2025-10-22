import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

// PWA register hook with fallback for testing
interface PWARegisterHook {
  needRefresh: [boolean, (value: boolean) => void];
  offlineReady: [boolean, (value: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export const usePWARegister = (): PWARegisterHook => {
  // Hooks must be unconditionally called
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  const register = useRegisterSW({
    onRegistered(r: unknown) {
      console.log("SW Registered:", r);
    },
    onRegisterError(error: unknown) {
      console.log("SW registration error", error);
    },
  });

  const isTestEnv = typeof window === "undefined" || process.env.NODE_ENV === "test";
  if (isTestEnv) {
    return {
      needRefresh: [needRefresh, setNeedRefresh],
      offlineReady: [offlineReady, setOfflineReady],
      updateServiceWorker: async () => {},
    };
  }

  return register as unknown as PWARegisterHook;
};
