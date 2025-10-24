// Shared encrypted photo preview logic for modals
import type { FishCaught } from '../types';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import { storage } from '@shared/services/firebase';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { compressImage } from './imageCompression';

/**
 * Returns a displayable photo URL for a FishCaught record, handling encrypted photos.
 * - If encrypted, decrypts and returns a blob URL (async).
 * - If not encrypted, returns photoUrl or photo.
 * - If decryption fails, returns a placeholder SVG.
 *
 * @param fish FishCaught record
 * @returns Promise<string | undefined> - displayable photo URL or undefined
 */
export async function getFishPhotoPreview(fish: FishCaught): Promise<string | undefined> {
  // Detect encrypted photo: must have encryptedMetadata and enc_photos path
  const isEncrypted = Boolean(fish.encryptedMetadata && typeof fish.photoPath === 'string' && fish.photoPath.includes('enc_photos'));
  const rawPhoto: string | undefined = fish.photoUrl || fish.photo;
  // If photoPath exists and is not encrypted, try to resolve it to a usable URL
  if (!isEncrypted && fish.photoPath) {
    // If it's already a blob or data URL, return as-is
    if (fish.photoPath.startsWith('blob:') || fish.photoPath.startsWith('data:') || fish.photoPath.startsWith('http')) {
      return fish.photoPath;
    }

    // Otherwise assume it's a storage-relative path and try to get a download URL
    try {
      const ref = storageRef(storage, fish.photoPath);
      const url = await getDownloadURL(ref);
      return url;
    } catch {
      // If we can't resolve the storage path, return a friendly placeholder instead of the raw path
      return createPlaceholderSVG('No Photo');
    }
  }
  if (isEncrypted && typeof fish.photoPath === 'string') {
    try {
      const decryptedData = await firebaseDataService.getDecryptedPhoto(
        fish.photoPath,
        fish.encryptedMetadata
      );
      if (decryptedData) {
        // Downscale for preview to speed up gallery rendering
        try {
          const u8 = new Uint8Array(decryptedData.data);
          const c = await compressImage(u8, decryptedData.mimeType, { maxDimension: 512, quality: 0.7, convertTo: 'image/jpeg' });
          const blob = new Blob([c.bytes], { type: c.mime });
          return URL.createObjectURL(blob);
        } catch {
          const blob = new Blob([decryptedData.data], { type: decryptedData.mimeType });
          return URL.createObjectURL(blob);
        }
      } else {
        return createPlaceholderSVG('Encrypted Photo');
      }
    } catch {
      return createPlaceholderSVG('Encrypted Photo');
    }
  }
  // Return null/undefined if no image exists
  if (!fish.photoPath && !fish.photoUrl && !fish.photo) {
    return undefined;
  }
  return rawPhoto || undefined;
}

/**
 * Returns a simple SVG placeholder for missing or encrypted photos.
 */
export function createPlaceholderSVG(label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='100%' height='100%' fill='%23eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='12' fill='%23666'>${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
