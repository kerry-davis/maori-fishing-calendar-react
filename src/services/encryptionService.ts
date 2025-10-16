/*
 * Client-side application layer encryption service.
 * Provides per-user symmetric encryption (AES-GCM) for selected Firestore fields.
 *
 * Threat Model:
 *  - Protects confidentiality of selected fields at rest in Firestore from casual inspection.
 *  - Does NOT protect against a fully compromised client runtime or XSS (keys live in memory).
 *  - Queryable fields must remain in plaintext (ids, foreign keys, timestamps, etc.).
 *
 * Key Management:
 *  - Deterministic key derived from user email + build-time pepper + per-user salt (moderate obfuscation, NOT high security).
 *  - Derived CryptoKey is kept only in-memory; never persisted.
 *  - Salt key: enc_salt_<userId>
 *  - Ciphertext format: enc:v1:<base64(iv)>:<base64(cipher)>
 *
 * Backward Compatibility:
 *  - Plain values (non prefixed) are returned as-is by decrypt routines.
 *  - Mixed state supported; re-saving will encrypt newly configured fields once key ready.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { DEV_WARN, PROD_WARN } from '../utils/loggingHelpers';

const ENC_PREFIX = 'enc:v1:';

interface EncryptionConfigEntry {
  fields?: string[];              // direct scalar fields to encrypt
  arrayFields?: string[];         // arrays of scalars to encrypt element-wise
  nested?: Record<string, EncryptionConfigEntry>; // future expansion
}

// Which fields to encrypt per logical collection
// Adjust as needed; keep query/index fields out.
const encryptionConfig: Record<string, EncryptionConfigEntry> = {
  trips: {
    fields: ['water', 'location', 'companions', 'notes'], // leaving 'hours' plaintext for potential analytics
  },
  weatherLogs: {
    fields: ['sky', 'windCondition', 'windDirection'],
  },
  fishCaught: {
    fields: ['species', 'length', 'weight', 'time', 'details'],
    arrayFields: ['gear'],
  },
  tackleItems: {
    // type maybe used for filtering/grouping so we skip it; encrypt potentially sensitive labels
    fields: ['name', 'brand', 'colour'],
  },
  // gearTypes intentionally left mostly plaintext for usability; can add later if needed
};

function toUint8(arr: ArrayBuffer | Uint8Array): Uint8Array {
  return arr instanceof Uint8Array ? arr : new Uint8Array(arr);
}

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = toUint8(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

class EncryptionService {
  private key: CryptoKey | null = null;
  // Stored for potential future per-user config; currently only used to namespace salt.
  private _userId: string | null = null; // kept for future per-user extensions
  private ready = false;

  // Accessor (and linter usage) for potential external diagnostics
  get currentUserId(): string | null { return this._userId; }

  isReady(): boolean { return this.ready && !!this.key; }

  clear(): void {
    this.key = null;
    this._userId = null;
    this.ready = false;
  }

  async setDeterministicKey(userId: string, email: string): Promise<void> {
    this._userId = userId;
    const saltKey = `enc_salt_${userId}`;
    let saltB64 = localStorage.getItem(saltKey);
    if (!saltB64) {
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      saltB64 = bufToBase64(saltBytes);
      localStorage.setItem(saltKey, saltB64);
    }
    const saltBytes = base64ToBuf(saltB64);
    const pepper = (import.meta as any).env?.VITE_KEY_PEPPER || 'default-pepper';
    const material = new TextEncoder().encode(`${email}|${pepper}`);
    const subtle = (globalThis as any).crypto?.subtle;
    if (!subtle) {
      PROD_WARN('[Encryption] Web Crypto not available - operating in plaintext mode');
      this.key = null;
      this.ready = false;
      return;
    }
    // Basic PBKDF2 (reduced iterations due to deterministic & low entropy anyway) or simple hash fallback
    try {
      const baseKey = await subtle.importKey('raw', material, { name: 'PBKDF2' }, false, ['deriveBits','deriveKey']);
      this.key = await subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes, iterations: 60000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
    } catch {
      // Fallback: direct hash
      const hash = await subtle.digest('SHA-256', material);
      this.key = await subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
    }
    this.ready = true;
  }

  private async encryptRaw(plain: string): Promise<string> {
    if (!this.key) throw new Error('Encryption key not initialized');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, enc.encode(plain));
    return `${ENC_PREFIX}${bufToBase64(iv)}:${bufToBase64(cipherBuf)}`;
  }

  private async decryptRaw(ciphertext: string): Promise<string> {
    if (!this.key) throw new Error('Encryption key not initialized');
    if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext; // plaintext fallback
    try {
      const parts = ciphertext.split(':');
      // enc v1 iv cipher
      const ivB64 = parts[2];
      const cipherB64 = parts[3];
      const iv = base64ToBuf(ivB64);
      const cipher = base64ToBuf(cipherB64);
  const ivCopy = new Uint8Array(iv); // copy
  const cipherCopy = new Uint8Array(cipher);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivCopy }, this.key, cipherCopy);
      const dec = new TextDecoder();
      return dec.decode(plainBuf);
    } catch (e) {
      DEV_WARN('[Encryption] Decrypt failed, returning ciphertext:', e);
      return ciphertext;
    }
  }

  // Public helpers
  async encryptValue(value: any): Promise<any> {
    if (value == null) return value;
    if (!this.isReady()) return value; // fallback to plaintext
    if (typeof value === 'string') return this.encryptRaw(value);
    if (typeof value === 'number' || typeof value === 'boolean') return this.encryptRaw(String(value));
    // For objects / arrays we JSON stringify
    return this.encryptRaw(JSON.stringify(value));
  }

  async decryptValue(value: any): Promise<any> {
    if (value == null) return value;
    if (typeof value !== 'string') return value; // Non-string can't be our ciphertext format
    if (!value.startsWith(ENC_PREFIX)) return value;
    const plain = await this.decryptRaw(value);
    // Attempt JSON parse
    try { return JSON.parse(plain); } catch { return plain; }
  }

  async encryptFields(collection: string, obj: any): Promise<any> {
    const config = encryptionConfig[collection];
    if (!config) return obj;
    if (!this.isReady()) return obj; // store plaintext if key absent

    const clone: any = { ...obj };

    // Scalar fields
    if (config.fields) {
      for (const field of config.fields) {
        if (field in clone && clone[field] != null) {
          try { clone[field] = await this.encryptValue(clone[field]); } catch (e) { DEV_WARN('[Encryption] Encrypt field failed:', collection, field, e); }
        }
      }
    }

    // Array fields
    if (config.arrayFields) {
      for (const field of config.arrayFields) {
        if (Array.isArray(clone[field])) {
          const arr = clone[field] as any[];
          clone[field] = await Promise.all(arr.map(v => this.encryptValue(v)));
        }
      }
    }

    clone._encrypted = true;
    return clone;
  }

  async decryptObject(collection: string, obj: any): Promise<any> {
    const config = encryptionConfig[collection];
    if (!config) return obj;
    // We attempt decryption field-wise regardless of key availability (will no-op for plaintext)
    const clone: any = { ...obj };

    const tasks: Promise<void>[] = [];

    if (config.fields) {
      for (const field of config.fields) {
        if (field in clone && typeof clone[field] === 'string') {
          tasks.push(this.decryptValue(clone[field]).then(v => { clone[field] = v; }));
        }
      }
    }

    if (config.arrayFields) {
      for (const field of config.arrayFields) {
        if (Array.isArray(clone[field])) {
          const arr = clone[field];
          tasks.push((async () => {
            const dec: any[] = [];
            for (const item of arr) {
              if (typeof item === 'string') dec.push(await this.decryptValue(item)); else dec.push(item);
            }
            clone[field] = dec;
          })());
        }
      }
    }

    try { await Promise.all(tasks); } catch {/* ignore individual failures */}
    return clone;
  }
}

