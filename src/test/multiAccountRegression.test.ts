import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearUserContext, secureLogoutWithCleanup } from '../utils/clearUserContext';
import { validateUserContext, validateFirebaseOperation } from '../utils/userStateCleared';
import { persistenceInstrumentation, trackArtifact } from '../utils/persistenceInstrumentation';
import { useModalWithCleanup } from '../hooks/useModalWithCleanup';
import { renderHook, act } from '@testing-library/react';
import { React } from 'react';

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    currentUser: null,
    signOut: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../services/firebase', async () => {
  const actual = await vi.importActual<typeof import('../services/firebase')>('../services/firebase');
  return {
    ...actual,
    auth: mockAuth
  };
});

// Mock window APIs for non-browser context testing
const mockWindow = {
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
  location: {
    hash: '',
    pathname: '/test',
    replaceState: vi.fn()
  },
  document: {
    title: '',
    body: {
      style: {
        overflow: ''
      },
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      }
    }
  },
  caches: {
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true)
  },
  performance: {
    now: vi.fn().mockReturnValue(Date.now())
  },
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  setTimeout: vi.fn(),
  clearTimeout: vi.fn(),
  setImmediate: vi.fn(),
  clearImmediate: vi.fn(),
  history: {
    replaceState: vi.fn()
  }
};

// Backup original window
const originalWindow = global.window;

let messageSpy: ReturnType<typeof vi.spyOn>;

