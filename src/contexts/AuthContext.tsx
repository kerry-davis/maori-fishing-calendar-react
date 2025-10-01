import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  const [redirectAttempts, setRedirectAttempts] = useState(0);
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

    // Call handleRedirectResult for PWA mode
    if (isPWA && auth) {
      handleRedirectResult();
    }

    return unsubscribe;
  }, [user]);

  // Handle redirect result for PWA authentication
  const handleRedirectResult = useCallback(async () => {
    const browserInfo = getBrowserInfo();
    console.log('=== HANDLING REDIRECT RESULT ===');
    console.log('Browser info:', browserInfo);
    console.log('Checking for redirect result... (attempt:', redirectAttempts + 1, ')');

    try {
      const result = await getRedirectResult(auth);

      if (result && result.user) {
        console.log('✅ Redirect result successful, user:', result.user.email);
        setSuccessMessage('Successfully signed in with Google!');
        setRedirectAttempts(0); // Reset counter on success
      } else {
        console.log('❓ No redirect result or no user in result');
        setRedirectAttempts(prev => prev + 1);

        // For PWA, set a more specific timeout
        if (redirectAttempts === 0) {
          setTimeout(() => {
            console.log('⏰ First redirect check timeout - may need manual retry');
          }, 3000);
        }
      }
    } catch (err) {
      console.error('❌ getRedirectResult error:', err);
      setRedirectAttempts(prev => prev + 1);

      // More specific error handling for different browsers
      if (err instanceof Error) {
        if (err.message.includes('auth/user-not-found') || err.message.includes('no-auth-event')) {
          console.log('No pending redirect result - this is normal');
          return;
        }

        // Browser-specific error handling
        if (browserInfo.isOpera && browserInfo.isMobile) {
          console.log('Opera PWA redirect error - may need page refresh');
        } else if (browserInfo.isChrome && browserInfo.isMobile) {
          console.log('Chrome PWA redirect error - trying alternative approach');
        }

        // Only show error after multiple attempts
        if (redirectAttempts >= 2) {
          setError(`Authentication issue: ${err.message}. Try refreshing the page.`);
        }
      }
    }
  }, [auth, redirectAttempts]);

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

  // Enhanced browser detection helper
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isOpera = userAgent.includes('opr/') || userAgent.includes('opera');
    const isChrome = userAgent.includes('chrome') && !isOpera && !userAgent.includes('edg/');
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    // More specific PWA detection
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = isStandalone || (isMobile && (window.navigator as any).standalone === true);

    return {
      isOpera,
      isChrome,
      isMobile,
      isIOS,
      isAndroid,
      isStandalone,
      isInstalled,
      userAgent: navigator.userAgent
    };
  };

  const signInWithGoogle = async () => {
    console.log('=== GOOGLE SIGN-IN START ===');
    console.log('signInWithGoogle called');
    console.log('auth available:', !!auth);
    console.log('isPWA:', isPWA);

    const browserInfo = getBrowserInfo();
    console.log('Browser info:', browserInfo);

    if (!auth) {
      const errorMsg = 'Firebase authentication is not configured. Please set up your Firebase environment variables.';
      console.error('Auth not available:', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      setError(null);
      console.log('Creating GoogleAuthProvider...');
      const provider = new GoogleAuthProvider();

      // Determine authentication method based on browser and PWA status
      const isActualPWA = browserInfo.isInstalled || isPWA;
      console.log('isActualPWA:', isActualPWA);

      if (isActualPWA && browserInfo.isOpera && browserInfo.isMobile) {
        // Opera PWA: Use redirect with optimized settings
        console.log('Opera PWA detected - using redirect with optimized settings...');
        provider.setCustomParameters({
          prompt: 'select_account',
          redirect_uri: window.location.origin
        });
        await signInWithRedirect(auth, provider);
        console.log('Opera PWA redirect initiated - will complete on page reload');

      } else if (isActualPWA && browserInfo.isChrome && browserInfo.isMobile) {
        // Chrome PWA: Use redirect with enhanced result handling
        console.log('Chrome PWA detected - using redirect with enhanced handling...');
        await signInWithRedirect(auth, provider);
        console.log('Chrome PWA redirect initiated - will complete on page reload');

      } else if (isActualPWA) {
        // Other PWA browsers: Try popup first, fallback to redirect
        console.log('Other PWA detected - trying popup first...');
        try {
          const result = await signInWithPopup(auth, provider);
          console.log('PWA popup successful, user:', result.user?.email);
          setSuccessMessage('Successfully signed in with Google!');
          return;
        } catch (popupError) {
          console.log('PWA popup failed, using redirect...', popupError);
          await signInWithRedirect(auth, provider);
          console.log('PWA redirect initiated after popup failure');
        }

      } else {
        // Regular web mode: Use popup
        console.log('Regular web mode - using signInWithPopup...');
        const result = await signInWithPopup(auth, provider);
        console.log('Regular popup successful, user:', result.user?.email);
        setSuccessMessage('Successfully signed in with Google!');
      }

    } catch (err) {
      console.error('=== GOOGLE SIGN-IN ERROR ===');
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

  // Expose debug methods to window for troubleshooting
  useEffect(() => {
    (window as any).clearSyncQueue = clearSyncQueue;
    (window as any).debugAuth = {
      getBrowserInfo: () => {
        const browserInfo = getBrowserInfo();
        return {
          ...browserInfo,
          redirectAttempts,
          currentUser: user?.email || 'none',
          isPWA,
          authConfigured: !!auth
        };
      },
      retryRedirect: () => {
        console.log('Manual redirect retry requested');
        setRedirectAttempts(0);
        setError(null);
        if (isPWA && auth) {
          handleRedirectResult();
        }
      },
      checkAuthState: () => {
        console.log('Current auth state:', {
          user: user?.email || 'none',
          loading,
          error,
          successMessage,
          redirectAttempts,
          isPWA
        });
      }
    };
  }, [redirectAttempts, user, isPWA, auth, loading, error, successMessage]);

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