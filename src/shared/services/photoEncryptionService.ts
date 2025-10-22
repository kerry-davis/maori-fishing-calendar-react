/**
 * Photo Encryption Service
 * Handles binary photo encryption using AES-GCM with the existing user key infrastructure
 *
 * Binary Format:
 * - Magic bytes: "ENC1" (4 bytes)
 * - Version: 1 (1 byte)
 * - IV length: 12 (1 byte, always 12 for AES-GCM)
 * - IV: 12 bytes
 * - Encrypted data: variable length
 * - Auth tag: 16 bytes (included in encrypted data for AES-GCM)
 */

import { encryptionService } from './encryptionService';
import { PROD_ERROR } from '../utils/loggingHelpers';

interface EncryptedPhotoMetadata {
  version: number;
  iv: Uint8Array;
  originalMime: string;
  originalSize: number;
  encryptedSize: number;
  hash: string; // SHA-256 hash of original data for integrity
}

interface PhotoEncryptionResult {
  encryptedData: ArrayBuffer;
  metadata: EncryptedPhotoMetadata;
  storagePath: string;
}

class PhotoEncryptionService {
  private static MAGIC_BYTES = new Uint8Array([0x45, 0x4E, 0x43, 0x31]); // "ENC1"
  private static VERSION = 1;
  private static IV_LENGTH = 12;

  /**
   * Check if encryption service is ready
   */
  isReady(): boolean {
    return encryptionService.isReady();
  }

  /**
   * Encrypt photo binary data
   */
  async encryptPhoto(
    photoData: ArrayBuffer | Uint8Array,
    mimeType: string,
    userId: string,
    fishId?: string
  ): Promise<PhotoEncryptionResult> {
    if (!this.isReady()) {
      throw new Error('Encryption service not initialized');
    }

    const data = photoData instanceof Uint8Array ? photoData : new Uint8Array(photoData);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(PhotoEncryptionService.IV_LENGTH));

