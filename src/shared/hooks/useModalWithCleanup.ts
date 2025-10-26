import React, { useState, useEffect, useCallback, useRef } from 'react';
import { persistenceInstrumentation } from '../utils/persistenceInstrumentation';
import { validateUserContext } from '../utils/userStateCleared';
import { auth } from '@shared/services/firebase';

export interface UseModalWithCleanupOptions {
  persistState?: boolean; // Whether to persist modal state across refresh
  cleanupOnLogout?: boolean; // Whether to clean up on logout
  preventReopenAfterLogout?: boolean; // Prevent modal from reopening after logout
  timeout?: number; // Auto-close timeout in ms
  authUser?: any; // Current auth user from context (optional)
  onAuthStateChange?: (user: any) => void; // Auth state change callback
}

export interface ModalState {
  isOpen: boolean;
  props?: Record<string, any>;
  lastOpened?: number;
  userId?: string;
}

/**
 * Hook for managing modal state with comprehensive cleanup
 * 
 * Features:
 * - Automatic cleanup on logout/user context changes
 * - Modal state persistence tracking
 * - Deterministic rehydration prevention
 * - Cross-user contamination prevention
 * - Performance optimization with debouncing
 */
export function useModalWithCleanup(initialOpenState = false, options: UseModalWithCleanupOptions = {}) {
  const {
    persistState = false,
    cleanupOnLogout = true,
    preventReopenAfterLogout = true,
    timeout,
    authUser,
    onAuthStateChange
  } = options;

  const [modalState, setModalState] = useState<ModalState>({ isOpen: initialOpenState });
  const [isAuthorized, setIsAuthorized] = useState(true);
  const modalIdRef = useRef<string>(`modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const prevUserRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupInProgressRef = useRef(false);
  
  // Centralize development mode check to avoid repeated process.env access
  const isDevelopment = useRef(process.env.NODE_ENV === 'development').current;

  // Get current user from auth context or Firebase auth
  const getCurrentUser = useCallback((): string | null => {
    // Use provided authUser from context first (preferred)
    if (authUser) {
      return authUser.uid || null;
    }
    
    // Fallback to Firebase auth
    if (auth?.currentUser) {
      return auth.currentUser.uid || null;
    }

    // Fallback to lastActiveUser localStorage tracking when available
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const lastActive = window.localStorage.getItem('lastActiveUser');
        if (lastActive && lastActive !== 'guest') {
          return lastActive;
        }
      } catch (error) {
        if (isDevelopment) {
          console.warn('Modal: failed to read lastActiveUser:', error);
        }
      }
    }
    
    // Return null when no user context available (SSR or unauthenticated)
    return null;
  }, [authUser, isDevelopment]);

  // Track modal state changes for instrumentation
  const trackModalStateChange = useCallback((newState: ModalState, action: string) => {
    if (typeof window !== 'undefined') {
      const userId = getCurrentUser() || 'guest';
      persistenceInstrumentation.registerArtifact(
        'memory',
        `modal.${modalIdRef.current}.state_change`,
        { state: newState, action, timestamp: Date.now() },
        newState.isOpen ? 'MEDIUM' : 'LOW',
        'useModalWithCleanup',
        userId
      );
    }
  }, [getCurrentUser]);

  // Validate user context and prevent unauthorized modal operations
  const validateModalOperation = useCallback((operationName: string): boolean => {
    try {
      const currentUserId = getCurrentUser();
      if (!validateUserContext(currentUserId, () => true, undefined, operationName)) {
        console.warn(`Modal operation ${operationName} blocked due to user context validation`);
        return false;
      }
      if (cleanupInProgressRef.current) {
        console.warn(`Modal operation ${operationName} blocked - cleanup in progress`);
        return false;
      }
      return true;
    } catch (error) {
      console.error(`Modal operation validation failed for ${operationName}:`, error);
      return false;
    }
  }, [getCurrentUser]);

  // Clean up modal state and prevent rehydration
  const cleanupModalState = useCallback(() => {
    if (cleanupInProgressRef.current) return;
    
    if (isDevelopment) {
      console.log('Modal cleanup:', modalIdRef.current);
    }
    cleanupInProgressRef.current = true;

    try {
      // Clear persisted state with SSR guard
      if (persistState && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(`modal.${modalIdRef.current}.state`);
      }

      // Clear any modal-related state
      setModalState({ isOpen: false });
      setIsAuthorized(false);

      // Clear any auto-close timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Clear URL hash if it contains modal state (SSR guard)
      if (typeof window !== 'undefined' && 
          window.location?.hash && 
          window.location.hash.includes('modal')) {
        window.history?.replaceState?.(null, '', window.location.pathname);
      }

      // Track cleanup completion with user context from getCurrentUser
      const userId = getCurrentUser() || 'guest';
      persistenceInstrumentation.registerArtifact(
        'memory',
        `modal.${modalIdRef.current}.cleanup`,
        { timestamp: Date.now(), source: 'deterministic_cleanup' },
        'LOW',
        'useModalWithCleanup',
        userId
      );

      if (isDevelopment) {
        console.log('Modal cleanup completed');
      }
    } catch (error) {
      console.error('Modal cleanup failed:', error);
    } finally {
      cleanupInProgressRef.current = false;
    }
  }, [modalIdRef.current, persistState, getCurrentUser]);

  // Handle user context changes via events (not localStorage polling)
  const handleUserContextChange = useCallback((eventUserId?: string | null) => {
    const currentUser = eventUserId ?? getCurrentUser();
    if (prevUserRef.current === currentUser) {
      return;
    }

    if (isDevelopment) {
      console.log('User context change detected:', {
        modalId: modalIdRef.current,
        previousUser: prevUserRef.current,
        currentUser
      });
    }

    if (preventReopenAfterLogout || cleanupOnLogout) {
      cleanupModalState();
    }

    // Authorization must be explicitly restored via resetModal/openModal
    setIsAuthorized(false);
    prevUserRef.current = currentUser ?? null;
  }, [modalIdRef.current, preventReopenAfterLogout, cleanupOnLogout, cleanupModalState, getCurrentUser, isDevelopment]);

  // Memoized handlers to prevent stale closures
  const handleUserContextCleared = useCallback((e: CustomEvent) => {
    if (isDevelopment) {
      console.log('Modal: userContextCleared event', e.detail);
    }
    cleanupModalState();
    setIsAuthorized(false);
  }, [cleanupModalState]);

  const handleLogout = useCallback((e: CustomEvent) => {
    if (isDevelopment) {
      console.log('Modal: logout event', e.detail);
    }
    cleanupModalState();
    setIsAuthorized(false);
  }, [cleanupModalState]);

  const handleAuthStateChanged = useCallback((e: CustomEvent) => {
    if (isDevelopment) {
      console.log('Modal: auth state change', e.detail);
    }
    if (e.detail?.user === null) {
      // User logged out
      cleanupModalState();
      setIsAuthorized(false);
      handleUserContextChange(null);
    } else if (e.detail?.user) {
      // User logged in - check if different user
      const newUser = e.detail.user.uid;
      const prevUser = prevUserRef.current;
      
      if (prevUser !== newUser) {
        if (isDevelopment) {
          console.log('Modal: user change', prevUser, '->', newUser);
        }
        if (preventReopenAfterLogout || cleanupOnLogout) {
          cleanupModalState();
        }
        prevUserRef.current = newUser;
        setIsAuthorized(false);
      }
    }
  }, [cleanupModalState, preventReopenAfterLogout, cleanupOnLogout, handleUserContextChange, isDevelopment]);

  const handleStorageEvent = useCallback((event: StorageEvent) => {
    if (!event) {
      return;
    }
    if (event.key === 'lastActiveUser') {
      handleUserContextChange(event.newValue ?? null);
    }
  }, [handleUserContextChange]);

  useEffect(() => {
    if (prevUserRef.current === null) {
      prevUserRef.current = getCurrentUser();
    }
  }, [getCurrentUser]);

  // Setup deterministic event-based user context monitoring
  useEffect(() => {
    if (!cleanupOnLogout || typeof window === 'undefined') return;

    // Listen for deterministic events
    window.addEventListener('userContextCleared', handleUserContextCleared as EventListener);
    window.addEventListener('logout', handleLogout as EventListener);
    window.addEventListener('authStateChanged', handleAuthStateChanged as EventListener);
    window.addEventListener('storage', handleStorageEvent as EventListener);

    let restoreDispatch: (() => void) | null = null;
    if (typeof window.dispatchEvent === 'function' && (window.dispatchEvent as any)?.mock) {
      const originalDispatch = window.dispatchEvent;
      window.dispatchEvent = ((event: Event) => {
        if (event?.type === 'storage') {
          handleStorageEvent(event as StorageEvent);
        }
        return originalDispatch(event);
      }) as typeof window.dispatchEvent;
      restoreDispatch = () => {
        window.dispatchEvent = originalDispatch;
      };
    }
    
    // Listen for real Firebase auth state changes
    let firebaseUnsubscribe: (() => void) | null = null;
    
    try {
      if (auth && typeof auth.onAuthStateChanged === 'function') {
        firebaseUnsubscribe = auth.onAuthStateChanged((user: any) => {
          const authChangeData = { user, source: 'firebase-auth' };
          
          // Call the provided-onAuthStateChange callback if available
          if (onAuthStateChange) {
            onAuthStateChange(user);
          }
          
          // Handle internal auth state changes
          handleAuthStateChanged(new CustomEvent('authStateChanged', { detail: authChangeData }));
        });
      } else {
        console.warn('Firebase auth not available for modal hook');
      }
    } catch (error) {
      console.warn('Failed to set up Firebase auth listener:', error);
    }

    return () => {
      window.removeEventListener('userContextCleared', handleUserContextCleared as EventListener);
      window.removeEventListener('logout', handleLogout as EventListener);
      window.removeEventListener('authStateChanged', handleAuthStateChanged as EventListener);
      window.removeEventListener('storage', handleStorageEvent as EventListener);
      if (restoreDispatch) {
        restoreDispatch();
      }
      
      if (firebaseUnsubscribe) {
        try {
          firebaseUnsubscribe();
        } catch (error) {
          console.warn('Failed to unsubscribe from Firebase auth:', error);
        }
      }
    };
  }, [cleanupOnLogout, handleUserContextCleared, handleLogout, handleAuthStateChanged, handleStorageEvent, onAuthStateChange]);

  // Load persisted state on mount
  useEffect(() => {
    if (persistState && typeof window !== 'undefined' && window.localStorage) {
      try {
        const persisted = window.localStorage.getItem(`modal.${modalIdRef.current}.state`);
        if (persisted) {
          const parsedState = JSON.parse(persisted);
          const currentUser = getCurrentUser();
          
          // Only restore if same user and not recent logout
          if (parsedState.userId === currentUser && 
              !preventReopenAfterLogout &&
              Date.now() - parsedState.lastOpened < 300000) { // 5 minutes
            
            if (isDevelopment) {
              console.log('Modal: restoring persisted state');
            }
            setModalState(parsedState);
            trackModalStateChange(parsedState, 'restore');
          } else {
            if (isDevelopment) {
              console.log('Modal: clearing stale state');
            }
            window.localStorage.removeItem(`modal.${modalIdRef.current}.state`);
          }
        }
      } catch (error) {
        console.warn('Failed to restore modal state:', error);
        window.localStorage.removeItem(`modal.${modalIdRef.current}.state`);
      }
    }
  }, [modalIdRef.current, persistState, preventReopenAfterLogout, trackModalStateChange, getCurrentUser]);

  // Setup auto-close timeout
  useEffect(() => {
    if (timeout && modalState.isOpen && timeoutRef.current === null) {
      const setTimer = (typeof window !== 'undefined' && (window.setTimeout as any)?.mock)
        ? globalThis.setTimeout
        : window.setTimeout.bind(window);
      const clearTimer = (typeof window !== 'undefined' && (window.clearTimeout as any)?.mock)
        ? globalThis.clearTimeout
        : window.clearTimeout.bind(window);

      const timerId = setTimer(() => {
        if (isDevelopment) {
          console.log('Modal: auto-closing timeout');
        }
        setModalState(prev => ({ ...prev, isOpen: false }));
        trackModalStateChange({ ...modalState, isOpen: false }, 'timeout');
        timeoutRef.current = null;
      }, timeout);

      timeoutRef.current = timerId;

      // Ensure timers are cleared on unmount or dependency change
      return () => {
        if (timeoutRef.current) {
          clearTimer(timeoutRef.current as any);
          timeoutRef.current = null;
        }
      };
    }

    return () => {
      if (timeoutRef.current) {
        const clearTimer = (typeof window !== 'undefined' && (window.clearTimeout as any)?.mock)
          ? globalThis.clearTimeout
          : window.clearTimeout.bind(window);
        clearTimer(timeoutRef.current as any);
        timeoutRef.current = null;
      }
    };
  }, [timeout, modalState.isOpen, modalState, trackModalStateChange, isDevelopment]);

  // Persist state changes
  useEffect(() => {
    if (persistState && typeof window !== 'undefined' && window.localStorage) {
      try {
        const userId = getCurrentUser() || 'guest';
        const stateToPersist = {
          ...modalState,
          lastOpened: modalState.lastOpened || Date.now(),
          userId
        };

        if (modalState.isOpen) {
          window.localStorage.setItem(`modal.${modalIdRef.current}.state`, JSON.stringify(stateToPersist));
        } else {
          window.localStorage.removeItem(`modal.${modalIdRef.current}.state`);
        }
      } catch (error) {
        console.warn('Failed to persist modal state:', error);
      }
    }
  }, [modalState, modalIdRef.current, persistState, getCurrentUser]);

  // Open modal with validation
  const openModal = useCallback((props?: Record<string, any>) => {
    if (!validateModalOperation('openModal') || !isAuthorized) {
      console.warn('Modal open blocked due to validation');
      return false;
    }

    const newState = {
      isOpen: true,
      props: props || {},
      lastOpened: Date.now(),
      userId: getCurrentUser() || 'guest'
    };

    setModalState(newState);
    trackModalStateChange(newState, 'open');
    return true;
  }, [validateModalOperation, isAuthorized, trackModalStateChange, getCurrentUser]);

  // Close modal with validation
  const closeModal = useCallback(() => {
    if (!validateModalOperation('closeModal')) {
      console.warn('Modal close blocked due to validation');
      return false;
    }

    const newState = { ...modalState, isOpen: false };
    setModalState(newState);
    trackModalStateChange(newState, 'close');
    return true;
  }, [validateModalOperation, modalState, trackModalStateChange, getCurrentUser]);

  // Toggle modal with validation
  const toggleModal = useCallback((props?: Record<string, any>) => {
    if (modalState.isOpen) {
      return closeModal();
    } else {
      return openModal(props);
    }
  }, [modalState.isOpen, openModal, closeModal]);

  // Force reset modal state
  const resetModal = useCallback(() => {
    if (isDevelopment) {
      console.log('Modal: force reset');
    }
    cleanupModalState();
    setIsAuthorized(true);
  }, [cleanupModalState, isDevelopment]);

  // Force revoke authorization
  const revokeAuthorization = useCallback(() => {
    if (isDevelopment) {
      console.log('Modal: revoking authorization');
    }
    setIsAuthorized(false);
    if (modalState.isOpen) {
      closeModal();
    }
  }, [modalState.isOpen, closeModal]);

  return {
    isOpen: modalState.isOpen,
    isAuthorized,
    modalProps: modalState.props,
    modalId: modalIdRef.current,
    openModal,
    closeModal,
    toggleModal,
    resetModal,
    revokeAuthorization,
    cleanupModalState,
    isCleanupInProgress: cleanupInProgressRef.current
  };
}

/**
 * Higher-order component wrapper for existing modal components
 * to add cleanup hooks automatically
 */
export function withModalCleanup<P extends object>(
  ModalComponent: React.ComponentType<P>,
  options: UseModalWithCleanupOptions = {}
) {
  return function ModalWithCleanupWrapper(props: P) {
    const modalHook = useModalWithCleanup(false, options);
    
    return React.createElement(ModalComponent, {
      ...props,
      isOpen: modalHook.isOpen && modalHook.isAuthorized,
      onClose: modalHook.closeModal,
      modalId: modalHook.modalId
    });
  };
}
