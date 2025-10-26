// Minimal ULID generator (time + randomness, Crockford base32)
const CROCKFORD32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(time: number, len = 10): string {
  let out = '';
  for (let i = len; i > 0; i--) {
    out = CROCKFORD32[time % 32] + out;
    time = Math.floor(time / 32);
  }
  return out;
}

function randomChars(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CROCKFORD32[Math.floor(Math.random() * 32)];
  }
  return out;
}

export function generateULID(date: number = Date.now()): string {
  return encodeTime(date) + randomChars(16);
}
