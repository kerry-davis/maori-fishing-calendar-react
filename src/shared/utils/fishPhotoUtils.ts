import type { FishCaught, FishPhoto } from '../types';
import { generateULID } from './ulid';

type LegacyPhotoFields = Partial<Pick<
  FishCaught,
  'id' | 'photo' | 'photoHash' | 'photoPath' | 'photoMime' | 'photoUrl' | 'encryptedMetadata'
>>;

function clonePhoto(photo: FishPhoto, fallbackIndex: number): FishPhoto {
  const id = photo.id || generateULID();
  const order = typeof photo.order === 'number' ? photo.order : fallbackIndex;
  return { ...photo, id, order };
}

export function normalizeFishPhotos(photos?: FishPhoto[] | null, legacy?: LegacyPhotoFields): FishPhoto[] {
  const normalized: FishPhoto[] = [];

  if (Array.isArray(photos)) {
    photos.forEach((photo, index) => {
      if (!photo) return;
      normalized.push(clonePhoto(photo, index));
    });
  }

  const hasLegacySource =
    !normalized.length &&
    legacy &&
    Boolean(legacy.photo || legacy.photoPath || legacy.photoUrl);

  if (hasLegacySource) {
    normalized.push({
      id: `${legacy?.id || generateULID()}-primary`,
      order: 0,
      photo: legacy?.photo,
      photoHash: legacy?.photoHash,
      photoPath: legacy?.photoPath,
      photoMime: legacy?.photoMime,
      photoUrl: legacy?.photoUrl,
      encryptedMetadata: legacy?.encryptedMetadata,
      isPrimary: true,
    });
  }

  if (!normalized.length) {
    return [];
  }

  normalized.sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    return orderDiff !== 0 ? orderDiff : a.id.localeCompare(b.id);
  });

  return normalized.map((photo, index) => ({ ...photo, order: index }));
}

export function getPrimaryPhoto(photos?: FishPhoto[] | null, primaryPhotoId?: string): FishPhoto | null {
  if (!Array.isArray(photos) || photos.length === 0) {
    return null;
  }

  if (primaryPhotoId) {
    const match = photos.find((photo) => photo.id === primaryPhotoId);
    if (match) {
      return match;
    }
  }

  const flagged = photos.find((photo) => photo.isPrimary);
  if (flagged) {
    return flagged;
  }

  return photos[0];
}

export function deriveLegacyPhotoFields(photos?: FishPhoto[] | null, primaryPhotoId?: string): Partial<FishCaught> {
  const primary = getPrimaryPhoto(photos, primaryPhotoId);

  if (!primary) {
    return {
      primaryPhotoId: undefined,
      photo: undefined,
      photoHash: undefined,
      photoPath: undefined,
      photoMime: undefined,
      photoUrl: undefined,
      encryptedMetadata: undefined,
    };
  }

  return {
    primaryPhotoId: primary.id,
    photo: primary.photo,
    photoHash: primary.photoHash,
    photoPath: primary.photoPath,
    photoMime: primary.photoMime,
    photoUrl: primary.photoUrl,
    encryptedMetadata: primary.encryptedMetadata,
  };
}

export function ensurePhotoPrimary(photos: FishPhoto[], primaryPhotoId?: string): FishPhoto[] {
  if (!Array.isArray(photos) || photos.length === 0) {
    return [];
  }

  const normalized = photos.map((photo) => ({
    ...photo,
    isPrimary: false,
  }));

  const primary = getPrimaryPhoto(normalized, primaryPhotoId);
  if (!primary) {
    normalized[0].isPrimary = true;
    return normalized;
  }

  return normalized.map((photo) => ({
    ...photo,
    isPrimary: photo.id === primary.id,
  }));
}
