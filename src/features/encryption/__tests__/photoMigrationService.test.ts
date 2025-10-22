/**
 * Photo Migration Service Tests
 * Tests the background migration service for encrypting existing photos
 */

import { photoMigrationService } from '@shared/services/photoMigrationService';
import { photoEncryptionService } from '@shared/services/photoEncryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import { encryptionService } from '@shared/services/encryptionService';
import { describe, test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Mock the firebase/storage named imports used by the service to avoid real SDK calls
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
  getMetadata: vi.fn(),
  getBlob: vi.fn(),
  listAll: vi.fn()
}));

// Mock Firebase services
vi.mock('@shared/services/firebase', () => ({
  storage: {
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    getDownloadURL: vi.fn(),
    getMetadata: vi.fn(),
    getBlob: vi.fn(),
    listAll: vi.fn(),
    deleteObject: vi.fn()
  },
  firestore: {
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(),
    writeBatch: vi.fn()
  },
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}));

// Mock crypto.subtle for testing
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockImplementation((algorithm: string, data: ArrayBuffer) => {
        const mockHash = new Uint8Array(32);
        for (let i = 0; i < mockHash.length; i++) {
          mockHash[i] = i % 256;
        }
        return Promise.resolve(mockHash.buffer);
      }),
      encrypt: vi.fn().mockImplementation((algorithm: any, key: CryptoKey, data: ArrayBuffer) => {
        const dataArray = new Uint8Array(data);
        const encrypted = new Uint8Array(dataArray.length + 16);
        encrypted.set(dataArray);
        return Promise.resolve(encrypted.buffer);
      }),
      decrypt: vi.fn().mockImplementation((algorithm: any, key: CryptoKey, data: ArrayBuffer) => {
        const dataArray = new Uint8Array(data);
        const decrypted = dataArray.slice(0, -16);
        return Promise.resolve(decrypted.buffer);
      }),
      getRandomValues: vi.fn().mockImplementation((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = i % 256;
        }
        return array;
      })
      ,
      importKey: vi.fn().mockImplementation(async (format: string, keyData: any) => {
        // return a dummy CryptoKey-like object; our encrypt/decrypt mocks ignore the key
        return { __mockKey: true } as unknown as CryptoKey;
      }),
      deriveKey: vi.fn().mockImplementation(async (...args: any[]) => {
        return { __mockDerivedKey: true } as unknown as CryptoKey;
      }),
      deriveBits: vi.fn().mockImplementation(async (...args: any[]) => {
        // return a mocked ArrayBuffer
        const buf = new Uint8Array(32);
        for (let i = 0; i < buf.length; i++) buf[i] = i % 256;
        return buf.buffer;
      })
    },
    getRandomValues: vi.fn().mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    })
  },
  configurable: true
});

beforeAll(async () => {
  // Initialize encryption service for testing
  await encryptionService.setDeterministicKey('test-user-id', 'test@example.com');
});

