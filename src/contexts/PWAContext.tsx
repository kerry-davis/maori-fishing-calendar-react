import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePWARegister } from '../hooks/usePWARegister';

interface PWAContextType {
  // Install prompt
  canInstall: boolean;
  showInstallPrompt: () => void;
  
  // Update handling
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  
  // Status
  isOnline: boolean;
  isPWA: boolean;
}

const PWAContext = createContext<PWAContextType | undefined>(undefined);

interface PWAProviderProps {
  children: ReactNode;
}

export const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isPWA, setIsPWA] = useState(false);

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = usePWARegister();

  // Handle install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check display mode with enhanced detection
  useEffect(() => {
    const checkPWAMode = () => {
      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      const isStandalone = mediaQuery.matches;

      // Enhanced PWA detection for iOS and other platforms
      const isIOSPWA = (window.navigator as any).standalone === true;
      const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches && /Android/i.test(navigator.userAgent);

      const isPWA = isStandalone || isIOSPWA || isAndroidPWA;

      console.log('PWA detection:', {
        isStandalone,
        isIOSPWA,
        isAndroidPWA,
        isPWA,
        userAgent: navigator.userAgent
      });

      setIsPWA(isPWA);
    };

    // Check immediately
    checkPWAMode();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      console.log('Display mode changed:', e.matches);
      checkPWAMode();
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const showInstallPrompt = async () => {
    if (!deferredPrompt) return;

    // Show the prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setCanInstall(false);
  };

  const contextValue: PWAContextType = {
    canInstall,
    showInstallPrompt,
    needRefresh,
    offlineReady,
    updateServiceWorker,
    isOnline,
    isPWA,
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = (): PWAContextType => {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};