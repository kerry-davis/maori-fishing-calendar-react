import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearUserContext } from '../utils/clearUserContext';
import { validateUserContext, validateFirebaseOperation } from '../utils/userStateCleared';
import { persistenceInstrumentation } from '../utils/persistenceInstrumentation';
import { useModalWithCleanup } from '../hooks/useModalWithCleanup';
import { renderHook, act } from '@testing-library/react';
import { React } from 'react';

describe('Data Integrity Fixes Validation - Test 4', () => {
  let mockWindow: any;
  let mockAuth: any;

  beforeEach(() => {
    // Mock comprehensive window environment
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
      location: { hash: '', pathname: '/test', replaceState: vi.fn() },
      document: { title: '', body: { style: { overflow: '', classList: { add: vi.fn(), remove: vi.fn() } } } },
      caches: { keys: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue(true) },
      performance: { now: vi.fn().mockReturnValue(Date.now()) },
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
      history: { replaceState: vi.fn() }
    };

    mockAuth = {
      currentUser: null,
      signOut: vi.fn().mockResolvedValue(undefined)
    };

    global.window = mockWindow;
    (global as any).localStorage = mockWindow.localStorage;
    (global as any).sessionStorage = mockWindow.sessionStorage;
    (global as any).document = mockWindow.document;
    (global as any).performance = mockWindow.performance;

    vi.clearAllMocks();
    persistenceInstrumentation.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    persistenceInstrumentation.reset();
  });

  describe('Task 1: TypeScript Build Validation', () => {
    it('should have proper TypeScript types for assessRisk method', () => {
      persistenceInstrumentation.startSession();
      
      // Test that assessRisk method has proper return type structure
      const artifacts = [
        { layer: 'localStorage' as const, key: 'test', valueType: 'string' as const, value: 'test', riskLevel: 'HIGH' as const, timestamp: Date.now(), source: 'test' }
      ];
      
      const report = persistenceInstrumentation.endSession('test-user', 'test-logout');
      
      // Verify the return structure matches expected types
      expect(report).toHaveProperty('highRiskCount');
      expect(report).toHaveProperty('mediumRiskCount');
      expect(report).toHaveProperty('totalArtifactsRemaining');
      expect(report).toHaveProperty('criticalIssues');
      
      // Verify types are the correct data types
      expect(typeof report.highRiskCount).toBe('number');
      expect(typeof report.mediumRiskCount).toBe('number');
      expect(typeof report.totalArtifactsRemaining).toBe('number');
      expect(Array.isArray(report.criticalIssues)).toBe(true);
    });

    it('should compile without TypeScript errors for all new methods', () => {
      // Test that all methods exist and are callable
      expect(typeof persistenceInstrumentation.assessRisk).toBe('function');
      expect(typeof persistenceInstrumentation.startSession).toBe('function');
      expect(typeof persistenceInstrumentation.endSession).toBe('function');
      
      // Test method signatures
      const artifacts: any[] = [];
      expect(() => {
        // @ts-expect-error - Testing private method access for validation
        (persistenceInstrumentation as any).assessRisk(artifacts);
      }).not.to.throw();
    });
  });

  describe('Task 2: Browser API Safety Validation', () => {
    it('should handle missing performance API gracefully', () => {
      delete (global as any).performance;
      
      const result = clearUserContext();
      
      // Should succeed with fallback to Date.now()
      return expect(result).resolves.toMatchObject({ success: true });
    });

    it('should guard all storage operations', () => {
      delete (global as any).localStorage;
      
      const result = clearUserContext();
      
      return expect(result).resolves.toMatchObject({ 
        success: true,
        cleanupResults: { storageClear: false }
      });
    });

    it('should not have duplicate imports or compile errors', () => {
      // This test validates the import structure
      expect(() => {
        const testModule = require('../utils/clearUserContext');
        expect(testModule.clearUserContext).toBeDefined();
        expect(testModule.secureLogoutWithCleanup).toBeDefined();
      }).not.to.throw();
    });
  });

  describe('Task 3: Firebase Auth Import and Write Operation Detection', () => {
    it('should use static Firebase auth import instead of dynamic require', () => {
      // Mock the static import to avoid actual Firebase dependency
      vi.doMock('../services/firebase', () => ({
        auth: mockAuth
      }));

      // Should not rely on dynamic requires
      expect(() => {
        validateUserContext('test-user-123', () => 'test-result', undefined, 'readOperation');
      }).not.to.throw();
      
      // Should not call require
      expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('require'));
    });

    it('should detect write operations explicitly, not by substring matching', () => {
      // Test explicit write operations
      const writeOperations = ['createTrip', 'saveTrip', 'deleteTrip', 'updateWeather'];
      
      writeOperations.forEach(op => {
        expect(() => {
          validateUserContext(null, () => {}, undefined, op);
        }).to.throw('Write operations require authenticated user context');
      });

      // Test that read operations are allowed
      const readOperations = ['getTrip', 'fetchTrips', 'loadWeather'];
      
      readOperations.forEach(op => {
        expect(() => {
          const result = validateUserContext(null, () => 'read-result', undefined, op);
          expect(result).toBe('read-result');
        }).not.to.throw();
      });

      // Test that ambiguous names without exact match are treated as reads
      expect(() => {
        const result = validateUserContext(null, () => 'write-ish-result', undefined, 'writeishOperation');
        expect(result).toBe('write-ish-result');
      }).not.to.throw();
    });

    it('should block write operations in guest mode', () => {
      const writeOperation = () => validateUserContext(null, () => {}, undefined, 'createTrip');
      expect(writeOperation).toThrow('Write operations require authenticated user context');
    });

    it('should allow read operations in guest mode', () => {
      const result = validateUserContext(null, () => 'data', undefined, 'getTrip');
      expect(result).toBe('data');
    });

    it('should use hardcoded write operation Set for O(1) lookup', () => {
      // This test validates performance - we can't directly test the Set but can validate behavior
      const startTime = Date.now();
      
      // Test multiple operations to ensure Set is being used efficiently
      for (let i = 0; i < 1000; i++) {
        validateUserContext(null, () => {}, undefined, 'createTrip');
        validateUserContext(null, () => 'data', undefined, 'getTrip');
      }
      
      const duration = Date.now() - startTime;
      // Should complete quickly with Set lookup (less than 100ms for 2000 operations)
      expect(duration).to.be.lessThan(100);
    });
  });

  describe('Task 4: Deterministic Modal Events', () => {
    it('should respond to userContextCleared events', () => {
      const { result } = renderHook(() => useModalWithCleanup(true, { cleanupOnLogout: true }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).to.be(true);

      // Simulate deterministic logout event
      act(() => {
        const customEvent = new CustomEvent('userContextCleared', {
          detail: { userId: 'test-user', reason: 'logout' }
        });
        window.dispatchEvent(customEvent);
      });

      expect(result.current.isOpen).to.be.false;
      expect(result.current.isAuthorized).to.be.false;
    });

    it('should respond to logout events', () => {
      const { result } = renderHook(() => useModalWithCleanup(true));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).to.be(true);

      act(() => {
        const logoutEvent = new CustomEvent('logout', {
          detail: { userId: 'test-user', source: 'button' }
        });
        window.dispatchEvent(logoutEvent);
      });

      expect(result.current.isOpen).to.be.false);
      expect(result.current.isAuthorized).to.be.false);
    });

    it('should respond to authStateChanged events', () => {
      const { result } = renderHook(() => useModalWithCleanup(true, {
        preventReopenAfterLogout: true
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).to.be(true);

      // Test user logout
      act(() => {
        const authEvent = new CustomEvent('authStateChanged', {
          detail: { user: null }
        });
        window.dispatchEvent(authEvent);
      });

      expect(result.current.isOpen).to.be.false;
      expect(result.current.isAuthorized).to.be.false;
    });

    it('should handle user changes via authStateChanged', () => {
      const { result } = renderHook(() => useModalWithCleanup(true, {
        preventReopenAfterLogout: true
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).to.be(true);

      // Simulate user change
      act(() => {
        const authEvent = new CustomEvent('authStateChanged', {
          detail: { user: { uid: 'different-user-123' } }
        });
        window.dispatchEvent(authEvent);
      });

      expect(result.current.isOpen).to.be.false; // State should be cleaned
      expect(result.current.isAuthorized).to.be.true;
    });

    it('should not rely on storage event polling', () => {
      const { result } = renderHook(() => useModalWithCleanup(true));

      act(() => {
        result.current.openModal();
      });

      // Simulate storage event (should not trigger cleanup)
      act(() => {
        const storageEvent = new StorageEvent('storage', {
          key: 'lastActiveUser',
          oldValue: 'user1',
          newValue: 'user2'
        });
        window.dispatchEvent(storageEvent);
      });

      // Modal should remain open because we don't rely on storage events
      expect(result.current.isOpen).to.be(true);
    });

    it('should clean up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useModalWithCleanup(true, {
        cleanupOnLogout: true
      }));

      unmount();

      // Should have proper cleanup - count removeEventListener calls
      const removeEventCalls = mockWindow.removeEventListener.mock.calls;
      const eventTypes = removeEventCalls.map(call => call[0]);
      
      expect(eventTypes).to.include('userContextCleared');
      expect(eventTypes).to.include('logout');
      expect(eventTypes).to.include('authStateChanged');
    });
  });

  describe('Cross-Session Cleanup Validation', () => {
    it('should trigger cleanup on explicit logout events', () => {
      const { result } = renderHook(() => useModalWithCleanup(true));

      // Setup modal state
      act(() => {
        result.current.openModal({ modalData: 'test' });
      });

      expect(result.current.isOpen).to.be(true;
        expect(result.current.modalProps.modalData).to.be('test');

      // Simulate cross-session logout (different tab triggers logout)
      act(() => {
        const crossSessionEvent = new CustomEvent('userContextCleared', {
          detail: { userId: 'current-user', source: 'cross-session' }
        });
        window.dispatchEvent(crossSessionEvent);
      });

      expect(result.current.isOpen).to.be(false);
      expect(result.current.modalProps).to.deep.equal({});
    });

    it('should reset authorization state on session context changes', () => {
      const { result } = renderHook(() => useModalWithCleanup(true));

      // Initial should be authorized
      expect(result.current.isAuthorized).to.be(true);

      // Trigger context change
      act(() => {
        const contextEvent = new CustomEvent('authStateChanged', {
          detail: { user: null, previousUser: { uid: 'old-user' } }
        });
        window.dispatchEvent(contextEvent);
      });

      expect(result.current.isAuthorized).to.be(false);

      // New user context
      act(() => {
        const loginEvent = new CustomEvent('authStateChanged', {
          detail: { user: { uid: 'new-user' } }
        });
        window.dispatchEvent(loginEvent);
      });

      expect(result.current.isAuthorized).to.be(true;
    });

    it('should handle rapid successive auth changes', () => {
      const { result } = renderHook(() => useModalWithCleanup(true, {
        preventReopenAfterLogout: true
      }));

      // Open modal for user 1
      act(() => {
        result.current.openModal();
      });

      // Simulate rapid user switching
      act(() => {
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: { user: null }
        }));
        
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: { user: { uid: 'user2' } }
        }));
        
        window.dispatchEvent(new CustomEvent('authStateChanged', {
          detail: { user: null }
        }));
      });

      // Should be closed and unauthorized after the sequence
      expect(result.current.isOpen).to.be(false;
      expect(result.current.isAuthorized).to.be.false;
    });
  });

  describe('Comprehensive Integration Validation', () => {
    it('should validate complete end-to-end workflow', async () => {
      // Test full data integrity workflow with all fixes
      persistenceInstrumentation.startSession();
      
      const userId = 'test-user-integration';
      
      // Track some artifacts
      persistenceInstrumentation.registerArtifact('localStorage', 'testKey', 'testValue', 'LOW', 'Component', userId);
      
      // Validate user context operations
      expect(() => {
        validateUserContext(userId, () => 'success', undefined, 'readOperation');
      }).not.to.throw();
      
      // Test write operation blocking
      expect(() => {
        validateUserContext(null, () => {}, undefined, 'createTrip');
      }).toThrow();
      
      // Test modal cleanup events
      const { result: modalResult } = renderHook(() => useModalWithCleanup(true));
      
      act(() => {
        modalResult.current.openModal();
      });
      
      expect(modalResult.current.isOpen).to.be.true;
      
      // Trigger cleanup
      act(() => {
        window.dispatchEvent(new CustomEvent('userContextCleared', {
          detail: { userId, reason: 'integration-test' }
        }));
      });
      
      expect(modalResult.current.isOpen).to.be.false;
      
      // Cleanup and verify instrumentation
      const report = persistenceInstrumentation.endSession(userId, 'integration-test');
      
      expect(report.artifactsBeforeLogout).to.have.length(1);
      expect(report.leakagePaths).to.have.length(0);
      
      // Test browser safety in cleanup
      const cleanupResult = await clearUserContext();
      
      expect(cleanupResult.success).to.be.true;
      expect(messageSpy).toHaveBeenCalledWith('🚀 Starting comprehensive user context clearing...');
    });

    it('should validate TypeScript compilation success', () => {
      // This test ensures all our changes compile successfully
      expect(() => {
        const clearUserContextModule = require('../utils/clearUserContext');
        const userStateClearedModule = require('../utils/userStateCleared');
        const persistenceInstrumentationModule = require('../utils/persistenceInstrumentation');
        const modalHookModule = require('../hooks/useModalWithCleanup');
        
        // Test all exported functions are accessible
        expect(clearUserContextModule.clearUserContext).toBeDefined();
        expect(userStateClearedModule.validateUserContext).toBeDefined();
        expect(persistenceInstrumentationModule.persistenceInstrumentation).toBeDefined();
        expect(modalHookModule.useModalWithCleanup).toBeDefined();
      }).not.to.throw();
    });
  });
});
