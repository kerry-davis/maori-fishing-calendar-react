import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@app/providers/AuthContext';
import { encryptionService } from '@shared/services/encryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import EncryptionMigrationStatus from '@features/encryption/EncryptionMigrationStatus';
import React from 'react';
import { useEncryptionMigrationStatus } from '@shared/hooks/useEncryptionMigrationStatus';

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
  }
}));

// Mock Firebase auth
vi.mock('@shared/services/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
    getRedirectResult: vi.fn(),
  }
}));

// Mock PWAContext
vi.mock('@app/providers/PWAContext', () => ({
  PWAProvider: ({ children }: { children: React.ReactNode }) => children,
  usePWA: () => ({ isPWA: false }),
}));

describe('Encryption Index Integration Tests', () => {
  let authCallback: ((user: any) => void) | null = null;
  let migrationStatusCalls: any[] = [];
  
  beforeEach(() => {
    vi.clearAllMocks();
    migrationStatusCalls = [];
    
    // Setup onAuthStateChanged mock to capture the callback
    vi.mocked(require('@shared/services/firebase').auth.onAuthStateChanged).mockImplementation((callback) => {
      authCallback = callback as (user: any) => void;
      return vi.fn(); // unsubscribe function
    });
    
    // Mock migration status with index error initially
    vi.mocked(firebaseDataService.getEncryptionMigrationStatus).mockImplementation(() => {
      const status = migrationStatusCalls[migrationStatusCalls.length - 1] || {
        running: false,
        allDone: false,
        collections: {
          trips: { processed: 0, updated: 0, done: false }
        }
      };
      return status;
    });
    
    // Mock localStorage for encryption state
    const localStorageMock = {
      getItem: vi.fn((key: string) => {
        // Mock encryption state based on test flow
        if (key.includes('encryptionState_trips_testuser')) {
          return migrationStatusCalls.length > 2 
            ? JSON.stringify({ processed: 10, updated: 10, done: true })
            : JSON.stringify({ processed: 0, updated: 0, done: false });
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
    
    // Mock window events
    Object.defineProperty(window, 'dispatchEvent', {
      value: vi.fn(),
    });
    
    Object.defineProperty(window, 'addEventListener', {
      value: vi.fn(),
    });
    
    Object.defineProperty(window, 'removeEventListener', {
      value: vi.fn(),
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
    migrationStatusCalls = [];
  });

  it('should show index error when Firestore index is missing', async () => {
    // Mock the migration to throw an index error
    const indexError = new Error('The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/projects/test-project/databases/(default)/indexes?create_composite=...');
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

    // Wait for encryption to become ready
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Trigger migration
    await act(async () => {
      result.current.start?.();
    });

    // Should show index error event
    await waitFor(() => {
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'encryptionIndexError',
          detail: expect.objectContaining({
            collection: 'trips',
            error: expect.stringContaining('requires an index'),
            consoleUrl: 'https://console.firebase.google.com/'
          })
        })
      );
    });
  });

  it('should complete migration successfully after index is created', async () => {
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

    // Simulate successful migration (index now exists)
    migrationStatusCalls.push({
      running: true,
      allDone: false,
      collections: {
        trips: { processed: 5, updated: 3, done: false }
      }
    });

    // Start migration
    await act(async () => {
      result.current.start?.();
    });

    // Simulate migration completion
    migrationStatusCalls.push({
      running: false,
      allDone: true,
      collections: {
        trips: { processed: 10, updated: 10, done: true }
      }
    });

    // Trigger completion event (simulating successful migration with index)
    await act(() => {
      window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
        detail: {
          userId: 'testuser',
          status: {
            running: false,
            allDone: true,
            collections: {
              trips: { processed: 10, updated: 10, done: true }
            }
          }
        }
      }));
    });

    // Should complete successfully
    await waitFor(() => {
      expect(result.current.allDone).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  it('should display error pill when index error occurs', async () => {
    // Mock index error in the migration hook
    vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockRejectedValueOnce(
      new Error('FAILED_PRECONDITION: The query requires an index')
    );
    
    render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );

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

    // Wait for encryption to be ready
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Start migration which will fail with index error
    await act(async () => {
      result.current.start?.();
    });

    // Should display error pill instead of regular progress
    await waitFor(() => {
      expect(screen.getByTestId('encryption-migration-pill-error')).toBeInTheDocument();
      expect(screen.getByText('Index Error')).toBeInTheDocument();
      expect(screen.getByText(/requires Firestore index/)).toBeInTheDocument();
      expect(screen.getByText('Fix in Console')).toBeInTheDocument();
    });

    // Should not show regular progress pill
    expect(screen.queryByTestId('encryption-migration-pill')).not.toBeInTheDocument();
  });

  it('should clear error state after successful_RETRY with proper index', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // First, simulate index error
    vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockRejectedValueOnce(
      new Error('The query requires an index')
    );

    // Log in and trigger migration failure
    await act(async () => {
      if (authCallback) {
        const mockUser = { uid: 'testuser', email: 'test@example.com' };
        authCallback(mockUser);
      }
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    await act(async () => {
      result.current.start?.();
    });

    // Wait for error to be set
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    // Reset and simulate successful retry with proper index
    vi.mocked(firebaseDataService.startBackgroundEncryptionMigration).mockResolvedValueOnce(undefined);
    migrationStatusCalls.push({
      running: false,
      allDone: true,
      collections: {
        trips: { processed: 10, updated: 10, done: true }
      }
    });

    // Force restart (retry migration)
    await act(async () => {
      result.current.forceRestart?.();
    });

    // Trigger completion event
    await act(() => {
      window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
        detail: {
          userId: 'testuser',
          status: {
            running: false,
            allDone: true,
            collections: {
              trips: { processed: 10, updated: 10, done: true }
            }
          }
        }
      }));
    });

    // Should clear error and complete successfully
    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.allDone).toBe(true);
    });
  });

  it('should provide console link functionality in error state', async () => {
    const mockOpen = vi.fn();
    Object.defineProperty(window, 'open', {
      value: mockOpen,
    });

    render(
      <AuthProvider>
        <TestComponentWithError />
      </AuthProvider>
    );

    const consoleLink = screen.getByText('Fix in Console');
    expect(consoleLink).toBeInTheDocument();
    
    // Simulate clicking the console link
    await act(async () => {
      consoleLink.click();
    });

    // Should open console in new tab
    expect(mockOpen).toHaveBeenCalledWith(
      'https://console.firebase.google.com/',
      '_blank'
    );
  });
});

// Test component to simulate error state
function TestComponentWithError() {
  const { error } = useEncryptionMigrationStatus();
  
  // Simulate an error state for testing
  React.useEffect(() => {
    if (!error) {
      window.dispatchEvent(new CustomEvent('encryptionIndexError', {
        detail: {
          collection: 'trips',
          error: 'The query requires an index',
          userId: 'testuser',
          consoleUrl: 'https://console.firebase.google.com/'
        }
      }));
    }
  }, [error]);
  
  return <EncryptionMigrationStatus />;
}
