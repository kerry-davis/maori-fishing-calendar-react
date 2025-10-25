import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@app/providers/AuthContext';
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
    // Required by AuthProvider background ops
    switchToUser: vi.fn().mockResolvedValue(undefined),
    mergeLocalDataForUser: vi.fn().mockResolvedValue(undefined),
    clearAllData: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    backupLocalDataBeforeLogout: vi.fn().mockResolvedValue(undefined),
    clearSyncQueue: vi.fn().mockResolvedValue(undefined),
  }
}));

// Mock Firebase auth
vi.mock('@shared/services/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
    getRedirectResult: vi.fn(),
  },
  firestore: {},
  storage: {}
}));

// Mock PWAContext
vi.mock('@app/providers/PWAContext', () => ({
  PWAProvider: ({ children }: { children: React.ReactNode }) => children,
  usePWA: () => ({ isPWA: false }),
}));

describe('Migration Completion Verification', () => {
  let authCallback: ((user: any) => void) | null = null;
  let migrationEvents: any[] = [];
  let dispatchSpy: ReturnType<typeof vi.spyOn> | null = null;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    migrationEvents = [];
    
    // Setup onAuthStateChanged mock to capture the callback
    const firebase = await import('@shared/services/firebase');
    vi.mocked(firebase.auth.onAuthStateChanged).mockImplementation((callback) => {
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
      getItem: vi.fn(() => null),
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

  it('should watch for completion event and dismiss pill after indexes exist', async () => {
    // Initial migration status - in progress
    vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
      running: true,
      allDone: false,
      collections: {
        trips: { processed: 5, updated: 3, done: false },
        weatherLogs: { processed: 2, updated: 1, done: false }
      }
    });

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

    // Wait for encryption to become ready
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Migration status should show running
    expect(result.current.running).toBe(true);
    expect(result.current.allDone).toBe(false);

    // Render migration status component
    const { container } = render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );

    // Pill should be visible showing progress
    expect(screen.getByTestId('encryption-migration-pill')).toBeInTheDocument();
    expect(screen.getByText('Encrypting data…')).toBeInTheDocument();
    expect(screen.queryByTestId('encryption-migration-pill-error')).not.toBeInTheDocument();

    // Simulate indexes being created and migration completing
    vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
      running: false,
      allDone: true,
      collections: {
        trips: { processed: 10, updated: 10, done: true },
        weatherLogs: { processed: 5, updated: 5, done: true }
      }
    });

    // Trigger completion event (simulating successful migration after indexes exist)
    act(() => {
      window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
        detail: {
          userId: 'testuser',
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

    // Wait for completion event to be processed
    await waitFor(() => {
      expect(result.current.allDone).toBe(true);
      expect(result.current.running).toBe(false);
      expect(result.current.error).toBeNull();
    });

    // Pill should disappear after completion
    await waitFor(() => {
      expect(screen.queryByTestId('encryption-migration-pill')).not.toBeInTheDocument();
      expect(screen.queryByTestId('encryption-migration-pill-error')).not.toBeInTheDocument();
    });
  });

  it('should verify completion event was triggered for all collections', async () => {
    // Mock successful migration completion
    vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
      running: false,
      allDone: true,
      collections: {
        trips: { processed: 15, updated: 15, done: true },
        weatherLogs: { processed: 8, updated: 8, done: true },
        fishCaught: { processed: 25, updated: 20, done: true },
        tackleItems: { processed: 12, updated: 10, done: true }
      }
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      if (authCallback) {
        const mockUser = { uid: 'completeness-user', email: 'complete@test.com' };
        authCallback(mockUser);
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Trigger completion event
    act(() => {
      window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
        detail: {
          userId: 'completeness-user',
          status: {
            running: false,
            allDone: true,
            collections: {
              trips: { processed: 15, updated: 15, done: true },
              weatherLogs: { processed: 8, updated: 8, done: true },
              fishCaught: { processed: 25, updated: 20, done: true },
              tackleItems: { processed: 12, updated: 10, done: true }
            }
          }
        }
      }));
    });

    // Verify completion event was recorded
    await waitFor(() => {
      expect(migrationEvents.length).toBe(1);
      expect(migrationEvents[0].type).toBe('encryptionMigrationCompleted');
      expect(migrationEvents[0].detail.status.allDone).toBe(true);
      expect(Object.keys(migrationEvents[0].detail.status.collections)).toEqual(
        expect.arrayContaining(['trips', 'weatherLogs', 'fishCaught', 'tackleItems'])
      );
    });

    // Verify hook reflects completion
    expect(result.current.allDone).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should handle migration completion with no warnings after proper setup', async () => {
    // Mock a scenario where migration runs successfully from start to finish
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await act(async () => {
      if (authCallback) {
        const mockUser = { uid: 'success-user', email: 'success@test.com' };
        authCallback(mockUser);
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Start migration (should succeed because indexes exist)
    const startPromise = act(async () => {
      await result.current.start?.();
    });

    // Simulate successful completion immediately (indexes were already in place)
    await act(async () => {
      await startPromise;
      vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockReturnValue({
        running: false,
        allDone: true,
        collections: {
          trips: { processed: 5, updated: 5, done: true },
          weatherLogs: { processed: 3, updated: 3, done: true }
        }
      });
      
      window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
        detail: {
          userId: 'success-user',
          status: {
            running: false,
            allDone: true,
            collections: {
              trips: { processed: 5, updated: 5, done: true },
              weatherLogs: { processed: 3, updated: 3, done: true }
            }
          }
        }
      }));
    });

    // Verify successful completion without errors
    await waitFor(() => {
      expect(result.current.allDone).toBe(true);
      expect(result.current.error).toBeNull();
    });

    // Verify no error events were dispatched
    const errorEvents = migrationEvents.filter(event => event.type === 'encryptionIndexError');
    expect(errorEvents).toHaveLength(0);
  });
});
