import { describe, it, expect, beforeAll } from 'vitest';
import { BrowserZipImportService } from '../services/browserZipImportService';

function makeFakeImage(size: number): Uint8Array {
  // Generate deterministic pseudo-bytes
  const buf = new Uint8Array(size);
  for (let i = 0; i < size; i++) buf[i] = (i * 31 + 7) & 0xff;
  return buf;
}

describe('Smoke: import perf with photo cache', () => {
  const svc = new BrowserZipImportService();
  const zip = new Map<string, Uint8Array>();
  const NUM = 20; // simulate ~20 images

  beforeAll(() => {
    // Create fake image entries to exercise hashing/cache
    for (let i = 0; i < NUM; i++) {
      const bytes = makeFakeImage(200_000); // ~200 KB each synthetic
      zip.set(`photos/img_${i}.jpg`, bytes);
    }
  });

  it('first run compresses, second run reuses cache and is faster', async () => {
    const t1 = performance.now();
    const r1 = await (svc as any).__test_processImages(zip, true);
    const d1 = performance.now() - t1;
    expect(r1.compressionStats.imagesProcessed).toBe(NUM);

    const t2 = performance.now();
    const r2 = await (svc as any).__test_processImages(zip, true);
    const d2 = performance.now() - t2;
    expect(r2.compressionStats.imagesProcessed).toBe(NUM);

    // Assert second run is at least 2x faster in this synthetic test environment
    // (Allows headroom for CI variability)
    expect(d2).toBeLessThan(d1 * 0.5);

    // Expose numbers in test output for smoke visibility
    console.log(`[SMOKE] first: ${Math.round(d1)}ms, second: ${Math.round(d2)}ms`);
  });
});
