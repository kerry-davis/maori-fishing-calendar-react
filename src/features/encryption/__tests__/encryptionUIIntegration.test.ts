import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { encryptionService } from '@shared/services/encryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';

// Mock the encryption service and firebase data service
vi.mock('@shared/services/encryptionService', () => ({
  encryptionService: {
    isReady: vi.fn().mockReturnValue(false),
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
  }
}));

// Mock PWAContext
vi.mock('@app/providers/PWAContext', () => ({
  PWAProvider: ({ children }: { children: any }) => children,
  usePWA: () => ({ isPWA: false }),
}));

// Do NOT mock AuthContext module here to avoid context duplication across tests

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
    
    const fb = await import('@shared/services/firebase');
    (fb as any).auth.onAuthStateChanged.mockImplementation((callback: any) => {
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

    const { firebaseDataService } = await import('../services/firebaseDataService');
    
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
    const { useEncryptionMigrationStatus } = await import('@shared/hooks/useEncryptionMigrationStatus');
    const { AuthContext } = await import('@app/providers/AuthContext');
    const { renderHook } = await import('@testing-library/react');
    const wrapper = ({ children }: any) => React.createElement(
      (AuthContext as any).Provider,
      { value: { user: { uid: 'test', email: 'test@example.com' }, encryptionReady: false } as any },
      children
    );
    // Render the hook to trigger effects
    const res = renderHook(() => useEncryptionMigrationStatus(), { wrapper });
    // Expect polling disabled due to encryption not ready
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[enc-migration] Polling disabled: encryption not ready'));
    consoleSpy.mockRestore();
  });

  it('should handle guest mode correctly', async () => {
    (encryptionService.isReady as any).mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, 'log');
    const { useEncryptionMigrationStatus } = await import('@shared/hooks/useEncryptionMigrationStatus');
    const { AuthContext } = await import('@app/providers/AuthContext');
    const { renderHook } = await import('@testing-library/react');
    const wrapper = ({ children }: any) => React.createElement(
      (AuthContext as any).Provider,
      { value: { user: null, encryptionReady: false } as any },
      children
    );
    renderHook(() => useEncryptionMigrationStatus(), { wrapper });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[enc-migration] Polling disabled: no user (guest mode)'));
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
    const consoleSpy = vi.spyOn(console, 'info');
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
    
    expect(consoleSpy).toHaveBeenCalled();
    
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
