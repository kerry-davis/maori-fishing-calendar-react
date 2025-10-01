import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { firebaseDataService } from '../services/firebaseDataService';
import { usePWA } from './PWAContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  successMessage: string | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: () => void;
  clearSuccessMessage: () => void;
  clearSyncQueue: () => boolean;
  isFirebaseConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isPWA } = usePWA();

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (newUser) => {
      const previousUser = user;

      if (newUser && !previousUser) {
        // User is logging in
        console.log('User logging in, checking for local data and merging...');
        await firebaseDataService.switchToUser(newUser.uid);
        
        // First merge any local data to Firebase, THEN clear local data
        console.log('Merging any local guest data to Firebase...');
        await firebaseDataService.mergeLocalDataForUser();
        
        // Now clear local data to prevent duplicates with Firebase data
        console.log('Clearing local data after merge to prevent duplicates');
        await firebaseDataService.clearAllData();
        
        console.log('Login completed - local data merged and Firebase data will be loaded fresh');
      } else if (!newUser && previousUser) {
        // User is logging out
        console.log('User logging out, switching to guest mode...');
        // Don't clear local data - keep it visible for better UX
        await firebaseDataService.initialize(); // Re-initialize in guest mode.
        console.log('Switched to guest mode - local data remains visible');
      }

      console.log('Auth state changed - user:', newUser?.uid || 'null', 'email:', newUser?.email || 'none');
      setUser(newUser);
      setLoading(false);
    });

    // Enhanced redirect result handling for mobile PWAs
    const handleRedirectResult = async () => {
      const browserInfo = {
        isChrome: navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('OPR/'),
        isAndroid: /Android/i.test(navigator.userAgent),
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      };

      console.log('=== REDIRECT RESULT HANDLER ===');
      console.log('Browser info:', browserInfo);

      try {
        console.log('Checking for redirect result...');
        const result = await getRedirectResult(auth);

        if (result && result.user) {
          console.log('✅ Redirect result successful for user:', result.user.email);
          setSuccessMessage('Successfully signed in with Google!');
        } else {
          console.log('❓ No redirect result found');

          // For Chrome Android PWA, try a more aggressive approach
          if (browserInfo.isChrome && browserInfo.isAndroid && isPWA) {
            console.log('🔄 Chrome Android PWA - no result, trying again in 2 seconds...');
            setTimeout(() => {
              console.log('🔄 Retrying redirect result for Chrome Android PWA...');
              handleRedirectResult();
            }, 2000);
          }
        }
      } catch (err) {
        console.error('❌ getRedirectResult error:', err);

        // Enhanced error handling for Chrome PWA
        if (browserInfo.isChrome && browserInfo.isAndroid && isPWA) {
          console.log('🔍 Chrome Android PWA specific error handling');

          if (err instanceof Error && err.message.includes('no-auth-event')) {
            console.log('No auth event - this might be normal for Chrome PWA, retrying...');
            setTimeout(() => handleRedirectResult(), 1000);
            return;
          }
        }

        // Only show error for actual authentication failures, not "no result" cases
        if (err instanceof Error && !err.message.includes('no-auth-event')) {
          const errorMessage = err.message || 'Google sign-in failed';
          setError(errorMessage);
        }
      }
    };

    // Handle redirect result for PWA
    if (isPWA) {
      handleRedirectResult();
    }

    return unsubscribe;
  }, [user]);

  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not configured. Please set up your Firebase environment variables.');
    }
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
      setSuccessMessage('Successfully signed in!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const register = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not configured. Please set up your Firebase environment variables.');
    }
    try {
      setError(null);
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccessMessage('Account created successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const signInWithGoogle = async () => {
    console.log('signInWithGoogle called');
    console.log('auth available:', !!auth);
    console.log('isPWA:', isPWA);

    if (!auth) {
      const errorMsg = 'Firebase authentication is not configured. Please set up your Firebase environment variables.';
      console.error('Auth not available:', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      setError(null);
      console.log('Creating GoogleAuthProvider...');
      const provider = new GoogleAuthProvider();

      // Enhanced browser detection for debugging
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isOpera = userAgent.includes('OPR/') || userAgent.includes('Opera');
      const isChrome = userAgent.includes('Chrome') && !isOpera;
      const isAndroid = /Android/i.test(userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

      console.log('=== BROWSER DETECTION ===');
      console.log('User Agent:', userAgent);
      console.log('isPWA:', isPWA);
      console.log('isMobile:', isMobile);
      console.log('isOpera:', isOpera);
      console.log('isChrome:', isChrome);
      console.log('isAndroid:', isAndroid);
      console.log('isIOS:', isIOS);
      console.log('Display Mode:', window.matchMedia('(display-mode: standalone)').matches);

      if (isPWA && isMobile && isOpera) {
        // Opera mobile PWA - use redirect with specific configuration
        console.log('Opera mobile PWA detected - using redirect with custom parameters...');
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        await signInWithRedirect(auth, provider);
        console.log('Opera PWA redirect initiated');
      } else if (isPWA && isMobile && isChrome && isAndroid) {
        // Chrome Android PWA - try popup first, fallback to redirect
        console.log('Chrome Android PWA detected - trying popup first...');
        try {
          await signInWithPopup(auth, provider);
          console.log('Chrome Android PWA popup successful');
          setSuccessMessage('Successfully signed in with Google!');
        } catch (popupError) {
          console.log('Chrome Android PWA popup failed, using redirect...', popupError);
          await signInWithRedirect(auth, provider);
          console.log('Chrome Android PWA redirect initiated');
        }
      } else if (isPWA && isMobile) {
        // Other mobile PWA browsers - use redirect
        console.log('Other mobile PWA detected - using signInWithRedirect...');
        await signInWithRedirect(auth, provider);
        console.log('Other mobile PWA redirect initiated');
      } else if (isPWA) {
        // Desktop PWA - try popup first, fallback to redirect
        console.log('Desktop PWA detected - trying popup first...');
        try {
          await signInWithPopup(auth, provider);
          console.log('Desktop PWA popup successful');
          setSuccessMessage('Successfully signed in with Google!');
        } catch (popupError) {
          console.log('Desktop PWA popup failed, using redirect...', popupError);
          await signInWithRedirect(auth, provider);
          console.log('Desktop PWA redirect initiated');
        }
      } else {
        // Regular web mode - use popup
        console.log('Regular web mode - using signInWithPopup...');
        await signInWithPopup(auth, provider);
        console.log('Regular popup successful');
        setSuccessMessage('Successfully signed in with Google!');
      }
    } catch (err) {
      console.error('signInWithGoogle error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    console.log('Logout called, auth available:', !!auth);

    if (!auth) {
      console.warn('Firebase auth not available, clearing local user state');
      // If Firebase auth is not available, just clear the local user state
      setUser(null);
      setSuccessMessage('Signed out successfully');
      return;
    }

    try {
      setError(null);
      
      // Download Firebase data to local storage for guest mode access
      console.log('Downloading your data for offline access...');
      setSuccessMessage('Downloading your data for offline access...');
      
      try {
        await firebaseDataService.backupLocalDataBeforeLogout();
        console.log('Data download completed - your data will be available offline');
      } catch (backupError) {
        console.warn('Failed to download data for offline access:', backupError);
        // Continue with logout even if backup fails
      }

      console.log('Calling Firebase signOut...');
      await signOut(auth);
      console.log('Firebase signOut successful');

      // Clear sync queue after successful logout
      try {
        firebaseDataService.clearSyncQueue();
        console.log('Sync queue cleared during logout');
        // Dispatch custom event to notify sync status hook
        window.dispatchEvent(new CustomEvent('syncQueueCleared'));
      } catch (syncError) {
        console.warn('Failed to clear sync queue during logout:', syncError);
      }

      setSuccessMessage('Signed out successfully');
    } catch (err) {
      console.error('Firebase logout error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);

      // If Firebase logout fails, still clear local state as fallback
      console.log('Clearing local user state as fallback');
      setUser(null);

      // Also try to clear sync queue even if Firebase logout failed
      try {
        firebaseDataService.clearSyncQueue();
        console.log('Sync queue cleared during fallback logout');
        // Dispatch custom event to notify sync status hook
        window.dispatchEvent(new CustomEvent('syncQueueCleared'));
      } catch (syncError) {
        console.warn('Failed to clear sync queue during fallback logout:', syncError);
      }

      setSuccessMessage('Signed out locally');

      throw new Error(errorMessage);
    }
  };

  // Alternative logout method that always works (for debugging)
  const forceLogout = () => {
    console.log('Force logout called - clearing all user state');

    // Clear sync queue
    try {
      firebaseDataService.clearSyncQueue();
      console.log('Sync queue cleared during force logout');
      // Dispatch custom event to notify sync status hook
      window.dispatchEvent(new CustomEvent('syncQueueCleared'));
    } catch (syncError) {
      console.warn('Failed to clear sync queue during force logout:', syncError);
    }

    setUser(null);
    setError(null);
    setSuccessMessage('Force logout completed');
  };

  const clearSuccessMessage = () => {
    setSuccessMessage(null);
  };

  const isFirebaseConfigured = auth !== null;

  // Debug method to clear sync queue (exposed to window for debugging)
  const clearSyncQueue = () => {
    try {
      firebaseDataService.clearSyncQueue();
      console.log('Sync queue cleared via debug method');

      // Dispatch custom event to notify sync status hook
      window.dispatchEvent(new CustomEvent('syncQueueCleared'));

      setSuccessMessage('Sync queue cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear sync queue:', error);
      setError('Failed to clear sync queue');
      return false;
    }
  };

  // Expose debug methods to window for Chrome PWA troubleshooting
  useEffect(() => {
    (window as any).clearSyncQueue = clearSyncQueue;
    (window as any).debugChromePWA = {
      checkDetection: () => {
        const userAgent = navigator.userAgent;
        const isPWA = window.matchMedia('(display-mode: standalone)').matches;
        const isChrome = userAgent.includes('Chrome') && !userAgent.includes('OPR/');
        const isAndroid = /Android/i.test(userAgent);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

        console.log('=== CHROME PWA DETECTION DEBUG ===');
        console.log('User Agent:', userAgent);
        console.log('isPWA:', isPWA);
        console.log('isChrome:', isChrome);
        console.log('isAndroid:', isAndroid);
        console.log('isMobile:', isMobile);
        console.log('Display Mode:', window.matchMedia('(display-mode: standalone)').matches);

        return {
          isPWA,
          isChrome,
          isAndroid,
          isMobile,
          userAgent,
          currentUser: user?.email || 'none'
        };
      },
      testRedirect: async () => {
        console.log('=== TESTING REDIRECT RESULT ===');
        try {
          const result = await getRedirectResult(auth);
          console.log('Redirect result:', result);
          if (result && result.user) {
            console.log('✅ User found:', result.user.email);
          } else {
            console.log('❓ No user in redirect result');
          }
        } catch (err) {
          console.log('❌ Redirect result error:', err);
        }
      },
      forceRetry: () => {
        console.log('=== FORCED RETRY ===');
        setError(null);
        // Manually call handleRedirectResult for retry
        if (isPWA && auth) {
          getRedirectResult(auth)
            .then((result) => {
              if (result && result.user) {
                console.log('✅ Manual retry successful:', result.user.email);
                setSuccessMessage('Successfully signed in with Google!');
              } else {
                console.log('❓ Manual retry - no result');
              }
            })
            .catch((err) => {
              console.error('❌ Manual retry error:', err);
            });
        }
      }
    };
  }, [user, isPWA, auth]);

  const value = {
    user,
    loading,
    successMessage,
    error,
    login,
    register,
    signInWithGoogle,
    logout,
    forceLogout,
    clearSuccessMessage,
    clearSyncQueue,
    isFirebaseConfigured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Export the context for testing purposes
export { AuthContext };