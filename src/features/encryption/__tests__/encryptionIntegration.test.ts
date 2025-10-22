import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptionService } from '@shared/services/encryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    encrypt: async (algorithm: AesGcmParams, key: CryptoKey, data: ArrayBuffer) => {
      // Mock encryption - return some deterministic data based on input
      const input = new Uint8Array(data);
      const output = new Uint8Array(input.length + 16); // Add space for auth tag
      for (let i = 0; i < input.length; i++) {
        output[i] = input[i] ^ 0x42; // Simple XOR for mock
      }
      // Add mock auth tag
      for (let i = input.length; i < output.length; i++) {
        output[i] = Math.floor(Math.random() * 256);
      }
      return output.buffer;
    },
    decrypt: async (algorithm: AesGcmParams, key: CryptoKey, data: ArrayBuffer) => {
      // Mock decryption - reverse of encrypt
      const input = new Uint8Array(data);
      const output = new Uint8Array(input.length - 16); // Remove auth tag
      for (let i = 0; i < output.length; i++) {
        output[i] = input[i] ^ 0x42; // Reverse XOR
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
      // Mock SHA-256
      const hash = new Uint8Array(32);
      for (let i = 0; i < data.byteLength; i++) {
        hash[i % 32] = (hash[i % 32] + new Uint8Array(data)[i]) % 256;
      }
      return hash.buffer;
    },
    deriveBits: async (algorithm: Algorithm, baseKey: CryptoKey, length: number) => {
      // Mock PBKDF2
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

// Setup mock crypto
Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true
});

