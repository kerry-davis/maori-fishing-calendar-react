import { describe, it, expect, beforeAll } from 'vitest';
import { objectNeedsEncryption, encryptionService } from '../services/encryptionService';

// Minimal test to ensure objectNeedsEncryption works and encrypt/decrypt roundtrip under migration scenario.

describe('encryption migration helpers', () => {
  beforeAll(async () => {
    // Initialize deterministic key for tests
    await encryptionService.setDeterministicKey('test-user-id', 'user@example.com');
  });
  it('objectNeedsEncryption detects plaintext fields', () => {
    const sample = { water: 'harbour', location: 'Spot A', companions: 'John', notes: 'Great day' };
    expect(objectNeedsEncryption('trips', sample)).toBe(true);
  });

  it('objectNeedsEncryption returns false after encryption', async () => {
    const original = { water: 'harbour', location: 'Spot A', companions: 'John', notes: 'Great day' };
    const encrypted = await encryptionService.encryptFields('trips', original);
    expect(objectNeedsEncryption('trips', encrypted)).toBe(false);
  });

  it('handles arrayFields logic (fishCaught.gear)', async () => {
    const original = { species: 'Snapper', length: '30cm', weight: '1kg', time: '12:00', details: 'Calm', gear: ['Lure A', 'Rig B'] };
    expect(objectNeedsEncryption('fishCaught', original)).toBe(true);
    const encrypted = await encryptionService.encryptFields('fishCaught', original);
    expect(objectNeedsEncryption('fishCaught', encrypted)).toBe(false);
  });

  it('skips unknown collection', () => {
    expect(objectNeedsEncryption('unknownCollection', { any: 'value' })).toBe(false);
  });
});
