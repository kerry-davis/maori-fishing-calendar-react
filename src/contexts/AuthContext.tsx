import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
import { auth, authInitPromise } from '../services/firebase';
import { shouldUseRedirect } from '../services/authHelpers';
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
  const [isProcessingRedirect, setIsProcessingRedirect] = useState(true);
  const { isPWA } = usePWA();
  const previousUserRef = useRef<User | null>(null);

  // Effect 1: Ensure Firebase Auth persistence is initialized before anything else
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!auth) {
        setIsProcessingRedirect(false);
        setLoading(false);
        return;
      }
      try {
        if (authInitPromise) {
          if (import.meta.env.DEV) console.log('Waiting for Firebase Auth persistence initialization...');
          await authInitPromise;
        }
      } catch (e) {
        console.warn('Auth persistence init failed or unavailable:', e);
      }
      if (cancelled) return;
      // After persistence is ready, process redirect result once
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          setSuccessMessage('Successfully signed in with Google!');
        }
      } catch (err) {
        console.error('getRedirectResult error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Google sign-in failed';
        setError(errorMessage);
      } finally {
        if (!cancelled) setIsProcessingRedirect(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  // Effect 2: Set up the auth state listener.
  // This waits for the redirect processing to finish before running.
  useEffect(() => {
    if (isProcessingRedirect || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (newUser) => {
      console.log('Auth state changed - user:', newUser?.uid || 'null', 'email:', newUser?.email || 'none');
      setUser(newUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [isProcessingRedirect]);

  // Effect 3: Handle data logic on user state change (login/logout).
  // This runs after the initial auth state has been determined.
  useEffect(() => {
    const newUser = user;
    const previousUser = previousUserRef.current;

    const handleDataLogic = async () => {
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
    };

    // Only run this logic after the initial auth state has been determined.
    if (!loading) {
      handleDataLogic();
    }

    // Update the ref for the next render cycle.
    previousUserRef.current = user;
  }, [user, loading]);

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

    if (!auth) {
      const errorMsg = 'Firebase authentication is not configured. Please set up your Firebase environment variables.';
      console.error('Auth not available:', errorMsg);
      throw new Error(errorMsg);
    }
    try {
      setError(null);
      console.log('Creating GoogleAuthProvider...');
      const provider = new GoogleAuthProvider();
      const shouldRedirect = shouldUseRedirect({
        userAgent: navigator.userAgent,
        isPWA,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      });

      if (authInitPromise) {
        try {
          await authInitPromise; // Ensure persistence before starting sign-in
        } catch {}
      }

      if (shouldRedirect) {
        console.log('Environment prefers redirect, using signInWithRedirect');
        await signInWithRedirect(auth, provider);
      } else {
        console.log('Attempting signInWithPopup');
        try {
          await signInWithPopup(auth, provider);
          console.log('signInWithPopup successful');
          setSuccessMessage('Successfully signed in with Google!');
        } catch (popupErr) {
          console.warn('signInWithPopup failed, evaluating fallback to redirect...', popupErr);
          // Fallback to redirect on non-iOS environments to keep flow working
          const ua = navigator.userAgent.toLowerCase();
          const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
          if (!isIOS) {
            console.log('Falling back to signInWithRedirect after popup failure');
            await signInWithRedirect(auth, provider);
          } else {
            throw popupErr; // Bubble up for iOS where redirect decision is handled earlier
          }
        }
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

  // Expose debug method to window
  useEffect(() => {
    (window as any).clearSyncQueue = clearSyncQueue;
  }, []);

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