import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptionService } from '../services/encryptionService';
import { firebaseDataService } from '../services/firebaseDataService';

// Mock Web Crypto API with deterministic behavior for testing
const mockCrypto = {
  subtle: {
    encrypt: async (algorithm: AesGcmParams, key: CryptoKey, data: ArrayBuffer) => {
      const input = new Uint8Array(data);
      const output = new Uint8Array(input.length + 16);
      for (let i = 0; i < input.length; i++) {
        output[i] = input[i] ^ 0x42;
      }
      // Add deterministic auth tag (all zeros)
      for (let i = input.length; i < output.length; i++) {
        output[i] = 0;
      }
      return output.buffer;
    },
    decrypt: async (algorithm: AesGcmParams, key: CryptoKey, data: ArrayBuffer) => {
      const input = new Uint8Array(data);
      // Reverse the XOR operation
      const output = new Uint8Array(input.length - 16);
      for (let i = 0; i < output.length; i++) {
        output[i] = input[i] ^ 0x42; // Remove auth tag
      }
      return output.buffer;
    },
    importKey: async (format: string, keyData: ArrayBuffer, algorithm: Algorithm, extractable: boolean, keyUsages: string[]) => {
      return { algorithm, extractable, type: 'secret', usages: keyUsages };
    },
    deriveKey: async (algorithm: Algorithm, baseKey: CryptoKey, derivedKeyAlgorithm: Algorithm, extractable: boolean, keyUsages: string[]) => {
      return { algorithm, extractable, type: 'secret', usages: keyUsages };
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
    },
    getRandomValues: (array: Uint8Array) => {
      // Use deterministic values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = (i * 7) % 256; // Deterministic pseudo-random
      }
      return array;
    }
  };
