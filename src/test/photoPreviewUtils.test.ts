import { describe, it, expect } from 'vitest';
import { getFishPhotoPreview } from '../utils/photoPreviewUtils';
import type { FishCaught } from '../types';

const baseFish: Partial<FishCaught> = {
  id: 'test-id',
  tripId: 1,
  species: 'Snapper',
  length: '50',
  weight: '2',
  time: '12:00',
  gear: [],
  details: '',
};

const fishWithPhoto: FishCaught = { ...baseFish, photo: 'photo-url' } as FishCaught;
const fishWithPhotoUrl: FishCaught = { ...baseFish, photoUrl: 'photo-url' } as FishCaught;
const fishWithPhotoPath: FishCaught = { ...baseFish, photoPath: 'photo-path' } as FishCaught;
const fishEmpty: FishCaught = { ...baseFish } as FishCaught;

describe('getFishPhotoPreview', () => {
  it('returns photo if present', async () => {
    expect(await getFishPhotoPreview(fishWithPhoto)).toBe('photo-url');
  });
  it('returns photoUrl if present', async () => {
    expect(await getFishPhotoPreview(fishWithPhotoUrl)).toBe('photo-url');
  });
  it('returns photoPath if present (unencrypted)', async () => {
    expect(await getFishPhotoPreview(fishWithPhotoPath)).toBe('photo-path');
  });
  it('returns undefined if no image exists', async () => {
    expect(await getFishPhotoPreview(fishEmpty)).toBeUndefined();
  });
});
