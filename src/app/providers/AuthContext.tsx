/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
import { auth } from '@shared/services/firebase';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import { encryptionService } from '@shared/services/encryptionService';
import { usePWA } from './PWAContext';
import { mapFirebaseError } from '@shared/utils/firebaseErrorMessages';
import { clearUserState } from '@shared/utils/userStateCleared';
import { secureLogoutWithCleanup } from '@shared/utils/clearUserContext';
import { SyncStatusProvider, useSyncStatusContext } from './SyncStatusContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  successMessage: string | null;
  error: string | null;
  encryptionReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: () => void;
  clearSuccessMessage: () => void;
  clearSyncQueue: () => boolean;
  isFirebaseConfigured: boolean;
  userDataReady: boolean; // New flag to indicate when user-specific data is ready
  authStateChanged: boolean; // New flag for immediate auth state change notifications
  lastSyncTime: Date | null;
  syncQueueLength: number;
  isSyncing: boolean;
  isOnline: boolean;
  isFirebaseReachable: boolean | null;
  refreshSyncStatus: () => void;
  markSyncComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type DebugChromePWA = {
  checkDetection: () => {
    isPWA: boolean;
    isChrome: boolean;
    isAndroid: boolean;
    isMobile: boolean;
    userAgent: string;
    currentUser: string;
  };
  testRedirect: () => Promise<void>;
  forceRetry: () => void;
};

type ExtendedWindow = Window & {
  lastAuthTime?: number;
  clearSyncQueue?: () => boolean;
  debugChromePWA?: DebugChromePWA;
};

const getExtendedWindow = (): ExtendedWindow | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  return window as ExtendedWindow;
};

const stampLastAuthTime = (): void => {
  const extendedWindow = getExtendedWindow();
  if (extendedWindow) {
    extendedWindow.lastAuthTime = Date.now();
  }
};

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // QA-friendly timeout; production uses 60 minutes
const LAST_ACTIVITY_STORAGE_KEY = 'lastUserActivityAt';
const LAST_ACTIVITY_USER_KEY = 'lastUserActivityUid';

const readLastActivity = (currentUserId?: string | null): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    if (!raw) {
      return 0;
    }

    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp)) {
      return 0;
    }

    if (!currentUserId) {
      return timestamp;
    }

    const storedUid = localStorage.getItem(LAST_ACTIVITY_USER_KEY);
    return storedUid && storedUid === currentUserId ? timestamp : 0;
  } catch (error) {
    console.warn('Failed to read last activity timestamp:', error);
    return 0;
  }
};

const writeLastActivity = (currentUserId?: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
    if (currentUserId) {
      localStorage.setItem(LAST_ACTIVITY_USER_KEY, currentUserId);
    } else {
      localStorage.removeItem(LAST_ACTIVITY_USER_KEY);
    }
  } catch (error) {
    console.warn('Failed to record last activity timestamp:', error);
  }
};

const tagLastActivityUser = (currentUserId?: string | null): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (currentUserId) {
      localStorage.setItem(LAST_ACTIVITY_USER_KEY, currentUserId);
    } else {
      localStorage.removeItem(LAST_ACTIVITY_USER_KEY);
    }
  } catch (error) {
    console.warn('Failed to tag last activity user:', error);
  }
};

