import type { Trip, WeatherLog, FishCaught, DatabaseError } from "../types";
import { DB_CONFIG } from "../types";
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
  limit,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

/**
 * Firebase Data Service - Cloud-first with offline fallback
 * Replaces IndexedDB with Firestore while maintaining offline functionality
 */
export class FirebaseDataService {
  private userId: string | null = null;
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
 }

  /**
   * Initialize the service with user authentication
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    this.isInitialized = true;

    // Load any pending operations from localStorage
    this.loadSyncQueue();

    // Temporarily skip sync processing to prevent UI blocking
    // If coming back online, process the queue
    // if (this.isOnline) {
    //   await this.processSyncQueue();
    // }

    console.log('Firebase Data Service initialized for user:', userId);
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.userId !== null;
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

    console.log('Creating trip with service userId:', this.userId);
    console.log('Auth currentUser UID:', auth.currentUser?.uid);

    const tripWithUser = { ...sanitizedTripData, userId: this.userId };
    console.log('Trip data to save:', tripWithUser);

    if (this.isOnline) {
      try {
        // Generate local ID first
        const tripId = Date.now();

        const docRef = await addDoc(collection(firestore, 'trips'), {
          ...tripWithUser,
          id: tripId, // Store the local ID in Firestore for deletion queries
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

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('trips', id.toString());
        if (firebaseId) {
          const docRef = doc(firestore, 'trips', firebaseId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            return this.convertFromFirestore(data, id);
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
    * Get all trips for a specific date
    */
   async getTripsByDate(date: string): Promise<Trip[]> {
     if (!this.isReady()) throw new Error('Service not initialized');

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
           const localId = this.generateLocalId(doc.id);
           trips.push(this.convertFromFirestore(data, localId));
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

    if (this.isOnline) {
      try {
        const q = query(
          collection(firestore, 'trips'),
          where('userId', '==', this.userId),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const trips: Trip[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const localId = this.generateLocalId(doc.id);
          trips.push(this.convertFromFirestore(data, localId, doc.id));
        });

        return trips;
      } catch (error) {
        console.warn('Firestore query failed, falling back to local:', error);
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
    * Delete a trip and all associated data
    */
   async deleteTrip(id: number, firebaseDocId?: string): Promise<void> {
     if (!this.isReady()) throw new Error('Service not initialized');

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
             where('tripId', '==', id)
           );
           const weatherSnapshot = await getDocs(weatherQuery);
           weatherSnapshot.forEach((doc) => {
             batch.delete(doc.ref);
           });

           // Delete associated fish caught
           const fishQuery = query(
             collection(firestore, 'fishCaught'),
             where('userId', '==', this.userId),
             where('tripId', '==', id)
           );
           const fishSnapshot = await getDocs(fishQuery);
           fishSnapshot.forEach((doc) => {
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
             where('tripId', '==', id)
           );
           const weatherSnapshot = await getDocs(weatherQuery);
           weatherSnapshot.forEach((doc) => {
             batch.delete(doc.ref);
           });

           // Delete associated fish caught
           const fishQuery = query(
             collection(firestore, 'fishCaught'),
             where('userId', '==', this.userId),
             where('tripId', '==', id)
           );
           const fishSnapshot = await getDocs(fishQuery);
           fishSnapshot.forEach((doc) => {
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
               await this.deleteTripDocuments(tripSnapshot.docs.map(doc => doc.ref));
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

  async createWeatherLog(weatherData: Omit<WeatherLog, "id">): Promise<number> {
    if (!this.isReady()) throw new Error('Service not initialized');

    // Data integrity checks
    this.validateWeatherLogData(weatherData);

    const weatherWithUser = { ...weatherData, userId: this.userId };

    if (this.isOnline) {
      try {
        const docRef = await addDoc(collection(firestore, 'weatherLogs'), {
          ...weatherWithUser,
          createdAt: serverTimestamp()
        });

        const weatherId = Date.now();
        await this.storeLocalMapping('weatherLogs', weatherId.toString(), docRef.id);
        return weatherId;
      } catch (error) {
        console.warn('Firestore create failed, falling back to local:', error);
        return this.queueOperation('create', 'weatherLogs', weatherWithUser);
      }
    } else {
      return this.queueOperation('create', 'weatherLogs', weatherWithUser);
    }
  }

  async getWeatherLogById(id: number): Promise<WeatherLog | null> {
    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('weatherLogs', id.toString());
        if (firebaseId) {
          const docRef = doc(firestore, 'weatherLogs', firebaseId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            return this.convertFromFirestore(data, id) as WeatherLog;
          }
        }
      } catch (error) {
        console.warn('Firestore get failed, trying local:', error);
      }
    }

    return databaseService.getWeatherLogById(id);
  }

  async getWeatherLogsByTripId(tripId: number): Promise<WeatherLog[]> {
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
          const localId = this.generateLocalId(doc.id);
          weatherLogs.push(this.convertFromFirestore(data, localId) as WeatherLog);
        });

        return weatherLogs;
      } catch (error) {
        console.warn('Firestore query failed, falling back to local:', error);
      }
    }

    return databaseService.getWeatherLogsByTripId(tripId);
  }

  async getAllWeatherLogs(): Promise<WeatherLog[]> {
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
          const localId = this.generateLocalId(doc.id);
          weatherLogs.push(this.convertFromFirestore(data, localId) as WeatherLog);
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

    const weatherWithUser = { ...weatherLog, userId: this.userId };

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('weatherLogs', weatherLog.id.toString());
        if (firebaseId) {
          const docRef = doc(firestore, 'weatherLogs', firebaseId);
          await updateDoc(docRef, weatherWithUser);
          return;
        }
      } catch (error) {
        console.warn('Firestore update failed, falling back to local:', error);
      }
    }

    await databaseService.updateWeatherLog(weatherLog);
    this.queueOperation('update', 'weatherLogs', weatherWithUser);
  }

  async deleteWeatherLog(id: number): Promise<void> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('weatherLogs', id.toString());
        if (firebaseId) {
          await deleteDoc(doc(firestore, 'weatherLogs', firebaseId));
          return;
        }
      } catch (error) {
        console.warn('Firestore delete failed, falling back to local:', error);
      }
    }

    await databaseService.deleteWeatherLog(id);
    this.queueOperation('delete', 'weatherLogs', { id, userId: this.userId });
  }

  // FISH CAUGHT OPERATIONS

  async createFishCaught(fishData: Omit<FishCaught, "id">): Promise<number> {
    if (!this.isReady()) throw new Error('Service not initialized');

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

    const fishWithUser = { ...sanitizedFishData, userId: this.userId };

    if (this.isOnline) {
      try {
        const docRef = await addDoc(collection(firestore, 'fishCaught'), {
          ...fishWithUser,
          createdAt: serverTimestamp()
        });

        const fishId = Date.now();
        await this.storeLocalMapping('fishCaught', fishId.toString(), docRef.id);
        return fishId;
      } catch (error) {
        console.warn('Firestore create failed, falling back to local:', error);
        return this.queueOperation('create', 'fishCaught', fishWithUser);
      }
    } else {
      return this.queueOperation('create', 'fishCaught', fishWithUser);
    }
  }

  async getFishCaughtById(id: number): Promise<FishCaught | null> {
    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('fishCaught', id.toString());
        if (firebaseId) {
          const docRef = doc(firestore, 'fishCaught', firebaseId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            return this.convertFromFirestore(data, id) as FishCaught;
          }
        }
      } catch (error) {
        console.warn('Firestore get failed, trying local:', error);
      }
    }

    return databaseService.getFishCaughtById(id);
  }

  async getFishCaughtByTripId(tripId: number): Promise<FishCaught[]> {
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
          const localId = this.generateLocalId(doc.id);
          fishCaught.push(this.convertFromFirestore(data, localId) as FishCaught);
        });

        return fishCaught;
      } catch (error) {
        console.warn('Firestore query failed, falling back to local:', error);
      }
    }

    return databaseService.getFishCaughtByTripId(tripId);
  }

  async getAllFishCaught(): Promise<FishCaught[]> {
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
          const localId = this.generateLocalId(doc.id);
          fishCaught.push(this.convertFromFirestore(data, localId) as FishCaught);
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

    const fishWithUser = { ...fishCaught, userId: this.userId };

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('fishCaught', fishCaught.id.toString());
        if (firebaseId) {
          const docRef = doc(firestore, 'fishCaught', firebaseId);
          await updateDoc(docRef, fishWithUser);
          return;
        }
      } catch (error) {
        console.warn('Firestore update failed, falling back to local:', error);
      }
    }

    await databaseService.updateFishCaught(fishCaught);
    this.queueOperation('update', 'fishCaught', fishWithUser);
  }

  async deleteFishCaught(id: number): Promise<void> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('fishCaught', id.toString());
        if (firebaseId) {
          await deleteDoc(doc(firestore, 'fishCaught', firebaseId));
          return;
        }
      } catch (error) {
        console.warn('Firestore delete failed, falling back to local:', error);
      }
    }

    await databaseService.deleteFishCaught(id);
    this.queueOperation('delete', 'fishCaught', { id, userId: this.userId });
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

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;

    console.log('Processing sync queue...', this.syncQueue.length, 'operations');

    let syncedCount = 0;
    for (const operation of this.syncQueue) {
      try {
        await this.executeQueuedOperation(operation);
        // Remove from queue on success
        this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
        syncedCount++;
      } catch (error) {
        console.error('Failed to sync operation:', operation, error);
        // For now, remove failed operations to prevent infinite sync attempts
        console.log('Removing failed operation from queue to prevent blocking');
        this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
      }
    }

    this.saveSyncQueue();

    // Mark sync as complete if we successfully synced operations
    if (syncedCount > 0 && this.userId) {
      localStorage.setItem(`lastSync_${this.userId}`, new Date().toISOString());
    }
  }

  private async executeQueuedOperation(operation: any): Promise<void> {
    const { operation: opType, collection: coll, data } = operation;

    switch (opType) {
      case 'create':
        await addDoc(collection(firestore, coll), {
          ...data,
          createdAt: serverTimestamp()
        });
        break;
      case 'update':
        // Find the document by some identifier
        // This is complex - we'd need to store Firebase IDs
        break;
      case 'delete':
        // Similar complexity for deletes
        break;
    }
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
  }

  private async getFirebaseId(collection: string, localId: string): Promise<string | null> {
    const key = `idMapping_${this.userId}_${collection}_${localId}`;
    return localStorage.getItem(key);
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

  private convertFromFirestore(data: any, localId: number, firebaseDocId?: string): any {
    const { userId, createdAt, updatedAt, ...cleanData } = data;
    return {
      ...cleanData,
      id: localId,
      firebaseDocId, // Include the Firestore document ID for deletion
      createdAt: createdAt?.toDate?.()?.toISOString() || createdAt,
      updatedAt: updatedAt?.toDate?.()?.toISOString() || updatedAt
    };
  }

  /**
   * Create a standardized database error
   */
  private createDatabaseError(
    type: DatabaseError["type"],
    message: string,
  ): DatabaseError {
    return {
      type,
      message,
      recoverable: type !== "connection",
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
    console.log('Sync queue cleared');
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

    if (weatherData.waterTemp !== undefined && typeof weatherData.waterTemp !== 'number') {
      throw new Error('Water temperature must be a number');
    }

    if (weatherData.airTemp !== undefined && typeof weatherData.airTemp !== 'number') {
      throw new Error('Air temperature must be a number');
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

  /**
   * Delete trip documents and associated data
   */
  private async deleteTripDocuments(tripRefs: any[]): Promise<void> {
    const batch = writeBatch(firestore);

    // Delete trip documents
    tripRefs.forEach(ref => batch.delete(ref));

    // Note: We can't efficiently delete associated weather/fish data without knowing the trip IDs
    // This would require additional queries. For now, just delete the trips.

    await batch.commit();
    console.log(`Deleted ${tripRefs.length} trip document(s) from Firestore`);
  }

  /**
   * Resync trips from local storage to Firestore (nuclear option)
   */
  private async resyncTripsFromLocalStorage(): Promise<void> {
    console.log('Starting data resync from local storage...');

    // Get all local trips
    const localTrips = await databaseService.getAllTrips();
    console.log(`Found ${localTrips.length} trips in local storage`);

    if (localTrips.length === 0) {
      console.log('No local trips to resync');
      return;
    }

    // Clear existing Firestore data for this user
    console.log('Clearing existing Firestore data...');
    await this.clearUserFirestoreData();

    // Recreate all trips in Firestore
    console.log('Recreating trips in Firestore...');
    for (const trip of localTrips) {
      try {
        const tripData = { ...trip, userId: this.userId };
        const docRef = await addDoc(collection(firestore, 'trips'), {
          ...tripData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Store the mapping
        await this.storeLocalMapping('trips', trip.id.toString(), docRef.id);
        console.log(`Resynced trip ${trip.id}`);
      } catch (error) {
        console.error(`Failed to resync trip ${trip.id}:`, error);
      }
    }

    console.log('Data resync completed');
  }

  /**
   * Clear all user data from Firestore (dangerous operation)
   */
  private async clearUserFirestoreData(): Promise<void> {
    console.log('Clearing user data from Firestore...');

    // Delete all trips
    const tripsQuery = query(
      collection(firestore, 'trips'),
      where('userId', '==', this.userId)
    );
    const tripsSnapshot = await getDocs(tripsQuery);
    const batch = writeBatch(firestore);

    tripsSnapshot.forEach(doc => batch.delete(doc.ref));

    // Note: In a real implementation, you'd also delete weather logs and fish catches
    // But for this emergency resync, we'll focus on trips

    await batch.commit();
    console.log(`Cleared ${tripsSnapshot.size} trip documents from Firestore`);
  }
}

// Export a singleton instance
export const firebaseDataService = new FirebaseDataService();