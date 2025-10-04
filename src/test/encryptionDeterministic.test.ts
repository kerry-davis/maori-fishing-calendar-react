import { describe, it, expect, beforeAll } from 'vitest';
import { encryptionService, isPossiblyEncrypted, ENCRYPTION_COLLECTION_FIELD_MAP } from '../services/encryptionService';

describe('deterministic encryption service', () => {
  beforeAll(async () => {
    await encryptionService.setDeterministicKey('user-1', 'user1@example.com');
  });

  it('encrypts and decrypts a scalar value via fields API', async () => {
    const trip = { water: 'Harbour', location: 'Spot A', companions: 'Alice', notes: 'Calm day' };
    const enc = await encryptionService.encryptFields('trips', trip);
    expect(isPossiblyEncrypted(enc.water)).toBe(true);
    const dec = await encryptionService.decryptObject('trips', enc);
    expect(dec.water).toBe('Harbour');
    expect(dec.notes).toBe('Calm day');
  });

  it('encrypts array fields', async () => {
    const fish = { species: 'Snapper', length: '30cm', weight: '1kg', time: '12:00', details: 'Test', gear: ['Lure A','Rig B'] };
    const enc = await encryptionService.encryptFields('fishCaught', fish);
    expect(enc.gear.every((g: string) => isPossiblyEncrypted(g))).toBe(true);
    const dec = await encryptionService.decryptObject('fishCaught', enc);
    expect(dec.gear).toEqual(['Lure A','Rig B']);
  });

  it('object without config remains unchanged', async () => {
    const plain = { foo: 'bar' };
    const enc = await encryptionService.encryptFields('unknownCollection', plain);
    expect(enc.foo).toBe('bar');
  });

  it('isPossiblyEncrypted detects ciphertext prefix', () => {
    expect(isPossiblyEncrypted('enc:v1:abc:def')).toBe(true);
    expect(isPossiblyEncrypted('plain')).toBe(false);
  });
});
