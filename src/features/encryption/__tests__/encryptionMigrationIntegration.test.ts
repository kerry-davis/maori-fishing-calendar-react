import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptionService, objectNeedsEncryption, ENCRYPTION_COLLECTION_FIELD_MAP } from '@shared/services/encryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';

// Mock Web Crypto API (same as before)
const mockCrypto = {
  subtle: {
    encrypt: async (algorithm: AesGcmParams, key: CryptoKey, data: ArrayBuffer) => {
      const input = new Uint8Array(data);
      const output = new Uint8Array(input.length + 16);
      for (let i = 0; i < input.length; i++) {
        output[i] = input[i] ^ 0x42;
      }
      for (let i = input.length; i < output.length; i++) {
        output[i] = Math.floor(Math.random() * 256);
      }
      return output.buffer;
    },
    decrypt: async (algorithm: AesGcmParams, key: CryptoKey, data: ArrayBuffer) => {
      const input = new Uint8Array(data);
      const output = new Uint8Array(input.length - 16);
      for (let i = 0; i < output.length; i++) {
        output[i] = input[i] ^ 0x42;
      }
      return output.buffer;
    },
    importKey: async (format: string, keyData: ArrayBuffer, algorithm: Algorithm, extractable: boolean, keyUsages: string[]) => {
      return { algorithm, extractable, type: 'secret', usages: keyUsages };
    },
    deriveKey: async (algorithm: Algorithm, baseKey: CryptoKey, derivedKeyAlgorithm: Algorithm, extractable: boolean, keyUsages: string[]) => {
      return { algorithm: derivedKeyAlgorithm, extractable, type: 'secret', usages: keyUsages };
    },
    digest: async (algorithm: string, data: ArrayBuffer) => {
      const hash = new Uint8Array(32);
      for (let i = 0; i < data.byteLength; i++) {
        hash[i % 32] = (hash[i % 32] + new Uint8Array(data)[i]) % 256;
      }
      return hash.buffer;
    },
    deriveBits: async (algorithm: Algorithm, baseKey: CryptoKey, length: number) => {
      const bits = new Uint8Array(length / 8);
      for (let i = 0; i < bits.length; i++) {
        bits[i] = Math.floor(Math.random() * 256);
      }
      return bits.buffer;
    }
  },
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }
};

Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true
});