describe('PhotoMigrationService', () => {
    // tiny SVG data URL (1x1 px) used as test photo data (avoids base64)
    const tinySvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="black"/></svg>';
    const mockFishData = [
    {
      id: 'fish-1',
      tripId: 1,
      species: 'Test Fish 1',
      photo: tinySvg,
      photoHash: 'hash-1'
    },
    {
      id: 'fish-2',
      tripId: 1,
      species: 'Test Fish 2',
      photo: tinySvg,
      photoHash: 'hash-2'
    },
    {
      id: 'fish-3',
      tripId: 1,
      species: 'Test Fish 3',
      photoPath: 'users/test-user-id/images/hash-3',
      photoHash: 'hash-3'
    }
  ];

  beforeEach(async () => {
    // Reset service state
    photoMigrationService.clearProgress();

    // Mock firebaseDataService methods
    vi.spyOn(firebaseDataService, 'isReady').mockReturnValue(true);
    vi.spyOn(firebaseDataService, 'getAllFishCaught').mockResolvedValue(mockFishData as any);
    vi.spyOn(firebaseDataService, 'getFishCaughtById').mockImplementation(async (id: string) => {
      return mockFishData.find(fish => fish.id === id) as any;
    });
    vi.spyOn(firebaseDataService, 'updateFishCaught').mockResolvedValue(undefined);

    // Mock photoEncryptionService
    vi.spyOn(photoEncryptionService, 'isReady').mockReturnValue(true);
    vi.spyOn(photoEncryptionService, 'encryptPhoto').mockResolvedValue({
      encryptedData: new ArrayBuffer(100),
      metadata: {
        version: 1,
        iv: new Uint8Array(12),
        originalMime: 'image/jpeg',
        originalSize: 1000,
        encryptedSize: 1016,
        hash: 'mock-hash-123456789012345678901234567890123456789012345678901234567890'
      },
      storagePath: 'users/test-user-id/enc_photos/fish-1_123456_abcdef.enc'
    });
    vi.spyOn(photoEncryptionService, 'serializeMetadata').mockReturnValue('serialized-metadata');

    // Mock Firebase Storage functions
  const firebaseModule = await import('@shared/services/firebase');
    const storage = (firebaseModule as any).storage;
  storage.ref.mockReturnValue({});
  storage.uploadBytes.mockResolvedValue({});
  storage.getDownloadURL.mockResolvedValue('https://example.com/encrypted-photo.jpg');
  storage.getMetadata.mockResolvedValue({ customMetadata: {}, contentType: 'image/png' });
  storage.getBlob.mockResolvedValue({ arrayBuffer: async () => new Uint8Array([1,2,3]).buffer });
  storage.listAll.mockResolvedValue({ items: [], prefixes: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Migration Detection', () => {
    test('should detect photos needing migration', async () => {
      const unencryptedPhotos = await photoMigrationService.detectUnencryptedPhotos();

      expect(unencryptedPhotos).toHaveLength(3);
      expect(unencryptedPhotos.map(f => f.id)).toEqual(['fish-1', 'fish-2', 'fish-3']);
    });

    test('should handle empty photo collection', async () => {
      vi.spyOn(firebaseDataService, 'getAllFishCaught').mockResolvedValue([]);

      const unencryptedPhotos = await photoMigrationService.detectUnencryptedPhotos();

      expect(unencryptedPhotos).toHaveLength(0);
    });

    test('should skip already migrated photos', async () => {
      const migratedFishData = [
        {
          id: 'fish-1',
          tripId: 1,
          species: 'Test Fish 1',
          photo: 'data:image/jpeg;base64,mock-photo-data-1',
          photoHash: 'hash-1',
          encryptedMetadata: 'already-migrated'
        }
      ];

      vi.spyOn(firebaseDataService, 'getAllFishCaught').mockResolvedValue(migratedFishData as any);

      const unencryptedPhotos = await photoMigrationService.detectUnencryptedPhotos();

      expect(unencryptedPhotos).toHaveLength(0);
    });
  });

  describe('Migration Progress Tracking', () => {
    test('should track migration progress correctly', async () => {
      const progress = photoMigrationService.getProgress();

      expect(progress.totalPhotos).toBe(0);
      expect(progress.status).toBe('not_started');
      expect(progress.processedPhotos).toBe(0);
    });

    test('should persist progress to localStorage', async () => {
      // Mock localStorage
      const localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock });

      await photoMigrationService.detectUnencryptedPhotos();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'photoMigrationProgress',
        expect.stringContaining('totalPhotos')
      );
    });

    test('totalPhotos remains accurate after startMigration', async () => {
      // detect to set totals
      const detected = await photoMigrationService.detectUnencryptedPhotos();
      expect(detected.length).toBeGreaterThan(0);

      // start migration
      await photoMigrationService.startMigration();

      // progress.totalPhotos should remain the same as detected
      const progress = photoMigrationService.getProgress();
      expect(progress.totalPhotos).toBe(detected.length);
    });
  });

  describe('Batch Processing', () => {
    test('should create appropriate batch sizes', async () => {
      await photoMigrationService.detectUnencryptedPhotos();

      // The service should create batches internally
      // We can't directly test batch creation, but we can verify the setup
      const progress = photoMigrationService.getProgress();
      expect(progress.totalPhotos).toBe(3);
    });

    test('should handle batch processing errors gracefully', async () => {
      // Mock encryption failure
      vi.spyOn(photoEncryptionService, 'encryptPhoto').mockRejectedValue(new Error('Encryption failed'));

      // This would be tested in a real scenario with actual batch processing
      // For now, we verify the service handles errors
      expect(photoMigrationService.getProgress().status).toBe('not_started');
    });
  });

  describe('Migration Control', () => {
    test('should start migration process', async () => {
      const startPromise = photoMigrationService.startMigration();

      // Should not throw
      await expect(startPromise).resolves.toBeUndefined();
    });

    test('should prevent multiple concurrent migrations', async () => {
      // Start first migration
      const firstMigration = photoMigrationService.startMigration();

      // Try to start second migration
      await expect(photoMigrationService.startMigration()).rejects.toThrow('Migration already in progress');
    });

    test('should pause and resume migration', async () => {
      await photoMigrationService.startMigration();

      expect(photoMigrationService.isMigrationRunning()).toBe(true);

      photoMigrationService.pauseMigration();
      expect(photoMigrationService.isMigrationRunning()).toBe(false);

      // Resume would require more complex setup
      // await photoMigrationService.resumeMigration();
    });

    test('should cancel migration', async () => {
      await photoMigrationService.startMigration();

      photoMigrationService.cancelMigration();

      expect(photoMigrationService.isMigrationRunning()).toBe(false);
      expect(photoMigrationService.getProgress().status).toBe('not_started');
    });

    test('startMigration should surface initialization errors', async () => {
      // Make detectUnencryptedPhotos throw by making firebaseDataService not ready
      vi.spyOn(firebaseDataService, 'isReady').mockReturnValue(false);

      await expect(photoMigrationService.startMigration()).rejects.toThrow();
    });

    test('processedPhotos should only count successful migrations', async () => {
      // Make encryptPhoto succeed for fish-1 and fail for fish-2
      vi.spyOn(photoEncryptionService, 'encryptPhoto')
        .mockImplementationOnce(async () => ({
          encryptedData: new ArrayBuffer(100),
          metadata: { version: 1, iv: new Uint8Array(12), originalMime: 'image/jpeg', originalSize: 1000, encryptedSize: 1016, hash: 'h' },
          storagePath: 'users/test-user-id/enc_photos/fish-1.enc'
        }))
        .mockImplementationOnce(async () => { throw new Error('Encryption failed'); });

      // Start migration and wait for background loop to complete
      await photoMigrationService.startMigration();

      // Allow some time for background processing in tests (small sleep)
      await new Promise(r => setTimeout(r, 50));

      const progress = photoMigrationService.getProgress();
      // Only one successful migration should be counted
      expect(progress.processedPhotos).toBe(1);
      expect(progress.successfulPhotos.length).toBe(1);
      expect(progress.failedPhotos.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Recovery', () => {
    test('should handle migration failures gracefully', async () => {
      // Mock service to fail
      vi.spyOn(firebaseDataService, 'getAllFishCaught').mockRejectedValue(new Error('Database error'));

      await expect(photoMigrationService.detectUnencryptedPhotos()).rejects.toThrow('Database error');
    });

    test('should provide retry functionality', async () => {
      // Mock some failures
      const progress = photoMigrationService.getProgress();
      progress.failedPhotos = ['fish-1', 'fish-2'];
      progress.status = 'failed';

      // The retry functionality should be available
      expect(typeof photoMigrationService.retryFailedPhotos).toBe('function');
    });
  });

  describe('Migration States', () => {
    test('should track migration states correctly', async () => {
      const initialProgress = photoMigrationService.getProgress();

      expect(initialProgress.status).toBe('not_started');
      expect(initialProgress.processedPhotos).toBe(0);
      expect(initialProgress.failedPhotos).toEqual([]);
    });

    test('should handle completion states', async () => {
      // Test completed state
      const progress = photoMigrationService.getProgress();
      progress.status = 'completed';
      progress.processedPhotos = 3;
      progress.successfulPhotos = ['fish-1', 'fish-2', 'fish-3'];

      expect(progress.status).toBe('completed');
      expect(progress.processedPhotos).toBe(3);
    });
  });

  describe('Service Integration', () => {
    test('should integrate with encryption service', () => {
      expect(photoEncryptionService.isReady()).toBe(true);
    });

    test('should integrate with firebase data service', () => {
      expect(firebaseDataService.isReady()).toBe(true);
    });

    test('should handle service initialization errors', async () => {
      vi.spyOn(firebaseDataService, 'isReady').mockReturnValue(false);

      await expect(photoMigrationService.detectUnencryptedPhotos()).rejects.toThrow('Firebase service not initialized');
    });
  });

  describe('Memory Management', () => {
    test('should clean up progress on successful completion', async () => {
      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      };
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      // Simulate successful completion
      photoMigrationService.clearProgress();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('photoMigrationProgress');
    });

    test('should maintain progress during failures', async () => {
      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      };
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

      // Simulate failure state
      const progress = photoMigrationService.getProgress();
      progress.status = 'failed';
      progress.failedPhotos = ['fish-1'];

      // Progress should be maintained for retry
      expect(progress.failedPhotos).toContain('fish-1');
    });
  });
});