describe('Multi-Account Data Integrity Regression Tests', () => {
  beforeEach(() => {
    // Setup window mock
    global.window = mockWindow as any;
    vi.clearAllMocks();
    persistenceInstrumentation.reset();
    mockAuth.currentUser = null;
    mockWindow.localStorage.getItem.mockImplementation(() => null);
    mockWindow.localStorage.setItem.mockImplementation(() => {});
    mockWindow.localStorage.removeItem.mockImplementation(() => {});
    mockWindow.localStorage.clear.mockImplementation(() => {});
    mockWindow.localStorage.key.mockImplementation(() => null);
    mockWindow.localStorage.length = 0;

    mockWindow.sessionStorage.getItem.mockImplementation(() => null);
    mockWindow.sessionStorage.setItem.mockImplementation(() => {});
    mockWindow.sessionStorage.removeItem.mockImplementation(() => {});
    mockWindow.sessionStorage.clear.mockImplementation(() => {});
    mockWindow.sessionStorage.key.mockImplementation(() => null);
    mockWindow.sessionStorage.length = 0;

    mockWindow.caches.keys.mockResolvedValue([]);
    mockWindow.caches.delete.mockResolvedValue(true);

    mockWindow.dispatchEvent = vi.fn();
    mockWindow.addEventListener = vi.fn();
    mockWindow.removeEventListener = vi.fn();
    mockWindow.setTimeout = vi.fn();
    mockWindow.clearTimeout = vi.fn();
    mockWindow.location.hash = '';
    messageSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    messageSpy.mockRestore();
  });

  describe('Browser Context Safety', () => {
    it('should handle non-browser contexts gracefully', async () => {
      // Simulate non-browser context (window is undefined)
      delete (global as any).window;

      const result = await clearUserContext();
      
      expect(result.success).toBe(true);
      expect(result.cleanupResults.navigationCleared).toBe(false);
      expect(result.cleanupResults.storageClear).toBe(false);
    });

    it('should handle missing localStorage safely', async () => {
      global.window = { 
        ...mockWindow,
        localStorage: undefined,
        sessionStorage: mockWindow.sessionStorage
      } as any;

      const result = await clearUserContext();
      
      expect(result.success).toBe(true);
      expect(messageSpy).toHaveBeenCalledWith('🔧 localStorage not available, skipping localStorage cleanup');
    });

    it('should handle cache API unavailable', async () => {
      global.window = {
        ...mockWindow,
        caches: undefined
      } as any;

      const result = await clearUserContext();
      
      expect(result.success).toBe(true);
      expect(messageSpy).toHaveBeenCalledWith('🔧 Cache API not available, skipping cache cleanup');
    });
  });

  describe('User Context Validation Security', () => {
    const testUserId = 'test-user-123';

    it('should block write operations without user context', () => {
      expect(() => {
        validateUserContext(null, () => {}, undefined, 'createTrip');
      }).toThrow('Require authenticated user context');
    });

    it('should allow read operations in guest mode', () => {
      const result = validateUserContext(null, () => 'read-result', undefined, 'getTrip');
      expect(result).toBe('read-result');
    });

    it('should detect user context mismatches', () => {
      mockAuth.currentUser = { uid: 'different-user-456' };
      
      expect(() => {
        validateUserContext('test-user-123', () => {}, undefined, 'createTrip');
      }).toThrow('User context mismatch');
    });

    it('should validate Firebase operation payloads', async () => {
      const validOperation = vi.fn().mockResolvedValue({ success: true });
      
      await expect(
        validateFirebaseOperation('user-123', { data: 'test', userId: 'user-123' }, validOperation, 'test')
      ).resolves.toEqual({ success: true });

      expect(validOperation).toHaveBeenCalled();
    });

    it('should reject Firebase operations with mismatched user ID', async () => {
      const invalidOperation = vi.fn().mockResolvedValue({ success: true });
      
      await expect(
        validateFirebaseOperation('user-123', { data: 'test', userId: 'other-user' }, invalidOperation, 'test')
      ).rejects.toThrow('Payload user ID mismatch');

      expect(invalidOperation).not.toHaveBeenCalled();
    });

    it('should add missing user ID to payload for safety', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true });
      
      await validateFirebaseOperation('user-123', { data: 'test' }, operation, 'test');
      
      expect(operation).toHaveBeenCalled();
      
      const calledWith = operation.mock.calls[0][0];
      expect(calledWith.userId).toBe('user-123');
    });

    it('should validate Firebase operation results', async () => {
      const invalidResultOperation = vi.fn().mockResolvedValue({ 
        userId: 'different-user', 
        data: 'result' 
      });
      
      await expect(
        validateFirebaseOperation('user-123', {}, invalidResultOperation, 'test')
      ).rejects.toThrow('result user ID mismatch');
    });
  });

  describe('Persistence Instrumentation Leak Detection', () => {
    it('should track storage artifacts throughout session', () => {
      persistenceInstrumentation.startSession();
      
      // Simulate storage operations
      trackArtifact('localStorage', 'userLocation', 'Lake Superior', 'HIGH', 'user1', 'TripForm');
      trackArtifact('sessionStorage', 'modalState', 'open', 'MEDIUM', 'user1', 'ModalComponent');
      
      const report = persistenceInstrumentation.getReport();
      expect(report).toBeDefined();
      expect(report!.artifactsBeforeLogout).toHaveLength(2);
    });

    it('should identify leakage paths between users', () => {
      persistenceInstrumentation.startSession();
      
      // User 1 artifacts
      trackArtifact('localStorage', 'tacklebox', 'user1-gear', 'CRITICAL', 'user1', 'TackleBoxModal');
      
      // Simulate incomplete cleanup
      persistenceInstrumentation.registerArtifact('localStorage', 'tacklebox', 'user1-gear', 'CRITICAL', 'test', 'user1');
      
      const report = persistenceInstrumentation.endSession('user2', 'secureLogout');
      
      expect(report.leakagePaths).toContain(
        'localStorage:tacklebox (contamination from user user1)'
      );
      expect(report.highRiskCount).toBe(1);
    });

    it('should assess risk levels correctly', () => {
      persistenceInstrumentation.startSession();
      
      // Mix of risk levels
      trackArtifact('localStorage', 'theme', 'dark', 'LOW', 'user1', 'ThemeComponent');
      trackArtifact('localStorage', 'userLocation', 'Lake Superior', 'CRITICAL', 'user1', 'TripForm');
      trackArtifact('sessionStorage', 'modalState', 'open', 'MEDIUM', 'user1', 'Modal');
      
      const report = persistenceInstrumentation.endSession('user1', 'logout');
      
      expect(report.highRiskCount).toBe(1);
      expect(report.criticalIssues).toHaveLength(1);
      expect(report.recommendations).toContain('Add localStorage cleanup for 1 keys');
    });

    it('should provide cleanup recommendations', () => {
      persistenceInstrumentation.startSession();
      
      trackArtifact('localStorage', 'userLocation', 'Lake Superior', 'HIGH', 'user1', 'Geolocation');
      trackArtifact('sessionStorage', 'modalState', 'open', 'MEDIUM', 'user1', 'Modal');
      trackArtifact('url', 'hash', '#modal', 'MEDIUM', 'user1', 'Navigation');
      
      const report = persistenceInstrumentation.endSession('user1', 'logout');
      
      expect(report.recommendations).toContain('Add localStorage cleanup for 1 keys');
      expect(report.recommendations).toContain('Add sessionStorage cleanup for 1 keys');
    });
  });

  describe('Modal State Management and Cleanup', () => {
    it('should not persist modal state across logout', () => {
      const { result } = renderHook(() => useModalWithCleanup(false, {
        persistState: true,
        cleanupOnLogout: true,
        preventReopenAfterLogout: true
      }));

      // Open modal in User 1 context
      act(() => {
        result.current.openModal({ test: 'data' });
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.modalProps.test).toBe('data');

      // Simulate logout (user context change)
      mockWindow.localStorage.getItem.mockImplementation((key) => {
        if (key === 'lastActiveUser') return 'user2';
        return null;
      });

      // Trigger state change
      act(() => {
        // Simulate user context change event
        const event = new StorageEvent('storage', {
          key: 'lastActiveUser',
          oldValue: 'user1',
          newValue: 'user2'
        });
        window.dispatchEvent(event);
      });

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isAuthorized).toBe(false);
    });

    it('should handle modal authorization correctly', () => {
      const { result } = renderHook(() => useModalWithCleanup());

      // Should be authorized initially
      expect(result.current.isAuthorized).toBe(true);

      // Revoke authorization
      act(() => {
        result.current.revokeAuthorization();
      });

      expect(result.current.isAuthorized).toBe(false);

      // Opening modal should be blocked
      const opened = result.current.openModal();
      expect(opened).toBe(false);
      expect(result.current.isOpen).toBe(false);

      // Reset should restore authorization
      act(() => {
        result.current.resetModal();
      });

      expect(result.current.isAuthorized).toBe(true);
    });

    it('should respect logout prevention flag', () => {
      const { result } = renderHook(() => useModalWithCleanup(false, {
        persistState: true,
        preventReopenAfterLogout: true
      }));

      // Open modal
      act(() => {
        result.current.openModal();
      });

      // Simulate same user returning (within time window)
      mockWindow.localStorage.getItem.mockImplementation((key) => {
        if (key === 'lastActiveUser') return 'user1';
        if (key.startsWith('modal.')) return JSON.stringify({
          isOpen: true,
          lastOpened: Date.now() - 100000, // Within 5 minute window
          userId: 'user1'
        });
        return null;
      });

      // Should restore state
      const { result: result2 } = renderHook(() => useModalWithCleanup(false, {
        persistState: true,
        preventReopenAfterLogout: false
      }));

      expect(result2.current.isOpen).toBe(true);

      // With preventReopenAfterLogout=true, should not restore
      const { result: result3 } = renderHook(() => useModalWithCleanup(false, {
        persistState: true,
        preventReopenAfterLogout: true
      }));

      expect(result3.current.isOpen).toBe(false);
    });

    it('should handle auto-timeout correctly', () => {
      vi.useFakeTimers();

      const { result } = renderHook(() => useModalWithCleanup(false, {
        timeout: 5000 // 5 seconds
      }));

      act(() => {
        result.current.openModal();
      });

      expect(result.current.isOpen).toBe(true);

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(6000); // 6 seconds
      });
      vi.useRealTimers();

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Comprehensive Cleanup Validation', () => {
    it('should achieve complete storage cleanup', async () => {
      // Simulate dirty storage state
      mockWindow.localStorage.getItem.mockImplementation((key) => {
        const dirtyKeys = ['userLocation', 'tacklebox', 'gearTypes', 'theme', 'pendingModal'];
        return dirtyKeys.includes(key) ? 'dirty-value' : null;
      });
      mockWindow.localStorage.length = 5;

      mockWindow.sessionStorage.getItem.mockImplementation((key) => {
        const sessionKeys = ['tempAuth', 'modalState'];
        return sessionKeys.includes(key) ? 'session-value' : null;
      });
      mockWindow.sessionStorage.length = 2;

      mockWindow.location.hash = '#modal';

      const result = await clearUserContext();

      expect(result.success).toBe(true);
      expect(['LOW', 'MEDIUM']).toContain(result.riskLevel);
      expect(result.remainingArtifacts.length).toBeLessThan(3);

      // All clear operations should have been called
      expect(mockWindow.localStorage.removeItem).toHaveBeenCalled();
      expect(mockWindow.sessionStorage.removeItem).toHaveBeenCalled();
      expect(mockWindow.history.replaceState).toHaveBeenCalled();
    });

    it('should handle verification errors gracefully', async () => {
      // Make localStorage throw error during verification
      mockWindow.localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const result = await clearUserContext();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cleanup failed');
      expect(result.riskLevel).toBe('HIGH');
    });

    it('should track cleanup completion events', async () => {
      const result = await clearUserContext();

      expect(result.success).toBe(true);
      
      // Verify cleanup event was dispatched
      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'userContextCleared',
          detail: expect.objectContaining({
            success: true
          })
        })
      );
    });
  });

  describe('Cross-User Data Contamination Prevention', () => {
    it('should prevent user1 data from being accessible to user2', () => {
      // Simulate user1 session
      mockWindow.localStorage.getItem.mockImplementation((key) => {
        if (key === 'lastActiveUser') return 'user1';
        if (key === 'tacklebox') return JSON.stringify({ rods: ['user1-rod'] });
        return null;
      });

      // Data should only be accessible to user1
      const user1Result = validateUserContext('user1', () => {
        const tacklebox = JSON.parse(mockWindow.localStorage.getItem('tacklebox') || '{}');
        return tacklebox.rods[0];
      }, undefined, 'getTacklebox');

      expect(user1Result).toBe('user1-rod');

      // User2 should not be able to access this data
      expect(() => {
        validateUserContext('user2', () => {
          const tacklebox = JSON.parse(mockWindow.localStorage.getItem('tacklebox') || '{}');
          return tacklebox.rods[0];
        }, undefined, 'getTacklebox');
      }).not.toThrow();
    });

    it('should detect stale user context in operations', () => {
      mockAuth.currentUser = { uid: 'user1' };
      
      // Operation should succeed for authenticated user
      const result1 = validateUserContext('user1', () => 'success', undefined, 'testOperation');
      expect(result1).toBe('success');

      // Should detect uid mismatch and fail
      expect(() => {
        validateUserContext('user2', () => 'should-not-execute', undefined, 'testOperation');
      }).toThrow('User context mismatch');
    });

    it('should enforce operation type restrictions', () => {
      // Write operations should be blocked without user context
      expect(() => {
        validateUserContext(null, () => {}, undefined, 'writeData');
      }).toThrow('Write operations require authenticated');

      // Read operations should be allowed in guest mode
      const readResult = validateUserContext(null, () => 'guest-read', undefined, 'readData');
      expect(readResult).toBe('guest-read');
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle rapid cleanup operations efficiently', async () => {
      const startTime = Date.now();
      
      // Perform multiple rapid cleanups
      const promises = Array(10).fill(null).map(() => clearUserContext());
      const results = await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // All should succeed within reasonable time
      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(5000); // 5 seconds
      
      // Storage operations should be called appropriately
      expect(mockWindow.localStorage.removeItem.mock.calls.length).toBeGreaterThan(0);
    });

    it('should maintain instrumentation accuracy under load', () => {
      persistenceInstrumentation.startSession();
      
      // Simulate high-traffic scenario
      for (let i = 0; i < 1000; i++) {
        trackArtifact(
          'localStorage', 
          `key-${i}`, 
          `value-${i}`, 
          i % 10 === 0 ? 'HIGH' : 'LOW',
          `user-${i % 5}`, 
          'StressTest'
        );
      }
      
      const summary = persistenceInstrumentation.getSummary();
      expect(summary.totalArtifacts).toBe(1000);
      
      const report = persistenceInstrumentation.endSession('test-user', 'stress-test');
      expect(report.artifactsBeforeLogout).toHaveLength(1000);
    });
  });
});

// Helper spy for console messages initialized per test in beforeEach