    // Calculate hash of original data for integrity verification
    const dataForHash = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataForHash as ArrayBuffer);
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    try {
      // Encrypt the photo data using existing encryption service
      const encryptedArrayBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        (encryptionService as any).key,
        dataForHash as ArrayBuffer
      );

      // Create metadata
      const metadata: EncryptedPhotoMetadata = {
        version: PhotoEncryptionService.VERSION,
        iv,
        originalMime: mimeType,
        originalSize: data.length,
        encryptedSize: encryptedArrayBuffer.byteLength,
        hash
      };

      // Generate storage path
      const timestamp = Date.now();
      const storagePath = `users/${userId}/enc_photos/${fishId || 'temp'}_${timestamp}_${hash.substring(0, 8)}.enc`;

      return {
        encryptedData: encryptedArrayBuffer,
        metadata,
        storagePath
      };
    } catch (error) {
      PROD_ERROR('Photo encryption failed:', error);
      throw new Error(`Failed to encrypt photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt photo binary data
   */
  async decryptPhoto(
    encryptedData: ArrayBuffer,
    metadata: EncryptedPhotoMetadata
  ): Promise<{ data: ArrayBuffer; mimeType: string }> {
    if (!this.isReady()) {
      throw new Error('Encryption service not initialized');
    }

    if (metadata.version !== PhotoEncryptionService.VERSION) {
      throw new Error(`Unsupported encryption version: ${metadata.version}`);
    }

    try {
      // Decrypt the photo data
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: metadata.iv.buffer.slice(metadata.iv.byteOffset, metadata.iv.byteOffset + metadata.iv.byteLength) as ArrayBuffer },
        (encryptionService as any).key,
        encryptedData
      );

      // Verify hash if provided
      if (metadata.hash) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', decryptedBuffer);
        const actualHash = Array.from(new Uint8Array(hashBuffer))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        if (actualHash !== metadata.hash) {
          throw new Error('Photo data integrity check failed');
        }
      }

      return {
        data: decryptedBuffer,
        mimeType: metadata.originalMime
      };
    } catch (error) {
      PROD_ERROR('Photo decryption failed:', error);
      throw new Error(`Failed to decrypt photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Serialize metadata for storage in Firestore
   */
  serializeMetadata(metadata: EncryptedPhotoMetadata): string {
    const serializable = {
      ...metadata,
      iv: Array.from(metadata.iv),
      hash: metadata.hash
    };
    return btoa(JSON.stringify(serializable));
  }

  /**
   * Deserialize metadata from Firestore storage
   */
  deserializeMetadata(serialized: string): EncryptedPhotoMetadata {
    try {
      const parsed = JSON.parse(atob(serialized));
      return {
        ...parsed,
        iv: new Uint8Array(parsed.iv)
      };
    } catch (error) {
      throw new Error(`Invalid metadata format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create binary format with magic bytes and metadata
   * This is an alternative to storing metadata separately in Firestore
   */
  createBinaryFormat(encryptedData: ArrayBuffer, metadata: EncryptedPhotoMetadata): ArrayBuffer {
    const metadataBuffer = new TextEncoder().encode(JSON.stringify({
      ...metadata,
      iv: Array.from(metadata.iv)
    }));

    const totalSize =
      PhotoEncryptionService.MAGIC_BYTES.length +
      1 + // version
      1 + // IV length
      metadata.iv.length +
      metadataBuffer.length +
      4 + // metadata length
      encryptedData.byteLength;

    const buffer = new ArrayBuffer(totalSize);
    const view = new Uint8Array(buffer);
    const dataView = new DataView(buffer);

    let offset = 0;

    // Magic bytes
    view.set(PhotoEncryptionService.MAGIC_BYTES, offset);
    offset += PhotoEncryptionService.MAGIC_BYTES.length;

    // Version
    dataView.setUint8(offset, metadata.version);
    offset += 1;

    // IV length
    dataView.setUint8(offset, metadata.iv.length);
    offset += 1;

    // IV
    view.set(metadata.iv, offset);
    offset += metadata.iv.length;

    // Metadata length
    dataView.setUint32(offset, metadataBuffer.length, true);
    offset += 4;

    // Metadata
    view.set(new Uint8Array(metadataBuffer), offset);
    offset += metadataBuffer.length;

    // Encrypted data
    view.set(new Uint8Array(encryptedData), offset);

    return buffer;
  }

  /**
   * Parse binary format back to components
   */
  parseBinaryFormat(buffer: ArrayBuffer): { encryptedData: ArrayBuffer; metadata: EncryptedPhotoMetadata } | null {
    const view = new Uint8Array(buffer);

    // Check magic bytes
    for (let i = 0; i < PhotoEncryptionService.MAGIC_BYTES.length; i++) {
      if (view[i] !== PhotoEncryptionService.MAGIC_BYTES[i]) {
        return null; // Not our format
      }
    }

    let offset = PhotoEncryptionService.MAGIC_BYTES.length;

    // Version
    const version = view[offset];
    offset += 1;

    if (version !== PhotoEncryptionService.VERSION) {
      throw new Error(`Unsupported binary format version: ${version}`);
    }

    // IV length
    const ivLength = view[offset];
    offset += 1;

    // IV
    const iv = view.slice(offset, offset + ivLength);
    offset += ivLength;

    // Metadata length
    if (offset + 4 > view.length) return null;
    const metadataLength = new DataView(buffer).getUint32(offset, true);
    offset += 4;

    // Metadata
    if (offset + metadataLength > view.length) return null;
    const metadataBuffer = view.slice(offset, offset + metadataLength);
    offset += metadataLength;

    // Encrypted data (rest of buffer)
    const encryptedData = buffer.slice(offset);

    // Parse metadata
    const metadataText = new TextDecoder().decode(metadataBuffer);
    const metadata = JSON.parse(metadataText);

    return {
      encryptedData,
      metadata: {
        ...metadata,
        iv: new Uint8Array(iv)
      }
    };
  }
}

export const photoEncryptionService = new PhotoEncryptionService();
export type { EncryptedPhotoMetadata, PhotoEncryptionResult };