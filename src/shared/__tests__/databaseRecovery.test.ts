import { describe, it, expect, vi } from 'vitest';
import { DatabaseService } from '../services/databaseService';
import { DB_CONFIG } from '../types';

describe('IndexedDB Recovery Logic', () => {
  it('should recover from version mismatch by deleting and recreating the database', async () => {
    // Simulate VersionError on first open
    let openCalled = 0;
    const originalOpen = indexedDB.open;
    const originalDelete = indexedDB.deleteDatabase;
    let deleteCalled = false;
    // Helper to create a mock IDBOpenDBRequest
    function createMockRequest() {
      return {
        onerror: undefined,
        onsuccess: undefined,
        error: undefined,
      } as any;
    }
    // @ts-ignore
    indexedDB.open = vi.fn((name, version) => {
      openCalled++;
      const req = createMockRequest();
      if (openCalled === 1) {
        // Simulate VersionError
        setTimeout(() => {
          req.error = { name: 'VersionError', message: 'Version mismatch' };
          if (typeof req.onerror === 'function') req.onerror({ target: req });
        }, 10);
      } else {
        // Simulate successful open
        setTimeout(() => {
          if (typeof req.onsuccess === 'function') req.onsuccess({ target: { result: {} } });
        }, 10);
      }
      return req;
    });
    // @ts-ignore
    indexedDB.deleteDatabase = vi.fn((name) => {
      deleteCalled = true;
      const req = createMockRequest();
      setTimeout(() => {
        if (typeof req.onsuccess === 'function') req.onsuccess();
      }, 10);
      return req;
    });

    const service = new DatabaseService();
    await expect(service.initialize()).resolves.toBeUndefined();
    expect(openCalled).toBe(2);
    expect(deleteCalled).toBe(true);

    // Restore originals
    // @ts-ignore
    indexedDB.open = originalOpen;
    // @ts-ignore
    indexedDB.deleteDatabase = originalDelete;
  });
});
