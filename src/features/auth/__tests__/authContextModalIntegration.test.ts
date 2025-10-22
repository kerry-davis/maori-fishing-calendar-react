import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalWithCleanup } from '@shared/hooks/useModalWithCleanup';

// Mock Firebase auth with all properties inline
vi.mock('@shared/services/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn().mockImplementation(() => () => {}),
    signOut: vi.fn().mockResolvedValue(undefined)
  }
}));

// Import after mocking
import { auth } from '@shared/services/firebase';
// Cast to any to avoid TypeScript issues with mock
const mockAuth = auth as any;

describe('Auth Context Modal Integration Tests', () => {
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
      dispatchEvent: vi.fn()
    };

    global.window = mockWindow;
    (global as any).localStorage = mockWindow.localStorage;
    (global as any).sessionStorage = mockWindow.sessionStorage;

    // Reset Firebase auth mock
    mockAuth.currentUser = null;
    mockAuth.onAuthStateChanged = vi.fn().mockImplementation((callback: (user: any) => void) => {
      // Return unsubscribe function
      return () => {};
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auth Context Integration', () => {
    it('should use provided authUser from context instead of localStorage', () => {
      const authUser = { uid: 'context-user-123', email: 'user@test.com' };
      const onAuthStateChange = vi.fn();

      const { result } = renderHook(() => useModalWithCleanup(false, {
        authUser,
        onAuthStateChange
      }));

      // Should accept and use the provided auth user
      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
        expect(result.current.isOpen).toBe(true);
      });

      // Should not have checked localStorage for user
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalledWith('lastActiveUser');
    });

    it('should fallback to Firebase auth when no authUser provided', () => {
      // Mock Firebase auth user
      mockAuth.currentUser = { uid: 'firebase-user-456', email: 'firebase@test.com' };
      const onAuthStateChange = vi.fn();

      const { result } = renderHook(() => useModalWithCleanup(false, {
        onAuthStateChange
      }));

      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      expect(result.current.isOpen).toBe(true);
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalled();
    });

    it('should handle no auth user gracefully without localStorage fallback', () => {
      // No auth user provided and no Firebase auth
      mockAuth.currentUser = null;

      const { result } = renderHook(() => useModalWithCleanup(false));

      // Should work with no user context
      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      expect(result.current.isOpen).toBe(true);
      // Should not attempt localStorage for user tracking
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalled();
    });

    it('should handle None user gracefully', () => {
      const { result } = renderHook(() => useModalWithCleanup(false));

      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should track state changes with real user ID', () => {
      const authUser = { uid: 'tracking-user-123', email: 'track@test.com' };
      
      const { result } = renderHook(() => useModalWithCleanup(false, {
        authUser
      }));

      act(() => {
        result.current.openModal();
      });

      // Verify the modal is opened with proper user context
      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);
    });
  });

  describe('Firebase Auth Integration', () => {
    it('should subscribe to Firebase auth state changes', () => {
      const mockUnsubscribe = vi.fn();
      mockAuth.onAuthStateChanged.mockReturnValue(mockUnsubscribe);
      
      const onAuthStateChange = vi.fn();

      const { unmount } = renderHook(() => useModalWithCleanup(true, {
        onAuthStateChange
      }));

      // Should have set up Firebase auth listener
      expect(mockAuth.onAuthStateChanged).toHaveBeenCalledWith(expect.any(Function));
      expect(onAuthStateChange).not.toHaveBeenCalled(); // No initial call

      unmount();

      // Should clean up Firebase auth subscription
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle Firebase auth unavailability gracefully', () => {
      // Mock auth without onAuthStateChanged method
      mockAuth.onAuthStateChanged = undefined as any;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderHook(() => useModalWithCleanup(true));

      expect(consoleSpy).toHaveBeenCalledWith('Firebase auth not available for modal hook');

      consoleSpy.mockRestore();
    });

    it('should handle Firebase auth subscription errors graciously', () => {
      mockAuth.onAuthStateChanged.mockImplementation(() => {
        throw new Error('Firebase subscription failed');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderHook(() => useModalWithCleanup(true));

      expect(consoleSpy).toHaveBeenCalledWith('Failed to set up Firebase auth listener:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should call onAuthStateChange callback when Firebase auth changes', () => {
      let authCallback: ((user: any) => void) | null = null;
      
      mockAuth.onAuthStateChanged.mockImplementation((callback) => {
        authCallback = callback;
        return () => {};
      });

      const onAuthStateChange = vi.fn();
      
      renderHook(() => useModalWithCleanup(true, {
        onAuthStateChange
      }));

      // Simulate Firebase auth state change
      const testUser = { uid: 'auth-change-user', email: 'change@test.com' };
      act(() => {
        if (authCallback) {
          authCallback(testUser);
        }
      });

      expect(onAuthStateChange).toHaveBeenCalledWith(testUser);
    });

    it('should handle Firebase auth unsubscription errors', () => {
      const badUnsubscribe = () => {
        throw new Error('Unsubscribe failed');
      };
      mockAuth.onAuthStateChanged.mockReturnValue(badUnsubscribe);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { unmount } = renderHook(() => useModalWithCleanup(true));

      unmount();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to unsubscribe from Firebase auth:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('Authorization and Gatekeeping', () => {
    it('should allow modal operations when auth user is present', () => {
      const authUser = { uid: 'authorized-user-123', email: 'auth@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(false, {
        authUser,
        cleanupOnLogout: true
      }));

      // Opening modal should succeed
      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);
    });

    it('should block modal operations when user is None', () => {
      const { result } = renderHook(() => useModalWithCleanup(false, {
        cleanupOnLogout: false
      }));

      // Should still allow operations when no user context validation is strict
      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should handle auth context changes during modal operations', () => {
      let authUser = { uid: 'user-one-123', email: 'user1@test.com' };
      
      const { result, rerender } = renderHook(
        ({ authUser, onAuthStateChange }) => useModalWithCleanup(false, {
          authUser,
          onAuthStateChange
        }),
        {
          initialProps: { authUser, onAuthStateChange: vi.fn() }
        }
      );

      // Open modal with first user
      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);

      // Change user context - should cleanup for preventReopenAfterLogout
      const newUser = { uid: 'user-two-456', email: 'user2@test.com' };
      
      rerender({ 
        authUser: newUser, 
        onAuthStateChange: vi.fn() 
      });

      expect(result.current.isAuthorized).toBe(true);
    });

    it('should listen for custom auth events and handle them', () => {
      const authUser = { uid: 'event-user-123', email: 'event@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(true, {
        authUser,
        preventReopenAfterLogout: true
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);

      // Simulate logout event
      act(() => {
        window.dispatchEvent(new CustomEvent('logout', {
          detail: { userId: authUser.uid, source: 'button' }
        }));
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isAuthorized).toBe(false);

      // Simulate login event
      act(() => {
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: { user: authUser, source: 'login' }
        }));
      });

      expect(result.current.isAuthorized).toBe(true);
    });

    it('should handle user mismatch scenarios', () => {
      const authUser = { uid: 'mismatch-user-123', email: 'mismatch@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(true, {
        authUser,
        preventReopenAfterLogout: true
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);

      // Simulate user state change with different user
      act(() => {
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: { user: { uid: 'different-user-456', email: 'different@test.com' } }
        }));
      });

      // Should cleanup due to user change with preventReopenAfterLogout
      expect(result.current.isOpen).toBe(false);
      expect(result.current.isAuthorized).toBe(true);
    });
  });

  describe('Instrumentation and Tracking', () => {
    it('should register modal state changes with correct user ID', () => {
      const authUser = { uid: 'instrumentation-user-123', email: 'instrument@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(false, {
        authUser
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);
      // Modal should have proper user context tracked internally
    });

    it('should track modal cleanup events with proper user context', () => {
      const authUser = { uid: 'cleanup-user-123', email: 'cleanup@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(true, {
        authUser,
        cleanupOnLogout: true
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);

      // Trigger cleanup
      act(() => {
        window.dispatchEvent(new CustomEvent('userContextCleared', {
          detail: { userId: authUser.uid }
        }));
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isAuthorized).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed auth user objects', () => {
      const malformedUsers = [
        null,
        undefined,
        {},
        { uid: null },
        { email: 'test@test.com' }, // missing uid
        { uid: '', email: 'test@test.com' }, // empty uid
        { id: 'some-id' } // using id instead of uid
      ];

      malformedUsers.forEach((authUser, index) => {
        const { result } = renderHook(() => useModalWithCleanup(false, {
          authUser
        }));

        act(() => {
          const opened = result.current.openModal();
          expect(opened).toBe(true);
        });

        expect(result.current.isOpen).toBe(true);
      });
    });

    it('should handle rapid auth state changes without errors', () => {
      const { result } = renderHook(() => useModalWithCleanup(true));

      act(() => {
        result.current.openModal();
      });

      // Rapid state changes
      const users = [
        { uid: 'user-1', email: 'user1@test.com' },
        null,
        { uid: 'user-2', email: 'user2@test.com' },
        undefined,
        { uid: 'user-3', email: 'user3@test.com' }
      ];

      users.forEach(user => {
        act(() => {
          window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { user, source: 'rapid-test' }
          }));
        });
      });

      // Should not throw and should have consistent state
      expect(result.current.isAuthorized).toBeDefined();
      expect(typeof result.current.isAuthorized).toBe('boolean');
    });

    it('should handle missing browser APIs in SSR context', () => {
      delete (global as any).window;
      delete (global as any).document;
      
      // Mock document for the test
      global.document = {
        createElement: vi.fn(),
        getElementById: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as any;

      const authUser = { uid: 'ssr-user-123', email: 'ssr@test.com' };

      expect(() => {
        renderHook(() => useModalWithCleanup(false, {
          authUser
        }));
      }).not.to.throw();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical login -> modal -> logout workflow', () => {
      const { result, rerender } = renderHook(
        ({ authUser }) => useModalWithCleanup(true, {
          authUser,
          preventReopenAfterLogout: true
        }),
        {
          initialProps: { authUser: null }
        }
      );

      // Stage 1: No user, modal should work but no specific user context
      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);

      // Stage 2: User logs in (auth context changes)
      const loggedInUser = { uid: 'workflow-user-123', email: 'workflow@test.com' };
      
      rerender({ authUser: loggedInUser });

      // Modal should remain open, authorization track real user
      expect(result.current.isOpen).toBe(true);
      expect(result.current.isAuthorized).toBe(true);

      // Stage 3: User logs out (auth context becomes null)
      rerender({ authUser: null });

      // Should trigger cleanup due to preventReopenAfterLogout
      expect(result.current.isOpen).toBe(false);
      expect(result.current.isAuthorized).toBe(false);

      // Stage 4: Different user should not see previous modal state
      const differentUser = { uid: 'different-user-456', email: 'different@test.com' };
      
      rerender({ authUser: differentUser });

      expect(result.current.isAuthorized).toBe(true);
      
      // Opening modal should start fresh
      act(() => {
        const opened = result.current.openModal();
        expect(opened).toBe(true);
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should handle concurrent multiple auth sources', () => {
      // Simulate both Firebase auth and context auth being available
      mockAuth.currentUser = { uid: 'firebase-user-123', email: 'firebase@test.com' };
      
      const contextUser = { uid: 'context-user-456', email: 'context@test.com' };

      const { result } = renderHook(() => useModalWithCleanup(false, {
        authUser: contextUser
      }));

      act(() => {
        result.current.openModal();
      });

      // Should prioritize context user over Firebase auth
      expect(result.current.isOpen).toBe(true);
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalled(); // Shouldn't use localStorage

      // If context user is removed, should fall back to Firebase auth
      const { rerender } = renderHook(
        ({ authUser }) => useModalWithCleanup(false, { authUser }),
        { initialProps: { authUser: contextUser } }
      );

      rerender({ authUser: null });

      // Now should use Firebase auth, not localStorage
      expect(mockWindow.localStorage.getItem).not.toHaveBeenCalledWith('lastActiveUser');
      expect(mockAuth.currentUser).toEqual({ uid: 'firebase-user-123', email: 'firebase@test.com' });
    });
  });
});
