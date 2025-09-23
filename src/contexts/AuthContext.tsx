import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { firebaseDataService } from '../services/firebaseDataService';

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

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
      console.log('Calling signInWithPopup...');
      await signInWithPopup(auth, provider);
      console.log('signInWithPopup successful');
      setSuccessMessage('Successfully signed in with Google!');
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