const clearLastActivity = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVITY_USER_KEY);
  } catch (error) {
    console.warn('Failed to clear last activity timestamp:', error);
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type AuthContextBaseValue = Omit<
  AuthContextType,
  'lastSyncTime' | 'syncQueueLength' | 'isSyncing' | 'isOnline' | 'isFirebaseReachable' | 'refreshSyncStatus' | 'markSyncComplete'
>;

const AuthContextComposer: React.FC<{ baseValue: AuthContextBaseValue; children: React.ReactNode }> = ({
  baseValue,
  children
}) => {
  const {
    lastSyncTime,
    syncQueueLength,
    isSyncing,
    isOnline,
    isFirebaseReachable,
    refreshStatus,
    markSyncComplete
  } = useSyncStatusContext();

  const contextValue = useMemo<AuthContextType>(() => ({
    ...baseValue,
    lastSyncTime,
    syncQueueLength,
    isSyncing,
    isOnline,
    isFirebaseReachable,
    refreshSyncStatus: refreshStatus,
    markSyncComplete
  }), [
    baseValue,
    lastSyncTime,
    syncQueueLength,
    isSyncing,
    isOnline,
    isFirebaseReachable,
    refreshStatus,
    markSyncComplete
  ]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [userDataReady, setUserDataReady] = useState(false);
  const [authStateChanged, setAuthStateChanged] = useState(false);
  const { isPWA } = usePWA();
  const migrationStartedRef = useRef(false);
  const previousUserRef = useRef<User | null>(null);
  const backgroundOpsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutBackgroundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectHandlerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAutoLogoutRef = useRef(false);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (newUser) => {
      const prevUser = previousUserRef.current;

      // Update user state IMMEDIATELY for responsive UI
      console.log('Auth state changed - user:', newUser?.uid || 'null', 'email:', newUser?.email || 'none');

      // Check if auth state actually changed (including the first time user becomes available)
      const authStateActuallyChanged = prevUser?.uid !== newUser?.uid;
      
      if (authStateActuallyChanged) {
        console.log('🔄 Auth state actually changed, triggering immediate notifications');
        setAuthStateChanged(true);
        try {
          if (newUser?.uid) {
            localStorage.setItem('lastActiveUser', newUser.uid);
          } else {
            localStorage.setItem('lastActiveUser', 'guest');
          }
        } catch (storageError) {
          console.warn('Failed to update lastActiveUser key:', storageError);
        }
        
        // Emit immediate auth state change event for instant UI updates
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: {
            fromUser: prevUser?.uid || null,
            toUser: newUser?.uid || null,
            isLogin: newUser && !prevUser,
            isLogout: !newUser && !!prevUser,
            timestamp: Date.now(),
            user: newUser,
            previousUser: prevUser
          }
        }));
        
        // Reset auth state change flag after a short delay to allow components to respond
        setTimeout(() => setAuthStateChanged(false), 100);
      }

      // Clear any unintended modal state that might be preserved during PWA redirect
      if (newUser && !prevUser) {
        console.log('🧹 Clearing potentially preserved modal state after login');

        // Clear URL hash if it contains modal state
        if (window.location.hash && window.location.hash.includes('modal')) {
          console.log('Clearing modal-related URL hash:', window.location.hash);
          window.history.replaceState(null, '', window.location.pathname);
        }

        // Clear any localStorage values that might trigger modals
        const modalKeys = ['pendingModal', 'intendedModal', 'settingsModalOpen'];
        modalKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            console.log('Clearing localStorage modal key:', key);
            localStorage.removeItem(key);
          }
        });
      }

      setUser(newUser);
      setLoading(false);

      // Handle data operations asynchronously WITHOUT blocking UI
      if (newUser && !prevUser) {
        // User is logging in - handle data operations in background
        console.log('User logging in, handling data operations in background...');
        tagLastActivityUser(newUser.uid);
        setUserDataReady(false); // Reset userDataReady for new login

        // Define background login operations
        const runLoginBackgroundOps = async () => {
          try {
            console.log('Background: Switching to user context...');
            await firebaseDataService.switchToUser(newUser.uid);

            // Initialize encryption key for the user
            if (newUser.email) {
              const isTestEnv = typeof import.meta !== 'undefined' && (import.meta as any).env?.TEST;
              try {
                if (isTestEnv) {
                  await encryptionService.setDeterministicKey(newUser.uid, newUser.email);
                  setEncryptionReady(true);
                  void firebaseDataService.rehydrateCachedData();
                } else {
                  // Ensure per-user salt is synced across devices before deriving key
                  const { ensureUserSalt } = await import('@shared/services/userSaltService');
                  await ensureUserSalt(newUser.uid);
                  await encryptionService.setDeterministicKey(newUser.uid, newUser.email);
                  console.log('Background: Encryption key initialized for user');
                  setEncryptionReady(true);
                  void firebaseDataService.rehydrateCachedData();
                }

                // Start background encryption migration immediately after key is ready
                if (encryptionService.isReady() && !migrationStartedRef.current) {
                  console.log('Background: Starting background encryption migration...');
                  migrationStartedRef.current = true;
                  try {
                    await firebaseDataService.startBackgroundEncryptionMigration();
                    console.log('Background: Encryption migration started successfully');
                  } catch (migrationError) {
                    console.error('Background: Failed to start encryption migration:', migrationError);
                    // Don't block login flow, migration is non-critical
                  }
                }
              } catch (encryptionError) {
                console.error('Background: Failed to initialize encryption key:', encryptionError);
                // Don't block login flow, but surface the error
                if (encryptionError instanceof Error && encryptionError.message.includes('VITE_KEY_PEPPER')) {
                  console.warn('VITE_KEY_PEPPER environment variable is missing or empty');
                }
              }
            }

            // For Chrome PWA, minimize background operations for faster UI response
            const isChromePWA = navigator.userAgent.includes('Chrome') &&
                               !navigator.userAgent.includes('OPR/') &&
                               window.matchMedia('(display-mode: standalone)').matches;

            if (isChromePWA) {
              console.log('Chrome PWA detected - minimizing background operations for faster UI...');
              // Only do essential operations for Chrome PWA
              try {
                await firebaseDataService.mergeLocalDataForUser();
              } catch (mergeError) {
                console.warn('Chrome PWA merge failed, continuing anyway:', mergeError);
              }
            } else {
              // Full data operations for other browsers
              console.log('Background: Merging local guest data to Firebase...');
              await firebaseDataService.mergeLocalDataForUser();

              console.log('Background: Clearing local data to prevent duplicates...');
              await firebaseDataService.clearAllData();
            }

            console.log('Background: Login data operations completed');
            
            // Set userDataReady to true and emit calendar refresh signal
            setUserDataReady(true);
            console.log('Background: User data ready - emitting calendar refresh signal');
            window.dispatchEvent(new CustomEvent('userDataReady', { detail: { userId: newUser.uid, timestamp: Date.now(), source: 'AuthContext', isGuest: false } }));
          } catch (error) {
            console.error('Background data operations error:', error);
            // Still set userDataReady to allow UI to function, albeit with limited data
            setUserDataReady(true);
            window.dispatchEvent(new CustomEvent('userDataReady', { detail: { userId: newUser.uid, error, timestamp: Date.now(), source: 'AuthContext', isGuest: false } }));
          }
        };

        const isTestEnv = typeof import.meta !== 'undefined' && (import.meta as any).env?.TEST;
        if (isTestEnv) {
          // Run immediately in tests to avoid timer flakiness and cross-test leaks
          runLoginBackgroundOps();
        } else {
          // Use setTimeout to avoid blocking the UI update
          if (backgroundOpsTimeoutRef.current) {
            clearTimeout(backgroundOpsTimeoutRef.current);
          }
          backgroundOpsTimeoutRef.current = setTimeout(() => {
            runLoginBackgroundOps();
          }, 50); // Even smaller delay for faster response
        }

      } else if (!newUser && prevUser) {
        // User is logging out
        console.log('User logging out, switching to guest mode...');
        // Clear encryption key when logging out
        encryptionService.clear();
        setEncryptionReady(false);
        setUserDataReady(false); // Reset userDataReady on logout
        // Reset migration flag
        migrationStartedRef.current = false;
        // Don't clear local data - keep it visible for better UX
        if (logoutBackgroundTimeoutRef.current) {
          clearTimeout(logoutBackgroundTimeoutRef.current);
        }
        logoutBackgroundTimeoutRef.current = setTimeout(async () => {
          try {
            await firebaseDataService.initialize(); // Re-initialize in guest mode.
            console.log('Background: Switched to guest mode - local data remains visible');
            
            // Set userDataReady to true for guest mode and emit refresh
            setUserDataReady(true);
            try {
              localStorage.setItem('lastActiveUser', 'guest');
            } catch (storageError) {
              console.warn('Failed to update lastActiveUser key on logout:', storageError);
            }
            window.dispatchEvent(new CustomEvent('userDataReady', { detail: { userId: null, isGuest: true, timestamp: Date.now(), source: 'AuthContext' } }));
          } catch (error) {
            console.error('Background logout data operations error:', error);
            // Still set userDataReady to allow UI to function
            setUserDataReady(true);
            window.dispatchEvent(new CustomEvent('userDataReady', { detail: { userId: null, isGuest: true, error, timestamp: Date.now(), source: 'AuthContext' } }));
          }
        }, 100);
      }

      // Update previous user reference at the end
      previousUserRef.current = newUser;
    });

    // Optimized redirect result handling for mobile PWAs
    const handleRedirectResult = async () => {
      const browserInfo = {
        isChrome: navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('OPR/'),
        isAndroid: /Android/i.test(navigator.userAgent),
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      };

      console.log('=== FAST REDIRECT RESULT HANDLER ===');
      console.log('Browser info:', browserInfo);

      try {
        console.log('Quick check for redirect result...');
        const result = await getRedirectResult(auth);

        if (result && result.user) {
          console.log('✅ Fast redirect result successful for user:', result.user.email);
          setSuccessMessage('Successfully signed in with Google!');
          return; // Exit early on success
        } else {
          console.log('❓ No redirect result found');
        }
      } catch (err) {
        console.error('❌ getRedirectResult error:', err);

        // For Chrome Android PWA, only retry once quickly
        if (browserInfo.isChrome && browserInfo.isAndroid && isPWA) {
          if (err instanceof Error && err.message.includes('no-auth-event')) {
            console.log('Chrome PWA no-auth-event - single quick retry...');
            setTimeout(async () => {
              try {
                const retryResult = await getRedirectResult(auth);
                if (retryResult && retryResult.user) {
                  console.log('✅ Chrome PWA retry successful:', retryResult.user.email);
                  setSuccessMessage('Successfully signed in with Google!');
                }
              } catch (retryError) {
                console.log('❌ Chrome PWA retry failed:', retryError);
              }
            }, 500); // Quick 500ms retry for Chrome PWA
            return;
          }
        }

        // Only show error for actual failures
        if (err instanceof Error && !err.message.includes('no-auth-event')) {
          const errorMessage = err.message || 'Google sign-in failed';
          setError(errorMessage);
        }
      }
    };

    // Handle redirect result for PWA (immediate for faster UI response)
    if (isPWA) {
      // Use setTimeout to avoid blocking initial auth state change
      if (redirectHandlerTimeoutRef.current) {
        clearTimeout(redirectHandlerTimeoutRef.current);
      }
      redirectHandlerTimeoutRef.current = setTimeout(() => handleRedirectResult(), 50);
    }

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      if (backgroundOpsTimeoutRef.current) {
        clearTimeout(backgroundOpsTimeoutRef.current);
        backgroundOpsTimeoutRef.current = null;
      }
      if (logoutBackgroundTimeoutRef.current) {
        clearTimeout(logoutBackgroundTimeoutRef.current);
        logoutBackgroundTimeoutRef.current = null;
      }
      if (redirectHandlerTimeoutRef.current) {
        clearTimeout(redirectHandlerTimeoutRef.current);
        redirectHandlerTimeoutRef.current = null;
      }
    };
    }, [isPWA]);

  const login = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not configured. Please set up your Firebase environment variables.');
    }
    try {
      setError(null);
      stampLastAuthTime();
      await signInWithEmailAndPassword(auth, email, password);
      setSuccessMessage('Successfully signed in!');
    } catch (err) {
      const friendly = mapFirebaseError(err, 'login');
      setError(friendly);
      throw new Error(friendly);
    }
  };

  const register = async (email: string, password: string) => {
    if (!auth) {
      throw new Error('Firebase authentication is not configured. Please set up your Firebase environment variables.');
    }
    try {
      setError(null);
      stampLastAuthTime();
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccessMessage('Account created successfully!');
    } catch (err) {
      const friendly = mapFirebaseError(err, 'register');
      setError(friendly);
      throw new Error(friendly);
    }
  };

  const signInWithGoogle = async () => {
    console.log('=== AGGRESSIVE MODAL LOCK ENGAGED ===');
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

      // Set authentication start timestamp for modal monitoring
      stampLastAuthTime();

      // ELEGANT: Clean modal state before authentication
      console.log('🧹 Cleaning modal state before authentication');
      if (typeof window !== 'undefined') {
        // Clear URL hash if it contains modal state
        if (window.location.hash && window.location.hash.includes('settings')) {
          console.log('Clearing settings-related URL hash');
          window.history.replaceState(null, '', window.location.pathname);
        }

        // Clear specific modal trigger keys (less aggressive)
        const specificModalKeys = ['pendingModal', 'intendedModal', 'settingsModalOpen'];
        specificModalKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            console.log('Clearing specific modal key:', key);
            localStorage.removeItem(key);
          }
        });
      }

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

      // ELEGANT: Final cleanup after authentication
      setTimeout(() => {
        console.log('🧹 Final modal state cleanup after authentication');
        if (typeof window !== 'undefined') {
          // Ensure URL is clean
          if (window.location.hash && window.location.hash.includes('settings')) {
            console.log('Final cleanup: clearing settings URL hash');
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
        stampLastAuthTime();
      }, 100);

    } catch (err) {
      console.error('signInWithGoogle error:', err);
      const friendly = mapFirebaseError(err, 'google');
      setError(friendly);
      throw new Error(friendly);
    }
  };

  const logout = async () => {
    console.log('Logout called, auth available:', !!auth);

    try {
      setError(null);

      // Use the enhanced comprehensive logout with listener cleanup
      console.log('Using enhanced secure logout with comprehensive cleanup...');
      await secureLogoutWithCleanup();
      clearLastActivity();
      setSuccessMessage('Signed out successfully');

    } catch (err) {
      console.error('Enhanced logout failed, falling back to basic logout:', err);
      
      // Fallback to basic logout if enhanced fails
      try {
        setError(null);

        // Call basic Firebase signOut
        if (auth) {
          console.log('Calling Firebase signOut...');
          await signOut(auth);
          console.log('Firebase signOut successful');
        }

        // Clear all local data (no backup needed - cloud is source of truth)
        await clearUserState();
        clearLastActivity();

        setSuccessMessage('Signed out successfully');
      } catch (fallbackError) {
        console.error('Even basic logout failed:', fallbackError);
        const friendly = mapFirebaseError(fallbackError, 'generic');
        setError(friendly);
        
        // Last resort - just clear local state
        setUser(null);
        setError(null);
        setSuccessMessage('Force logged out locally');
        clearLastActivity();
      }
    }
  };

  // Alternative logout method that always works (for debugging)
  const forceLogout = () => {
    console.log('Force logout called - clearing all user state');

    // Clear encryption key
    encryptionService.clear();
    setEncryptionReady(false);
    
    // Clear sync queue
    try {
      firebaseDataService.clearSyncQueue();
      console.log('Sync queue cleared during force logout');
      // Dispatch custom event to notify sync status hook
      window.dispatchEvent(new CustomEvent('syncQueueCleared'));
    } catch (syncError) {
      console.warn('Failed to clear sync queue during force logout:', syncError);
    }

    // Use comprehensive state clearing
    clearUserState().then(() => {
      console.log('Force logout state cleanup completed');
    }).catch(err => {
      console.warn('Force logout state cleanup failed:', err);
    });

    setUser(null);
    setError(null);
    setSuccessMessage('Force logout completed');
    clearLastActivity();
  };

  const clearSuccessMessage = () => {
    setSuccessMessage(null);
  };

  const isFirebaseConfigured = auth !== null;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!user) {
      return;
    }

    const currentUserId = user.uid;
    tagLastActivityUser(currentUserId);

    const refreshActivity = () => {
      writeLastActivity(currentUserId);
    };

    const checkAndMaybeLogout = async (refreshTimestampAfterCheck = false) => {
      if (pendingAutoLogoutRef.current) {
        return;
      }

      const lastActivity = readLastActivity(currentUserId);

      if (lastActivity && Number.isFinite(lastActivity)) {
        const inactiveFor = Date.now() - lastActivity;
        if (inactiveFor >= INACTIVITY_TIMEOUT_MS) {
          pendingAutoLogoutRef.current = true;
          try {
            await logout();
          } finally {
            pendingAutoLogoutRef.current = false;
          }
          return;
        }
      }

      if (refreshTimestampAfterCheck) {
        if (lastActivity) {
          refreshActivity();
        } else {
          tagLastActivityUser(currentUserId);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void checkAndMaybeLogout(true);
      }
    };

    const handleFocus = () => {
      void checkAndMaybeLogout(true);
    };

    const visibilityTarget = typeof document !== 'undefined' ? document : null;
    const touchOptions: AddEventListenerOptions = { passive: true };

    void checkAndMaybeLogout(false);

    window.addEventListener('mousemove', refreshActivity);
    window.addEventListener('keydown', refreshActivity);
    window.addEventListener('touchstart', refreshActivity, touchOptions);
    window.addEventListener('focus', handleFocus);
    visibilityTarget?.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('mousemove', refreshActivity);
      window.removeEventListener('keydown', refreshActivity);
      window.removeEventListener('touchstart', refreshActivity, touchOptions);
      window.removeEventListener('focus', handleFocus);
      visibilityTarget?.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, logout]);

  // Debug method to clear sync queue (exposed to window for debugging)
  const clearSyncQueue = useCallback(() => {
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
  }, []);

  // Expose debug methods to window for Chrome PWA troubleshooting
  useEffect(() => {
    const extendedWindow = getExtendedWindow();
    if (!extendedWindow) {
      return;
    }

    extendedWindow.clearSyncQueue = clearSyncQueue;
    extendedWindow.debugChromePWA = {
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

    return () => {
      const cleanupWindow = getExtendedWindow();
      if (cleanupWindow) {
        delete cleanupWindow.clearSyncQueue;
        delete cleanupWindow.debugChromePWA;
      }
    };
  }, [user, isPWA, clearSyncQueue]);

  const baseValue: AuthContextBaseValue = {
    user,
    loading,
    successMessage,
    error,
    encryptionReady,
    userDataReady,
    authStateChanged,
    login,
    register,
    signInWithGoogle,
    logout,
    forceLogout,
    clearSuccessMessage,
    clearSyncQueue,
    isFirebaseConfigured,
  };

  return (
    <SyncStatusProvider userId={user?.uid ?? null}>
      <AuthContextComposer baseValue={baseValue}>
        {children}
      </AuthContextComposer>
    </SyncStatusProvider>
  );
};

// Export the context for testing purposes
export { AuthContext };
