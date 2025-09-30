/**
 * Photo Cache Service
 * Stores compressed image results in IndexedDB, keyed by content hash and options
 * to avoid recompressing the same images on subsequent imports.
 */

type CachedPhoto = {
  key: string; // hash+options
  dataUri: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  createdAt: number;
};

class PhotoCacheService {
  private static DB_NAME = 'photoCacheDB';
  private static STORE_NAME = 'images';
  private static DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  // Fallback for non-browser/test environments without IndexedDB (e.g., Node/jsdom)
  private useMemory: boolean = false;
  private memoryStore: Map<string, CachedPhoto> = new Map();

  private async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    // Detect availability of IndexedDB
    const hasIndexedDB = typeof indexedDB !== 'undefined' && !!indexedDB;

    if (!hasIndexedDB) {
      // Use in-memory cache in environments without IndexedDB (tests/SSR)
      this.useMemory = true;
      this.initPromise = Promise.resolve();
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(PhotoCacheService.DB_NAME, PhotoCacheService.DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PhotoCacheService.STORE_NAME)) {
          db.createObjectStore(PhotoCacheService.STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    return this.initPromise;
  }

  async get(key: string): Promise<CachedPhoto | null> {
    await this.init();
    if (this.useMemory) {
      return this.memoryStore.get(key) || null;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(PhotoCacheService.STORE_NAME, 'readonly');
      const store = tx.objectStore(PhotoCacheService.STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CachedPhoto) || null);
      req.onerror = () => reject(req.error);
    });
  }

  async set(entry: CachedPhoto): Promise<void> {
    await this.init();
    if (this.useMemory) {
      this.memoryStore.set(entry.key, entry);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(PhotoCacheService.STORE_NAME, 'readwrite');
      const store = tx.objectStore(PhotoCacheService.STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const photoCacheService = new PhotoCacheService();
