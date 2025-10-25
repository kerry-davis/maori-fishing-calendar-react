import type { Trip, WeatherLog, FishCaught, ImportProgress } from "../types";
import { firestore, storage } from "@shared/services/firebase";
import { encryptionService, ENCRYPTION_COLLECTION_FIELD_MAP, isPossiblyEncrypted } from './encryptionService';
import { photoEncryptionService } from './photoEncryptionService';
import { databaseService } from "./databaseService";
import { validateUserContext, validateFirebaseOperation } from "../utils/userStateCleared";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  deleteField
} from "firebase/firestore";
import type { DocumentReference } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, getMetadata, listAll, deleteObject, getBlob } from "firebase/storage";
import type { StorageReference } from "firebase/storage";
import { DEV_LOG, DEV_WARN, PROD_ERROR } from "../utils/loggingHelpers";
import { compressImage } from "../utils/imageCompression";

type QueuedSyncOperation = {
  id?: number;
  operation?: string;
  collection?: string;
  data?: any;
  timestamp?: string;
};

type SyncCollectionName = 'trips' | 'weatherLogs' | 'fishCaught';

/**
 * Firebase Data Service - Cloud-first with offline fallback
 * Replaces IndexedDB with Firestore while maintaining offline functionality
 */
export class FirebaseDataService {
  private userId: string | null = null;
  private isGuest = true;
  private isOnline = navigator.onLine;
  private syncQueue: QueuedSyncOperation[] = [];
  private isInitialized = false;
  private storageInstance = storage;
  private hasLoggedStorageUnavailable = false;
  private isProcessingQueue = false;
  private queueRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      void this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Add emergency clear method to window for debugging
    (window as any).clearFirebaseSync = () => this.clearSyncQueue();
    (window as any).debugIdMappings = () => this.debugIdMappings();
  }

  private stripUndefined<T extends Record<string, any>>(obj: T): T {
    const copy: Record<string, any> = { ...obj };
    Object.keys(copy).forEach((k) => {
      if (copy[k] === undefined) delete copy[k];
    });
    return copy as T;
  }

  private sanitizeFishUpdatePayload(base: Record<string, any>): Record<string, any> {
    // Remove undefineds first
    const payload: Record<string, any> = this.stripUndefined(base);

    // If client indicates photo cleared or replaced, ensure we remove storage-backed fields
    const wantsClear = payload.photo === '' || payload.photoPath === '' || payload.photoUrl === '' || payload.encryptedMetadata === undefined;
    if (wantsClear) {
      payload.photo = deleteField();
      payload.photoPath = deleteField();
      payload.photoUrl = deleteField();
      payload.photoMime = deleteField();
      payload.photoHash = deleteField();
      payload.encryptedMetadata = deleteField();
    }

    return payload;
  }

  private ensureServiceReady(): void {
    if (!this.isReady()) {
      throw new Error('Service not initialized');
    }
  }

  private async runGuestAwareWrite<T>(
    operationName: string,
    guestOperation: () => Promise<T>,
    authenticatedOperation: () => Promise<T>
  ): Promise<T> {
    this.ensureServiceReady();

    // Bypass validateUserContext entirely for guest writes (userId is null)
    if (this.userId == null || this.isGuest) {
      return await guestOperation();
    }

    const validated = validateUserContext(this.userId, authenticatedOperation, undefined, operationName);
    if (!validated) {
      throw new Error(`User context validation failed for ${operationName}`);
    }

    return await validated;
  }

  // Simple stable stringify (sorted keys) for deterministic hashing
  private stableStringify(obj: any): string {
    const seen = new WeakSet();
    const stringify = (value: any): any => {
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        if (Array.isArray(value)) return value.map(stringify);
        const keys = Object.keys(value).sort();
        const out: any = {};
        for (const k of keys) out[k] = stringify(value[k]);
        return out;
      }
      return value;
    };
    return JSON.stringify(stringify(obj));
  }

  // Compute SHA-256 hex for bytes (ArrayBuffer or Uint8Array). Fallback to FNV-1a if subtle unavailable.
  private async sha256Hex(input: ArrayBuffer | Uint8Array): Promise<string> {
    try {
      if (crypto?.subtle?.digest) {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
        const bytes = new Uint8Array(hashBuffer);
        return Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch {
      // ignore and fallback
    }
    // Fallback: hash base64 string version with FNV1a (we'll build base64 outside if needed)
    const u8 = input instanceof Uint8Array ? input : new Uint8Array(input as ArrayBufferLike);
    const base64 = typeof Buffer !== 'undefined' ? Buffer.from(u8).toString('base64') : btoa(String.fromCharCode(...u8));
    return this.hashStringFNV1a(base64);
  }

  // Parse data URL to bytes and mime; supports data:*;base64,....
  private dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
    const match = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
    if (!match) return null;
    const mime = match[1];
    const b64 = match[2];
    try {
      const binary = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return { bytes, mime };
    } catch (e) {
      DEV_WARN('Failed to decode data URL image:', e);
      return null;
    }
  }

  // Ensure photo is present in Storage; returns reference fields
  private async ensurePhotoInStorage(
    userId: string,
    bytes: Uint8Array,
    mime: string
  ): Promise<
    | { photoHash: string; photoPath: string; photoMime: string; photoUrl: string; encryptedMetadata?: string }
    | { inlinePhoto: string; photoHash: string }
  >
  {
    // Compress before hashing/encryption to store smaller files
    try {
      const compressed = await compressImage(bytes, mime, {
        maxDimension: 1080,
        quality: 0.85,
        convertTo: 'image/jpeg',
      });
      bytes = compressed.bytes;
      mime = compressed.mime || mime;
    } catch {/* fallback to original */}

    const hash = await this.sha256Hex(bytes);
    const storageService = this.storageInstance;

    if (!storageService) {
      if (!this.hasLoggedStorageUnavailable) {
        DEV_WARN('[Storage] Firebase storage unavailable; skipping photo upload operations');
        this.hasLoggedStorageUnavailable = true;
      }
      const base64 = typeof Buffer !== 'undefined'
        ? Buffer.from(bytes).toString('base64')
        : btoa(String.fromCharCode(...bytes));
      const dataUrl = `data:${mime};base64,${base64}`;
      return { inlinePhoto: dataUrl, photoHash: hash };
    }

    // Check if photo encryption is enabled and ready
    const shouldEncrypt = photoEncryptionService.isReady();

    if (shouldEncrypt) {
      try {
        // Encrypt the photo data
        const encryptionResult = await photoEncryptionService.encryptPhoto(bytes, mime, userId);

        // Upload encrypted photo to Firebase Storage
        const ref = storageRef(storageService, encryptionResult.storagePath);
        await uploadBytes(ref, encryptionResult.encryptedData, {
          contentType: 'application/octet-stream', // Store as binary, not image
          customMetadata: {
            encrypted: 'true',
            originalMime: mime,
            version: '1'
          }
        });

        let url = '';
        try {
          url = await getDownloadURL(ref);
        } catch {
          // ignore; URL can be fetched later on demand
        }

        return {
          photoHash: hash,
          photoPath: encryptionResult.storagePath,
          photoMime: mime,
          photoUrl: url,
          encryptedMetadata: photoEncryptionService.serializeMetadata(encryptionResult.metadata)
        };
      } catch (encryptionError) {
        DEV_WARN('[Photo Encryption] Encryption failed, falling back to unencrypted storage:', encryptionError);
        // Fall through to unencrypted storage
      }
    }

    // Fallback to unencrypted storage (legacy behavior)
    const path = `users/${userId}/images/${hash}`;
    const ref = storageRef(storageService, path);
    try {
      // Try to get metadata to determine existence
      await getMetadata(ref);
    } catch {
      // Not found or other error: attempt to upload
      try {
        await uploadBytes(ref, bytes, { contentType: mime });
      } catch {
        // If another client raced and already uploaded, proceed quietly
        // console.warn('Upload failed (may already exist):', uploadErr);
      }
    }
    let url = '';
    try {
      url = await getDownloadURL(ref);
    } catch {
      // ignore; URL can be fetched later on demand
    }
    return { photoHash: hash, photoPath: path, photoMime: mime, photoUrl: url };
  }

  private async collectStorageObjects(path: string): Promise<StorageReference[]> {
    const storageService = this.storageInstance;
    if (!storageService) {
      if (!this.hasLoggedStorageUnavailable) {
        DEV_WARN('[Wipe] Firebase storage unavailable; skipping storage cleanup');
        this.hasLoggedStorageUnavailable = true;
      }
      return [];
    }

    const collected: StorageReference[] = [];
    const stack: StorageReference[] = [storageRef(storageService, path)];

    while (stack.length) {
      const current = stack.pop()!;
      try {
        const result = await listAll(current);
        collected.push(...result.items);
        if (result.prefixes.length) {
          stack.push(...result.prefixes);
        }
      } catch (error: any) {
        const code = error?.code;
        if (code === 'storage/object-not-found' || code === 'storage/invalid-root-operation') {
          continue;
        }
        DEV_WARN(`[Storage] Failed to list path ${current.fullPath}:`, error);
      }
    }

    return collected;
  }

  /**
   * Get decrypted photo data for display
   */
  async getDecryptedPhoto(photoPath: string, encryptedMetadata?: string): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
    if (!photoPath) return null;

    const storageService = this.storageInstance;
    if (!storageService) {
      DEV_WARN('[Photo] Storage unavailable for photo decryption');
      return null;
    }

    try {
      const ref = storageRef(storageService, photoPath);
      const metadata = await getMetadata(ref);

      // Check if this is an encrypted photo
      if (metadata.customMetadata?.encrypted === 'true' && encryptedMetadata) {
        // Download encrypted data
        const encryptedBlob = await getBlob(ref);
        const encryptedArrayBuffer = await encryptedBlob.arrayBuffer();

        // Decrypt using metadata
        const photoMetadata = photoEncryptionService.deserializeMetadata(encryptedMetadata);

        return await photoEncryptionService.decryptPhoto(encryptedArrayBuffer, photoMetadata);
      } else {
        // Legacy unencrypted photo - return as blob data
        const blob = await getBlob(ref);
        return {
          data: await blob.arrayBuffer(),
          mimeType: metadata.contentType || 'image/jpeg'
        };
      }
    } catch (error) {
      PROD_ERROR('[Photo] Failed to retrieve photo:', error);
      return null;
    }
  }

  // Fast FNV-1a 32-bit hash for strings -> hex
  private hashStringFNV1a(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash >>> 0) * 0x01000193;
    }
    // Convert to 8-char hex
    return ('0000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  private computeFishContentHash(fish: FishCaught): string {
    // Only include meaningful fields
    const payload = {
      id: fish.id,
      tripId: fish.tripId,
      species: fish.species,
      length: fish.length,
      weight: fish.weight,
      time: fish.time,
      gearIds: Array.isArray((fish as any).gearIds) ? [...(fish as any).gearIds].sort() : undefined,
      gear: Array.isArray(fish.gear) ? [...fish.gear].sort() : fish.gear,
      details: fish.details,
      photoHash: fish.photoHash || null,
    };
    return this.hashStringFNV1a(this.stableStringify(payload));
  }

  private computeTripContentHash(trip: Trip): string {
    const payload = {
      id: trip.id,
      date: trip.date,
      water: trip.water,
      location: trip.location,
      hours: trip.hours,
      companions: trip.companions,
      notes: trip.notes,
    };
    return this.hashStringFNV1a(this.stableStringify(payload));
  }

  private computeWeatherContentHash(weather: WeatherLog): string {
    const payload = {
      id: weather.id,
      tripId: weather.tripId,
      timeOfDay: weather.timeOfDay,
      sky: weather.sky,
      windCondition: weather.windCondition,
      windDirection: weather.windDirection,
      waterTemp: weather.waterTemp,
      airTemp: weather.airTemp,
    };
    return this.hashStringFNV1a(this.stableStringify(payload));
  }

  /**
   * Initialize the service for guest or authenticated user
   */
  async initialize(userId?: string): Promise<void> {
    if (userId) {
      this.userId = userId;
      this.isGuest = false;
      this.loadSyncQueue(); // Load user-specific queue
      void this.processSyncQueue();
      DEV_LOG('Firebase Data Service initialized for user:', userId);
    } else {
      this.userId = null;
      this.isGuest = true;
      DEV_LOG('Firebase Data Service initialized for guest');
    }
    this.isInitialized = true;
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Returns true when a user is authenticated and the service is initialized
   */
  isAuthenticated(): boolean {
    return this.isInitialized && !this.isGuest;
  }

  /**
   * Returns true when in guest mode (no authenticated user) and initialized
   */
  isGuestMode(): boolean {
    return this.isInitialized && this.isGuest;
  }

  async switchToUser(userId: string): Promise<void> {
    if (this.isGuest) {
      this.userId = userId;
      this.isGuest = false;
      this.loadSyncQueue();
      void this.processSyncQueue();
      DEV_LOG('Switched to user mode:', userId);
    }
  }

  // TRIP OPERATIONS

  /**
   * Create a new trip with enhanced user context validation
   */
  async createTrip(tripData: Omit<Trip, "id">): Promise<number> {
    this.ensureServiceReady();
    // If running in guest mode, allow an explicit guest token path that does not rely on the
    // outer authenticated validateUserContext. This prevents the generic 'createTrip' token
    // from being implicitly allowed when no auth is present.
    if (this.isGuest) {
      // Data integrity checks
      this.validateTripData(tripData);

      const sanitizedTripData = {
        ...tripData,
        water: this.sanitizeString(tripData.water),
        location: this.sanitizeString(tripData.location),
        companions: tripData.companions ? this.sanitizeString(tripData.companions) : tripData.companions,
        notes: tripData.notes ? this.sanitizeString(tripData.notes) : tripData.notes,
      };

      // Use explicit guest token to bypass validation safely by performing the local DB write directly
      const created = await databaseService.createTrip(sanitizedTripData);
      return created as number;
    }

    // Enhanced validation with operation type for authenticated users
    return validateUserContext(this.userId, async () => {
      // Data integrity checks
      this.validateTripData(tripData);

      // Prepare payload with user context validation
      const sanitizedTripData = {
        ...tripData,
        water: this.sanitizeString(tripData.water),
        location: this.sanitizeString(tripData.location),
        companions: tripData.companions ? this.sanitizeString(tripData.companions) : tripData.companions,
        notes: tripData.notes ? this.sanitizeString(tripData.notes) : tripData.notes,
      };

      const tripId = Date.now();
      let tripWithUser: any = { ...sanitizedTripData, id: tripId, userId: this.userId };
      
      // Enhanced Firebase operation validation
      return validateFirebaseOperation(this.userId, tripWithUser, async (validatedPayload) => {
        let operationPayload = validatedPayload;
        try {
          operationPayload = await encryptionService.encryptFields('trips', operationPayload);
        } catch (e) {
          DEV_WARN('[encryption] trip encrypt failed', e);
        }

        DEV_LOG('Creating trip with enhanced validation for user:', this.userId);

        if (this.isOnline) {
          try {
            const docRef = await addDoc(collection(firestore, 'trips'), {
              ...operationPayload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            // Store the Firebase ID mapping
            await this.storeLocalMapping('trips', tripId.toString(), docRef.id);

            DEV_LOG('Trip created in Firestore with validation:', docRef.id);
            return tripId;
          } catch (error) {
            DEV_WARN('Firestore create failed, falling back to local:', error);
            return this.queueOperation('create', 'trips', operationPayload);
          }
        }

        return this.queueOperation('create', 'trips', operationPayload);
      }, 'createTrip');
    }, undefined, 'createTrip') as unknown as number || Promise.reject(new Error('User context validation failed'));
  }

  /**
   * Upsert a trip for import flows (idempotent by local ID for this user)
   * - If a trip with the same local id already exists in Firestore, update it
   * - Otherwise, create a new document
   */
  async upsertTripFromImport(trip: Trip): Promise<number> {
    if (!this.isReady()) throw new Error('Service not initialized');

    // When in guest mode, just upsert locally
    if (this.isGuest) {
      try {
        await databaseService.updateTrip(trip);
      } catch {
        await databaseService.createTrip({
          date: trip.date,
          water: trip.water,
          location: trip.location,
          hours: trip.hours,
          companions: trip.companions,
          notes: trip.notes,
        });
      }
      return trip.id;
    }

    const localId = trip.id;
    const cleanTrip: any = {};
    Object.entries(trip).forEach(([k, v]) => { if (v !== undefined) (cleanTrip as any)[k] = v; });
  let tripWithUser: any = { ...cleanTrip, userId: this.userId };
  try { tripWithUser = await encryptionService.encryptFields('trips', tripWithUser); } catch (e) { DEV_WARN('[encryption] trip encrypt failed', e); }
  const contentHash = this.computeTripContentHash(trip);
  tripWithUser.contentHash = contentHash;

    if (this.isOnline) {
      // Try mapping first
      const mappedId = await this.getFirebaseId('trips', localId.toString());
      if (mappedId) {
        try {
          const docRef = doc(firestore, 'trips', mappedId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const existing = snap.data();
            if ((existing as any).contentHash === contentHash) {
              return localId;
            }
            await updateDoc(docRef, { ...tripWithUser, updatedAt: serverTimestamp() });
            return localId;
          } else {
            // Stale mapping, remove and continue to query
            localStorage.removeItem(`idMapping_${this.userId}_trips_${localId}`);
          }
        } catch {
          // fall through to query path
        }
      }

      // Query by unique tuple (userId, id)
      try {
        const q = query(
          collection(firestore, 'trips'),
          where('userId', '==', this.userId),
          where('id', '==', localId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const existing = snapshot.docs[0];
          const existingData = existing.data();
          if ((existingData as any).contentHash === contentHash) {
            await this.storeLocalMapping('trips', localId.toString(), existing.id);
            return localId;
          }
          await updateDoc(existing.ref, { ...tripWithUser, updatedAt: serverTimestamp() });
          await this.storeLocalMapping('trips', localId.toString(), existing.id);
          return localId;
        }
      } catch (e) {
        DEV_WARN('Trip upsert query failed, falling back to create:', e);
      }

      // Create new
      const docRef = await addDoc(collection(firestore, 'trips'), {
        ...tripWithUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this.storeLocalMapping('trips', localId.toString(), docRef.id);
      return localId;
    }

    // Offline: queue as upsert (use update semantics with mapping later)
    await databaseService.updateTrip(trip);
    this.queueOperation('update', 'trips', tripWithUser);
    return localId;
  }

  /**
    * Get a trip by ID
    */
   async getTripById(id: number): Promise<Trip | null> {
     if (!this.isReady()) throw new Error('Service not initialized');

     if (this.isGuest) {
       return databaseService.getTripById(id);
     }

     if (this.isOnline) {
       try {
         const firebaseId = await this.getFirebaseId('trips', id.toString());
         if (firebaseId) {
           const docRef = doc(firestore, 'trips', firebaseId);
           const docSnap = await getDoc(docRef);

           if (docSnap.exists()) {
            const data = docSnap.data();
            return await this.convertFromFirestore(data, id, docSnap.id, 'trips');
           }
         }
       } catch (error) {
         DEV_WARN('Firestore get failed, trying local:', error);
       }
     }

     // Fallback to local storage
     return databaseService.getTripById(id);
   }

   /**
    * Get a trip by Firebase document ID (for cases where we have the Firebase ID directly)
    */
   async getTripByFirebaseId(firebaseId: string): Promise<Trip | null> {
     if (!this.isReady()) throw new Error('Service not initialized');

     if (this.isGuest) {
      throw new Error("Cannot get trip by Firebase ID in guest mode.");
     }

     if (this.isOnline) {
       try {
         const docRef = doc(firestore, 'trips', firebaseId);
         const docSnap = await getDoc(docRef);

         if (docSnap.exists()) {
           const data = docSnap.data();
           const localId = this.generateLocalId(firebaseId);
           return await this.convertFromFirestore(data, localId, firebaseId, 'trips');
         }
       } catch (error) {
         DEV_WARN('Firestore get by Firebase ID failed:', error);
       }
     }

     return null;
   }

  /**
    * Get all trips for a specific date
    */
   async getTripsByDate(date: string): Promise<Trip[]> {
    if (!this.isReady()) throw new Error('Service not initialized');

    // Guest mode bypass: perform local DB read directly
    if (this.isGuest) {
      return databaseService.getTripsByDate(date);
    }

    // UID validation: ensure operation is for current user
    return validateUserContext(this.userId, async () => {
      DEV_LOG('getTripsByDate called for date:', date, 'online:', this.isOnline);

      if (this.isOnline) {
        try {
          const q = query(
            collection(firestore, 'trips'),
            where('userId', '==', this.userId),
            where('date', '==', date)
          );

          const querySnapshot = await getDocs(q);
          DEV_LOG('Firestore query returned', querySnapshot.size, 'documents');
          const trips: Trip[] = [];

          // Process all documents concurrently
          const tripPromises = querySnapshot.docs.map((doc) => {
            const data = doc.data();
            const localId = data.id as number;
            this.storeLocalMapping('trips', localId.toString(), doc.id);
            return this.convertFromFirestore(data, localId, doc.id, 'trips');
          });

          trips.push(...(await Promise.all(tripPromises)));

          DEV_LOG('Returning', trips.length, 'trips from Firestore');
          return trips;
        } catch (error) {
          DEV_WARN('Firestore query failed, falling back to local:', error);
        }
      }

      // Fallback to local storage
      DEV_LOG('Using local storage fallback');
      const localTrips = await databaseService.getTripsByDate(date);
      DEV_LOG('Local storage returned', localTrips.length, 'trips');
      return localTrips;
    }) || Promise.reject(new Error('User context validation failed'));
   }

  /**
   * Get all trips
   */
  async getAllTrips(): Promise<Trip[]> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      return databaseService.getAllTrips();
    }

    if (this.isOnline) {
      try {
        DEV_LOG('Fetching trips from Firebase for user:', this.userId);
        const q = query(
          collection(firestore, 'trips'),
          where('userId', '==', this.userId),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        
        // Process all documents concurrently
        const tripPromises = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          const localId = data.id as number;
          this.storeLocalMapping('trips', localId.toString(), doc.id);
          return this.convertFromFirestore(data, localId, doc.id, 'trips');
        });

        const trips = await Promise.all(tripPromises) as Trip[];
        DEV_LOG(`Found ${trips.length} trips in Firebase for user ${this.userId}`);
        return trips;
      } catch (error) {
        PROD_ERROR('Firestore query failed, falling back to local:', error);
      }
    }

    // Fallback to local storage
    return databaseService.getAllTrips();
  }

  /**
    * Update a trip with enhanced user context validation
    */
  async updateTrip(trip: Trip): Promise<void> {
    await this.runGuestAwareWrite('updateTrip',
      () => databaseService.updateTrip(trip),
      async () => {
        let tripWithUser: any = { ...trip, userId: this.userId };

        return validateFirebaseOperation(this.userId, tripWithUser, async (validatedPayload) => {
          let operationPayload = validatedPayload;
          try {
            operationPayload = await encryptionService.encryptFields('trips', operationPayload);
          } catch (e) {
            DEV_WARN('[encryption] trip encrypt failed', e);
          }

          DEV_LOG('Updating trip with enhanced validation for user:', this.userId, 'trip:', trip.id);

          if (this.isOnline) {
            try {
              // 1) Try mapping
              const mappedId = await this.getFirebaseId('trips', trip.id.toString());
              if (mappedId) {
                const docRef = doc(firestore, 'trips', mappedId);
                await updateDoc(docRef, { ...operationPayload, updatedAt: serverTimestamp() });
                DEV_LOG('Trip updated in Firestore with validation:', mappedId);
                return;
              }

              // 2) Resolve by querying (userId + id)
              try {
                const q = query(
                  collection(firestore, 'trips'),
                  where('userId', '==', this.userId),
                  where('id', '==', trip.id)
                );
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                  const existing = snapshot.docs[0];
                  await updateDoc(existing.ref, { ...operationPayload, updatedAt: serverTimestamp() });
                  await this.storeLocalMapping('trips', trip.id.toString(), existing.id);
                  DEV_LOG('Trip updated in Firestore via query resolution:', existing.id);
                  return;
                }
              } catch (e) {
                DEV_WARN('Trip update query failed, falling back to create:', e);
              }

              // 3) Create new if not found, then store mapping
              const createdRef = await addDoc(collection(firestore, 'trips'), {
                ...operationPayload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              });
              await this.storeLocalMapping('trips', trip.id.toString(), createdRef.id);
              DEV_LOG('Trip created in Firestore during update fallback:', createdRef.id);
              return;
            } catch (error) {
              DEV_WARN('Firestore update failed, falling back to local:', error);
            }
          }

          await databaseService.updateTrip(trip);
          // Only queue when offline or Firestore path failed entirely
          this.queueOperation('update', 'trips', operationPayload);
        }, 'updateTrip');
      }
    );
  }

   /**
    * Update a trip using Firebase document ID directly (bypasses ID mapping)
    */
   async updateTripWithFirebaseId(firebaseId: string, trip: Trip): Promise<void> {
     if (!this.isReady()) throw new Error('Service not initialized');

     if (this.isGuest) {
       // This function is Firebase-specific, so it should not be called for guests.
       throw new Error("Cannot update trip with Firebase ID in guest mode.");
     }

  let tripWithUser: any = { ...trip, userId: this.userId };
  try { tripWithUser = await encryptionService.encryptFields('trips', tripWithUser); } catch (e) { DEV_WARN('[encryption] trip encrypt failed', e); }

     if (this.isOnline) {
       try {
         const docRef = doc(firestore, 'trips', firebaseId);
         await updateDoc(docRef, {
           ...tripWithUser,
           updatedAt: serverTimestamp()
         });
         DEV_LOG('Trip updated in Firestore using direct Firebase ID:', firebaseId);
         return;
       } catch (error) {
         DEV_WARN('Firestore update with direct ID failed, falling back to local:', error);
       }
     }

     // Fallback to local storage
     await databaseService.updateTrip(trip);
     this.queueOperation('update', 'trips', tripWithUser);
   }

  /**
    * Delete a trip and all associated data
    */
  async deleteTrip(id: number, firebaseDocId?: string): Promise<void> {
    await this.runGuestAwareWrite('deleteTrip',
      () => databaseService.deleteTrip(id),
      async () => {
        DEV_LOG('deleteTrip called with id:', id, 'firebaseDocId:', firebaseDocId);

        if (this.isOnline) {
          try {
            DEV_LOG('Attempting Firestore delete...');

            if (firebaseDocId) {
              DEV_LOG('Using provided Firebase document ID:', firebaseDocId);
              const batch = writeBatch(firestore);

              batch.delete(doc(firestore, 'trips', firebaseDocId));

              const weatherQuery = query(
                collection(firestore, 'weatherLogs'),
                where('userId', '==', this.userId),
                where('tripId', '==', id),
              );
              const weatherSnapshot = await getDocs(weatherQuery);
              weatherSnapshot.forEach(doc => {
                batch.delete(doc.ref);
              });

              const fishQuery = query(
                collection(firestore, 'fishCaught'),
                where('userId', '==', this.userId),
                where('tripId', '==', id),
              );
              const fishSnapshot = await getDocs(fishQuery);
              fishSnapshot.forEach(doc => {
                batch.delete(doc.ref);
              });

              await batch.commit();
              DEV_LOG('Trip and associated data deleted from Firestore using document ID');
              return;
            }

            const firebaseId = await this.getFirebaseId('trips', id.toString());
            DEV_LOG('Firebase ID for trip', id, ':', firebaseId);

            if (firebaseId) {
              DEV_LOG('Found Firebase ID via mapping, proceeding with batch delete');
              const batch = writeBatch(firestore);

              batch.delete(doc(firestore, 'trips', firebaseId));

              const weatherQuery = query(
                collection(firestore, 'weatherLogs'),
                where('userId', '==', this.userId),
                where('tripId', '==', id),
              );
              const weatherSnapshot = await getDocs(weatherQuery);
              weatherSnapshot.forEach(doc => {
                batch.delete(doc.ref);
              });

              const fishQuery = query(
                collection(firestore, 'fishCaught'),
                where('userId', '==', this.userId),
                where('tripId', '==', id),
              );
              const fishSnapshot = await getDocs(fishQuery);
              fishSnapshot.forEach(doc => {
                batch.delete(doc.ref);
              });

              await batch.commit();
              DEV_LOG('Trip and associated data deleted from Firestore');
              return;
            }

            DEV_LOG('No Firebase ID found, trying alternative deletion methods');

            try {
              const tripQuery = query(
                collection(firestore, 'trips'),
                where('userId', '==', this.userId),
                where('id', '==', id)
              );

              const tripSnapshot = await getDocs(tripQuery);

              if (!tripSnapshot.empty) {
                DEV_LOG(`Found ${tripSnapshot.size} trip document(s) by local ID, deleting...`);
                const batch = writeBatch(firestore);
                tripSnapshot.forEach(doc => {
                  batch.delete(doc.ref);
                });
                await batch.commit();
                return;
              }
            } catch (error) {
              DEV_WARN('Local ID query failed:', error);
            }

            DEV_LOG('Cannot delete trip - no reliable way to identify it in Firestore');
            DEV_LOG('This may be an old trip created before proper ID tracking');
            throw new Error('Trip not found for deletion - please refresh and try again');
          } catch (error) {
            PROD_ERROR('Firestore delete failed:', error);
            DEV_WARN('Falling back to local storage');
          }
        }

        DEV_LOG('Using local storage fallback for delete');
        await databaseService.deleteTrip(id);
        this.queueOperation('delete', 'trips', { id, userId: this.userId });
      }
    );
  }

  // WEATHER LOG OPERATIONS

  async createWeatherLog(weatherData: Omit<WeatherLog, "id">): Promise<string> {
    return this.runGuestAwareWrite('createWeather',
      () => databaseService.createWeatherLog(weatherData),
      async () => {
        this.validateWeatherLogData(weatherData);

        const localId = `${weatherData.tripId}-${Date.now()}`;
        let weatherWithIds: any = { ...weatherData, id: localId, userId: this.userId };
        try { weatherWithIds = await encryptionService.encryptFields('weatherLogs', weatherWithIds); } catch (e) { DEV_WARN('[encryption] weather encrypt failed', e); }

        DEV_LOG('[Weather Create] Creating weather log with data:', weatherWithIds);

        if (this.isOnline) {
          try {
            const docRef = await addDoc(collection(firestore, 'weatherLogs'), {
              ...weatherWithIds,
              createdAt: serverTimestamp()
            });

            DEV_LOG('[Weather Create] Firebase document ID:', docRef.id);
            await this.storeLocalMapping('weatherLogs', localId, docRef.id);
            DEV_LOG('[Weather Create] Successfully created weather log and stored mappings');
            return localId;
          } catch (error) {
            DEV_WARN('Firestore create failed, falling back to local:', error);
            this.queueOperation('create', 'weatherLogs', weatherWithIds);
            return localId;
          }
        }

        this.queueOperation('create', 'weatherLogs', weatherWithIds);
        return localId;
      }
    );
  }

  /**
   * Upsert a weather log for import flows (idempotent by local string ID)
   */
  async upsertWeatherLogFromImport(weather: WeatherLog): Promise<string> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      try {
        await databaseService.updateWeatherLog(weather);
      } catch {
        await databaseService.createWeatherLog({
          tripId: weather.tripId,
          timeOfDay: weather.timeOfDay,
          sky: weather.sky,
          windCondition: weather.windCondition,
          windDirection: weather.windDirection,
          waterTemp: weather.waterTemp,
          airTemp: weather.airTemp,
        });
      }
      return weather.id;
    }

    const localId = weather.id;
    const cleanWeather: any = {};
    Object.entries(weather).forEach(([k, v]) => { if (v !== undefined) (cleanWeather as any)[k] = v; });
  let weatherWithUser: any = { ...cleanWeather, userId: this.userId };
  try { weatherWithUser = await encryptionService.encryptFields('weatherLogs', weatherWithUser); } catch (e) { DEV_WARN('[encryption] weather encrypt failed', e); }
  const contentHash = this.computeWeatherContentHash(weather);
  weatherWithUser.contentHash = contentHash;

    if (this.isOnline) {
      const mappedId = await this.getFirebaseId('weatherLogs', localId);
      if (mappedId) {
        try {
          const docRef = doc(firestore, 'weatherLogs', mappedId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const existing = snap.data();
            if ((existing as any).contentHash === contentHash) {
              return localId;
            }
            await updateDoc(docRef, { ...weatherWithUser, updatedAt: serverTimestamp() });
            return localId;
          } else {
            localStorage.removeItem(`idMapping_${this.userId}_weatherLogs_${localId}`);
          }
        } catch {/* continue */}
      }

      try {
        const q = query(
          collection(firestore, 'weatherLogs'),
          where('userId', '==', this.userId),
          where('id', '==', localId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const existing = snapshot.docs[0];
          const existingData = existing.data();
          if ((existingData as any).contentHash === contentHash) {
            await this.storeLocalMapping('weatherLogs', localId, existing.id);
            return localId;
          }
          await updateDoc(existing.ref, { ...weatherWithUser, updatedAt: serverTimestamp() });
          await this.storeLocalMapping('weatherLogs', localId, existing.id);
          return localId;
        }
      } catch (e) {
        DEV_WARN('Weather upsert query failed, falling back to create:', e);
      }

      const docRef = await addDoc(collection(firestore, 'weatherLogs'), {
        ...weatherWithUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this.storeLocalMapping('weatherLogs', localId, docRef.id);
      return localId;
    }

    await databaseService.updateWeatherLog(weather);
    this.queueOperation('update', 'weatherLogs', weatherWithUser);
    return localId;
  }

  async getWeatherLogById(id: string): Promise<WeatherLog | null> {
    if (!this.isReady()) throw new Error('Service not initialized');
    if (this.isGuest) {
      return databaseService.getWeatherLogById(id);
    }

    if (this.isOnline) {
      try {
        // We might not have a firebaseId if the item was created offline and not synced
        const firebaseId = await this.getFirebaseId('weatherLogs', id);
        if (firebaseId) {
          const docRef = doc(firestore, 'weatherLogs', firebaseId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            return await this.convertFromFirestore(data, id, firebaseId, 'weatherLogs') as WeatherLog;
          }
        }

        // Fallback to querying by the string ID if no mapping is found
        const weatherQuery = query(
          collection(firestore, 'weatherLogs'),
          where('userId', '==', this.userId),
          where('id', '==', id)
        );

        const weatherSnapshot = await getDocs(weatherQuery);
        if (!weatherSnapshot.empty) {
          const doc = weatherSnapshot.docs[0];
          const data = doc.data();
          // Ensure mapping is stored for future lookups
          await this.storeLocalMapping('weatherLogs', id, doc.id);
          return await this.convertFromFirestore(data, id, doc.id, 'weatherLogs') as WeatherLog;
        }

      } catch (error) {
        DEV_WARN('Firestore get failed, trying local:', error);
      }
    }

    return databaseService.getWeatherLogById(id);
  }

  async getWeatherLogsByTripId(tripId: number): Promise<WeatherLog[]> {
    if (!this.isReady()) throw new Error('Service not initialized');
    if (this.isGuest) {
      return databaseService.getWeatherLogsByTripId(tripId);
    }

    if (this.isOnline) {
      try {
        const q = query(
          collection(firestore, 'weatherLogs'),
          where('userId', '==', this.userId),
          where('tripId', '==', tripId)
        );

        const querySnapshot = await getDocs(q);
        
        // Process all documents concurrently
        const weatherLogPromises = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          const localId = data.id as string; // The ID is stored in the document
          this.storeLocalMapping('weatherLogs', localId, doc.id);
          return this.convertFromFirestore(data, localId, doc.id, 'weatherLogs');
        });

        const weatherLogs = await Promise.all(weatherLogPromises) as WeatherLog[];
        return weatherLogs;
      } catch (error) {
        DEV_WARN('Firestore query failed, falling back to local:', error);
      }
    }

    return databaseService.getWeatherLogsByTripId(tripId);
  }

  async getAllWeatherLogs(): Promise<WeatherLog[]> {
    if (!this.isReady()) throw new Error('Service not initialized');
    if (this.isGuest) {
      return databaseService.getAllWeatherLogs();
    }

    if (this.isOnline) {
      try {
        const q = query(
          collection(firestore, 'weatherLogs'),
          where('userId', '==', this.userId)
        );

        const querySnapshot = await getDocs(q);
        
        // Process all documents concurrently
        const weatherLogPromises = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          const localId = data.id as string; // The ID is stored in the document
          this.storeLocalMapping('weatherLogs', localId, doc.id);
          return this.convertFromFirestore(data, localId, doc.id, 'weatherLogs');
        });

        const weatherLogs = await Promise.all(weatherLogPromises) as WeatherLog[];
        return weatherLogs;
      } catch (error) {
        DEV_WARN('Firestore query failed, falling back to local:', error);
      }
    }

    return databaseService.getAllWeatherLogs();
  }

  async updateWeatherLog(weatherLog: WeatherLog): Promise<void> {
    await this.runGuestAwareWrite('updateWeather',
      () => databaseService.updateWeatherLog(weatherLog),
      async () => {
        let weatherWithUser = { ...weatherLog, userId: this.userId };
        try { weatherWithUser = await encryptionService.encryptFields('weatherLogs', weatherWithUser); } catch (e) { DEV_WARN('[encryption] weather encrypt failed', e); }

        if (this.isOnline) {
          try {
            const firebaseId = await this.getFirebaseId('weatherLogs', weatherLog.id.toString());
            if (firebaseId) {
              const docRef = doc(firestore, 'weatherLogs', firebaseId);
              await updateDoc(docRef, {
                ...weatherWithUser,
                updatedAt: serverTimestamp()
              });
              DEV_LOG('Weather log updated in Firestore:', firebaseId);
              return;
            }

            DEV_LOG('No Firebase ID mapping found for weather log, creating new document');
            const docRef = await addDoc(collection(firestore, 'weatherLogs'), {
              ...weatherWithUser,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            await this.storeLocalMapping('weatherLogs', weatherLog.id.toString(), docRef.id);
            DEV_LOG('Weather log created in Firestore:', docRef.id);
            return;
          } catch (error) {
            DEV_WARN('Firestore update/create failed, falling back to local:', error);
          }
        }

        await databaseService.updateWeatherLog(weatherLog);
        this.queueOperation('update', 'weatherLogs', weatherWithUser);
      }
    );
  }

  async deleteWeatherLog(id: string): Promise<void> {
    await this.runGuestAwareWrite('deleteWeather',
      () => databaseService.deleteWeatherLog(id),
      async () => {
        DEV_LOG('[Weather Delete] Starting delete for weather log ID:', id);
        let deletedFromFirebase = false;

        if (this.isOnline) {
          try {
            const firebaseId = await this.getFirebaseId('weatherLogs', id);
            if (firebaseId) {
              await deleteDoc(doc(firestore, 'weatherLogs', firebaseId));
              DEV_LOG('[Weather Delete] Firestore doc deleted via mapping:', firebaseId);
              deletedFromFirebase = true;
            } else {
              DEV_WARN('[Weather Delete] No Firebase ID mapping found for local ID:', id);
            }
          } catch (error) {
            PROD_ERROR('[Weather Delete] Firestore delete failed:', error);
          }
        }

        await databaseService.deleteWeatherLog(id);

        if (!this.isOnline || (this.isOnline && !deletedFromFirebase)) {
          DEV_LOG('[Weather Delete] Queuing for sync.');
          this.queueOperation('delete', 'weatherLogs', { id, userId: this.userId });
        } else {
          DEV_LOG('[Weather Delete] Deletion successful on all stores. No queue needed.');
        }
      }
    );
  }

  // FISH CAUGHT OPERATIONS

  async createFishCaught(fishData: Omit<FishCaught, "id">): Promise<string> {
    return this.runGuestAwareWrite('createFish',
      () => databaseService.createFishCaught(fishData),
      async () => {
        this.validateFishCatchData(fishData);

        const sanitizedFishData = {
          ...fishData,
          species: this.sanitizeString(fishData.species),
          gear: fishData.gear ? fishData.gear.map(g => this.sanitizeString(g)) : fishData.gear,
          length: fishData.length ? this.sanitizeString(fishData.length) : fishData.length,
          weight: fishData.weight ? this.sanitizeString(fishData.weight) : fishData.weight,
          time: fishData.time ? this.sanitizeString(fishData.time) : fishData.time,
          details: fishData.details ? this.sanitizeString(fishData.details) : fishData.details,
        };

        const localId = `${fishData.tripId}-${Date.now()}`;
        let fishWithIds: any = { ...sanitizedFishData, id: localId, userId: this.userId };
        try { fishWithIds = await encryptionService.encryptFields('fishCaught', fishWithIds); } catch (e) { DEV_WARN('[encryption] fish encrypt failed', e); }

        if (this.isOnline && sanitizedFishData.photo && typeof sanitizedFishData.photo === 'string') {
          const data = this.dataUrlToBytes(sanitizedFishData.photo);
          if (data && this.userId) {
            try {
              const refInfo = await this.ensurePhotoInStorage(this.userId, data.bytes, data.mime);
              if ('inlinePhoto' in refInfo) {
                fishWithIds.photo = refInfo.inlinePhoto;
                fishWithIds.photoHash = refInfo.photoHash;
              } else {
                fishWithIds.photoHash = refInfo.photoHash;
                fishWithIds.photoPath = refInfo.photoPath;
                fishWithIds.photoMime = refInfo.photoMime;
                if (refInfo.photoUrl) fishWithIds.photoUrl = refInfo.photoUrl;
                if ('encryptedMetadata' in refInfo && refInfo.encryptedMetadata) {
                  fishWithIds.encryptedMetadata = refInfo.encryptedMetadata;
                }
                delete fishWithIds.photo;
              }
            } catch (e) {
              DEV_WARN('Failed to move photo to Storage, keeping inline for now:', e);
            }
          }
        }

        DEV_LOG('[Fish Create] Creating fish catch with data:', fishWithIds);

        if (this.isOnline) {
          try {
            const docRef = await addDoc(collection(firestore, 'fishCaught'), {
              ...fishWithIds,
              createdAt: serverTimestamp()
            });

            DEV_LOG('[Fish Create] Firebase document ID:', docRef.id);
            await this.storeLocalMapping('fishCaught', localId, docRef.id);
            DEV_LOG('[Fish Create] Successfully created fish catch and stored mappings');
            return localId;
          } catch (error) {
            DEV_WARN('Firestore create failed, falling back to local:', error);
            this.queueOperation('create', 'fishCaught', fishWithIds);
            return localId;
          }
        }

        this.queueOperation('create', 'fishCaught', fishWithIds);
        return localId;
      }
    );
  }

  /**
   * Upsert a fish record for import flows (idempotent by local string ID)
   */
  async upsertFishCaughtFromImport(fish: FishCaught): Promise<string> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      try {
        await databaseService.updateFishCaught(fish);
      } catch {
        await databaseService.createFishCaught({
          tripId: fish.tripId,
          species: fish.species,
          length: fish.length,
          weight: fish.weight,
          time: fish.time,
          gear: fish.gear,
          details: fish.details,
          photo: fish.photo,
        });
      }
      return fish.id;
    }

  const localId = fish.id;
  const cleanFish: any = {};
    Object.entries(fish).forEach(([k, v]) => { if (v !== undefined) (cleanFish as any)[k] = v; });
  let fishWithUser: any = { ...cleanFish, userId: this.userId };
  try { fishWithUser = await encryptionService.encryptFields('fishCaught', fishWithUser); } catch (e) { DEV_WARN('[encryption] fish encrypt failed', e); }

  // If we have an inline photo and we're online, move it to Storage
  if (this.isOnline && typeof fishWithUser.photo === 'string' && this.userId) {
    const data = this.dataUrlToBytes(fishWithUser.photo);
    if (data) {
      try {
        const refInfo = await this.ensurePhotoInStorage(this.userId, data.bytes, data.mime);
        if ('inlinePhoto' in refInfo) {
          fishWithUser.photo = refInfo.inlinePhoto;
          fishWithUser.photoHash = refInfo.photoHash;
        } else {
          fishWithUser.photoHash = refInfo.photoHash;
          fishWithUser.photoPath = refInfo.photoPath;
          fishWithUser.photoMime = refInfo.photoMime;
          if (refInfo.photoUrl) fishWithUser.photoUrl = refInfo.photoUrl;
          // Persist encrypted metadata if available (for encrypted photos)
          if ('encryptedMetadata' in refInfo && refInfo.encryptedMetadata) {
            fishWithUser.encryptedMetadata = refInfo.encryptedMetadata;
          }
          delete fishWithUser.photo;
        }
      } catch (e) {
        DEV_WARN('Failed to move import photo to Storage, keeping inline for now:', e);
      }
    }
  }

  const contentHash = this.computeFishContentHash(fishWithUser as FishCaught);
  fishWithUser.contentHash = contentHash;

    if (this.isOnline) {
      const mappedId = await this.getFirebaseId('fishCaught', localId);
      if (mappedId) {
        try {
          const docRef = doc(firestore, 'fishCaught', mappedId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const existing = snap.data();
            if ((existing as any).contentHash === contentHash) {
              // No changes; skip update
              return localId;
            }
            await updateDoc(docRef, { ...fishWithUser, updatedAt: serverTimestamp() });
            return localId;
          } else {
            localStorage.removeItem(`idMapping_${this.userId}_fishCaught_${localId}`);
          }
        } catch {/* continue */}
      }

      try {
        const q = query(
          collection(firestore, 'fishCaught'),
          where('userId', '==', this.userId),
          where('id', '==', localId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const existing = snapshot.docs[0];
          const existingData = existing.data();
          if ((existingData as any).contentHash === contentHash) {
            await this.storeLocalMapping('fishCaught', localId, existing.id);
            return localId;
          }
          await updateDoc(existing.ref, { ...fishWithUser, updatedAt: serverTimestamp() });
          await this.storeLocalMapping('fishCaught', localId, existing.id);
          return localId;
        }
      } catch (e) {
        DEV_WARN('Fish upsert query failed, falling back to create:', e);
      }

      const docRef = await addDoc(collection(firestore, 'fishCaught'), {
        ...fishWithUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this.storeLocalMapping('fishCaught', localId, docRef.id);
      return localId;
    }

    await databaseService.updateFishCaught(fish);
    this.queueOperation('update', 'fishCaught', fishWithUser);
    return localId;
  }

  async getFishCaughtById(id: string): Promise<FishCaught | null> {
    if (!this.isReady()) throw new Error('Service not initialized');
    if (this.isGuest) {
      return databaseService.getFishCaughtById(id);
    }

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('fishCaught', id);
        if (firebaseId) {
          const docRef = doc(firestore, 'fishCaught', firebaseId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            return await this.convertFromFirestore(data, id, firebaseId, 'fishCaught') as FishCaught;
          }
        }

        const fishQuery = query(
          collection(firestore, 'fishCaught'),
          where('userId', '==', this.userId),
          where('id', '==', id)
        );

        const fishSnapshot = await getDocs(fishQuery);
        if (!fishSnapshot.empty) {
          const doc = fishSnapshot.docs[0];
          const data = doc.data();
          await this.storeLocalMapping('fishCaught', id, doc.id);
          return await this.convertFromFirestore(data, id, doc.id, 'fishCaught') as FishCaught;
        }

      } catch (error) {
        DEV_WARN('Firestore get failed, trying local:', error);
      }
    }

    return databaseService.getFishCaughtById(id);
  }

  async getFishCaughtByTripId(tripId: number): Promise<FishCaught[]> {
    if (!this.isReady()) throw new Error('Service not initialized');
    if (this.isGuest) {
      return databaseService.getFishCaughtByTripId(tripId);
    }

    if (this.isOnline) {
      try {
        const q = query(
          collection(firestore, 'fishCaught'),
          where('userId', '==', this.userId),
          where('tripId', '==', tripId)
        );

        const querySnapshot = await getDocs(q);
        
        // Process all documents concurrently
        const fishPromises = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          const localId = data.id as string;
          this.storeLocalMapping('fishCaught', localId, doc.id);
          return this.convertFromFirestore(data, localId, doc.id, 'fishCaught');
        });

        const fishCaught = await Promise.all(fishPromises) as FishCaught[];
        return fishCaught;
      } catch (error) {
        DEV_WARN('Firestore query failed, falling back to local:', error);
      }
    }

    return databaseService.getFishCaughtByTripId(tripId);
  }

  async getAllFishCaught(): Promise<FishCaught[]> {
    if (!this.isReady()) throw new Error('Service not initialized');
    if (this.isGuest) {
      return databaseService.getAllFishCaught();
    }

    if (this.isOnline) {
      try {
        const q = query(
          collection(firestore, 'fishCaught'),
          where('userId', '==', this.userId)
        );

        const querySnapshot = await getDocs(q);
        
        // Process all documents concurrently
        const fishPromises = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          const localId = data.id as string;
          this.storeLocalMapping('fishCaught', localId, doc.id);
          return this.convertFromFirestore(data, localId, doc.id, 'fishCaught');
        });

        const fishCaught = await Promise.all(fishPromises) as FishCaught[];
        return fishCaught;
      } catch (error) {
        DEV_WARN('Firestore query failed, falling back to local:', error);
      }
    }

    return databaseService.getAllFishCaught();
  }

  async updateFishCaught(fishCaught: FishCaught): Promise<void> {
    await this.runGuestAwareWrite('updateFish',
      () => databaseService.updateFishCaught(fishCaught),
      async () => {
        let fishWithUser: any = { ...fishCaught, userId: this.userId };
        try { fishWithUser = await encryptionService.encryptFields('fishCaught', fishWithUser); } catch (e) { DEV_WARN('[encryption] fish encrypt failed', e); }

        if (this.isOnline && typeof fishWithUser.photo === 'string' && this.userId) {
          const data = this.dataUrlToBytes(fishWithUser.photo);
          if (data) {
            try {
              const refInfo = await this.ensurePhotoInStorage(this.userId, data.bytes, data.mime);
              if ('inlinePhoto' in refInfo) {
                fishWithUser.photo = refInfo.inlinePhoto;
                fishWithUser.photoHash = refInfo.photoHash;
              } else {
                fishWithUser.photoHash = refInfo.photoHash;
                fishWithUser.photoPath = refInfo.photoPath;
                fishWithUser.photoMime = refInfo.photoMime;
                if (refInfo.photoUrl) fishWithUser.photoUrl = refInfo.photoUrl;
                if ('encryptedMetadata' in refInfo && refInfo.encryptedMetadata) {
                  fishWithUser.encryptedMetadata = refInfo.encryptedMetadata;
                }
                delete fishWithUser.photo;
              }
            } catch (e) {
              DEV_WARN('Failed to move updated photo to Storage, keeping inline for now:', e);
            }
          }
        }

        // Sanitize payload for Firestore (remove undefined; clear photo-related fields when requested)
        const cleanUpdatePayload = this.sanitizeFishUpdatePayload(fishWithUser);
        DEV_LOG('[Fish Update] Starting update for fish ID:', fishCaught.id);

        if (this.isOnline) {
          try {
            const firebaseId = await this.getFirebaseId('fishCaught', fishCaught.id.toString());
            DEV_LOG('[Fish Update] Firebase ID lookup result:', firebaseId);

            if (firebaseId) {
              const docRef = doc(firestore, 'fishCaught', firebaseId);
              await updateDoc(docRef, {
                ...cleanUpdatePayload,
                updatedAt: serverTimestamp()
              });
              DEV_LOG('Fish caught updated in Firestore:', firebaseId);
              return;
            }

            DEV_LOG('No Firebase ID mapping found for fish catch, creating new document');
            const docRef = await addDoc(collection(firestore, 'fishCaught'), {
              ...this.stripUndefined(fishWithUser),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            await this.storeLocalMapping('fishCaught', fishCaught.id.toString(), docRef.id);
            DEV_LOG('Fish caught created in Firestore:', docRef.id);
            return;
          } catch (error) {
            DEV_WARN('Firestore update/create failed, falling back to local:', error);
          }
        }

        await databaseService.updateFishCaught(fishCaught);
        this.queueOperation('update', 'fishCaught', this.stripUndefined(fishWithUser));
      }
    );
  }

  async deleteFishCaught(id: string): Promise<void> {
    await this.runGuestAwareWrite('deleteFish',
      () => databaseService.deleteFishCaught(id),
      async () => {
        DEV_LOG('[Fish Delete] Starting delete for fish catch ID:', id);
        let deletedFromFirebase = false;

        if (this.isOnline) {
          try {
            const firebaseId = await this.getFirebaseId('fishCaught', id);
            if (firebaseId) {
              await deleteDoc(doc(firestore, 'fishCaught', firebaseId));
              DEV_LOG('[Fish Delete] Firestore doc deleted via mapping:', firebaseId);
              deletedFromFirebase = true;
            } else {
              DEV_WARN('[Fish Delete] No Firebase ID mapping found for local ID:', id);
            }
          } catch (error) {
            PROD_ERROR('[Fish Delete] Firestore delete failed:', error);
          }
        }

        await databaseService.deleteFishCaught(id);

        if (!this.isOnline || (this.isOnline && !deletedFromFirebase)) {
          DEV_LOG('[Fish Delete] Queuing for sync.');
          this.queueOperation('delete', 'fishCaught', { id, userId: this.userId });
        } else {
          DEV_LOG('[Fish Delete] Deletion successful on all stores. No queue needed.');
        }
      }
    );
  }

  async cleanupOrphanedFirestoreData(): Promise<void> {
    if (this.isGuest || !this.isOnline) {
      return;
    }

    DEV_LOG("Checking for orphaned data in Firestore...");

    try {
      // Get all trips for this user - collect both local IDs and Firebase document IDs
      const tripsQuery = query(
        collection(firestore, 'trips'),
        where('userId', '==', this.userId)
      );
      const tripsSnapshot = await getDocs(tripsQuery);
      const validLocalTripIds = new Set();
      const validFirebaseTripIds = new Set();

      tripsSnapshot.forEach(doc => {
        const tripData = doc.data();
        if (tripData.id) {
          validLocalTripIds.add(tripData.id); // Local trip ID
        }
        validFirebaseTripIds.add(doc.id); // Firebase document ID
      });

      DEV_LOG(`Found ${validLocalTripIds.size} valid trips in Firestore (local IDs: ${Array.from(validLocalTripIds).join(', ')})`);

      // Only proceed with cleanup if we have trips to validate against
      if (validLocalTripIds.size === 0) {
        DEV_LOG("No trips found - skipping orphaned data cleanup to avoid removing valid data");
        return;
      }

      // Check weather logs - they should have local trip IDs
      const weatherQuery = query(
        collection(firestore, 'weatherLogs'),
        where('userId', '==', this.userId)
      );
      const weatherSnapshot = await getDocs(weatherQuery);
      const orphanedWeatherDocs: string[] = [];

      weatherSnapshot.forEach(doc => {
        const data = doc.data();
        // Weather logs should have local trip IDs, not Firebase document IDs
        if (!data.tripId || !validLocalTripIds.has(data.tripId)) {
          DEV_LOG(`Found potentially orphaned weather log: ${doc.id} with tripId: ${data.tripId}`);
          DEV_LOG(`  Valid local trip IDs: ${Array.from(validLocalTripIds).join(', ')}`);
          DEV_LOG(`  Valid Firebase trip IDs: ${Array.from(validFirebaseTripIds).join(', ')}`);
          orphanedWeatherDocs.push(doc.id);
        }
      });

      // Check fish caught - they should have local trip IDs
      const fishQuery = query(
        collection(firestore, 'fishCaught'),
        where('userId', '==', this.userId)
      );
      const fishSnapshot = await getDocs(fishQuery);
      const orphanedFishDocs: string[] = [];

      fishSnapshot.forEach(doc => {
        const data = doc.data();
        // Fish caught should have local trip IDs, not Firebase document IDs
        if (!data.tripId || !validLocalTripIds.has(data.tripId)) {
          DEV_LOG(`Found potentially orphaned fish caught: ${doc.id} with tripId: ${data.tripId}`);
          DEV_LOG(`  Valid local trip IDs: ${Array.from(validLocalTripIds).join(', ')}`);
          DEV_LOG(`  Valid Firebase trip IDs: ${Array.from(validFirebaseTripIds).join(', ')}`);
          orphanedFishDocs.push(doc.id);
        }
      });

      // Only delete if we have a small number of orphaned records
      // This prevents accidentally deleting data during merge operations
      if (orphanedWeatherDocs.length > 0 || orphanedFishDocs.length > 0) {
        const totalOrphaned = orphanedWeatherDocs.length + orphanedFishDocs.length;

        // If we have more than 10 orphaned records, be very cautious
        if (totalOrphaned > 10) {
          DEV_LOG(`Found ${totalOrphaned} potentially orphaned records - this seems high, skipping cleanup to avoid data loss`);
          return;
        }

        DEV_LOG(`Cleaning up ${orphanedWeatherDocs.length} orphaned weather logs and ${orphanedFishDocs.length} orphaned fish caught records from Firestore.`);

        const batch = writeBatch(firestore);

        orphanedWeatherDocs.forEach(docId => {
          batch.delete(doc(firestore, 'weatherLogs', docId));
        });

        orphanedFishDocs.forEach(docId => {
          batch.delete(doc(firestore, 'fishCaught', docId));
        });

        await batch.commit();
        DEV_LOG("Orphaned data cleanup completed successfully.");
      } else {
        DEV_LOG("No orphaned data found in Firestore.");
      }
    } catch (error) {
      PROD_ERROR("Error during orphaned data cleanup:", error);
      // Don't throw - this is a cleanup operation, we don't want to break the main flow
    }
  }

  async mergeLocalDataForUser(): Promise<void> {
    if (this.isGuest || !this.userId) {
      DEV_WARN("Cannot merge local data in guest mode or without a user.");
      return;
    }
    DEV_LOG("Starting local data merge for user:", this.userId);

    const localTrips = await databaseService.getAllTrips();
    const localWeatherLogs = await databaseService.getAllWeatherLogs();
    const localFishCaught = await databaseService.getAllFishCaught();

    if (localTrips.length === 0 && localWeatherLogs.length === 0 && localFishCaught.length === 0) {
      DEV_LOG("No local data to merge.");
      return;
    }

    DEV_LOG(`Found ${localTrips.length} trips, ${localWeatherLogs.length} weather logs, and ${localFishCaught.length} fish caught locally.`);

    const validTripIds = new Set(localTrips.map(t => t.id));
    const chunk = async <T>(arr: T[], size: number, fn: (item: T, idx: number) => Promise<void>) => {
      for (let i = 0; i < arr.length; i += size) {
        const slice = arr.slice(i, i + size);
        for (let j = 0; j < slice.length; j++) {
          try {
            await fn(slice[j], i + j);
          } catch (e) {
            DEV_WARN('Merge item failed', e);
          }
        }
        // Yield to UI
        await new Promise(r => setTimeout(r, 0));
      }
    };

    // Upsert trips via import-safe path (ensures mapping + encryption)
    await chunk(localTrips, 50, async (trip) => {
      await this.upsertTripFromImport(trip);
    });

    // Upsert weather logs (only those with valid trip)
    const validWeather = localWeatherLogs.filter(w => !!w.tripId && validTripIds.has(w.tripId));
    await chunk(validWeather, 100, async (w) => {
      await this.upsertWeatherLogFromImport(w);
    });

    // Upsert fish catches (only those with valid trip)
    const validFish = localFishCaught.filter(f => !!f.tripId && validTripIds.has(f.tripId));
    await chunk(validFish, 50, async (f) => {
      await this.upsertFishCaughtFromImport(f);
    });

    DEV_LOG(`Merged ${localTrips.length} trips, ${validWeather.length} weather logs, and ${validFish.length} fish caught.`);

    // Clean up orphaned local records (not associated with any local trip)
    const orphanedWeather = localWeatherLogs.filter(w => !w.tripId || !validTripIds.has(w.tripId));
    const orphanedFish = localFishCaught.filter(f => !f.tripId || !validTripIds.has(f.tripId));
    if (orphanedWeather.length || orphanedFish.length) {
      DEV_LOG(`Cleaning up ${orphanedWeather.length} orphaned weather logs and ${orphanedFish.length} orphaned fish caught from local storage.`);
      for (const w of orphanedWeather) { try { await databaseService.deleteWeatherLog(w.id); } catch {} }
      for (const f of orphanedFish) { try { await databaseService.deleteFishCaught(f.id); } catch {} }
    }

    // Final cleanup of potential orphans in Firestore
    await this.cleanupOrphanedFirestoreData();

    // Keep local data visible for continuity (do not clear here)
    DEV_LOG("Local data backed up successfully - keeping visible for continuity");
  }

  // UTILITY METHODS

  async getFishCountForTrip(tripId: number): Promise<number> {
    const fishRecords = await this.getFishCaughtByTripId(tripId);
    return fishRecords.length;
  }

  async hasTripsOnDate(date: string): Promise<boolean> {
    const trips = await this.getTripsByDate(date);
    return trips.length > 0;
  }

  async getDatesWithTrips(): Promise<string[]> {
    const trips = await this.getAllTrips();
    const dates = new Set(trips.map((trip) => trip.date));
    return Array.from(dates);
  }

  async clearAllData(): Promise<void> {
    // Clear local data
    await databaseService.clearAllData();

    // Clear sync queue
    this.syncQueue = [];
    this.saveSyncQueue();

    // Note: We don't clear Firestore data here as it's the source of truth
    DEV_LOG('Local data cleared, Firestore data preserved');
  }

  /**
   * Destructively clear all Firestore data for the current authenticated user.
   * Also clears local ID mappings and sync queue to avoid stale references.
   * This is intended for explicit "wipe-and-replace" import flows.
   */
  async clearFirestoreUserData(onProgress?: (progress: ImportProgress) => void): Promise<void> {
    if (this.isGuest) {
      throw new Error('Cannot clear Firestore data in guest mode');
    }
    if (!this.userId) {
      throw new Error('No user ID available for Firestore cleanup');
    }
    if (!this.isOnline) {
      throw new Error('Cannot clear Firestore data while offline');
    }
    const storageRefsToDelete: StorageReference[] = [];
    const storagePaths = [
      `users/${this.userId}/catches`,
      `users/${this.userId}/images`,
      `users/${this.userId}/enc_photos`
    ];

    const includeStorage = !!this.storageInstance;
    for (const path of storagePaths) {
      const refs = await this.collectStorageObjects(path);
      if (refs.length) {
        DEV_LOG(`[Wipe] Found ${refs.length} storage objects under ${path}`);
        storageRefsToDelete.push(...refs);
      }
    }

    const collectionsToWipe = ['trips', 'weatherLogs', 'fishCaught', 'tackleItems', 'gearTypes', 'userSettings'];
    const collectionPlans: Array<{ name: string; refs: DocumentReference[] }> = [];

    for (const coll of collectionsToWipe) {
      if (coll === 'userSettings') {
        // userSettings is keyed by userId; avoid querying (which can be blocked by rules)
        const userSettingsRef = doc(firestore, 'userSettings', this.userId);
        collectionPlans.push({ name: coll, refs: [userSettingsRef] });
        continue;
      }
      const q = query(collection(firestore, coll), where('userId', '==', this.userId));
      const snapshot = await getDocs(q);
      const refs = snapshot.docs.map(d => d.ref);
      collectionPlans.push({ name: coll, refs });
    }

    let totalUnits = 1; // final cleanup
    if (includeStorage) {
      totalUnits += 1; // storage inventory milestone
      totalUnits += storageRefsToDelete.length > 0 ? storageRefsToDelete.length : 1;
    }
    for (const plan of collectionPlans) {
      totalUnits += Math.max(plan.refs.length, 1);
    }
    if (totalUnits <= 0) totalUnits = 1;

    let unitsCompleted = 0;
    const emitProgress = (phase: string, message: string, increment = 0) => {
      unitsCompleted += increment;
      const current = Math.min(unitsCompleted, totalUnits);
      const percent = totalUnits ? Math.min(100, Math.round((current / totalUnits) * 100)) : 100;
      onProgress?.({
        phase,
        current,
        total: totalUnits,
        percent,
        message
      });
    };

    emitProgress('preparing', 'Preparing data wipe…');

    const DELETE_BATCH_SIZE = 10;
    const CHUNK = 400;

    try {
      if (includeStorage) {
        emitProgress('storage-inventory', `Found ${storageRefsToDelete.length} storage object(s) to remove`, 1);

        if (storageRefsToDelete.length === 0) {
          emitProgress('storage-delete', 'No storage objects to delete', 1);
        } else {
          for (let i = 0; i < storageRefsToDelete.length; i += DELETE_BATCH_SIZE) {
            const chunk = storageRefsToDelete.slice(i, i + DELETE_BATCH_SIZE);
            await Promise.all(chunk.map(async (ref, index) => {
              try {
                await deleteObject(ref);
                const deletedCount = Math.min(i + index + 1, storageRefsToDelete.length);
                emitProgress('storage-delete', `Deleted ${deletedCount}/${storageRefsToDelete.length} storage objects`, 1);
                DEV_LOG(`[Wipe] Deleted storage object ${ref.fullPath}`);
              } catch (error: any) {
                if (error?.code === 'storage/object-not-found') {
                  emitProgress('storage-delete', `Storage object already removed (${ref.fullPath})`, 1);
                  return;
                }
                DEV_WARN(`[Wipe] Failed to delete storage object ${ref.fullPath}:`, error);
                emitProgress('storage-delete', `Failed deleting storage object ${ref.fullPath}`, 1);
              }
            }));
          }
        }
      }

      for (const { name, refs } of collectionPlans) {
        if (refs.length === 0) {
          emitProgress(`delete-${name}`, `No documents found in ${name}`, 1);
          DEV_LOG(`[Wipe] No documents to delete from ${name} for user ${this.userId}`);
          continue;
        }

        for (let i = 0; i < refs.length; i += CHUNK) {
          const batch = writeBatch(firestore);
          const slice = refs.slice(i, i + CHUNK);
          for (const ref of slice) {
            batch.delete(ref);
          }
          await batch.commit();

          slice.forEach((_, idx) => {
            const deletedCount = Math.min(i + idx + 1, refs.length);
            emitProgress(`delete-${name}`, `Deleted ${deletedCount}/${refs.length} ${name}`, 1);
          });
        }

        DEV_LOG(`[Wipe] Cleared ${refs.length} documents from ${name} for user ${this.userId}`);
      }

      this.clearLocalIdMappings();
      this.syncQueue = [];
      this.saveSyncQueue();
      await databaseService.clearAllData();
      emitProgress('cleanup', 'Clearing local caches…', 1);

      emitProgress('complete', 'Firestore user data wipe complete');
      DEV_LOG('[Wipe] Completed Firestore user data wipe');
    } catch (error) {
      const total = totalUnits || 1;
      const current = Math.min(unitsCompleted, total);
      const percent = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
      onProgress?.({
        phase: 'error',
        current,
        total,
        percent,
        message: error instanceof Error ? error.message : 'Failed to wipe Firestore data'
      });
      throw error;
    }
  }

  /**
   * Remove all localStorage ID mapping entries for the current user
   */
  private clearLocalIdMappings(): void {
    if (!this.userId) return;
    const prefix = `idMapping_${this.userId}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    // Also clear the user's sync queue key explicitly
    localStorage.removeItem(`syncQueue_${this.userId}`);
    DEV_LOG(`[Wipe] Cleared ${keysToRemove.length} local ID mappings for user ${this.userId}`);
  }

  /**
   * Download user's Firebase data to local storage before logout
   * This ensures data persistence and continuity in guest mode
   */
  async backupLocalDataBeforeLogout(): Promise<void> {
    if (this.isGuest) {
      DEV_LOG("Service is in guest mode, skipping data download");
      return;
    }

    if (!this.userId) {
      DEV_LOG("No user ID available, skipping data download");
      return;
    }

    DEV_LOG("Downloading Firebase data to local storage before logout...");

    try {
      // Only download if we're online and can access Firebase
      if (!this.isOnline) {
        DEV_LOG("Offline - cannot download Firebase data, keeping any existing local data");
        return;
      }

      // Download all user data from Firebase
      DEV_LOG('Fetching trips from Firebase...');
      const firebaseTrips = await this.getAllTrips();
      DEV_LOG('Fetching weather logs from Firebase...');
      const firebaseWeatherLogs = await this.getAllWeatherLogs();
      DEV_LOG('Fetching fish caught from Firebase...');
      const firebaseFishCaught = await this.getAllFishCaught();

      DEV_LOG(`Found ${firebaseTrips.length} trips, ${firebaseWeatherLogs.length} weather logs, and ${firebaseFishCaught.length} fish caught in Firebase`);

      if (firebaseTrips.length === 0 && firebaseWeatherLogs.length === 0 && firebaseFishCaught.length === 0) {
        DEV_LOG('No data found in Firebase - user may not have any data yet');
        return;
      }

      DEV_LOG(`Downloading ${firebaseTrips.length} trips, ${firebaseWeatherLogs.length} weather logs, and ${firebaseFishCaught.length} fish caught to local storage`);

      // Clear local storage first to avoid duplicates
      await databaseService.clearAllData();

      // Store Firebase data locally for guest mode access - preserving original IDs
      for (const trip of firebaseTrips) {
        // Use updateTrip which uses put() internally - preserves original ID
        await databaseService.updateTrip(trip);
      }

      for (const weatherLog of firebaseWeatherLogs) {
        // Use updateWeatherLog which uses put() internally - preserves original ID
        await databaseService.updateWeatherLog(weatherLog);
      }

      for (const fishCaught of firebaseFishCaught) {
        // Use updateFishCaught which uses put() internally - preserves original ID
        // This ensures encryptedMetadata is preserved in local cache
        await databaseService.updateFishCaught(fishCaught);
      }

      DEV_LOG("Successfully downloaded Firebase data to local storage for guest mode access");

    } catch (error) {
      PROD_ERROR("Failed to download Firebase data to local storage:", error);
      // Don't throw error - we don't want to prevent logout, but log the issue
      DEV_WARN("Logout will continue, but Firebase data may not be available in guest mode");
    }
  }

  /**
   * Periodic safety check to ensure all local data is synced for authenticated users
   * This provides an extra layer of data protection
   */
  async performSafetySync(): Promise<void> {
    if (this.isGuest) {
      return; // No sync needed for guest users
    }

    try {
      // Check for any unsynced local data
      const localTrips = await databaseService.getAllTrips();
      const localWeatherLogs = await databaseService.getAllWeatherLogs();
      const localFishCaught = await databaseService.getAllFishCaught();

      const totalLocalItems = localTrips.length + localWeatherLogs.length + localFishCaught.length;

      if (totalLocalItems > 0) {
        DEV_LOG(`Safety sync: Found ${totalLocalItems} local items to sync`);
        await this.mergeLocalDataForUser();
        DEV_LOG('Safety sync completed successfully');
      }
    } catch (error) {
      DEV_WARN('Safety sync failed:', error);
      // Don't throw - this is a background safety operation
    }
  }

  // OFFLINE QUEUE MANAGEMENT

  private async queueOperationAsync(operation: string, collection: string, data: any): Promise<number> {
    const enqueue = (payload: any) => ({
      id: Date.now(),
      operation,
      collection,
      data: payload,
      timestamp: new Date().toISOString()
    });
    let finalData = data;
    if (!data?._encrypted && encryptionService.isReady()) {
      try { finalData = await encryptionService.encryptFields(collection, data); } catch (e) { DEV_WARN('[encryption] queue encrypt failed', e); }
    }
    // Preserve encryptedMetadata in sync queue if present
    if (data.encryptedMetadata && !finalData.encryptedMetadata) {
      finalData.encryptedMetadata = data.encryptedMetadata;
    }
    const queuedOperation: QueuedSyncOperation = enqueue(finalData);
    this.syncQueue.push(queuedOperation);
    this.saveSyncQueue();
    DEV_LOG('Operation queued for sync:', queuedOperation);

    if (this.isOnline) {
      void this.processSyncQueue();
    }

    return queuedOperation.id ?? Date.now();
  }

  private queueOperation(operation: string, collection: string, data: any): number {
    // Fire and forget; returns a synthetic id for compatibility
    this.queueOperationAsync(operation, collection, data);
    return Date.now();
  }


  private saveSyncQueue(shouldNotify = true): void {
    if (!this.userId) {
      return;
    }

    localStorage.setItem(`syncQueue_${this.userId}`, JSON.stringify(this.syncQueue));

    if (shouldNotify) {
      this.notifySyncQueueChanged();
    }
  }

  private loadSyncQueue(): void {
    if (!this.userId) {
      this.syncQueue = [];
      return;
    }

    const queue = localStorage.getItem(`syncQueue_${this.userId}`);
    if (!queue) {
      this.syncQueue = [];
      return;
    }

    try {
      const parsed = JSON.parse(queue);
      this.syncQueue = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      DEV_WARN('Failed to parse stored sync queue, resetting.', error);
      this.syncQueue = [];
    }
  }

  private clearQueueRetryTimeout(): void {
    if (this.queueRetryTimeout) {
      clearTimeout(this.queueRetryTimeout);
      this.queueRetryTimeout = null;
    }
  }

  private notifySyncQueueChanged(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent('syncQueueUpdated'));
  }

  private notifySyncQueueCleared(): void {
    this.notifySyncQueueChanged();
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent('syncQueueCleared'));
  }

  private recordSuccessfulSync(): void {
    if (!this.userId) {
      return;
    }

    try {
      localStorage.setItem(`lastSync_${this.userId}`, new Date().toISOString());
    } catch (error) {
      DEV_WARN('Failed to persist last sync timestamp', error);
    }

    this.clearQueueRetryTimeout();
    this.notifySyncQueueCleared();
  }

  private async processSyncQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    if (this.isGuest || !this.userId || !this.isOnline || !firestore) {
      return;
    }

    if (this.syncQueue.length === 0) {
      this.clearQueueRetryTimeout();
      return;
    }

    this.isProcessingQueue = true;
    this.clearQueueRetryTimeout();

    try {
      const remaining: QueuedSyncOperation[] = [];
      let processedAny = false;

      for (const entry of this.syncQueue) {
        try {
          const success = await this.applyQueuedOperation(entry);
          if (success) {
            processedAny = true;
          } else {
            remaining.push(entry);
          }
        } catch (error) {
          DEV_WARN('Failed processing queued sync operation', entry, error);
          remaining.push(entry);
        }
      }

      if (processedAny || remaining.length !== this.syncQueue.length) {
        this.syncQueue = remaining;
        this.saveSyncQueue(false);

        if (this.syncQueue.length === 0 && processedAny) {
          this.recordSuccessfulSync();
        } else if (this.syncQueue.length > 0) {
          this.scheduleQueueRetry();
          if (processedAny) {
            this.notifySyncQueueChanged();
          }
        }
      } else if (this.syncQueue.length > 0) {
        this.scheduleQueueRetry();
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Aggressively attempts to drain the sync queue by resolving IDs via queries,
   * converting missing updates into creates, and treating missing deletes as success.
   * If entries still cannot be applied, moves them to a quarantine key and clears the queue
   * so the UI can proceed without being blocked.
   */
  async drainSyncQueueAggressive(): Promise<{ attempted: number; remaining: number; quarantinedKey?: string }> {
    if (this.isGuest || !this.userId) {
      return { attempted: 0, remaining: 0 };
    }

    // First, run a normal processing pass
    await this.processSyncQueue();

    if (this.syncQueue.length === 0) {
      return { attempted: 0, remaining: 0 };
    }

    // Attempt aggressive application per-entry
    const remaining: QueuedSyncOperation[] = [];
    for (const entry of this.syncQueue) {
      try {
        const ok = await this.applyQueuedOperation(entry);
        if (!ok) {
          // If still not ok, try converting update->create for missing mappings
          if (entry.operation === 'update') {
            const clone: QueuedSyncOperation = { ...entry, operation: 'create' };
            const ok2 = await this.applyQueuedOperation(clone);
            if (!ok2) remaining.push(entry);
          } else if (entry.operation === 'delete') {
            // Treat missing target deletes as success
            continue;
          } else {
            remaining.push(entry);
          }
        }
      } catch {
        remaining.push(entry);
      }
    }

    this.syncQueue = remaining;
    this.saveSyncQueue(false);

    // If still remaining, quarantine and clear to unblock UI
    if (this.syncQueue.length > 0) {
      const key = `syncQuarantine_${this.userId}_${Date.now()}`;
      try {
        localStorage.setItem(key, JSON.stringify(this.syncQueue));
      } catch {}
      this.syncQueue = [];
      this.saveSyncQueue(false);
      this.notifySyncQueueCleared();
      return { attempted: remaining.length, remaining: 0, quarantinedKey: key };
    }

    this.notifySyncQueueCleared();
    return { attempted: 0, remaining: 0 };
  }

  private scheduleQueueRetry(): void {
    if (this.queueRetryTimeout || !this.isOnline) {
      return;
    }

    this.queueRetryTimeout = setTimeout(() => {
      this.queueRetryTimeout = null;
      void this.processSyncQueue();
    }, 1_000);
  }

  private async applyQueuedOperation(entry: QueuedSyncOperation): Promise<boolean> {
    if (!entry.collection || !entry.operation) {
      return true;
    }

    const collectionName = entry.collection as SyncCollectionName;
    const operationType = entry.operation;

    switch (collectionName) {
      case 'trips':
        return this.applyTripOperation(operationType, entry.data);
      case 'weatherLogs':
        return this.applyWeatherOperation(operationType, entry.data);
      case 'fishCaught':
        return this.applyFishOperation(operationType, entry.data);
      default:
        DEV_WARN('Unsupported collection in sync queue entry', collectionName);
        return true;
    }
  }

  private async applyTripOperation(operationType: string, rawData: any): Promise<boolean> {
    if (!this.userId || !firestore) {
      return false;
    }

    const payload = await this.prepareQueuedPayload('trips', rawData);
    const localIdRaw = payload.id ?? rawData?.id;

    if (localIdRaw == null) {
      DEV_WARN('Queued trip operation missing id, skipping');
      return true;
    }

    const localId = typeof localIdRaw === 'number' ? localIdRaw : Number(localIdRaw);

    if (!Number.isFinite(localId)) {
      DEV_WARN('Queued trip operation has invalid id', localIdRaw);
      return true;
    }

    if (operationType === 'delete') {
      const firebaseId = await this.resolveFirebaseDocId('trips', localId.toString(), localId);
      if (!firebaseId) {
        return true;
      }
      await deleteDoc(doc(firestore, 'trips', firebaseId));
      localStorage.removeItem(`idMapping_${this.userId}_trips_${localId}`);
      return true;
    }

    const firebaseId = await this.resolveFirebaseDocId('trips', localId.toString(), localId);
    const basePayload = { ...payload };
    delete basePayload.createdAt;
    delete basePayload.updatedAt;

    if (operationType === 'create') {
      if (firebaseId) {
        await updateDoc(doc(firestore, 'trips', firebaseId), {
          ...basePayload,
          updatedAt: serverTimestamp()
        });
        return true;
      }

      const docRef = await addDoc(collection(firestore, 'trips'), {
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await this.storeLocalMapping('trips', localId.toString(), docRef.id);
      return true;
    }

    if (!firebaseId) {
      // No mapping yet; treat as create to avoid losing data
      return this.applyTripOperation('create', payload);
    }

    await updateDoc(doc(firestore, 'trips', firebaseId), {
      ...basePayload,
      updatedAt: serverTimestamp()
    });
    return true;
  }

  private async applyWeatherOperation(operationType: string, rawData: any): Promise<boolean> {
    if (!this.userId || !firestore) {
      return false;
    }

    const payload = await this.prepareQueuedPayload('weatherLogs', rawData);
    const localId = (payload.id ?? rawData?.id) as string | undefined;

    if (!localId) {
      DEV_WARN('Queued weather log operation missing id, skipping');
      return true;
    }

    if (operationType === 'delete') {
      const firebaseId = await this.resolveFirebaseDocId('weatherLogs', localId, localId);
      if (!firebaseId) {
        return true;
      }
      await deleteDoc(doc(firestore, 'weatherLogs', firebaseId));
      localStorage.removeItem(`idMapping_${this.userId}_weatherLogs_${localId}`);
      return true;
    }

    const firebaseId = await this.resolveFirebaseDocId('weatherLogs', localId, localId);
    const basePayload = { ...payload };
    delete basePayload.createdAt;
    delete basePayload.updatedAt;

    if (operationType === 'create') {
      if (firebaseId) {
        await updateDoc(doc(firestore, 'weatherLogs', firebaseId), {
          ...basePayload,
          updatedAt: serverTimestamp()
        });
        return true;
      }

      const docRef = await addDoc(collection(firestore, 'weatherLogs'), {
        ...basePayload,
        createdAt: serverTimestamp()
      });
      await this.storeLocalMapping('weatherLogs', localId, docRef.id);
      return true;
    }

    if (!firebaseId) {
      return this.applyWeatherOperation('create', payload);
    }

    await updateDoc(doc(firestore, 'weatherLogs', firebaseId), {
      ...basePayload,
      updatedAt: serverTimestamp()
    });
    return true;
  }

  private async applyFishOperation(operationType: string, rawData: any): Promise<boolean> {
    if (!this.userId || !firestore) {
      return false;
    }

    let payload = await this.prepareQueuedPayload('fishCaught', rawData);
    const localId = (payload.id ?? rawData?.id) as string | undefined;

    if (!localId) {
      DEV_WARN('Queued fish operation missing id, skipping');
      return true;
    }

    if (this.isOnline) {
      payload = await this.prepareFishQueuedPayload(payload);
    }

    if (operationType === 'delete') {
      const firebaseId = await this.resolveFirebaseDocId('fishCaught', localId, localId);
      if (!firebaseId) {
        return true;
      }
      await deleteDoc(doc(firestore, 'fishCaught', firebaseId));
      localStorage.removeItem(`idMapping_${this.userId}_fishCaught_${localId}`);
      return true;
    }

    const firebaseId = await this.resolveFirebaseDocId('fishCaught', localId, localId);
    const basePayload = { ...payload };
    delete basePayload.createdAt;
    delete basePayload.updatedAt;

    if (operationType === 'create') {
      if (firebaseId) {
        await updateDoc(doc(firestore, 'fishCaught', firebaseId), {
          ...this.sanitizeFishUpdatePayload(basePayload),
          updatedAt: serverTimestamp()
        });
        return true;
      }

      const docRef = await addDoc(collection(firestore, 'fishCaught'), {
        ...this.stripUndefined(basePayload),
        createdAt: serverTimestamp()
      });
      await this.storeLocalMapping('fishCaught', localId, docRef.id);
      return true;
    }

    if (!firebaseId) {
      return this.applyFishOperation('create', payload);
    }

    await updateDoc(doc(firestore, 'fishCaught', firebaseId), {
      ...this.sanitizeFishUpdatePayload(basePayload),
      updatedAt: serverTimestamp()
    });
    return true;
  }

  private async resolveFirebaseDocId(collectionName: SyncCollectionName, localId: string, queryValue: string | number): Promise<string | null> {
    const existing = await this.getFirebaseId(collectionName, localId);
    if (existing) {
      return existing;
    }

    if (!firestore || !this.userId) {
      return null;
    }

    try {
      const value = collectionName === 'trips' ? Number(queryValue) : queryValue;
      if (collectionName === 'trips' && !Number.isFinite(value as number)) {
        return null;
      }

      const q = query(
        collection(firestore, collectionName),
        where('userId', '==', this.userId),
        where('id', '==', value)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        await this.storeLocalMapping(collectionName, localId, docId);
        return docId;
      }
    } catch (error) {
      DEV_WARN('Failed resolving Firebase ID for queued operation', { collectionName, localId, error });
    }

    return null;
  }

  private async prepareQueuedPayload(collectionName: SyncCollectionName, rawData: any): Promise<Record<string, any>> {
    const base: Record<string, any> = rawData && typeof rawData === 'object' ? { ...rawData } : {};
    delete base.timestamp;

    if (!base.userId && this.userId) {
      base.userId = this.userId;
    }

    if (!base._encrypted && encryptionService.isReady()) {
      try {
        return await encryptionService.encryptFields(collectionName, base);
      } catch (error) {
        DEV_WARN('[Sync Queue] Failed to encrypt payload while processing queue', error);
      }
    }

    return base;
  }

  private async prepareFishQueuedPayload(payload: Record<string, any>): Promise<Record<string, any>> {
    if (!payload.photo || typeof payload.photo !== 'string' || !this.userId) {
      return payload;
    }

    const data = this.dataUrlToBytes(payload.photo);
    if (!data) {
      return payload;
    }

    try {
      const refInfo = await this.ensurePhotoInStorage(this.userId, data.bytes, data.mime);
      if ('inlinePhoto' in refInfo) {
        return { ...payload, photo: refInfo.inlinePhoto, photoHash: refInfo.photoHash };
      }

      const updated: Record<string, any> = { ...payload };
      updated.photoHash = refInfo.photoHash;
      updated.photoPath = refInfo.photoPath;
      updated.photoMime = refInfo.photoMime;
      if (refInfo.photoUrl) {
        updated.photoUrl = refInfo.photoUrl;
      }
      if ('encryptedMetadata' in refInfo && refInfo.encryptedMetadata) {
        updated.encryptedMetadata = refInfo.encryptedMetadata;
      }
      delete updated.photo;
      return updated;
    } catch (error) {
      DEV_WARN('Failed to upload queued fish photo to storage', error);
      return payload;
    }
  }

  // ID MAPPING UTILITIES

  private async storeLocalMapping(collection: string, localId: string, firebaseId: string): Promise<void> {
    const key = `idMapping_${this.userId}_${collection}_${localId}`;
    localStorage.setItem(key, firebaseId);
    DEV_LOG(`[ID Mapping] Stored mapping: ${key} -> ${firebaseId}`);
  }

  private async getFirebaseId(collection: string, localId: string): Promise<string | null> {
    const key = `idMapping_${this.userId}_${collection}_${localId}`;
    const firebaseId = localStorage.getItem(key);
    DEV_LOG(`[ID Mapping] Looking up: ${key} -> ${firebaseId || 'NOT FOUND'}`);
    DEV_LOG(`[ID Mapping] User ID: ${this.userId}, Collection: ${collection}, Local ID: ${localId}`);

    if (!firebaseId) {
      DEV_LOG(`[ID Mapping] No mapping found for ${collection} ID ${localId}`);
      DEV_LOG(`[ID Mapping] Available mappings for ${collection}:`);
      // Debug: show all available mappings for this collection
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.includes(`idMapping_${this.userId}_${collection}_`)) {
          const mappingValue = localStorage.getItem(storageKey);
          DEV_LOG(`[ID Mapping]   ${storageKey} -> ${mappingValue}`);
        }
      }
    }

    return firebaseId;
  }

  private generateLocalId(firebaseId: string): number {
    // Simple hash of Firebase ID to create a local number ID
    let hash = 0;
    for (let i = 0; i < firebaseId.length; i++) {
      const char = firebaseId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async convertFromFirestore(data: any, localId: number | string, firebaseDocId?: string, collectionHint?: string): Promise<any> {
    const { createdAt, updatedAt, ...restData } = data;
    const cleanData = { ...restData } as Record<string, unknown>;
    delete (cleanData as any).userId;
    const baseObj = {
      ...cleanData,
      id: localId,
      firebaseDocId: firebaseDocId, // Include the Firestore document ID for deletion
      createdAt: (createdAt as any)?.toDate?.()?.toISOString?.() || createdAt,
      updatedAt: (updatedAt as any)?.toDate?.()?.toISOString?.() || updatedAt
    };
    if (collectionHint) {
      return await encryptionService.decryptObject(collectionHint, baseObj);
    }
    return baseObj;
  }

  // ================= ENCRYPTION MIGRATION (deterministic key) =================
  private encryptionMigrationRunning = false;
  private getEncStateKey(collection: string): string { return `encMigrationState_${this.userId}_${collection}`; }
  private getEncAbortKey(): string { return `encMigrationAbort_${this.userId}`; }
  private loadEncState(key: string): any { try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw); } catch {} return { processed: 0, updated: 0, done: false, cursor: null }; }
  private saveEncState(key: string, state: any): void { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }
  private documentNeedsEncryption(data: any, cfg: { fields: string[]; arrayFields?: string[] }): boolean {
    for (const f of cfg.fields) {
      if (typeof data[f] === 'string' && data[f] && !isPossiblyEncrypted(data[f])) return true;
    }
    if (cfg.arrayFields) {
      for (const af of cfg.arrayFields) {
        const val = data[af];
        if (Array.isArray(val) && val.some(v => typeof v === 'string' && !isPossiblyEncrypted(v))) return true;
      }
    }
    return false;
  }
  /**
   * Check if error is a Firebase index error
   */
  private isFirebaseIndexError(error: Error): boolean {
    const indexErrorMessages = [
      'requires an index',
      'missing index',
      'index not found',
      'The query requires an index',
      'FAILED_PRECONDITION'
    ];
    
    return indexErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase()) ||
      error.stack?.toLowerCase().includes(msg.toLowerCase()) ||
      error.name === 'FirebaseError'
    );
  }

  /**
   * Extract collection name from Firebase index error
   */
  private extractCollectionFromError(error: Error): string | null {
    const message = error.message;
    
    // Look for collection patterns in error messages
    const collectionPatterns = [
      /collection\s+"([^"]+)"/i,
      /from\s+(\w+)/i,
      /on\s+(\w+)\s+collection/i
    ];
    
    for (const pattern of collectionPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // Default to trips if we can't extract (most common case)
    return 'trips';
  }

  async startBackgroundEncryptionMigration(progressCb?: (p: { collection: string; processed: number; updated: number; done: boolean; remaining?: number }) => void): Promise<void> {
    if (this.encryptionMigrationRunning) return;
    if (!this.userId || this.isGuest) return;
    if (!encryptionService.isReady()) return;
    if (!this.isOnline) return;
    this.encryptionMigrationRunning = true;
    try {
      for (const collection of Object.keys(ENCRYPTION_COLLECTION_FIELD_MAP)) {
        const stateKey = this.getEncStateKey(collection);
        const state = this.loadEncState(stateKey);
        if (state.done) { progressCb?.({ collection, processed: state.processed, updated: state.updated, done: true }); continue; }
        let cont = true;
        while (cont) {
          if (!this.isOnline) { cont = false; break; }
          if (localStorage.getItem(this.getEncAbortKey()) === '1') { DEV_WARN('[enc-migration] abort flag'); cont = false; break; }
          const batchRes = await this.processEncryptionMigrationBatch(collection, state);
            state.processed += batchRes.scanned;
            state.updated += batchRes.updated;
            state.cursor = batchRes.nextCursor ?? null;
            state.done = batchRes.done;
            this.saveEncState(stateKey, state);
            progressCb?.({ collection, processed: state.processed, updated: state.updated, done: state.done, remaining: batchRes.remaining });
            cont = !batchRes.done;
            if (cont) await new Promise(r => setTimeout(r, 200));
        }
      }
    } catch (e) { 
      PROD_ERROR('[enc-migration] error', e); 
      
      // Handle Firebase index errors specifically
      if (e instanceof Error && this.isFirebaseIndexError(e)) {
        PROD_ERROR('[enc-migration] Firebase index error detected - failing fast');
        
        // Mark the affected collection as done to prevent indefinite hanging
        const affectedCollection = this.extractCollectionFromError(e) || 'trips';
        try {
          const stateKey = this.getEncStateKey(affectedCollection);
          const currentState = this.loadEncState(stateKey);
          currentState.done = true;
          this.saveEncState(stateKey, currentState);
          
          DEV_WARN(`[enc-migration] Marked collection '${affectedCollection}' as done due to index error`);
          
          // Dispatch index error event for UI to show proper message
          window.dispatchEvent(new CustomEvent('encryptionIndexError', {
            detail: { 
              collection: affectedCollection,
              error: e.message,
              userId: this.userId,
              consoleUrl: 'https://console.firebase.google.com/'
            }
          }));
        } catch (stateError) {
          PROD_ERROR('[enc-migration] Failed to mark collection as done after index error:', stateError);
        }
      }
      
      // Log migration failure telemetry
      PROD_ERROR('[enc-migration] Migration failed:', {
        error: e instanceof Error ? e.message : 'Unknown error',
        userId: this.userId,
        isGuest: this.isGuest,
        isOnline: this.isOnline,
        encryptionReady: encryptionService.isReady(),
        isIndexError: e instanceof Error && this.isFirebaseIndexError(e)
      });
    } finally { 
      this.encryptionMigrationRunning = false;
      
      // Check if migration completed successfully and log success
      if (this.encryptionMigrationRunning === false) {
        try {
          const finalStatus = this.getEncryptionMigrationStatus();
          if (finalStatus.allDone) {
            DEV_LOG('[enc-migration] Migration completed successfully:', {
              userId: this.userId,
              collections: finalStatus.collections,
              totalProcessed: Object.values(finalStatus.collections).reduce((sum, col) => sum + col.processed, 0),
              totalUpdated: Object.values(finalStatus.collections).reduce((sum, col) => sum + col.updated, 0)
            });
            
            // Dispatch migration completion event for UI to listen to
            window.dispatchEvent(new CustomEvent('encryptionMigrationCompleted', {
              detail: { 
                userId: this.userId,
                status: finalStatus
              }
            }));
          }
        } catch (statusError) {
          DEV_WARN('[enc-migration] Failed to get final migration status:', statusError);
        }
      }
    }
  }
  private async processEncryptionMigrationBatch(collectionName: string, state: any): Promise<{ scanned: number; updated: number; done: boolean; nextCursor?: any; remaining?: number }> {
    const cfg = ENCRYPTION_COLLECTION_FIELD_MAP[collectionName];
    if (!cfg) return { scanned: 0, updated: 0, done: true };
    let baseQuery: any;
    try {
      if (state.cursor) {
        baseQuery = query(collection(firestore, collectionName), where('userId','==',this.userId), orderBy('createdAt','asc'), where('createdAt','>', state.cursor));
      } else {
        baseQuery = query(collection(firestore, collectionName), where('userId','==',this.userId), orderBy('createdAt','asc'));
      }
    } catch {
      baseQuery = query(collection(firestore, collectionName), where('userId','==',this.userId));
    }
    const snapshot = await getDocs(baseQuery);
    if (snapshot.empty) return { scanned: 0, updated: 0, done: true };
    let scanned = 0; let updated = 0;
    const batch = writeBatch(firestore);
    const WRITE_LIMIT = 350;
    for (const d of snapshot.docs) {
      if (updated >= WRITE_LIMIT) break;
      scanned++;
      const data = d.data();
      if (this.documentNeedsEncryption(data, cfg)) {
        try {
          const encrypted = await encryptionService.encryptFields(collectionName, data);
          batch.update(d.ref, encrypted);
          updated++;
        } catch (e) { DEV_WARN('[enc-migration] encrypt failed doc '+d.id, e); }
      }
    }
    if (updated > 0) { try { await batch.commit(); } catch (e) { PROD_ERROR('[enc-migration] commit failed', e); updated = 0; } }
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const lastData: any = lastDoc?.data?.();
    const nextCursor = lastData?.createdAt || null;
    const done = snapshot.size === 0 || (!nextCursor);
    return { scanned, updated, done, nextCursor };
  }
  getEncryptionMigrationStatus(): { running: boolean; collections: Record<string, { processed: number; updated: number; done: boolean }>; allDone: boolean } {
    const collections: Record<string, { processed: number; updated: number; done: boolean }> = {};
    let allDone = true;
    for (const c of Object.keys(ENCRYPTION_COLLECTION_FIELD_MAP)) {
      const state = this.loadEncState(this.getEncStateKey(c));
      collections[c] = { processed: state.processed || 0, updated: state.updated || 0, done: !!state.done };
      if (!state.done) allDone = false;
    }
    return { running: this.encryptionMigrationRunning, collections, allDone };
  }
  abortEncryptionMigration(): void { try { localStorage.setItem(this.getEncAbortKey(), '1'); } catch {} }
  resetEncryptionMigrationState(): void { for (const c of Object.keys(ENCRYPTION_COLLECTION_FIELD_MAP)) { try { localStorage.removeItem(this.getEncStateKey(c)); } catch {} } try { localStorage.removeItem(this.getEncAbortKey()); } catch {} }


  // TACKLE BOX METHODS

  /**
   * Get all tackle items from Firestore
   */
  async getAllTackleItems(): Promise<any[]> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    try {
      const q = query(
        collection(firestore, 'tackleItems'),
        where('userId', '==', this.userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      PROD_ERROR('Error fetching tackle items:', error);
      throw error;
    }
  }

  /**
   * Create a new tackle item in Firestore
   */
  async createTackleItem(item: any): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    // Data integrity checks
    this.validateTackleItemData(item);

    // Sanitize string inputs
    const sanitizedItem = {
      ...item,
      name: this.sanitizeString(item.name),
      type: this.sanitizeString(item.type),
      brand: item.brand ? this.sanitizeString(item.brand) : item.brand,
      colour: item.colour ? this.sanitizeString(item.colour) : item.colour,
    };

    try {
      let itemData = {
        ...sanitizedItem,
        userId: this.userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      try {
        itemData = await encryptionService.encryptFields('tackleItems', itemData);
      } catch (e) { 
        DEV_WARN('[encryption] tackle create encrypt failed', e); 
      }

      const docRef = await addDoc(collection(firestore, 'tackleItems'), itemData);
      return docRef.id;
    } catch (error) {
      PROD_ERROR('Error creating tackle item:', error);
      throw error;
    }
  }

  /**
   * Update a tackle item in Firestore
   */
  async updateTackleItem(id: string, updates: any): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    try {
      let encryptedUpdates = { ...updates };
      try {
        encryptedUpdates = await encryptionService.encryptFields('tackleItems', encryptedUpdates);
      } catch (e) { 
        DEV_WARN('[encryption] tackle update encrypt failed', e); 
      }
      const itemRef = doc(firestore, 'tackleItems', id);
      await updateDoc(itemRef, { ...encryptedUpdates, updatedAt: serverTimestamp() });
    } catch (error) {
      PROD_ERROR('Error updating tackle item:', error);
      throw error;
    }
  }

  /**
   * Delete a tackle item from Firestore
   */
  async deleteTackleItem(id: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    try {
      await deleteDoc(doc(firestore, 'tackleItems', id));
    } catch (error) {
      PROD_ERROR('Error deleting tackle item:', error);
      throw error;
    }
  }

  /**
   * Get all gear types from Firestore
   */
  async getAllGearTypes(): Promise<string[]> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    try {
      const q = query(
        collection(firestore, 'gearTypes'),
        where('userId', '==', this.userId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data().name);
    } catch (error) {
      PROD_ERROR('Error fetching gear types:', error);
      throw error;
    }
  }

  /**
   * Create a new gear type in Firestore
   */
  async createGearType(name: string): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    try {
      const typeData = {
        name,
        userId: this.userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(firestore, 'gearTypes'), typeData);
      return docRef.id;
    } catch (error) {
      PROD_ERROR('Error creating gear type:', error);
      throw error;
    }
  }

  /**
   * Update a gear type in Firestore
   */
  async updateGearType(id: string, newName: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    try {
      const typeRef = doc(firestore, 'gearTypes', id);
      await updateDoc(typeRef, {
        name: newName,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      PROD_ERROR('Error updating gear type:', error);
      throw error;
    }
  }

  /**
   * Delete a gear type from Firestore
   */
  async deleteGearType(id: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    try {
      await deleteDoc(doc(firestore, 'gearTypes', id));
    } catch (error) {
      PROD_ERROR('Error deleting gear type:', error);
      throw error;
    }
  }

  // DATA MIGRATION METHODS

  /**
   * Migrate existing local data to Firebase
   */
  async migrateLocalData(): Promise<{
    tripsMigrated: number;
    weatherLogsMigrated: number;
    fishCatchesMigrated: number;
    tackleItemsMigrated: number;
  }> {
    if (!this.isReady()) {
      throw new Error('Service not initialized - user must be authenticated');
    }

    const results = {
      tripsMigrated: 0,
      weatherLogsMigrated: 0,
      fishCatchesMigrated: 0,
      tackleItemsMigrated: 0,
    };

    try {
      DEV_LOG('Starting data migration...');

      // Migrate trips
      const localTrips = await this.getLocalTrips();
      if (localTrips.length > 0) {
        DEV_LOG(`Migrating ${localTrips.length} trips...`);
        for (const trip of localTrips) {
          try {
            await this.createTrip(trip);
            results.tripsMigrated++;
          } catch (error) {
            PROD_ERROR('Failed to migrate trip:', trip.id, error);
          }
        }
      }

      // Migrate weather logs
      const localWeather = await this.getLocalWeatherLogs();
      if (localWeather.length > 0) {
        DEV_LOG(`Migrating ${localWeather.length} weather logs...`);
        for (const weather of localWeather) {
          try {
            await this.createWeatherLog(weather);
            results.weatherLogsMigrated++;
          } catch (error) {
            PROD_ERROR('Failed to migrate weather log:', weather.id, error);
          }
        }
      }

      // Migrate fish catches
      const localFish = await this.getLocalFishCatches();
      if (localFish.length > 0) {
        DEV_LOG(`Migrating ${localFish.length} fish catches...`);
        for (const fish of localFish) {
          try {
            await this.createFishCaught(fish);
            results.fishCatchesMigrated++;
          } catch (error) {
            PROD_ERROR('Failed to migrate fish catch:', fish.id, error);
          }
        }
      }

      // Migrate tackle box
      const localTackle = await this.getLocalTackleItems();
      if (localTackle.length > 0) {
        DEV_LOG(`Migrating ${localTackle.length} tackle items...`);
        for (const item of localTackle) {
          try {
            await this.createTackleItem(item);
            results.tackleItemsMigrated++;
          } catch (error) {
            PROD_ERROR('Failed to migrate tackle item:', item.id, error);
          }
        }
      }

      // Mark migration as complete
      await this.markMigrationComplete();

      DEV_LOG('Data migration completed:', results);
      return results;
    } catch (error) {
      PROD_ERROR('Data migration failed:', error);
      throw error;
    }
  }

  /**
   * Check if user has completed migration
   */
  async hasCompletedMigration(): Promise<boolean> {
    try {
      return localStorage.getItem(`migrationComplete_${this.userId}`) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Check if user has local data that needs migration
   */
  async hasLocalData(): Promise<boolean> {
    try {
      const [trips, weather, fish, tackle] = await Promise.all([
        this.getLocalTrips(),
        this.getLocalWeatherLogs(),
        this.getLocalFishCatches(),
        this.getLocalTackleItems(),
      ]);

      return trips.length > 0 || weather.length > 0 || fish.length > 0 || tackle.length > 0;
    } catch {
      return false;
    }
  }

  /**
    * Clear the sync queue (emergency method to resolve stuck sync)
    */
  clearSyncQueue(): void {
    this.syncQueue = [];
    this.saveSyncQueue(false);
    this.clearQueueRetryTimeout();
    this.notifySyncQueueCleared();
    // Removed console.log to reduce debug messages
  }

  /**
   * Debug method to inspect ID mappings in localStorage
   */
  debugIdMappings(): void {
    if (!this.userId) {
      DEV_LOG('[ID Mapping Debug] No user ID set');
      return;
    }

    DEV_LOG('[ID Mapping Debug] Current ID mappings for user:', this.userId);
    const collections = ['trips', 'weatherLogs', 'fishCaught'];

    collections.forEach(collection => {
      DEV_LOG(`\n[ID Mapping Debug] ${collection.toUpperCase()} mappings:`);
      // Look for all keys that match the pattern
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(`idMapping_${this.userId}_${collection}_`)) {
          const firebaseId = localStorage.getItem(key);
          const localId = key.split('_').pop();
          DEV_LOG(`  ${localId} -> ${firebaseId}`);
        }
      }
    });
  }

  // PRIVATE MIGRATION HELPERS

  private async getLocalTrips(): Promise<any[]> {
    try {
      return await databaseService.getAllTrips();
    } catch (error) {
      PROD_ERROR('Failed to get local trips:', error);
      return [];
    }
  }

  private async getLocalWeatherLogs(): Promise<any[]> {
    try {
      return await databaseService.getAllWeatherLogs();
    } catch (error) {
      PROD_ERROR('Failed to get local weather logs:', error);
      return [];
    }
  }

  private async getLocalFishCatches(): Promise<any[]> {
    try {
      return await databaseService.getAllFishCaught();
    } catch (error) {
      PROD_ERROR('Failed to get local fish catches:', error);
      return [];
    }
  }

  private async getLocalTackleItems(): Promise<any[]> {
    try {
      const tackleData = localStorage.getItem('tacklebox');
      return tackleData ? JSON.parse(tackleData) : [];
    } catch (error) {
      PROD_ERROR('Failed to get local tackle items:', error);
      return [];
    }
  }


  private async markMigrationComplete(): Promise<void> {
    try {
      localStorage.setItem(`migrationComplete_${this.userId}`, 'true');
    } catch (error) {
      PROD_ERROR('Failed to mark migration complete:', error);
    }
  }


  // DATA INTEGRITY VALIDATION METHODS

  /**
   * Validate trip data before saving
   */
  private validateTripData(tripData: Omit<Trip, "id">): void {
    if (!tripData.date || typeof tripData.date !== 'string') {
      throw new Error('Trip date is required and must be a string');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(tripData.date)) {
      throw new Error('Trip date must be in YYYY-MM-DD format');
    }

    if (!tripData.water || typeof tripData.water !== 'string' || tripData.water.trim().length === 0) {
      throw new Error('Trip water/body is required');
    }

    if (!tripData.location || typeof tripData.location !== 'string' || tripData.location.trim().length === 0) {
      throw new Error('Trip location is required');
    }

    if (tripData.hours !== undefined && (typeof tripData.hours !== 'number' || tripData.hours < 0)) {
      throw new Error('Trip hours must be a positive number');
    }

    // Sanitize string fields
    if (tripData.companions && typeof tripData.companions !== 'string') {
      throw new Error('Trip companions must be a string');
    }

    if (tripData.notes && typeof tripData.notes !== 'string') {
      throw new Error('Trip notes must be a string');
    }
  }

  /**
   * Validate fish catch data before saving
   */
  private validateFishCatchData(fishData: Omit<FishCaught, "id">): void {
    if (!fishData.tripId || typeof fishData.tripId !== 'number' || fishData.tripId <= 0) {
      throw new Error('Valid trip ID is required for fish catch');
    }

    if (!fishData.species || typeof fishData.species !== 'string' || fishData.species.trim().length === 0) {
      throw new Error('Fish species is required');
    }

    if (fishData.gear && !Array.isArray(fishData.gear)) {
      throw new Error('Fish gear must be an array of strings');
    }

    if (fishData.length && typeof fishData.length !== 'string') {
      throw new Error('Fish length must be a string');
    }

    if (fishData.weight && typeof fishData.weight !== 'string') {
      throw new Error('Fish weight must be a string');
    }

    if (fishData.time && typeof fishData.time !== 'string') {
      throw new Error('Fish catch time must be a string');
    }

    if (fishData.details && typeof fishData.details !== 'string') {
      throw new Error('Fish details must be a string');
    }
  }

  /**
   * Validate weather log data before saving
   */
  private validateWeatherLogData(weatherData: Omit<WeatherLog, "id">): void {
    if (!weatherData.tripId || typeof weatherData.tripId !== 'number' || weatherData.tripId <= 0) {
      throw new Error('Valid trip ID is required for weather log');
    }

    if (!weatherData.timeOfDay || typeof weatherData.timeOfDay !== 'string') {
      throw new Error('Time of day is required for weather log');
    }

    // Handle temperature validation - can be string or number
    if (weatherData.waterTemp !== undefined && weatherData.waterTemp !== '') {
      const waterTemp = typeof weatherData.waterTemp === 'string' ? parseFloat(weatherData.waterTemp) : weatherData.waterTemp;
      if (isNaN(waterTemp)) {
        throw new Error('Water temperature must be a valid number');
      }
    }

    if (weatherData.airTemp !== undefined && weatherData.airTemp !== '') {
      const airTemp = typeof weatherData.airTemp === 'string' ? parseFloat(weatherData.airTemp) : weatherData.airTemp;
      if (isNaN(airTemp)) {
        throw new Error('Air temperature must be a valid number');
      }
    }
  }

  /**
   * Validate tackle item data before saving
   */
  private validateTackleItemData(item: any): void {
    if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
      throw new Error('Tackle item name is required');
    }

    if (!item.type || typeof item.type !== 'string' || item.type.trim().length === 0) {
      throw new Error('Tackle item type is required');
    }

    // Optional fields validation
    if (item.brand && typeof item.brand !== 'string') {
      throw new Error('Tackle item brand must be a string');
    }

    if (item.colour && typeof item.colour !== 'string') {
      throw new Error('Tackle item colour must be a string');
    }
  }

  /**
   * Sanitize string input to prevent injection attacks
   */
  private sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    // Remove potentially dangerous characters and trim
    return input.replace(/[<>"'&]/g, '').trim();
  }

}

// Export a singleton instance
export const firebaseDataService = new FirebaseDataService();