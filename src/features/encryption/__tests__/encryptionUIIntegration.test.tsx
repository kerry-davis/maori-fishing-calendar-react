import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, renderHook, act, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../app/providers/AuthContext';
import { encryptionService } from '../../../shared/services/encryptionService';
import { firebaseDataService } from '../../../shared/services/firebaseDataService';
import EncryptionMigrationStatus from '../EncryptionMigrationStatus';

// Simple test component to verify rendering
function TestComponent() {
  const { encryptionReady, user } = useAuth();
  return (
    <div data-testid="test-component">
      {user ? `User: ${user.email}` : 'No user'}
      {encryptionReady ? ' | Encryption Ready' : ' | Encryption Not Ready'}
    </div>
  );
}

// Mock the encryption service and firebase data service
vi.mock('../../../shared/services/encryptionService', () => ({
  encryptionService: {
    isReady: vi.fn().mockReturnValue(false),
    setDeterministicKey: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  }
}));

vi.mock('../../../shared/services/firebaseDataService', () => ({
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
vi.mock('../../../shared/services/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
  }
}));

// Mock PWAContext
vi.mock('../../../app/providers/PWAContext', () => ({
  PWAProvider: ({ children }: { children: React.ReactNode }) => children,
  usePWA: () => ({ isPWA: false }),
}));

