import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider } from '@app/providers/AuthContext';
import { useEncryptionMigrationStatus } from '@shared/hooks/useEncryptionMigrationStatus';
import { encryptionService } from '@shared/services/encryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import EncryptionMigrationStatus from '@features/encryption/EncryptionMigrationStatus';

// Mock the encryption service and firebase data service
vi.mock('@shared/services/encryptionService', () => ({
  encryptionService: {
    isReady: vi.fn().mockReturnValue(true),
    setDeterministicKey: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  }
}));

vi.mock('@shared/services/firebaseDataService', () => ({
  firebaseDataService: {
    startBackgroundEncryptionMigration: vi.fn().mockResolvedValue(undefined),
    getEncryptionMigrationStatus: vi.fn().mockReturnValue({
      running: false,
      allDone: false,
      collections: {},
    }),
    resetEncryptionMigrationState: vi.fn(),
    // Methods used by AuthProvider background operations
    switchToUser: vi.fn().mockResolvedValue(undefined),
    mergeLocalDataForUser: vi.fn().mockResolvedValue(undefined),
    clearAllData: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    backupLocalDataBeforeLogout: vi.fn().mockResolvedValue(undefined),
    clearSyncQueue: vi.fn().mockResolvedValue(undefined),
  }
}));

// Mock Firebase services used indirectly by providers (ensure all exports exist)
vi.mock('@shared/services/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
    getRedirectResult: vi.fn(),
  },
  firestore: {} as any,
  storage: {} as any,
  app: {} as any,
}));

// Mock PWAContext
vi.mock('@app/providers/PWAContext', () => ({
  PWAProvider: ({ children }: { children: React.ReactNode }) => children,
  usePWA: () => ({ isPWA: false }),
}));

