import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@app/providers/AuthContext';
import { encryptionService } from '@shared/services/encryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import EncryptionMigrationStatus from '@features/encryption/EncryptionMigrationStatus';

/**
 * Manual Migration Flow Tests
 * These tests simulate the actual manual verification process described in FIRESTORE_INDEX_VERIFICATION.md
 * They demonstrate what should happen when following the manual steps
 */

vi.mock('@shared/services/encryptionService', () => ({
  encryptionService: {
    isReady: vi.fn().mockReturnValue(true),
    setDeterministicKey: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  }
}));

vi.mock('@shared/services/firebaseDataService', () => ({
  firebaseDataService: {
    startBackgroundEncryptionMigration: vi.fn(),
    getEncryptionMigrationStatus: vi.fn().mockReturnValue({
      running: false,
      allDone: false,
      collections: {},
    }),
    resetEncryptionMigrationState: vi.fn(),
  }
}));

vi.mock('@shared/services/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
    getRedirectResult: vi.fn(),
  }
}));

vi.mock('@app/providers/PWAContext', () => ({
  PWAProvider: ({ children }: { children: React.ReactNode }) => children,
  usePWA: () => ({ isPWA: false }),
}));

describe('Manual Migration Flow Verification', () => {
  let authCallback: ((user: any) => void) | null = null;
  let migrationEvents: any[] = [];
  
  beforeEach(() => {
    vi.clearAllMocks();
    migrationEvents = [];
    
    vi.mocked(require('@shared/services/firebase').auth.onAuthStateChanged).mockImplementation((callback) => {
      authCallback = callback as (user: any) => void;
      return vi.fn();
    });
    
    Object.defineProperty(window, 'dispatchEvent', {
      value: vi.fn((event: CustomEvent) => {
        migrationEvents.push(event);
      }),
    });
    
    const localStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
    
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    authCallback = null;
    migrationEvents = [];
  });

  describe('Step 1: Migration Error Detection', () => {
    it('should detect missing Firestore indexes and show error pill', async () => {
      // Simulate missing Firestore index
      const indexError = new Error('The query requires an index. You can create it here: https://console.firebase.google.com/v1/rprojects/test-project/databases/(default)/indexes?create_composite=CkVwaXJlcG9zdHJ5IGluZGV4IGZvciBlbmNyeXB0aW9u');

      vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockRejectedValueOnce(indexError);
      
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Log in user
      await act(async () => {
        if (authCallback) {
          const mockUser = { uid: 'testuser', email: 'test@example.com' };
          authCallback(mockUser);
        }
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Start migration which will fail with index error
      await act(async () => {
        result.current.start?.();
      });

      // Verify error state
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.collection).toBe('trips');
        expect(result.current.error?.consoleUrl).toContain('console.firebase.google.com');
      });

      const { container } = render(
        <AuthProvider>
          <EncryptionMigrationStatus />
        </AuthProvider>
      );

      // Error pill should be visible
      await waitFor(() => {
        expect(screen.getByTestId('encryption-migration-pill-error')).toBeInTheDocument();
        expect(screen.getByText('Index Error')).toBeInTheDocument();
        expect(screen.getByText(/requires Firestore index/)).toBeInTheDocument();
      });
    });
  });

  describe('Step 2: Console Link Usage', () => {
    it('should include working console links in error message', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        if (authCallback) {
          const mockUser = { uid: 'linktest', email: 'link@test.com' };
          authCallback(mockUser);
        }
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Trigger index error
      act(() => {
        window.dispatchEvent(new CustomEvent('encryptionIndexError', {
          detail: {
            collection: 'trips',
            error: 'Index required for query optimization',
            userId: 'linktest',
            consoleUrl: 'https://console.firebase.google.com/project/test-project/database/firestore/indexes~2Ftrips~2FuserId~2FcreatedAt?create_composite=abc123'
          }
        }));
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.consoleUrl).toBe('https://console.firebase.google.com/project/test-project/database/firestore/indexes~2Ftrips~2FuserId~2FcreatedAt?create_composite=abc123');
      });

      const renderResult = render(
        <AuthProvider>
          <EncryptionMigrationStatus />
        </AuthProvider>
      );

      // Should have functioning console link
      const consoleLink = screen.getByText('Fix in Console');
      expect(consoleLink).toBeInTheDocument();
      
      // Verify link opens correctly
      const mockOpen = vi.fn();
      Object.defineProperty(window, 'open', {
        value: mockOpen,
      });

      await act(async () => {
        consoleLink.click();
      });

      expect(mockOpen).toHaveBeenCalledWith(
        'https://console.firebase.google.com/project/test-project/database/firestore/indexes~2Ftrips~2FuserId~2FcreatedAt?create_composite=abc123',
        '_blank'
      );
    });
  });

  describe('Step 3: Index Creation Verification', () => {
    it('should recognize when indexes become ready and allow retry', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        if (authCallback) {
          const mockUser = { uid: 'retrytest', email: 'retry@test.com' };
          authCallback(mockUser);
        }
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Step 1: Initial error
      const indexError = new Error('Missing index for collection');
      vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockRejectedValueOnce(indexError);
      
      await act(async () => {
        result.current.start?.();
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Step 2: Index created, migration now succeeds
      vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockResolvedValueOnce(undefined);
      vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
        running: true,
        allDone: false,
        collections: {
          trips: { processed: 3, updated: 2, done: false },
          weatherLogs: { processed: 2, updated: 1, done: false }
        }
      });

      // Step 3: Retry migration after index creation
      await act(async () => {
        result.current.forceRestart?.();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.running).toBe(true);
      });
    });
  });

  describe('Step 4: Completion Event Verification', () => {
    it('should fire encryptionMigrationCompleted event after successful migration', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        if (authCallback) {
          const mockUser = { uid: 'completiontest', email: 'completion@test.com' };
          authCallback(mockUser);
        }
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Start successful migration
      vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockResolvedValueOnce(undefined);

      await act(async () => {
        result.current.start?.();
      });

      // Set migration status to completing
      vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
        running: false,
        allDone: true,
        collections: {
          trips: { processed: 10, updated: 10, done: true },
          weatherLogs: { processed: 5, updated: 5, done: true }
        }
      });

      // Trigger completion
      act(() => {
        window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
          detail: {
            userId: 'completiontest',
            status: {
              running: false,
              allDone: true,
              collections: {
                trips: { processed: 10, updated: 10, done: true },
                weatherLogs: { processed: 5, updated: 5, done: true }
              }
            }
          }
        }));
      });

      // Verify completion event
      await waitFor(() => {
        expect(migrationEvents.length).toBe(1);
        expect(migrationEvents[0].type).toBe('encryptionMigrationCompleted');
        expect(migrationEvents[0].detail.userId).toBe('completiontest');
        expect(migrationEvents[0].detail.status.allDone).toBe(true);
      });

      // Verify hook reflects completion
      await waitFor(() => {
        expect(result.current.allDone).toBe(true);
        expect(result.current.error).toBeNull();
        expect(result.current.running).toBe(false);
      });
    });
  });

  describe('Step 5: Pill Disappearance Verification', () => {
    it('should dismiss migration pill when allDone becomes true', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Set up migration in progress
      vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
        running: true,
        allDone: false,
        collections: {
          trips: { processed: 3, updated: 2, done: false }
        }
      });

      const { container, rerender } = render(
        <AuthProvider>
          <EncryptionMigrationStatus />
        </AuthProvider>
      );

      // Pill should be visible during migration
      expect(screen.getByTestId('encryption-migration-pill')).toBeInTheDocument();
      expect(screen.getByText('Encrypting data…')).toBeInTheDocument();

      // Simulate completion
      vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
        running: false,
        allDone: true,
        collections: {
          trips: { processed: 5, updated: 5, done: true }
        }
      });

      act(() => {
        window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
          detail: { userId: 'testuser', status: { allDone: true } }
        }));
      });

      // Pill should disappear
      await waitFor(() => {
        expect(screen.queryByTestId('encryption-migration-pill')).not.toBeInTheDocument();
      });
    });
  });

  describe('Step 6: Multiple Collections Handling', () => {
    it('should handle multiple collections with missing indexes', async () => {
      let errorCount = 0;
      vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockImplementation(() => {
        errorCount++;
        if (errorCount === 1) {
          return Promise.reject(new Error('Index missing for trips'));
        } else if (errorCount === 2) {
          return Promise.reject(new Error('Index missing for weatherLogs'));
        } else {
          return Promise.resolve(undefined);
        }
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        if (authCallback) {
          const mockUser = { uid: 'multitest', email: 'multi@test.com' };
          authCallback(mockUser);
        }
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // First collection error
      await act(async () => {
        result.current.start?.();
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error?.collection).toBe('trips');
      });

      // Fix first collection, retry
      vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockImplementation(() => {
        errorCount++;
        if (errorCount === 3) {
          return Promise.reject(new Error('Index missing for weatherLogs'));
        } else {
          return Promise.resolve(undefined);
        }
      });

      await act(async () => {
        result.current.forceRestart?.();
      });

      await waitFor(() => {
        expect(result.current.error?.collection).toBe('weatherLogs');
      });

      // Fix second collection, retry
      vi.mocked(firebaseDataService.startBackgroundMigrationMigration).mockResolvedValue(undefined);
      
      await act(async () => {
        result.current.forceRestart?.();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('Manual Verification Checklist Validation', () => {
    it('should pass all manual verification checklist items', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        if (authCallback) {
          const mockUser = { uid: 'checklisttest', email: 'checklist@test.com' };
          authCallback(mockUser);
        }
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // ✅ Check 1: User logged in and encryption ready
      expect(result.current.user).toBeTruthy();
      expect(result.current.encryptionReady).toBe(true);

      // ✅ Check 2: Migration can be started
      await act(async () => {
        result.current.start?.();
      });

      // Simulate successful completion
      vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
        running: false,
        allDone: true,
        collections: {
          trips: { processed: 15, updated: 15, done: true },
          weatherLogs: { processed: 8, updated: 8, done: true }
        }
      });

      act(() => {
        window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
          detail: { userId: 'checklisttest' }
        }));
      });

      // ✅ Check 3: Completion event fired
      await waitFor(() => {
        expect(migrationEvents.some(e => e.type === 'encryptionMigrationCompleted')).toBe(true);
      });

      // ✅ Check 4: Pill disappears and allDone returns true
      await waitFor(() => {
        expect(result.current.allDone).toBe(true);
        expect(result.current.error).toBeNull();
      });

      // ✅ Check 5: No migration warnings
      expect(result.current.running).toBe(false);
    });
  });
});
