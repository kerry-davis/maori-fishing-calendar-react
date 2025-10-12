// Shared encrypted photo preview logic for modals
import type { FishCaught } from '../types';
import { firebaseDataService } from '../services/firebaseDataService';

/**
 * Returns a displayable photo URL for a FishCaught record, handling encrypted photos.
 * - If encrypted, decrypts and returns a blob URL (async).
 * - If not encrypted, returns photoUrl or photo.
 * - If decryption fails, returns a placeholder SVG.
 *
 * @param fish FishCaught record
 * @returns Promise<string> - displayable photo URL
 */
export async function getFishPhotoPreview(fish: FishCaught): Promise<string> {
  // Detect encrypted photo: must have encryptedMetadata and enc_photos path
  const isEncrypted = Boolean(fish.encryptedMetadata && typeof fish.photoPath === 'string' && fish.photoPath.includes('enc_photos'));
  const rawPhoto: string | undefined = fish.photoUrl || fish.photo;
  if (isEncrypted && typeof fish.photoPath === 'string') {
    try {
      const decryptedData = await firebaseDataService.getDecryptedPhoto(
        fish.photoPath,
        fish.encryptedMetadata
      );
      if (decryptedData) {
        const blob = new Blob([decryptedData.data], { type: decryptedData.mimeType });
        return URL.createObjectURL(blob);
      } else {
        return createPlaceholderSVG('Encrypted Photo');
      }
    } catch (err) {
      console.warn('Failed to decrypt photo for display:', err);
      return createPlaceholderSVG('Encrypted Photo');
    }
  }
  return rawPhoto || createPlaceholderSVG('No Photo');
}

/**
 * Returns a simple SVG placeholder for missing or encrypted photos.
 */
export function createPlaceholderSVG(label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='100%' height='100%' fill='%23eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='12' fill='%23666'>${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