describe('Encryption Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    
    // Reset encryption service
    encryptionService.clear();
    
    // Mock environment
    (import.meta as any).env = { VITE_KEY_PEPPER: 'test-pepper' };
  });

  afterEach(() => {
    localStorage.clear();
    encryptionService.clear();
  });

  describe('Key Setup and Lifecycle', () => {
    it('should initialize encryption key with user credentials', async () => {
      const userId = 'test-user-123';
      const email = 'test@example.com';

      await encryptionService.setDeterministicKey(userId, email);

      expect(encryptionService.isReady()).toBe(true);
      expect(encryptionService.currentUserId).toBe(userId);
    });

    it('should clear key on logout', async () => {
      const userId = 'test-user-123';
      const email = 'test@example.com';

      await encryptionService.setDeterministicKey(userId, email);
      expect(encryptionService.isReady()).toBe(true);

      encryptionService.clear();
      expect(encryptionService.isReady()).toBe(false);
      expect(encryptionService.currentUserId).toBe(null);
    });

    it('should handle missing VITE_KEY_PEpper gracefully', async () => {
      delete (import.meta as any).env?.VITE_KEY_PEPPER;
      
      const userId = 'test-user-123';
      const email = 'test@example.com';

      // Should not throw but service should not be ready
      await encryptionService.setDeterministicKey(userId, email);
      expect(encryptionService.isReady()).toBe(false);
    });
  });

  describe('Read/Write Cycles', () => {
    beforeEach(async () => {
      await encryptionService.setDeterministicKey('test-user', 'test@example.com');
      expect(encryptionService.isReady()).toBe(true);
    });

    it('should encrypt and decrypt trip data', async () => {
      const tripData = {
        id: 1,
        date: '2023-10-05',
        water: 'Lake Test',
        location: 'Test Location',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing trip!',
        userId: 'test-user'
      };

      const encrypted = await encryptionService.encryptFields('trips', tripData);
      expect(encrypted._encrypted).toBe(true);
      expect(encrypted.water).not.toBe(tripData.water); // Should be encrypted

      const decrypted = await encryptionService.decryptObject('trips', encrypted);
      expect(decrypted.water).toBe(tripData.water);
      expect(decrypted.location).toBe(tripData.location);
      expect(decrypted.notes).toBe(tripData.notes);
      expect(decrypted.hours).toBe(tripData.hours); // Should remain plaintext
    });

    it('should encrypt and decrypt weather log data', async () => {
      const weatherData = {
        id: 'weather-1',
        tripId: 1,
        timeOfDay: 'morning',
        sky: 'overcast',
        windCondition: 'light',
        windDirection: 'north',
        waterTemp: 15.5,
        airTemp: 18.0,
        userId: 'test-user'
      };

      const encrypted = await encryptionService.encryptFields('weatherLogs', weatherData);
      expect(encrypted._encrypted).toBe(true);

      const decrypted = await encryptionService.decryptObject('weatherLogs', encrypted);
      expect(decrypted.sky).toBe(weatherData.sky);
      expect(decrypted.windCondition).toBe(weatherData.windCondition);
    });

    it('should encrypt and decrypt fish caught data including arrays', async () => {
      const fishData = {
        id: 'fish-1',
        tripId: 1,
        species: 'Trout',
        length: 30.5,
        weight: 2.5,
        time: '08:30',
        details: 'Caught on spinner',
        gear: ['spinner', '6lb line', 'chartreuse lure'],
        userId: 'test-user'
      };

      const encrypted = await encryptionService.encryptFields('fishCaught', fishData);
      expect(encrypted._encrypted).toBe(true);
      expect(Array.isArray(encrypted.gear)).toBe(true);

      const decrypted = await encryptionService.decryptObject('fishCaught', encrypted);
      expect(decrypted.species).toBe(fishData.species);
      expect(decrypted.gear).toEqual(fishData.gear);
    });

    it('should handle mixed encrypted/plaintext state gracefully', async () => {
      const mixedData = {
        id: 1,
        water: 'enc:v1:abc123:', // Already encrypted format
        location: 'Plaintext Location',
        hours: 4
      };

      const decrypted = await encryptionService.decryptObject('trips', mixedData);
      // Should not error and should handle gracefully
      expect(decrypted.id).toBe(1);
      expect(decrypted.hours).toBe(4);
    });

    it('should return plaintext when encryption service not ready', async () => {
      encryptionService.clear();
      
      const data = {
        id: 1,
        water: 'Lake Test',
        location: 'Test Location'
      };

      const encrypted = await encryptionService.encryptFields('trips', data);
      expect(encrypted).toEqual(data); // Should be unchanged
      expect(encrypted._encrypted).toBeUndefined();
    });
  });

  describe('FirebaseDataService Integration', () => {
    it('should use convertFromFirestore with collection hints for decryption', () => {
      // Mock convertFromFirestore method (we can't easily test the full path without Firebase setup)
      const mockData = {
        water: 'enc:v1:test123:ciphertextdata',
        location: 'enc:v1:test456:morecipher',
        hours: 4
      };

      // This tests the signature and flow
      const result = (firebaseDataService as any).convertFromFirestore(
        mockData, 
        1, 
        'firestore-doc-id', 
        'trips'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await encryptionService.setDeterministicKey('test-user', 'test@example.com');
    });

    it('should handle encryption failures gracefully', async () => {
      // Mock encryption to fail
      const originalEncrypt = mockCrypto.subtle.encrypt;
      mockCrypto.subtle.encrypt = async () => {
        throw new Error('Encryption failed');
      };

      const data = {
        id: 1,
        water: 'Test Water',
        location: 'Test Location'
      };

      const result = await encryptionService.encryptFields('trips', data);
      // Should return original data on error
      expect(result).toEqual(data);

      // Restore
      mockCrypto.subtle.encrypt = originalEncrypt;
    });

    it('should handle decryption failures gracefully', async () => {
      // Mock decryption to fail
      const originalDecrypt = mockCrypto.subtle.decrypt;
      mockCrypto.subtle.decrypt = async (_algorithm: AesGcmParams, _key: CryptoKey, _data: ArrayBuffer) => {
        throw new Error('Decryption failed');
      };

      const encryptedData = 'enc:v1:test123:invalidcipher';

      const result = await encryptionService.decryptValue(encryptedData);
      // Should return original data on error
      expect(result).toBe(encryptedData);

      // Restore
      mockCrypto.subtle.decrypt = originalDecrypt;
    });
  });
});
