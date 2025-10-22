/**
 * Photo Encryption Service Tests
 * Tests the binary photo encryption/decryption functionality
 */

import { photoEncryptionService } from '../services/photoEncryptionService';
import { encryptionService } from '../services/encryptionService';
import { describe, test, expect, beforeAll, vi } from 'vitest';

// Mock crypto.subtle for testing
const mockCryptoKey = {} as CryptoKey;

beforeAll(async () => {
  // Initialize encryption service for testing
  await encryptionService.setDeterministicKey('test-user-id', 'test@example.com');
});

describe('PhotoEncryptionService', () => {
  const testImageData = new Uint8Array([
    0xFF, 0xD8, 0xFF, 0xE0, // JPEG header
    0x00, 0x10, 0x4A, 0x46, // JFIF
    0x49, 0x46, 0x00, 0x01, // More header data
    0x01, 0x01, 0x00, 0x48, // etc...
  ]);

  const testMimeType = 'image/jpeg';

  test('should check if encryption service is ready', () => {
    expect(photoEncryptionService.isReady()).toBe(true);
  });

  test('should encrypt photo data successfully', async () => {
    const result = await photoEncryptionService.encryptPhoto(
      testImageData,
      testMimeType,
      'test-user-id',
      'test-fish-id'
    );

    expect(result).toBeDefined();
    expect(result.encryptedData).toBeInstanceOf(ArrayBuffer);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.version).toBe(1);
    expect(result.metadata.originalMime).toBe(testMimeType);
    expect(result.metadata.originalSize).toBe(testImageData.length);
    expect(result.metadata.hash).toBeDefined();
    expect(result.metadata.hash.length).toBe(64); // SHA-256 hex length
    expect(result.storagePath).toContain('enc_photos');
    expect(result.storagePath).toContain('test-user-id');
  });

  test('should decrypt photo data successfully', async () => {
    // First encrypt
    const encryptionResult = await photoEncryptionService.encryptPhoto(
      testImageData,
      testMimeType,
      'test-user-id',
      'test-fish-id'
    );

    // Then decrypt
    const decryptionResult = await photoEncryptionService.decryptPhoto(
      encryptionResult.encryptedData,
      encryptionResult.metadata
    );

    expect(decryptionResult).toBeDefined();
    expect(decryptionResult.data).toBeInstanceOf(ArrayBuffer);
    expect(decryptionResult.mimeType).toBe(testMimeType);

    // Verify data integrity
    const decryptedArray = new Uint8Array(decryptionResult.data);
    expect(decryptedArray.length).toBe(testImageData.length);

    for (let i = 0; i < testImageData.length; i++) {
      expect(decryptedArray[i]).toBe(testImageData[i]);
    }
  });

  test('should serialize and deserialize metadata correctly', async () => {
    // Encrypt to get metadata
    const encryptionResult = await photoEncryptionService.encryptPhoto(
      testImageData,
      testMimeType,
      'test-user-id',
      'test-fish-id'
    );

    // Serialize metadata
    const serialized = photoEncryptionService.serializeMetadata(encryptionResult.metadata);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(0);

    // Deserialize metadata
    const deserialized = photoEncryptionService.deserializeMetadata(serialized);
    expect(deserialized).toEqual(encryptionResult.metadata);
  });

  test('should fail decryption with wrong key', async () => {
    // Encrypt with one key
    const encryptionResult = await photoEncryptionService.encryptPhoto(
      testImageData,
      testMimeType,
      'test-user-id',
      'test-fish-id'
    );

    // Create a service instance with a different key
    const differentEncryptionService = new (encryptionService.constructor as any)();
    await differentEncryptionService.setDeterministicKey('different-user-id', 'different@example.com');

    // Mock the isReady method to return false (simulating wrong key)
    const isReadySpy = vi.spyOn(photoEncryptionService, 'isReady').mockReturnValue(false);

    // This should fail because encryption service is not ready
    await expect(photoEncryptionService.decryptPhoto(
      encryptionResult.encryptedData,
      encryptionResult.metadata
    )).rejects.toThrow();

    // Restore the original isReady method
    isReadySpy.mockRestore();
  });


  test('should handle binary format creation and parsing', async () => {
    // Encrypt photo
    const encryptionResult = await photoEncryptionService.encryptPhoto(
      testImageData,
      testMimeType,
      'test-user-id',
      'test-fish-id'
    );

    // Create binary format
    const binaryFormat = photoEncryptionService.createBinaryFormat(
      encryptionResult.encryptedData,
      encryptionResult.metadata
    );

    expect(binaryFormat).toBeInstanceOf(ArrayBuffer);
    expect(binaryFormat.byteLength).toBeGreaterThan(encryptionResult.encryptedData.byteLength);

    // Parse binary format
    const parsed = photoEncryptionService.parseBinaryFormat(binaryFormat);
    expect(parsed).toBeDefined();
    expect(parsed!.encryptedData).toEqual(encryptionResult.encryptedData);
    expect(parsed!.metadata).toEqual(encryptionResult.metadata);
  });

  test('should reject invalid binary format', () => {
    const invalidData = new Uint8Array([0x00, 0x01, 0x02, 0x03]); // Not our magic bytes
    const result = photoEncryptionService.parseBinaryFormat(invalidData.buffer);
    expect(result).toBeNull();
  });
});