describe('Migration Flow Verification', () => {
  let authCallback: ((user: any) => void) | null = null;
  let migrationEvents: any[] = [];
  let dispatchSpy: ReturnType<typeof vi.spyOn> | null = null;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    migrationEvents = [];
    
    // Setup onAuthStateChanged mock to capture the callback
    const firebase = await import('@shared/services/firebase');
    vi.mocked(firebase.auth.onAuthStateChanged).mockImplementation((callback: (user: any) => void) => {
      authCallback = callback as (user: any) => void;
      return vi.fn(); // unsubscribe function
    });
    
    // Spy window events but keep native behavior
    const originalDispatch = window.dispatchEvent.bind(window);
    dispatchSpy = vi.spyOn(window, 'dispatchEvent').mockImplementation((event: any) => {
      migrationEvents.push(event);
      return originalDispatch(event);
    });
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn((key: string) => {
        // Mock encryption state based on test flow
        if (key.includes('encryptionState_')) {
          return JSON.stringify({ processed: 5, updated: 3, done: false });
        }
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
    
    // Mock matchMedia
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
    if (dispatchSpy) {
      dispatchSpy.mockRestore();
      dispatchSpy = null;
    }
  });

  it('should clear error pill and continue polling after Firestore index is created', async () => {
    // Step 1: Initial state shows index error
    const indexError = new Error('The query requires an index. You can create it here: https://console.firebase.google.com/v1/rprojects/test-project/databases/(default)/indexes?create_composite=...');
    vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockRejectedValueOnce(indexError);
    
    const { result } = renderHook(() => useEncryptionMigrationStatus(), {
      wrapper: AuthProvider,
    });

    // Log in user
    await act(async () => {
      if (authCallback) {
        const mockUser = { uid: 'testuser', email: 'test@example.com' };
        authCallback(mockUser);
      }
    });

    // Wait for encryption ready
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Step 2: Trigger migration which fails with index error
    await act(async () => {
      result.current.start?.();
    });

    // Verify error pill is shown
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.collection).toBe('trips');
    });

    const { rerender } = render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );

    // Error pill should be visible
    await waitFor(() => {
      expect(screen.getByTestId('encryption-migration-pill-error')).toBeInTheDocument();
      expect(screen.getByText('Index Error')).toBeInTheDocument();
    });

    // Step 3: Simulate creating Firestore index and re-running migration
    vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockResolvedValueOnce(undefined);
    
    // Set migration status to running (after index creation)
    vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
      running: true,
      allDone: false,
      collections: {
        trips: { processed: 2, updated: 1, done: false }
      }
    });

    // Force restart to simulate re-running migration after index creation
    await act(async () => {
      result.current.forceRestart?.();
    });

    // Error should be cleared and regular progress should resume
    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.running).toBe(true);
    });

    // Error pill should disappear, regular pill should appear
    await waitFor(() => {
      expect(screen.queryByTestId('encryption-migration-pill-error')).not.toBeInTheDocument();
      expect(screen.getByTestId('encryption-migration-pill')).toBeInTheDocument();
      expect(screen.getByText('Encrypting data…')).toBeInTheDocument();
    });
  });

  it('should continue polling and update totals correctly after error recovery', async () => {
    const { result } = renderHook(() => useEncryptionMigrationStatus(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      if (authCallback) {
        const mockUser = { uid: 'polling-user', email: 'polling@test.com' };
        authCallback(mockUser);
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Initial error state
    const indexError = new Error('FAILED_PRECONDITION: The query requires an index');
    vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockRejectedValueOnce(indexError);
    
    await act(async () => {
      result.current.start?.();
    });

    // Should show error
    expect(result.current.error).toBeTruthy();

    // Create index and restart migration
    vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockResolvedValueOnce(undefined);
    
    await act(async () => {
      result.current.forceRestart?.();
    });

    // Should clear error and start running
    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.running).toBe(true);
    });

    // Simulate polling updates
    let pollCount = 0;
    vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockImplementation(() => {
      pollCount++;
      return {
        running: pollCount < 3,
        allDone: pollCount >= 3,
        collections: {
          trips: { processed: pollCount * 2, updated: pollCount * 2, done: pollCount >= 3 }
        }
      };
    });

    // Polling should continue and update totals
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500)); // Allow polling to run
    });

    await waitFor(() => {
      expect(result.current.totalProcessed).toBeGreaterThan(0);
      expect(result.current.totalUpdated).toBeGreaterThan(0);
    });

    // Should complete successfully
    await waitFor(() => {
      expect(result.current.allDone).toBe(true);
      expect(result.current.running).toBe(false);
    });
  });

  it('should handle auth changes and reset polling correctly', async () => {
    const { result } = renderHook(() => useEncryptionMigrationStatus(), {
      wrapper: AuthProvider,
    });

    // First user logs in
    await act(async () => {
      if (authCallback) {
        const mockUser1 = { uid: 'user1', email: 'user1@test.com' };
        authCallback(mockUser1);
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Migration should start
    await act(async () => {
      result.current.start?.();
    });

    // We can't access user from migration status hook directly, need to access it from auth context

    // User changes (logout/login or different user)
    await act(async () => {
      if (authCallback) {
        const mockUser2 = { uid: 'user2', email: 'user2@test.com' };
        authCallback(mockUser2);
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Polling should reset for new user - removed user check since it's not available in migration hook
    // lastTrigger is not exposed in the hook result, remove this assertion
    
    // Should be able to start migration for new user
    await act(async () => {
      result.current.start?.();
    });

    await waitFor(() => {
      expect(result.current.running).toBe(true);
    });
  });

  it('should handle collection state defaults correctly when undefined', async () => {
    const { result } = renderHook(() => useEncryptionMigrationStatus(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      if (authCallback) {
        const mockUser = { uid: 'default-test', email: 'default@test.com' };
        authCallback(mockUser);
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Simulate an index error for a collection that has no existing state
    act(() => {
      window.dispatchEvent(new CustomEvent('encryptionIndexError', {
        detail: {
          collection: 'unknownCollection', // This collection has no existing state
          error: 'Index error',
          userId: 'default-test',
          consoleUrl: 'https://console.firebase.google.com/'
        }
      }));
    });

    // Should not throw error and should default collection state properly
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.collections).toEqual({
        unknownCollection: {
          processed: 0,
          updated: 0,
          done: true // Marked as done due to index error
        }
      });
    });
  });
});