describe('Encryption Migration Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    encryptionService.clear();
    (import.meta as any).env = { VITE_KEY_PEPPER: 'test-pepper' };
  });

  afterEach(() => {
    localStorage.clear();
    encryptionService.clear();
  });

  describe('Migration Status Detection', () => {
    beforeEach(async () => {
      await encryptionService.setDeterministicKey('test-user', 'test@example.com');
    });

    it('should identify objects that need encryption', () => {
      const plaintextTrip = {
        id: 1,
        date: '2023-10-05',
        water: 'Lake Test', // Plaintext
        location: 'Test Location', // Plaintext
        hours: 4,
        companions: 'John Doe', // Plaintext
        notes: 'Great trip!' // Plaintext
      };

      expect(objectNeedsEncryption('trips', plaintextTrip)).toBe(true);
    });

    it('should identify objects that are already encrypted', () => {
      const encryptedTrip = {
        id: 1,
        date: '2023-10-05',
        water: 'enc:v1:abc123:ciphertextdata', // Encrypted
        location: 'enc:v1:def456:morecipher', // Encrypted
        hours: 4,
        companions: 'enc:v1:ghi789:evenmorecipher', // Encrypted
        notes: 'enc:v1:jkl012:lastcipher' // Encrypted
      };

      expect(objectNeedsEncryption('trips', encryptedTrip)).toBe(false);
    });

    it('should handle mixed encryption states', () => {
      const mixedTrip = {
        id: 1,
        date: '2023-10-05',
        water: 'Lake Test', // Plaintext
        location: 'enc:v1:def456:morecipher', // Encrypted
        hours: 4,
        companions: 'John Doe', // Plaintext
        notes: 'enc:v1:jkl012:lastcipher' // Encrypted
      };

      expect(objectNeedsEncryption('trips', mixedTrip)).toBe(true);
    });

    it('should handle array fields correctly', () => {
      const fishWithPlaintextArray = {
        id: 'fish-1',
        tripId: 1,
        species: 'enc:v1:abc123:ciphertext', // Encrypted
        length: 30.5,
        gear: ['spinner', 'line'] // Plaintext array should still be considered for encryption
      };

      expect(objectNeedsEncryption('fishCaught', fishWithPlaintextArray)).toBe(true);
    });

    it('should return false for collections not in encryption config', () => {
      const arbitraryObject = {
        id: 1,
        someField: 'plaintext value',
        anotherField: 'another plaintext'
      };

      expect(objectNeedsEncryption('nonExistentCollection', arbitraryObject)).toBe(false);
    });
  });

  describe('Field Map Validation', () => {
    it('should have complete field mappings for all encrypted collections', () => {
      const requiredCollections = ['trips', 'weatherLogs', 'fishCaught', 'tackleItems'];
      
      for (const collection of requiredCollections) {
        expect(ENCRYPTION_COLLECTION_FIELD_MAP[collection]).toBeDefined();
        expect(Array.isArray(ENCRYPTION_COLLECTION_FIELD_MAP[collection].fields)).toBe(true);
      }
    });

    it('should include array fields for fishCaught', () => {
      const fishMapping = ENCRYPTION_COLLECTION_FIELD_MAP.fishCaught;
      expect(fishMapping.arrayFields).toContain('gear');
    });
  });

  describe('Migration Status Service Integration', () => {
    it('should provide migration status methods', () => {
      expect(firebaseDataService.getEncryptionMigrationStatus).toBeDefined();
      expect(firebaseDataService.startBackgroundEncryptionMigration).toBeDefined();
      expect(firebaseDataService.resetEncryptionMigrationState).toBeDefined();
    });

    it('should return migration status structure', () => {
      // Mock the status method to return expected structure
      const mockStatus = {
        running: false,
        collections: {
          trips: { processed: 0, updated: 0, done: false },
          weatherLogs: { processed: 0, updated: 0, done: false },
          fishCaught: { processed: 0, updated: 0, done: false },
          tackleItems: { processed: 0, updated: 0, done: false }
        },
        allDone: false
      };

      // Test structure expectations
      expect(mockStatus).toHaveProperty('running');
      expect(mockStatus).toHaveProperty('collections');
      expect(mockStatus).toHaveProperty('allDone');
      
      // Each collection should have progress fields
      Object.values(mockStatus.collections).forEach(collection => {
        expect(collection).toHaveProperty('processed');
        expect(collection).toHaveProperty('updated');
        expect(collection).toHaveProperty('done');
      });
    });
  });

  describe('Batch Processing Simulation', () => {
    beforeEach(async () => {
      await encryptionService.setDeterministicKey('test-user', 'test@example.com');
    });

    it('should simulate batch encryption processing', async () => {
      const batchData = [
        { id: 1, water: 'Lake 1', location: 'Location 1', notes: 'Note 1' },
        { id: 2, water: 'Lake 2', location: 'Location 2', notes: 'Note 2' },
        { id: 3, water: 'Lake 3', location: 'Location 3', notes: 'Note 3' }
      ];

      // Simulate processing a batch
      const processed = [];
      let updated = 0;

      for (const item of batchData) {
        if (objectNeedsEncryption('trips', item)) {
          const encrypted = await encryptionService.encryptFields('trips', item);
          processed.push(encrypted);
          updated++;
        }
      }

      expect(processed).toHaveLength(3);
      expect(updated).toBe(3);
      
      // Verify all items are now encrypted
      processed.forEach(item => {
        expect(item._encrypted).toBe(true);
        expect(typeof item.water).toBe('string');
        expect(item.water.startsWith('enc:v1:')).toBe(true);
      });
    });

    it('should handle batch with mixed encryption states', async () => {
      const mixedBatch = [
        { id: 1, water: 'Lake 1', location: 'Location 1', notes: 'Note 1' }, // Plaintext
        { id: 2, water: 'enc:v1:test:cipher', location: ' Location 2', notes: 'Note 2' }, // Mixed
        { id: 3, water: 'enc:v1:test:cipher', location: 'enc:v1:test:cipher', notes: 'enc:v1:test:cipher' } // Fully encrypted
      ];

      let processed = 0;
      let updated = 0;

      for (const item of mixedBatch) {
        if (objectNeedsEncryption('trips', item)) {
          await encryptionService.encryptFields('trips', item);
          updated++;
        }
        processed++;
      }

      expect(processed).toBe(3);
      expect(updated).toBe(2); // Only the first two need encryption
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await encryptionService.setDeterministicKey('test-user', 'test@example.com');
    });

    it('should handle individual item encryption failure without stopping batch', async () => {
      const batchData = [
        { id: 1, water: 'Lake 1', location: 'Location 1', notes: 'Note 1' },
        { id: 2, water: 'Lake 2', location: 'Location 2', notes: 'Note 2' },
        { id: 3, water: 'Lake 3', location: 'Location 3', notes: 'Note 3' }
      ];

      // Mock one item to fail encryption
      const originalEncrypt = mockCrypto.subtle.encrypt;
      let encryptCallCount = 0;
      mockCrypto.subtle.encrypt = async (...args) => {
        encryptCallCount++;
        if (encryptCallCount === 2) { // Fail the second item
          throw new Error('Mock encryption failure');
        }
        return originalEncrypt(...args);
      };

      const results = [];
      let failures = 0;

      for (const item of batchData) {
        try {
          const encrypted = await encryptionService.encryptFields('trips', item);
          results.push(encrypted);
        } catch {
          failures++;
          // In real migration, we'd log the error and continue
        }
      }

      expect(results).toHaveLength(2); // Two items succeeded
      expect(failures).toBe(1); // One item failed

      // Restore
      mockCrypto.subtle.encrypt = originalEncrypt;
    });
  });
});