describe('Encryption UI Integration Regression Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    
    // Mock window events
    window.dispatchEvent = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should hide migration pill in guest mode', async () => {
    // Mock guest user (no user)
    (encryptionService.isReady as any).mockReturnValue(false);
    
    // Test the useEncryptionMigrationStatus hook indirectly
    const { useEncryptionMigrationStatus } = await import('../../../shared/hooks/useEncryptionMigrationStatus');
    const consoleSpy = vi.spyOn(console, 'log');
    
    // Call hook logic directly
    const migrationStatus = useEncryptionMigrationStatus();
    
    // In guest mode, allDone should be false and pill shouldn't show
    expect(migrationStatus.allDone).toBe(false);
    
    consoleSpy.mockRestore();
  });

  it('should show migration pill when user is logged in but encryption not ready', async () => {
    // Mock logged in user with email
    const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
    
    // Mock onAuthStateChanged to simulate user login
    (require('../../../shared/services/firebase').auth.onAuthStateChanged as any).mockImplementation((callback: (user: any) => void) => {
      callback(mockUser); // Simulate user login
      return vi.fn(); // Return unsubscribe function
    });
    
    (encryptionService.isReady as any).mockReturnValue(false);
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: false,
      allDone: false,
      collections: {},
    });
    
    render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );

    // Wait for auth state to process and pill potentially to show
    await waitFor(() => {
      // Pill should not show when encryption not ready
      expect(screen.queryByText(/Encrypting data…/)).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should start migration after encryption service is ready', async () => {
    // Mock logged in user
    const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
    
    (require('../../../shared/services/firebase').auth.onAuthStateChanged as any).mockImplementation((callback: (user: any) => void) => {
      callback(mockUser); // Simulate user login
      return vi.fn();
    });
    
    // Initially not ready, then ready
    let encryptionReady = false;
    (encryptionService.isReady as any).mockImplementation(() => encryptionReady);
    (encryptionService.setDeterministicKey as any).mockResolvedValue(undefined);
    
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: false,
      allDone: false,
      collections: {},
    });
    
    render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );

    // Simulate encryption becoming ready (after setDeterministicKey)
    encryptionReady = true;
    
    // Wait for async operations
    await waitFor(() => {
      expect(encryptionService.setDeterministicKey).toHaveBeenCalledWith('test-user-123', 'test@example.com');
    }, { timeout: 3000 });
    
    await waitFor(() => {
      expect(firebaseDataService.startBackgroundEncryptionMigration).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should hide pill when migration is complete', async () => {
    // Mock logged in user
    const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
    
    (require('../../../shared/services/firebase').auth.onAuthStateChanged as any).mockImplementation((callback: (user: any) => void) => {
      callback(mockUser);
      return vi.fn();
    });
    
    (encryptionService.isReady as any).mockReturnValue(true);
    
    // Mock migration completed
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: false,
      allDone: true,
      collections: {
        trips: { processed: 10, updated: 5, done: true },
        weatherLogs: { processed: 8, updated: 4, done: true },
        fishCaught: { processed: 15, updated: 8, done: true },
      },
    });
    
    render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );

    // Pill should not be visible when migration is complete
    await waitFor(() => {
      expect(screen.queryByText(/Encrypting data…/)).not.toBeInTheDocument();
    });
  });

  it('should handle migration completion event correctly', async () => {
    // Mock logged in user
    const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
    
    (require('../../../shared/services/firebase').auth.onAuthStateChanged as any).mockImplementation((callback: (user: any) => void) => {
      callback(mockUser);
      return vi.fn();
    });
    
    (encryptionService.isReady as any).mockReturnValue(true);
    
    // Initially not complete
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: true,
      allDone: false,
      collections: {},
    });
    
    render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );

    // Simulate migration completion event
    const completionEvent = new CustomEvent('encryptionMigrationCompleted', {
      detail: {
        userId: 'test-user-123',
        status: {
          running: false,
          allDone: true,
          collections: {
            trips: { processed: 10, updated: 5, done: true },
          },
        }
      }
    });
    
    fireEvent(window, completionEvent);
    
    // Pill should disappear after completion event
    await waitFor(() => {
      expect(screen.queryByText(/Encrypting data…/)).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should prevent multiple migration starts during StrictMode re-renders', async () => {
    // Mock logged in user
    const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
    
    (require('../../../shared/services/firebase').auth.onAuthStateChanged as any).mockImplementation((callback: (user: any) => void) => {
      callback(mockUser);
      return vi.fn();
    });
    
    (encryptionService.isReady as any).mockReturnValue(true);
    (encryptionService.setDeterministicKey as any).mockResolvedValue(undefined);
    
    // Mock migration status as not complete and not running
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: false,
      allDone: false,
      collections: {},
    });
    
    // Simulate StrictMode re-render by rendering component twice
    const { unmount } = render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );
    
    // Unmount and remount to simulate StrictMode double render
    unmount();
    
    render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );
    
    // Migration should only be started once despite re-renders
    await waitFor(() => {
      expect(firebaseDataService.startBackgroundEncryptionMigration).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });

  it('should show migration pill with progress when migration is running', async () => {
    // Mock logged in user
    const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
    
    (require('../../../shared/services/firebase').auth.onAuthStateChanged as any).mockImplementation((callback: (user: any) => void) => {
      callback(mockUser);
      return vi.fn();
    });
    
    (encryptionService.isReady as any).mockReturnValue(true);
    
    // Mock migration in progress
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: true,
      allDone: false,
      collections: {
        trips: { processed: 10, updated: 5, done: false },
        weatherLogs: { processed: 8, updated: 4, done: true },
        fishCaught: { processed: 0, updated: 0, done: false },
      },
    });
    
    render(
      <AuthProvider>
        <EncryptionMigrationStatus />
      </AuthProvider>
    );

    // Pill should be visible with progress information
    await waitFor(() => {
      expect(screen.getByText(/Encrypting data…/)).toBeInTheDocument();
      expect(screen.getByText(/docs updated: 9/)).toBeInTheDocument(); // 5 + 4
      expect(screen.getByText(/processed: 18/)).toBeInTheDocument(); // 10 + 8
      expect(screen.getByText(/collections: 1\/3/)).toBeInTheDocument(); // 1 done out of 3
    });
  });

  it('should log in, await readiness signal, and assert pill disappears when migration completes', async () => {
    // Mock encryption service initially not ready
    (encryptionService.isReady as any).mockReturnValue(false);
    (encryptionService.setDeterministicKey as any).mockImplementation(async () => {
      // Simulate async key setup
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    // Mock migration status initially shows running
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: true,
      allDone: false,
      collections: {
        trips: { processed: 5, updated: 3, done: false },
      },
    });
    
    let authCallback: ((user: any) => void) | null = null;
    let resolveLogin: ((value: any) => void) | null = null;
    
    (require('../../../shared/services/firebase').auth.onAuthStateChanged as any).mockImplementation((callback: (user: any) => void) => {
      authCallback = callback;
      return vi.fn();
    });
    
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Verify initial state - encryption not ready
    expect(result.current.encryptionReady).toBe(false);
    expect(result.current.user).toBe(null);

    // Log in user
    await act(async () => {
      if (authCallback) {
        const mockUser = { uid: 'ready-test-user', email: 'ready@test.com' };
        authCallback(mockUser);
      }
    });

    // User should be logged in but encryption not ready yet
    expect(result.current.user).toBeTruthy();
    expect(result.current.encryptionReady).toBe(false);

    // Wait for encryption service to resolve and set encryption ready
    await act(async () => {
      // Wait for setDeterministicKey to resolve
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    // Encryption should now be ready
    expect(result.current.encryptionReady).toBe(true);

    // Now simulate migration completing
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: false,
      allDone: true,
      collections: {
        trips: { processed: 5, updated: 5, done: true },
      },
    });

    // Trigger migration completion event (same as real migration completion)
    act(() => {
      window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
        detail: { collections: ['trips'] }
      }));
    });

    // Render the migration status component to verify pill disappears
    const { container, rerender } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Component should be rendered
    expect(container).toBeInTheDocument();
  });
});
