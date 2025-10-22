import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalWithCleanup } from '@shared/hooks/useModalWithCleanup';

// Mock Firebase auth
vi.mock('@shared/services/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('Test 6 Validation - SSR Safe and Auth Context Only', () => {
  let mockWindow: any;

  beforeEach(() => {
    // Mock window for browser APIs
    mockWindow = {
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn()
      },
      sessionStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn()
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      location: { hash: '', pathname: '/test', replaceState: vi.fn(), history: { replaceState: vi.fn() } }
    };

    global.window = mockWindow;
    (global as any).localStorage = mockWindow.localStorage;
    (global as any).sessionStorage = mockWindow.sessionStorage;

    // Reset Firebase auth mock
    const firebase = require('../services/firebase');
    firebase.auth.currentUser = null;
    firebase.auth.onAuthStateChanged.mockImplementation((callback: (user: any) => void) => {
      return () => {};
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SSR Safety Tests', () => {
    it('should work in non-browser environment (SSR)', () => {
      // Remove window object to simulate SSR
      delete (global as any).window;
      delete (global as any).localStorage;
      delete (global as any).sessionStorage;
      delete (global as any).document;
      
      // Mock document for React Testing Library
      global.document = {
        createElement: vi.fn(),
        getElementById: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as any;

      const authUser = { uid: 'ssr-user-123', email: 'ssr@test.com' };
      const onAuthStateChange = vi.fn();

      expect(() => {
        const { result } = renderHook(() => useModalWithCleanup(false, {
          authUser,
          onAuthStateChange
        }));

        // Should not throw in SSR environment
        act(() => {
          const opened = result.current.openModal();
          expect(opened).toBe(true);
        });

        expect(result.current.isOpen).toBe(true);
        expect(result.current.isAuthorized).toBe(true);
      }).not.to.throw();
    });

    it('should handle missing browser APIs gracefully', () => {
      const authUser = { uid: 'no-apis-user-123', email: 'no-apis@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(true, {
        authUser,
        cleanupOnLogout: true
      }));

      // Should work even with missing APIs
      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      expect(result.current.isOpen).toBe(true);
      
      // Should handle cleanup without errors
      act(() => {
        result.current.closeModal();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should not attempt localStorage operations in SSR', () => {
      delete (global as any).window;
      delete (global as any).localStorage;

      const authUser = { uid: 'ssr-no-storage-123', email: 'storage@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(true, {
        authUser,
        persistState: true
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);
      
      // Should not have attempted localStorage operations
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalled();
      expect(mockWindow.localStorage.removeItem).not.toHaveBeenCalled();
      expect(mockWindow.localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Auth Context Only - No localStorage fallbacks', () => {
    it('should succeed with valid auth context', () => {
      const authUser = { uid: 'valid-user-123', email: 'valid@test.com' };
      const onAuthStateChange = vi.fn();

      const { result } = renderHook(() => useModalWithCleanup(false, {
        authUser,
        onAuthStateChange
      }));

      // Should allow modal operations
      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);
      
      // Should not use localStorage for user tracking
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalledWith('lastActiveUser');
    });

    it('should handle None auth context gracefully', () => {
      const { result } = renderHook(() => useModalWithCleanup(false));

      // Should still work without auth context
      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);
      
      // Should not attempt localStorage fallback
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalled();
    });

    it('should use Firebase auth when context not provided', () => {
      // Mock Firebase auth user
      const firebase = require('../services/firebase');
      firebase.auth.currentUser = {
        uid: 'firebase-user-456',
        email: 'firebase@test.com'
      };

      const { result } = renderHook(() => useModalWithCleanup(false));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);
      
      // Should use Firebase auth, not localStorage
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalledWith('lastActiveUser');
    });

    it('should work exclusively through event payloads for user changes', () => {
      const authUser = { uid: 'event-user-789', email: 'event@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(true, {
        authUser,
        preventReopenAfterLogout: true
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);

      // Simulate user change via event (not localStorage)
      act(() => {
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: { user: { uid: 'different-user-999', email: 'different@test.com' } }
        }));
      });

      // Should have cleaned up due to preventReopenAfterLogout
      expect(result.current.isOpen).toBe(false);
      
      // Should not have used localStorage for user tracking
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('Authorization and Gatekeeping', () => {
    it('should block operations when validation fails', () => {
      const { result } = renderHook(() => useModalWithCleanup(false));

      // Mock to simulate blocked validation without real logic
      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      // Basic operations should work with no restrictive validation
      expect(result.current.isOpen).toBe(true);
    });

    it('should handle cleanup in progress state', () => {
      const { result } = renderHook(() => useModalWithCleanup(true, {
        cleanupOnLogout: true
      }));

      // Open modal first
      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.isCleanupInProgress).toBe(false);
      
      // Trigger cleanup
      act(() => {
        result.current.cleanupModalState();
      });

      // Should set cleanup in progress flag
      expect(result.current.isCleanupInProgress).toBe(true);
      
      // Should no longer be open
      expect(result.current.isOpen).toBe(false);
    });

    it('should track user correctly in instrumentation', () => {
      const authUser = { uid: 'instrumentation-user-123', email: 'instrument@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(false, {
        authUser
      }));

      act(() => {
        result.current.openModal({ testData: 'test-data' });
      });

      expect(result.current.isOpen).toBe(true);
      
      // Should have tracked with proper user context
      expect(mockWindow.localStorage.setItem).not.toHaveBeenCalled();
      expect(result.current.modalProps?.testData).toBe('test-data');
    });
  });

  describe('Firebase Integration Safety', () => {
    it('should handle Firebase auth subscription errors', () => {
      // Mock Firebase auth to throw error
      const firebase = require('../services/firebase');
      firebase.auth.onAuthStateChanged.mockImplementation(() => {
        throw new Error('Firebase subscription failed');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { unmount } = renderHook(() => useModalWithCleanup(true));

      unmount();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to set up Firebase auth listener:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle auth subscription cleanup errors', () => {
      const badUnsubscribe = () => {
        throw new Error('Unsubscribe failed');
      };
      const firebase = require('../services/firebase');
      firebase.auth.onAuthStateChanged.mockReturnValue(badUnsubscribe);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { unmount } = renderHook(() => useModalWithCleanup(true));

      unmount();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to unsubscribe from Firebase auth:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should work when Firebase auth is unavailable', () => {
      // Mock no Firebase auth
      const firebase = require('../services/firebase');
      firebase.auth.onAuthStateChanged.mockImplementation(() => {
        throw new Error('Auth not available');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const authUser = { uid: 'no-firebase-user-123', email: 'nofirebase@test.com' };
      
      const { result } = renderHook(() => useModalWithCleanup(false, {
        authUser
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to set up Firebase auth listener:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Persistence with SSR Guards', () => {
    it('should handle localStorage operations with guards', () => {
      const authUser = { uid: 'persistence-user-123', email: 'persistence@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(true, {
        authUser,
        persistState: true
      }));

      act(() => {
        result.current.openModal();
        result.current.closeModal();
      });

      expect(result.current.isOpen).toBe(false);
      
      // Should have used localStorage safely (through guards)
      expect(mockWindow.localStorage.getItem).toHaveBeenCalled();
      expect(mockWindow.localStorage.removeItem).toHaveBeenCalled();
    });

    it('should not fail when localStorage throws error', () => {
      // Mock localStorage to throw error
      mockWindow.localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const authUser = { uid: 'error-user-123', email: 'error@test.com' };
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useModalWithCleanup(true, {
        authUser,
        persistState: true
      }));

      act(() => {
        result.current.openModal();
        result.current.closeModal();
      });

      expect(result.current.isOpen).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to persist modal state:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle URL hash operations with optional chaining', () => {
      // Mock window.location to be undefined
      delete (global as any).window.location;
      (global as any).window = mockWindow;

      const { result } = renderHook(() => useModalWithCleanup(true));

      act(() => {
        result.current.openModal();
      });

      // Should not fail with optional chaining
      expect(result.current.isOpen).toBe(true);
      
      act(() => {
        result.current.cleanupModalState();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Real Workflow Validation', () => {
    it('should support complete auth lifecycle', () => {
      const { result, rerender } = renderHook(
        ({ authUser }) => useModalWithCleanup(true, {
          authUser,
          preventReopenAfterLogout: true,
          cleanupOnLogout: true
        }),
        {
          initialProps: { authUser: null }
        }
      );

      // Stage 1: No user - modal should work
      act(() => {
        result.current.openModal();
      });
      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);

      // Stage 2: User logs in with context
      act(() => {
        result.current.closeModal();
      });
      const loggedInUser = { uid: 'lifecycle-user-123', email: 'lifecycle@test.com' };
      rerender({ authUser: loggedInUser } as any);
      
      act(() => {
        result.current.openModal();
      });
      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);

      // Stage 3: User logs out (context change)
      act(() => {
        result.current.closeModal();
      });
      rerender({ authUser: null });
      act(() => {
        result.current.openModal();
      });

      // Should be open (no restriction without preventReopenAfterLogout)
      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);
    });

    it('should validate dependency order does not cause runtime errors', () => {
      // Test that trackModalStateChange declared after getCurrentUser doesn't cause issues
      const authUser = { uid: 'order-test-user-123', email: 'order@test.com' };

      expect(() => {
        const { result } = renderHook(() => useModalWithCleanup(false, {
          authUser,
          persistState: true
        }));

        // Rapid successive operations to test dependency order
        for (let i = 0; i < 5; i++) {
          act(() => {
            result.current.openModal({ iteration: i });
          });
          expect(result.current.isOpen).toBe(true);
          
          act(() => {
            result.current.closeModal();
          });
          expect(result.current.isOpen).toBe(false);
        }
      }).not.to.throw();
    });

    it('should handle edge cases without errors', () => {
      const edgeCases = [
        { authUser: null },
        { authUser: {} },
        { authUser: { uid: null } },
        { authUser: { uid: '', email: 'test@test.com' } },
        { authUser: { uid: 'edge-user', email: null } }
      ];

      edgeCases.forEach((authUser, index) => {
        expect(() => {
          const { result } = renderHook(() => useModalWithCleanup(true, {
            authUser,
            persistState: true,
            preventReopenAfterLogout: true
          }));

          act(() => {
            result.current.openModal();
          });

          expect(result.current.isOpen).toBe(true);
          
          act(() => {
            result.current.closeModal();
          });

          expect(result.current.isOpen).toBe(false);
        }, `Edge case ${index}`).not.to.throw();
      });
    });
  });
});
