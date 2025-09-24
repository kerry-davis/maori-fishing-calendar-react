import type { Trip, WeatherLog, FishCaught } from "../types";
import { firestore, auth } from "./firebase";
import { databaseService } from "./databaseService";
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
  writeBatch
} from "firebase/firestore";

/**
 * Firebase Data Service - Cloud-first with offline fallback
 * Replaces IndexedDB with Firestore while maintaining offline functionality
 */
export class FirebaseDataService {
  private userId: string | null = null;
  private isGuest = true;
  private isOnline = navigator.onLine;
  private syncQueue: any[] = [];
  private isInitialized = false;

  constructor() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      // Temporarily disable sync processing to prevent UI blocking
      // this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Add emergency clear method to window for debugging
    (window as any).clearFirebaseSync = () => this.clearSyncQueue();
    (window as any).debugIdMappings = () => this.debugIdMappings();
  }

  /**
   * Initialize the service for guest or authenticated user
   */
  async initialize(userId?: string): Promise<void> {
    if (userId) {
      this.userId = userId;
      this.isGuest = false;
      this.loadSyncQueue(); // Load user-specific queue
      // await this.processSyncQueue();
      console.log('Firebase Data Service initialized for user:', userId);
    } else {
      this.userId = null;
      this.isGuest = true;
      console.log('Firebase Data Service initialized for guest');
    }
    this.isInitialized = true;
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  async switchToUser(userId: string): Promise<void> {
    if (this.isGuest) {
      this.userId = userId;
      this.isGuest = false;
      this.loadSyncQueue();
      console.log('Switched to user mode:', userId);
    }
  }

  // TRIP OPERATIONS

  /**
   * Create a new trip
   */
  async createTrip(tripData: Omit<Trip, "id">): Promise<number> {
    if (!this.isReady()) throw new Error('Service not initialized');

    // Data integrity checks
    this.validateTripData(tripData);

    // Sanitize string inputs
    const sanitizedTripData = {
      ...tripData,
      water: this.sanitizeString(tripData.water),
      location: this.sanitizeString(tripData.location),
      companions: tripData.companions ? this.sanitizeString(tripData.companions) : tripData.companions,
      notes: tripData.notes ? this.sanitizeString(tripData.notes) : tripData.notes,
    };

    if (this.isGuest) {
      return databaseService.createTrip(sanitizedTripData);
    }

    console.log('Creating trip with service userId:', this.userId);
    console.log('Auth currentUser UID:', auth.currentUser?.uid);

    const tripId = Date.now();
    const tripWithUser = { ...sanitizedTripData, id: tripId, userId: this.userId };
    console.log('Trip data to save:', tripWithUser);

    if (this.isOnline) {
      try {
        const docRef = await addDoc(collection(firestore, 'trips'), {
          ...tripWithUser,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Store the Firebase ID mapping
        await this.storeLocalMapping('trips', tripId.toString(), docRef.id);

        console.log('Trip created in Firestore:', docRef.id);
        return tripId;
      } catch (error) {
        console.warn('Firestore create failed, falling back to local:', error);
        return this.queueOperation('create', 'trips', tripWithUser);
      }
    } else {
      return this.queueOperation('create', 'trips', tripWithUser);
    }
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
             return this.convertFromFirestore(data, id, docSnap.id);
           }
         }
       } catch (error) {
         console.warn('Firestore get failed, trying local:', error);
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
           return this.convertFromFirestore(data, localId, firebaseId);
         }
       } catch (error) {
         console.warn('Firestore get by Firebase ID failed:', error);
       }
     }

     return null;
   }

  /**
    * Get all trips for a specific date
    */
   async getTripsByDate(date: string): Promise<Trip[]> {
     if (!this.isReady()) throw new Error('Service not initialized');

     if (this.isGuest) {
       return databaseService.getTripsByDate(date);
     }

     console.log('getTripsByDate called for date:', date, 'online:', this.isOnline);

     if (this.isOnline) {
       try {
         const q = query(
           collection(firestore, 'trips'),
           where('userId', '==', this.userId),
           where('date', '==', date)
         );

         const querySnapshot = await getDocs(q);
         console.log('Firestore query returned', querySnapshot.size, 'documents');
         const trips: Trip[] = [];

         querySnapshot.forEach((doc) => {
           const data = doc.data();
           const localId = data.id as number;
           this.storeLocalMapping('trips', localId.toString(), doc.id);
           trips.push(this.convertFromFirestore(data, localId, doc.id));
         });

         console.log('Returning', trips.length, 'trips from Firestore');
         return trips;
       } catch (error) {
         console.warn('Firestore query failed, falling back to local:', error);
       }
     }

     // Fallback to local storage
     console.log('Using local storage fallback');
     const localTrips = await databaseService.getTripsByDate(date);
     console.log('Local storage returned', localTrips.length, 'trips');
     return localTrips;
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
        console.log('Fetching trips from Firebase for user:', this.userId);
        const q = query(
          collection(firestore, 'trips'),
          where('userId', '==', this.userId),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const trips: Trip[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const localId = data.id as number;
          this.storeLocalMapping('trips', localId.toString(), doc.id);
          trips.push(this.convertFromFirestore(data, localId, doc.id));
        });

        console.log(`Found ${trips.length} trips in Firebase for user ${this.userId}`);
        return trips;
      } catch (error) {
        console.error('Firestore query failed, falling back to local:', error);
      }
    }

    // Fallback to local storage
    return databaseService.getAllTrips();
  }

  /**
    * Update a trip
    */
   async updateTrip(trip: Trip): Promise<void> {
     if (!this.isReady()) throw new Error('Service not initialized');

     if (this.isGuest) {
       return databaseService.updateTrip(trip);
     }

     const tripWithUser = { ...trip, userId: this.userId };

     if (this.isOnline) {
       try {
         const firebaseId = await this.getFirebaseId('trips', trip.id.toString());
         if (firebaseId) {
           const docRef = doc(firestore, 'trips', firebaseId);
           await updateDoc(docRef, {
             ...tripWithUser,
             updatedAt: serverTimestamp()
           });
           console.log('Trip updated in Firestore:', firebaseId);
           return;
         }
       } catch (error) {
         console.warn('Firestore update failed, falling back to local:', error);
       }
     }

     // Fallback to local storage
     await databaseService.updateTrip(trip);
     this.queueOperation('update', 'trips', tripWithUser);
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

     const tripWithUser = { ...trip, userId: this.userId };

     if (this.isOnline) {
       try {
         const docRef = doc(firestore, 'trips', firebaseId);
         await updateDoc(docRef, {
           ...tripWithUser,
           updatedAt: serverTimestamp()
         });
         console.log('Trip updated in Firestore using direct Firebase ID:', firebaseId);
         return;
       } catch (error) {
         console.warn('Firestore update with direct ID failed, falling back to local:', error);
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
     if (!this.isReady()) throw new Error('Service not initialized');

     if (this.isGuest) {
       return databaseService.deleteTrip(id);
     }

     console.log('deleteTrip called with id:', id, 'firebaseDocId:', firebaseDocId);

     if (this.isOnline) {
       try {
         console.log('Attempting Firestore delete...');

         // If we have the Firebase document ID directly, use it
         if (firebaseDocId) {
           console.log('Using provided Firebase document ID:', firebaseDocId);
           const batch = writeBatch(firestore);

           // Delete the trip
           batch.delete(doc(firestore, 'trips', firebaseDocId));

           // Delete associated weather logs
            const weatherQuery = query(
                collection(firestore, 'weatherLogs'),
                where('userId', '==', this.userId),
                where('tripId', '==', id),
            );
            const weatherSnapshot = await getDocs(weatherQuery);
            weatherSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Delete associated fish caught
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
           console.log('Trip and associated data deleted from Firestore using document ID');
           return;
         }

         // Fallback to ID mapping lookup
         const firebaseId = await this.getFirebaseId('trips', id.toString());
         console.log('Firebase ID for trip', id, ':', firebaseId);

         if (firebaseId) {
           console.log('Found Firebase ID via mapping, proceeding with batch delete');
           const batch = writeBatch(firestore);

           // Delete the trip
           batch.delete(doc(firestore, 'trips', firebaseId));

           // Delete associated weather logs
            const weatherQuery = query(
                collection(firestore, 'weatherLogs'),
                where('userId', '==', this.userId),
                where('tripId', '==', id),
            );
            const weatherSnapshot = await getDocs(weatherQuery);
            weatherSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            // Delete associated fish caught
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
           console.log('Trip and associated data deleted from Firestore');
           return;
         } else {
           console.log('No Firebase ID found, trying alternative deletion methods');

           // Method 1: Try to find by local ID field
           try {
             const tripQuery = query(
               collection(firestore, 'trips'),
               where('userId', '==', this.userId),
               where('id', '==', id)
             );

             const tripSnapshot = await getDocs(tripQuery);

             if (!tripSnapshot.empty) {
               console.log(`Found ${tripSnapshot.size} trip document(s) by local ID, deleting...`);
                const batch = writeBatch(firestore);
tripSnapshot.forEach(doc => {
   batch.delete(doc.ref);
});
await batch.commit();

               return;
             }
           } catch (error) {
             console.warn('Local ID query failed:', error);
           }

           // Method 2: For old trips without reliable identification, provide a helpful error
           console.log('Cannot delete trip - no reliable way to identify it in Firestore');
           console.log('This may be an old trip created before proper ID tracking');
           throw new Error('Trip not found for deletion - please refresh and try again');
         }
       } catch (error) {
         console.error('Firestore delete failed:', error);
         console.warn('Falling back to local storage');
       }
     }

     // Fallback to local storage
     console.log('Using local storage fallback for delete');
     await databaseService.deleteTrip(id);
     this.queueOperation('delete', 'trips', { id, userId: this.userId });
   }

  // WEATHER LOG OPERATIONS

  async createWeatherLog(weatherData: Omit<WeatherLog, "id">): Promise<string> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      return databaseService.createWeatherLog(weatherData);
    }

    // Data integrity checks
    this.validateWeatherLogData(weatherData);

    // Generate a local ID that we will store in the document itself
    const localId = `${weatherData.tripId}-${Date.now()}`;
    const weatherWithIds = { ...weatherData, id: localId, userId: this.userId };

    console.log('[Weather Create] Creating weather log with data:', weatherWithIds);

    if (this.isOnline) {
      try {
        const docRef = await addDoc(collection(firestore, 'weatherLogs'), {
          ...weatherWithIds,
          createdAt: serverTimestamp()
        });

        console.log('[Weather Create] Firebase document ID:', docRef.id);
        await this.storeLocalMapping('weatherLogs', localId, docRef.id);
        console.log('[Weather Create] Successfully created weather log and stored mappings');
        return localId;
      } catch (error) {
        console.warn('Firestore create failed, falling back to local:', error);
        this.queueOperation('create', 'weatherLogs', weatherWithIds);
        return localId; // Return localId even on failure to update UI
      }
    } else {
      this.queueOperation('create', 'weatherLogs', weatherWithIds);
      return localId; // Return localId for UI update
    }
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
            return this.convertFromFirestore(data, id, firebaseId) as WeatherLog;
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
          return this.convertFromFirestore(data, id, doc.id) as WeatherLog;
        }

      } catch (error) {
        console.warn('Firestore get failed, trying local:', error);
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
        const weatherLogs: WeatherLog[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const localId = data.id as string; // The ID is stored in the document
          this.storeLocalMapping('weatherLogs', localId, doc.id);
          weatherLogs.push(this.convertFromFirestore(data, localId, doc.id) as WeatherLog);
        });

        return weatherLogs;
      } catch (error) {
        console.warn('Firestore query failed, falling back to local:', error);
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
        const weatherLogs: WeatherLog[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const localId = data.id as string; // The ID is stored in the document
          this.storeLocalMapping('weatherLogs', localId, doc.id);
          weatherLogs.push(this.convertFromFirestore(data, localId, doc.id) as WeatherLog);
        });

        return weatherLogs;
      } catch (error) {
        console.warn('Firestore query failed, falling back to local:', error);
      }
    }

    return databaseService.getAllWeatherLogs();
  }

  async updateWeatherLog(weatherLog: WeatherLog): Promise<void> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      return databaseService.updateWeatherLog(weatherLog);
    }

    const weatherWithUser = { ...weatherLog, userId: this.userId };

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('weatherLogs', weatherLog.id.toString());
        if (firebaseId) {
          // Update existing Firestore document
          const docRef = doc(firestore, 'weatherLogs', firebaseId);
          await updateDoc(docRef, {
            ...weatherWithUser,
            updatedAt: serverTimestamp()
          });
          console.log('Weather log updated in Firestore:', firebaseId);
          return;
        } else {
          // No Firebase ID mapping found - create new document in Firestore
          console.log('No Firebase ID mapping found for weather log, creating new document');
          const docRef = await addDoc(collection(firestore, 'weatherLogs'), {
            ...weatherWithUser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Store the Firebase ID mapping for future operations
          await this.storeLocalMapping('weatherLogs', weatherLog.id.toString(), docRef.id);
          console.log('Weather log created in Firestore:', docRef.id);
          return;
        }
      } catch (error) {
        console.warn('Firestore update/create failed, falling back to local:', error);
      }
    }

    // Fallback to local storage and queue for sync
    await databaseService.updateWeatherLog(weatherLog);
    this.queueOperation('update', 'weatherLogs', weatherWithUser);
  }

  async deleteWeatherLog(id: string): Promise<void> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      // The 'id' for weather logs can be a string, databaseService handles it.
      return databaseService.deleteWeatherLog(id);
    }

    console.log('[Weather Delete] Starting delete for weather log ID:', id);
    let deletedFromFirebase = false;

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('weatherLogs', id);
        if (firebaseId) {
          await deleteDoc(doc(firestore, 'weatherLogs', firebaseId));
          console.log('[Weather Delete] Firestore doc deleted via mapping:', firebaseId);
          deletedFromFirebase = true;
        } else {
          console.warn('[Weather Delete] No Firebase ID mapping found for local ID:', id);
        }
      } catch (error) {
        console.error('[Weather Delete] Firestore delete failed:', error);
      }
    }

    // Always delete from local DB
    await databaseService.deleteWeatherLog(id);

    // Queue for sync if offline or if online deletion failed
    if (!this.isOnline || (this.isOnline && !deletedFromFirebase)) {
      console.log('[Weather Delete] Queuing for sync.');
      this.queueOperation('delete', 'weatherLogs', { id, userId: this.userId });
    } else {
      console.log('[Weather Delete] Deletion successful on all stores. No queue needed.');
    }
  }

  // FISH CAUGHT OPERATIONS

  async createFishCaught(fishData: Omit<FishCaught, "id">): Promise<string> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      return databaseService.createFishCaught(fishData);
    }

    // Data integrity checks
    this.validateFishCatchData(fishData);

    // Sanitize string inputs
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
    const fishWithIds = { ...sanitizedFishData, id: localId, userId: this.userId };

    console.log('[Fish Create] Creating fish catch with data:', fishWithIds);

    if (this.isOnline) {
      try {
        const docRef = await addDoc(collection(firestore, 'fishCaught'), {
          ...fishWithIds,
          createdAt: serverTimestamp()
        });

        console.log('[Fish Create] Firebase document ID:', docRef.id);
        await this.storeLocalMapping('fishCaught', localId, docRef.id);
        console.log('[Fish Create] Successfully created fish catch and stored mappings');
        return localId;
      } catch (error) {
        console.warn('Firestore create failed, falling back to local:', error);
        this.queueOperation('create', 'fishCaught', fishWithIds);
        return localId;
      }
    } else {
      this.queueOperation('create', 'fishCaught', fishWithIds);
      return localId;
    }
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
            return this.convertFromFirestore(data, id, firebaseId) as FishCaught;
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
          return this.convertFromFirestore(data, id, doc.id) as FishCaught;
        }

      } catch (error) {
        console.warn('Firestore get failed, trying local:', error);
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
        const fishCaught: FishCaught[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const localId = data.id as string;
          this.storeLocalMapping('fishCaught', localId, doc.id);
          fishCaught.push(this.convertFromFirestore(data, localId, doc.id) as FishCaught);
        });

        return fishCaught;
      } catch (error) {
        console.warn('Firestore query failed, falling back to local:', error);
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
        const fishCaught: FishCaught[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const localId = data.id as string;
          this.storeLocalMapping('fishCaught', localId, doc.id);
          fishCaught.push(this.convertFromFirestore(data, localId, doc.id) as FishCaught);
        });

        return fishCaught;
      } catch (error) {
        console.warn('Firestore query failed, falling back to local:', error);
      }
    }

    return databaseService.getAllFishCaught();
  }

  async updateFishCaught(fishCaught: FishCaught): Promise<void> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      return databaseService.updateFishCaught(fishCaught);
    }


    const fishWithUser = { ...fishCaught, userId: this.userId };
    console.log('[Fish Update] Starting update for fish ID:', fishCaught.id);

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('fishCaught', fishCaught.id.toString());
        console.log('[Fish Update] Firebase ID lookup result:', firebaseId);

        if (firebaseId) {
          // Update existing Firestore document
          const docRef = doc(firestore, 'fishCaught', firebaseId);
          await updateDoc(docRef, {
            ...fishWithUser,
            updatedAt: serverTimestamp()
          });
          console.log('Fish caught updated in Firestore:', firebaseId);
          return;
        } else {
          // No Firebase ID mapping found - create new document in Firestore
          console.log('No Firebase ID mapping found for fish catch, creating new document');
          const docRef = await addDoc(collection(firestore, 'fishCaught'), {
            ...fishWithUser,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Store the Firebase ID mapping for future operations
          await this.storeLocalMapping('fishCaught', fishCaught.id.toString(), docRef.id);
          console.log('Fish caught created in Firestore:', docRef.id);
          return;
        }
      } catch (error) {
        console.warn('Firestore update/create failed, falling back to local:', error);
      }
    }

    // Fallback to local storage and queue for sync
    await databaseService.updateFishCaught(fishCaught);
    this.queueOperation('update', 'fishCaught', fishWithUser);
  }

  async deleteFishCaught(id: string): Promise<void> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isGuest) {
      // The 'id' for fish caught can be a string, databaseService handles it.
      return databaseService.deleteFishCaught(id);
    }

    console.log('[Fish Delete] Starting delete for fish catch ID:', id);
    let deletedFromFirebase = false;

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('fishCaught', id);
        if (firebaseId) {
          await deleteDoc(doc(firestore, 'fishCaught', firebaseId));
          console.log('[Fish Delete] Firestore doc deleted via mapping:', firebaseId);
          deletedFromFirebase = true;
        } else {
          console.warn('[Fish Delete] No Firebase ID mapping found for local ID:', id);
        }
      } catch (error) {
        console.error('[Fish Delete] Firestore delete failed:', error);
      }
    }

    // Always delete from local DB
    await databaseService.deleteFishCaught(id);

    // Queue for sync if offline or if online deletion failed
    if (!this.isOnline || (this.isOnline && !deletedFromFirebase)) {
      console.log('[Fish Delete] Queuing for sync.');
      this.queueOperation('delete', 'fishCaught', { id, userId: this.userId });
    } else {
      console.log('[Fish Delete] Deletion successful on all stores. No queue needed.');
    }
  }

  async cleanupOrphanedFirestoreData(): Promise<void> {
    if (this.isGuest || !this.isOnline) {
      return;
    }

    console.log("Checking for orphaned data in Firestore...");

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

      console.log(`Found ${validLocalTripIds.size} valid trips in Firestore (local IDs: ${Array.from(validLocalTripIds).join(', ')})`);

      // Only proceed with cleanup if we have trips to validate against
      if (validLocalTripIds.size === 0) {
        console.log("No trips found - skipping orphaned data cleanup to avoid removing valid data");
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
          console.log(`Found potentially orphaned weather log: ${doc.id} with tripId: ${data.tripId}`);
          console.log(`  Valid local trip IDs: ${Array.from(validLocalTripIds).join(', ')}`);
          console.log(`  Valid Firebase trip IDs: ${Array.from(validFirebaseTripIds).join(', ')}`);
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
          console.log(`Found potentially orphaned fish caught: ${doc.id} with tripId: ${data.tripId}`);
          console.log(`  Valid local trip IDs: ${Array.from(validLocalTripIds).join(', ')}`);
          console.log(`  Valid Firebase trip IDs: ${Array.from(validFirebaseTripIds).join(', ')}`);
          orphanedFishDocs.push(doc.id);
        }
      });

      // Only delete if we have a small number of orphaned records
      // This prevents accidentally deleting data during merge operations
      if (orphanedWeatherDocs.length > 0 || orphanedFishDocs.length > 0) {
        const totalOrphaned = orphanedWeatherDocs.length + orphanedFishDocs.length;

        // If we have more than 10 orphaned records, be very cautious
        if (totalOrphaned > 10) {
          console.log(`Found ${totalOrphaned} potentially orphaned records - this seems high, skipping cleanup to avoid data loss`);
          return;
        }

        console.log(`Cleaning up ${orphanedWeatherDocs.length} orphaned weather logs and ${orphanedFishDocs.length} orphaned fish caught records from Firestore.`);

        const batch = writeBatch(firestore);

        orphanedWeatherDocs.forEach(docId => {
          batch.delete(doc(firestore, 'weatherLogs', docId));
        });

        orphanedFishDocs.forEach(docId => {
          batch.delete(doc(firestore, 'fishCaught', docId));
        });

        await batch.commit();
        console.log("Orphaned data cleanup completed successfully.");
      } else {
        console.log("No orphaned data found in Firestore.");
      }
    } catch (error) {
      console.error("Error during orphaned data cleanup:", error);
      // Don't throw - this is a cleanup operation, we don't want to break the main flow
    }
  }

  async mergeLocalDataForUser(): Promise<void> {
    if (this.isGuest || !this.userId) {
      console.warn("Cannot merge local data in guest mode or without a user.");
      return;
    }

    console.log("Starting local data merge for user:", this.userId);

    const localTrips = await databaseService.getAllTrips();
    const localWeatherLogs = await databaseService.getAllWeatherLogs();
    const localFishCaught = await databaseService.getAllFishCaught();

    if (localTrips.length === 0 && localWeatherLogs.length === 0 && localFishCaught.length === 0) {
      console.log("No local data to merge.");
      return;
    }

    console.log(`Found ${localTrips.length} trips, ${localWeatherLogs.length} weather logs, and ${localFishCaught.length} fish caught locally.`);

    const batch = writeBatch(firestore);
    const tripIdMap = new Map<number, string>();

    // Helper function to clean data for Firebase (remove undefined values)
    const cleanForFirebase = (obj: any) => {
      const cleaned: any = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
          cleaned[key] = obj[key];
        }
      });
      return cleaned;
    };

    // Helper function to check if a trip already exists in Firestore
    const getExistingTripFirebaseId = async (localTripId: number): Promise<string | null> => {
      try {
        // First check if we have a Firebase ID mapping for this local trip ID
        const firebaseId = await this.getFirebaseId('trips', localTripId.toString());
        if (firebaseId) {
          // Verify the document still exists in Firestore
          const docRef = doc(firestore, 'trips', firebaseId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return firebaseId;
          } else {
            // Document doesn't exist, remove the stale mapping
            console.warn(`Stale ID mapping found for trip ${localTripId}, removing mapping`);
            const key = `idMapping_${this.userId}_trips_${localTripId}`;
            localStorage.removeItem(key);
          }
        }

        // Fallback: query by local ID field in case the mapping is missing
        const existingTripsQuery = query(
          collection(firestore, 'trips'),
          where('userId', '==', this.userId),
          where('id', '==', localTripId)
        );
        const existingTripsSnapshot = await getDocs(existingTripsQuery);
        if (!existingTripsSnapshot.empty) {
          const existingDoc = existingTripsSnapshot.docs[0];
          // Store the mapping for future lookups
          await this.storeLocalMapping('trips', localTripId.toString(), existingDoc.id);
          return existingDoc.id;
        }
        return null;
      } catch (error) {
        console.warn('Error checking for existing trip:', error);
        return null;
      }
    };

    // Helper function to check if a weather log already exists in Firestore
    const getExistingWeatherLogFirebaseId = async (localId: string): Promise<string | null> => {
      try {
        // First check if we have a Firebase ID mapping for this local weather log ID
        const firebaseId = await this.getFirebaseId('weatherLogs', localId);
        if (firebaseId) {
          // Verify the document still exists in Firestore
          const docRef = doc(firestore, 'weatherLogs', firebaseId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return firebaseId;
          } else {
            // Document doesn't exist, remove the stale mapping
            console.warn(`Stale ID mapping found for weather log ${localId}, removing mapping`);
            const key = `idMapping_${this.userId}_weatherLogs_${localId}`;
            localStorage.removeItem(key);
          }
        }

        // Fallback: query by local ID field in case the mapping is missing
        const existingWeatherQuery = query(
          collection(firestore, 'weatherLogs'),
          where('userId', '==', this.userId),
          where('id', '==', localId)
        );
        const existingWeatherSnapshot = await getDocs(existingWeatherQuery);
        if (!existingWeatherSnapshot.empty) {
          const existingDoc = existingWeatherSnapshot.docs[0];
          // Store the mapping for future lookups
          await this.storeLocalMapping('weatherLogs', localId, existingDoc.id);
          return existingDoc.id;
        }
        return null;
      } catch (error) {
        console.warn('Error checking for existing weather log:', error);
        return null;
      }
    };

    // Helper function to check if a fish caught already exists in Firestore
    const getExistingFishCaughtFirebaseId = async (localId: string): Promise<string | null> => {
      try {
        // First check if we have a Firebase ID mapping for this local fish caught ID
        const firebaseId = await this.getFirebaseId('fishCaught', localId);
        if (firebaseId) {
          // Verify the document still exists in Firestore
          const docRef = doc(firestore, 'fishCaught', firebaseId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            return firebaseId;
          } else {
            // Document doesn't exist, remove the stale mapping
            console.warn(`Stale ID mapping found for fish caught ${localId}, removing mapping`);
            const key = `idMapping_${this.userId}_fishCaught_${localId}`;
            localStorage.removeItem(key);
          }
        }

        // Fallback: query by local ID field in case the mapping is missing
        const existingFishQuery = query(
          collection(firestore, 'fishCaught'),
          where('userId', '==', this.userId),
          where('id', '==', localId)
        );
        const existingFishSnapshot = await getDocs(existingFishQuery);
        if (!existingFishSnapshot.empty) {
          const existingDoc = existingFishSnapshot.docs[0];
          // Store the mapping for future lookups
          await this.storeLocalMapping('fishCaught', localId, existingDoc.id);
          return existingDoc.id;
        }
        return null;
      } catch (error) {
        console.warn('Error checking for existing fish caught:', error);
        return null;
      }
    };

    // Merge trips - check for existing ones first
    for (const trip of localTrips) {
      const { id: localId, ...tripData } = trip;

      // Check if trip already exists in Firestore
      const existingFirebaseId = await getExistingTripFirebaseId(localId);

      if (existingFirebaseId) {
        // Trip already exists, update it
        console.log(`Trip ${localId} already exists in Firestore, updating...`);
        const tripRef = doc(firestore, 'trips', existingFirebaseId);
        const cleanTrip = cleanForFirebase(tripData);
        batch.update(tripRef, { ...cleanTrip, id: localId, userId: this.userId, updatedAt: serverTimestamp() });
        tripIdMap.set(localId, existingFirebaseId);
      } else {
        // Trip doesn't exist, create new one
        console.log(`Trip ${localId} doesn't exist in Firestore, creating...`);
        const newTripRef = doc(collection(firestore, 'trips'));
        const cleanTrip = cleanForFirebase(tripData);
        batch.set(newTripRef, { ...cleanTrip, id: localId, userId: this.userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        tripIdMap.set(localId, newTripRef.id);
      }
    }

    // Create a set of valid trip IDs for validation
    const validTripIds = new Set(localTrips.map(trip => trip.id));

    // Merge weather logs with new trip IDs (only those associated with valid trips)
    const validWeatherLogs = localWeatherLogs.filter(log => {
      if (!log.tripId || !validTripIds.has(log.tripId)) {
        console.log(`Skipping orphaned weather log with tripId: ${log.tripId}`);
        return false;
      }
      return true;
    });

    for (const log of validWeatherLogs) {
      const { id: localId, tripId: localTripId, ...logData } = log;
      // Keep the original local trip ID - don't replace with Firebase document ID
      const originalTripId = localTripId;

      if (originalTripId) {
        // Check if weather log already exists in Firestore
        const existingFirebaseId = await getExistingWeatherLogFirebaseId(localId);

        if (existingFirebaseId) {
          // Weather log already exists, update it
          console.log(`Weather log ${localId} already exists in Firestore, updating...`);
          const logRef = doc(firestore, 'weatherLogs', existingFirebaseId);
          const cleanLog = cleanForFirebase(logData);
          batch.update(logRef, { ...cleanLog, id: localId, tripId: originalTripId, userId: this.userId, updatedAt: serverTimestamp() });
        } else {
          // Weather log doesn't exist, create new one
          console.log(`Weather log ${localId} doesn't exist in Firestore, creating...`);
          const newLogRef = doc(collection(firestore, 'weatherLogs'));
          const cleanLog = cleanForFirebase(logData);
          batch.set(newLogRef, { ...cleanLog, id: localId, tripId: originalTripId, userId: this.userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
      }
    }

    // Merge fish caught with new trip IDs (only those associated with valid trips)
    const validFishCaught = localFishCaught.filter(fish => {
      if (!fish.tripId || !validTripIds.has(fish.tripId)) {
        console.log(`Skipping orphaned fish caught with tripId: ${fish.tripId}`);
        return false;
      }
      return true;
    });

    for (const fish of validFishCaught) {
      const { id: localId, tripId: localTripId, ...fishData } = fish;
      // Keep the original local trip ID - don't replace with Firebase document ID
      const originalTripId = localTripId;

      if (originalTripId) {
        // Check if fish caught already exists in Firestore
        const existingFirebaseId = await getExistingFishCaughtFirebaseId(localId);

        if (existingFirebaseId) {
          // Fish caught already exists, update it
          console.log(`Fish caught ${localId} already exists in Firestore, updating...`);
          const fishRef = doc(firestore, 'fishCaught', existingFirebaseId);
          const cleanFish = cleanForFirebase(fishData);
          batch.update(fishRef, { ...cleanFish, id: localId, tripId: originalTripId, userId: this.userId, updatedAt: serverTimestamp() });
        } else {
          // Fish caught doesn't exist, create new one
          console.log(`Fish caught ${localId} doesn't exist in Firestore, creating...`);
          const newFishRef = doc(collection(firestore, 'fishCaught'));
          const cleanFish = cleanForFirebase(fishData);
          batch.set(newFishRef, { ...cleanFish, id: localId, tripId: originalTripId, userId: this.userId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
      }
    }

    console.log(`Merging ${localTrips.length} trips, ${validWeatherLogs.length} valid weather logs, and ${validFishCaught.length} valid fish caught.`);

    // Clean up orphaned data from local storage
    const orphanedWeatherLogs = localWeatherLogs.length - validWeatherLogs.length;
    const orphanedFishCaught = localFishCaught.length - validFishCaught.length;

    if (orphanedWeatherLogs > 0 || orphanedFishCaught > 0) {
      console.log(`Cleaning up ${orphanedWeatherLogs} orphaned weather logs and ${orphanedFishCaught} orphaned fish caught records from local storage.`);

      // Remove orphaned weather logs
      for (const log of localWeatherLogs) {
        if (!log.tripId || !validTripIds.has(log.tripId)) {
          await databaseService.deleteWeatherLog(log.id);
        }
      }

      // Remove orphaned fish caught
      for (const fish of localFishCaught) {
        if (!fish.tripId || !validTripIds.has(fish.tripId)) {
          await databaseService.deleteFishCaught(fish.id);
        }
      }
    }

    try {
      await batch.commit();
      console.log("Successfully merged local data to Firestore.");

      // Clean up any existing orphaned data in Firestore
      await this.cleanupOrphanedFirestoreData();

      // Keep local data visible for better UX - don't clear after merge
      // await databaseService.clearAllData();
      console.log("Local data backed up successfully - keeping visible for continuity");
    } catch (error) {
      console.error("Failed to merge local data to Firestore:", error);
      // Not clearing local data if merge fails, so we can retry later.
    }
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
    console.log('Local data cleared, Firestore data preserved');
  }

  /**
   * Download user's Firebase data to local storage before logout
   * This ensures data persistence and continuity in guest mode
   */
  async backupLocalDataBeforeLogout(): Promise<void> {
    if (this.isGuest) {
      console.log("Service is in guest mode, skipping data download");
      return;
    }

    if (!this.userId) {
      console.log("No user ID available, skipping data download");
      return;
    }

    console.log("Downloading Firebase data to local storage before logout...");

    try {
      // Only download if we're online and can access Firebase
      if (!this.isOnline) {
        console.log("Offline - cannot download Firebase data, keeping any existing local data");
        return;
      }

      // Download all user data from Firebase
      console.log('Fetching trips from Firebase...');
      const firebaseTrips = await this.getAllTrips();
      console.log('Fetching weather logs from Firebase...');
      const firebaseWeatherLogs = await this.getAllWeatherLogs();
      console.log('Fetching fish caught from Firebase...');
      const firebaseFishCaught = await this.getAllFishCaught();

      console.log(`Found ${firebaseTrips.length} trips, ${firebaseWeatherLogs.length} weather logs, and ${firebaseFishCaught.length} fish caught in Firebase`);

      if (firebaseTrips.length === 0 && firebaseWeatherLogs.length === 0 && firebaseFishCaught.length === 0) {
        console.log('No data found in Firebase - user may not have any data yet');
        return;
      }

      console.log(`Downloading ${firebaseTrips.length} trips, ${firebaseWeatherLogs.length} weather logs, and ${firebaseFishCaught.length} fish caught to local storage`);

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
        await databaseService.updateFishCaught(fishCaught);
      }

      console.log("Successfully downloaded Firebase data to local storage for guest mode access");

    } catch (error) {
      console.error("Failed to download Firebase data to local storage:", error);
      // Don't throw error - we don't want to prevent logout, but log the issue
      console.warn("Logout will continue, but Firebase data may not be available in guest mode");
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
        console.log(`Safety sync: Found ${totalLocalItems} local items to sync`);
        await this.mergeLocalDataForUser();
        console.log('Safety sync completed successfully');
      }
    } catch (error) {
      console.warn('Safety sync failed:', error);
      // Don't throw - this is a background safety operation
    }
  }

  // OFFLINE QUEUE MANAGEMENT

  private queueOperation(operation: string, collection: string, data: any): number {
    const queuedOperation = {
      id: Date.now(),
      operation,
      collection,
      data,
      timestamp: new Date().toISOString()
    };

    this.syncQueue.push(queuedOperation);
    this.saveSyncQueue();

    console.log('Operation queued for sync:', queuedOperation);

    // Return a temporary local ID
    return queuedOperation.id;
  }


  private saveSyncQueue(): void {
    if (this.userId) {
      localStorage.setItem(`syncQueue_${this.userId}`, JSON.stringify(this.syncQueue));
    }
  }

  private loadSyncQueue(): void {
    if (this.userId) {
      const queue = localStorage.getItem(`syncQueue_${this.userId}`);
      if (queue) {
        this.syncQueue = JSON.parse(queue);
      }
    }
  }

  // ID MAPPING UTILITIES

  private async storeLocalMapping(collection: string, localId: string, firebaseId: string): Promise<void> {
    const key = `idMapping_${this.userId}_${collection}_${localId}`;
    localStorage.setItem(key, firebaseId);
    console.log(`[ID Mapping] Stored mapping: ${key} -> ${firebaseId}`);
  }

  private async getFirebaseId(collection: string, localId: string): Promise<string | null> {
    const key = `idMapping_${this.userId}_${collection}_${localId}`;
    const firebaseId = localStorage.getItem(key);
    console.log(`[ID Mapping] Looking up: ${key} -> ${firebaseId || 'NOT FOUND'}`);
    console.log(`[ID Mapping] User ID: ${this.userId}, Collection: ${collection}, Local ID: ${localId}`);

    if (!firebaseId) {
      console.log(`[ID Mapping] No mapping found for ${collection} ID ${localId}`);
      console.log(`[ID Mapping] Available mappings for ${collection}:`);
      // Debug: show all available mappings for this collection
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.includes(`idMapping_${this.userId}_${collection}_`)) {
          const mappingValue = localStorage.getItem(storageKey);
          console.log(`[ID Mapping]   ${storageKey} -> ${mappingValue}`);
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

  private convertFromFirestore(data: any, localId: number | string, firebaseDocId?: string): any {
    const { userId, createdAt, updatedAt, ...cleanData } = data;
    return {
      ...cleanData,
      id: localId,
      firebaseDocId: firebaseDocId, // Include the Firestore document ID for deletion
      createdAt: createdAt?.toDate?.()?.toISOString() || createdAt,
      updatedAt: updatedAt?.toDate?.()?.toISOString() || updatedAt
    };
  }


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
      console.error('Error fetching tackle items:', error);
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
      const itemData = {
        ...sanitizedItem,
        userId: this.userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(firestore, 'tackleItems'), itemData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating tackle item:', error);
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
      const itemRef = doc(firestore, 'tackleItems', id);
      await updateDoc(itemRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating tackle item:', error);
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
      console.error('Error deleting tackle item:', error);
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
      console.error('Error fetching gear types:', error);
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
      console.error('Error creating gear type:', error);
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
      console.error('Error updating gear type:', error);
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
      console.error('Error deleting gear type:', error);
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
      console.log('Starting data migration...');

      // Migrate trips
      const localTrips = await this.getLocalTrips();
      if (localTrips.length > 0) {
        console.log(`Migrating ${localTrips.length} trips...`);
        for (const trip of localTrips) {
          try {
            await this.createTrip(trip);
            results.tripsMigrated++;
          } catch (error) {
            console.error('Failed to migrate trip:', trip.id, error);
          }
        }
      }

      // Migrate weather logs
      const localWeather = await this.getLocalWeatherLogs();
      if (localWeather.length > 0) {
        console.log(`Migrating ${localWeather.length} weather logs...`);
        for (const weather of localWeather) {
          try {
            await this.createWeatherLog(weather);
            results.weatherLogsMigrated++;
          } catch (error) {
            console.error('Failed to migrate weather log:', weather.id, error);
          }
        }
      }

      // Migrate fish catches
      const localFish = await this.getLocalFishCatches();
      if (localFish.length > 0) {
        console.log(`Migrating ${localFish.length} fish catches...`);
        for (const fish of localFish) {
          try {
            await this.createFishCaught(fish);
            results.fishCatchesMigrated++;
          } catch (error) {
            console.error('Failed to migrate fish catch:', fish.id, error);
          }
        }
      }

      // Migrate tackle box
      const localTackle = await this.getLocalTackleItems();
      if (localTackle.length > 0) {
        console.log(`Migrating ${localTackle.length} tackle items...`);
        for (const item of localTackle) {
          try {
            await this.createTackleItem(item);
            results.tackleItemsMigrated++;
          } catch (error) {
            console.error('Failed to migrate tackle item:', item.id, error);
          }
        }
      }

      // Mark migration as complete
      await this.markMigrationComplete();

      console.log('Data migration completed:', results);
      return results;
    } catch (error) {
      console.error('Data migration failed:', error);
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
    this.saveSyncQueue();
    // Removed console.log to reduce debug messages
  }

  /**
   * Debug method to inspect ID mappings in localStorage
   */
  debugIdMappings(): void {
    if (!this.userId) {
      console.log('[ID Mapping Debug] No user ID set');
      return;
    }

    console.log('[ID Mapping Debug] Current ID mappings for user:', this.userId);
    const collections = ['trips', 'weatherLogs', 'fishCaught'];

    collections.forEach(collection => {
      console.log(`\n[ID Mapping Debug] ${collection.toUpperCase()} mappings:`);
      // Look for all keys that match the pattern
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(`idMapping_${this.userId}_${collection}_`)) {
          const firebaseId = localStorage.getItem(key);
          const localId = key.split('_').pop();
          console.log(`  ${localId} -> ${firebaseId}`);
        }
      }
    });
  }

  // PRIVATE MIGRATION HELPERS

  private async getLocalTrips(): Promise<any[]> {
    try {
      return await databaseService.getAllTrips();
    } catch (error) {
      console.error('Failed to get local trips:', error);
      return [];
    }
  }

  private async getLocalWeatherLogs(): Promise<any[]> {
    try {
      return await databaseService.getAllWeatherLogs();
    } catch (error) {
      console.error('Failed to get local weather logs:', error);
      return [];
    }
  }

  private async getLocalFishCatches(): Promise<any[]> {
    try {
      return await databaseService.getAllFishCaught();
    } catch (error) {
      console.error('Failed to get local fish catches:', error);
      return [];
    }
  }

  private async getLocalTackleItems(): Promise<any[]> {
    try {
      const tackleData = localStorage.getItem('tacklebox');
      return tackleData ? JSON.parse(tackleData) : [];
    } catch (error) {
      console.error('Failed to get local tackle items:', error);
      return [];
    }
  }


  private async markMigrationComplete(): Promise<void> {
    try {
      localStorage.setItem(`migrationComplete_${this.userId}`, 'true');
    } catch (error) {
      console.error('Failed to mark migration complete:', error);
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
    return input.replace(/[<>\"'&]/g, '').trim();
  }

}

// Export a singleton instance
export const firebaseDataService = new FirebaseDataService();