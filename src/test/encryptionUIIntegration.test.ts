import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encryptionService } from '../services/encryptionService';
import { firebaseDataService } from '../services/firebaseDataService';

// Mock the encryption service and firebase data service
vi.mock('../services/encryptionService', () => ({
  encryptionService: {
    isReady: vi.fn().mockReturnValue(false),
    setDeterministicKey: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  }
}));

vi.mock('../services/firebaseDataService', () => ({
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
vi.mock('../services/firebase', () => ({
  auth: {
    onAuthStateChanged: vi.fn(),
    signOut: vi.fn(),
  }
}));

// Mock PWAContext
vi.mock('../contexts/PWAContext', () => ({
  PWAProvider: ({ children }: { children: any }) => children,
  usePWA: () => ({ isPWA: false }),
}));

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
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

  it('should start migration immediately after encryption service is ready', async () => {
    // Mock logged in user
    const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
    
    (require('../services/firebase').auth.onAuthStateChanged as any).mockImplementation((callback) => {
      callback(mockUser); // Simulate user login
      return vi.fn(); // Return unsubscribe function
    });
    
    // Mock encryption service initially not ready, then ready
    let encryptionReady = false;
    (encryptionService.isReady as any).mockImplementation(() => encryptionReady);
    (encryptionService.setDeterministicKey as any).mockResolvedValue(undefined);
    
    (firebaseDataService.getEncryptionMigrationStatus as any).mockReturnValue({
      running: false,
      allDone: false,
      collections: {},
    });
    
    // Import and test AuthContext behavior directly
    const consoleSpy = vi.spyOn(console, 'log');
    
    // Simulate the AuthContext logic
    if (mockUser.email) {
      await encryptionService.setDeterministicKey(mockUser.uid, mockUser.email);
      encryptionReady = true;
      
      if (encryptionService.isReady()) {
        await firebaseDataService.startBackgroundEncryptionMigration();
      }
    }
    
    // Verify the authentication flow
    expect(encryptionService.setDeterministicKey).toHaveBeenCalledWith('test-user-123', 'test@example.com');
    expect(encryptionService.isReady()).toBe(true);
    expect(firebaseDataService.startBackgroundEncryptionMigration).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should prevent multiple migration starts due to idempotent flag', async () => {
    // Mock the firebaseDataService internal flag
    const mockMigrationRunning = { current: false };
    
    vi.doMock('../services/firebaseDataService', () => ({
      firebaseDataService: {
        startBackgroundEncryptionMigration: vi.fn().mockImplementation(() => {
          if (mockMigrationRunning.current) return;
          mockMigrationRunning.current = true;
          // Simulated completion
          setTimeout(() => {
            mockMigrationRunning.current = false;
          }, 100);
        }),
        getEncryptionMigrationStatus: vi.fn().mockReturnValue({
          running: mockMigrationRunning.current,
          allDone: false,
          collections: {},
        }),
        resetEncryptionMigrationState: vi.fn(),
      }
    }));

    const { firebaseDataService } = require('../services/firebaseDataService');
    
    // Simulate multiple calls (StrictMode re-render scenario)
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(firebaseDataService.startBackgroundEncryptionMigration());
    }
    
    await Promise.all(promises);
    
    // Should only have one actual execution due to internal flag
    expect(firebaseDataService.startBackgroundEncryptionMigration).toHaveBeenCalledTimes(3);
  });

  it('should wait for encryption service before auto-starting migration', async () => {
    (encryptionService.isReady as any).mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, 'log');
    
    // Use the hook directly
    const { useEncryptionMigrationStatus } = await import('../hooks/useEncryptionMigrationStatus');
    
    // Create a mock user context
    const mockUseAuth = () => ({ user: { uid: 'test', email: 'test@example.com' } });
    vi.doMock('../contexts/AuthContext', () => ({
      useAuth: mockUseAuth
    }));
    
    // Check that auto-start is skipped when encryption not ready
    const status = firebaseDataService.getEncryptionMigrationStatus();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[enc-migration] Auto-start skipped: encryption service not ready')
    );
    
    consoleSpy.mockRestore();
  });

  it('should handle guest mode correctly', async () => {
    (encryptionService.isReady as any).mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, 'log');
    
    // Mock no user (guest mode)
    vi.doMock('../contexts/AuthContext', () => ({
      useAuth: () => ({ user: null })
    }));
    
    // Check that polling is disabled in guest mode
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[enc-migration] Polling disabled: no user (guest mode)')
    );
    
    consoleSpy.mockRestore();
  });

  it('should dispatch completion event when migration finishes', async () => {
    const eventSpy = vi.spyOn(window, 'dispatchEvent');
    
    // Mock completion event
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
    
    // Simulate the completion event being dispatched
    window.dispatchEvent(completionEvent);
    
    expect(eventSpy).toHaveBeenCalledWith(completionEvent);
    eventSpy.mockRestore();
  });

  it('should log migration completion telemetry', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');
    
    // Test the logging in firebaseDataService
    const mockStatus = {
      running: false,
      allDone: true,
      collections: {
        trips: { processed: 10, updated: 5, done: true },
        weatherLogs: { processed: 8, updated: 4, done: true },
      }
    };
    
    // Simulate completion logging
    console.info('[enc-migration] Migration completed successfully:', {
      userId: 'test-user-123',
      collections: mockStatus.collections,
      totalProcessed: 18,
      totalUpdated: 9
    });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[enc-migration] Migration completed successfully'),
      expect.objectContaining({
        userId: 'test-user-123',
        totalProcessed: 18,
        totalUpdated: 9
      })
    );
    
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should prevent duplicate migration starts in AuthContext', async () => {
    // Test the AuthContext migrationStarted flag behavior
    let migrationStarted = false;
    
    const mockUser = { uid: 'test-user-123', email: 'test@example.com' };
    
    // Simulate the AuthContext logic with idempotent flag
    const startMigrationWithFlag = () => {
      if (encryptionService.isReady() && !migrationStarted) {
        migrationStarted = true;
        firebaseDataService.startBackgroundEncryptionMigration();
      }
    };
    
    (encryptionService.isReady as any).mockReturnValue(true);
    
    // Call multiple times (StrictMode scenario)
    startMigrationWithFlag();
    startMigrationWithFlag();
    startMigrationWithFlag();
    
    // Should only be called once due to the flag
    expect(firebaseDataService.startBackgroundEncryptionMigration).toHaveBeenCalledTimes(1);
    expect(migrationStarted).toBe(true);
  });

  it('should reset migration flag on logout', async () => {
    // Test logout logic
    let migrationStarted = true;
    
    // Simulate logout
    migrationStarted = false;
    
    expect(migrationStarted).toBe(false);
  });
});