export const encryptionService = new EncryptionService();
export type { EncryptionConfigEntry };

// Export field map for migration reuse
export const ENCRYPTION_COLLECTION_FIELD_MAP: Record<string, { fields: string[]; arrayFields?: string[] }> = {
  trips: { fields: ['water', 'location', 'companions', 'notes'] },
  weatherLogs: { fields: ['sky', 'windCondition', 'windDirection'] },
  fishCaught: { fields: ['species', 'length', 'weight', 'time', 'details'], arrayFields: ['gear'] },
  tackleItems: { fields: ['name', 'brand', 'colour'] }
};

export function isPossiblyEncrypted(value: any): boolean {
  return typeof value === 'string' && value.startsWith('enc:v1:');
}

// Helper used by migration & tests: determine if object still has any plaintext fields
// for a given collection (based on ENCRYPTION_COLLECTION_FIELD_MAP). Mirrors logic in
// the background migration to decide if a document requires encryption.
export function objectNeedsEncryption(collection: string, obj: any): boolean {
  const cfg = ENCRYPTION_COLLECTION_FIELD_MAP[collection];
  if (!cfg) return false;
  if (cfg.fields) {
    for (const f of cfg.fields) {
      const v = (obj as any)[f];
      if (typeof v === 'string' && v && !isPossiblyEncrypted(v)) return true;
    }
  }
  if (cfg.arrayFields) {
    for (const af of cfg.arrayFields) {
      const arr = (obj as any)[af];
      if (Array.isArray(arr) && arr.some(v => typeof v === 'string' && !isPossiblyEncrypted(v))) return true;
    }
  }
  return false;
}