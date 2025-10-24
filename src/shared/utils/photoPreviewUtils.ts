// Shared encrypted photo preview logic for modals
import type { FishCaught } from '../types';
import { firebaseDataService } from '@shared/services/firebaseDataService';
// no direct storage refs needed here; firebaseDataService handles blob retrieval
import { compressImage } from './imageCompression';
import { photoCacheService } from '@shared/services/photoCacheService';

// In-memory hot cache for this session (avoids IDB roundtrips)
const inMemoryPreviewCache = new Map<string, string>();

function makePreviewKey(fish: FishCaught, opts = { dim: 512, q: 0.7 }) {
  const path = fish.photoPath || fish.photoUrl || fish.photo || 'inline';
  const hash = fish.photoHash || '';
  return `preview|${path}|${hash}|${opts.dim}|${opts.q}`;
}

function bytesToDataUri(bytes: Uint8Array, mime: string): string {
  let binary = '';
  const len = bytes.length;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return `data:${mime};base64,${base64}`;
}

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
  const isGuest = !firebaseDataService.isAuthenticated?.() || (firebaseDataService as any).isGuest;
  const rawPhoto: string | undefined = fish.photoUrl || fish.photo;
  // If photoPath exists and is not encrypted, build or fetch a cached preview for authed users
  if (!isEncrypted && fish.photoPath) {
    if (isGuest) return createSignInEncryptedPlaceholder();

    const key = makePreviewKey(fish);
    const memHit = inMemoryPreviewCache.get(key);
    if (memHit) return memHit;
    const idbHit = await photoCacheService.get(key);
    if (idbHit?.dataUri) {
      inMemoryPreviewCache.set(key, idbHit.dataUri);
      return idbHit.dataUri;
    }

    try {
      const data = await firebaseDataService.getDecryptedPhoto(fish.photoPath);
      if (!data) return createPlaceholderSVG('No Photo');
      const u8 = new Uint8Array(data.data);
      const c = await compressImage(u8, data.mimeType, { maxDimension: 512, quality: 0.7, convertTo: 'image/jpeg' });
      const dataUri = bytesToDataUri(c.bytes, c.mime);
      inMemoryPreviewCache.set(key, dataUri);
      await photoCacheService.set({ key, dataUri, mimeType: c.mime, originalSize: u8.length, compressedSize: c.bytes.length, createdAt: Date.now() });
      return dataUri;
    } catch {
      return createPlaceholderSVG('No Photo');
    }
  }
  if (isEncrypted && typeof fish.photoPath === 'string') {
    // If unauthenticated, prompt sign-in instead of attempting decrypt
    if (isGuest) {
      return createSignInEncryptedPlaceholder();
    }
    try {
      const key = makePreviewKey(fish);
      const memHit = inMemoryPreviewCache.get(key);
      if (memHit) return memHit;
      const idbHit = await photoCacheService.get(key);
      if (idbHit?.dataUri) {
        inMemoryPreviewCache.set(key, idbHit.dataUri);
        return idbHit.dataUri;
      }

      const decryptedData = await firebaseDataService.getDecryptedPhoto(fish.photoPath, fish.encryptedMetadata);
      if (!decryptedData) return createSignInEncryptedPlaceholder();

      const u8 = new Uint8Array(decryptedData.data);
      const c = await compressImage(u8, decryptedData.mimeType, { maxDimension: 512, quality: 0.7, convertTo: 'image/jpeg' });
      const dataUri = bytesToDataUri(c.bytes, c.mime);
      inMemoryPreviewCache.set(key, dataUri);
      await photoCacheService.set({ key, dataUri, mimeType: c.mime, originalSize: u8.length, compressedSize: c.bytes.length, createdAt: Date.now() });
      return dataUri;
    } catch {
      return createSignInEncryptedPlaceholder();
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

export function createSignInEncryptedPlaceholder(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
    <rect width='100%' height='100%' fill='%23eee'/>
    <text x='50%' y='42%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%23666'>Sign in to view</text>
    <text x='50%' y='58%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%23666'>encrypted photos</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
