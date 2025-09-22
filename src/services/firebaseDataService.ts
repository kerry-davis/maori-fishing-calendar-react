import type { Trip, WeatherLog, FishCaught, DatabaseError } from "../types";
import { DB_CONFIG } from "../types";
import { firestore } from "./firebase";
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
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Initialize the service with user authentication
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    this.isInitialized = true;

    // Load any pending operations from localStorage
    this.loadSyncQueue();

    // If coming back online, process the queue
    if (this.isOnline) {
      await this.processSyncQueue();
    }

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

    const tripWithUser = { ...tripData, userId: this.userId };

    if (this.isOnline) {
      try {
        const docRef = await addDoc(collection(firestore, 'trips'), {
          ...tripWithUser,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Store the Firebase ID as a string, but return a number for compatibility
        const tripId = Date.now(); // Use timestamp as local ID
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

    if (this.isOnline) {
      try {
        const q = query(
          collection(firestore, 'trips'),
          where('userId', '==', this.userId),
          where('date', '==', date)
        );

        const querySnapshot = await getDocs(q);
        const trips: Trip[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const localId = this.generateLocalId(doc.id);
          trips.push(this.convertFromFirestore(data, localId));
        });

        return trips;
      } catch (error) {
        console.warn('Firestore query failed, falling back to local:', error);
      }
    }

    // Fallback to local storage
    return databaseService.getTripsByDate(date);
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
          trips.push(this.convertFromFirestore(data, localId));
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
  async deleteTrip(id: number): Promise<void> {
    if (!this.isReady()) throw new Error('Service not initialized');

    if (this.isOnline) {
      try {
        const firebaseId = await this.getFirebaseId('trips', id.toString());
        if (firebaseId) {
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
        }
      } catch (error) {
        console.warn('Firestore delete failed, falling back to local:', error);
      }
    }

    // Fallback to local storage
    await databaseService.deleteTrip(id);
    this.queueOperation('delete', 'trips', { id, userId: this.userId });
  }

  // WEATHER LOG OPERATIONS

  async createWeatherLog(weatherData: Omit<WeatherLog, "id">): Promise<number> {
    if (!this.isReady()) throw new Error('Service not initialized');

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

    const fishWithUser = { ...fishData, userId: this.userId };

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

    for (const operation of this.syncQueue) {
      try {
        await this.executeQueuedOperation(operation);
        // Remove from queue on success
        this.syncQueue = this.syncQueue.filter(op => op.id !== operation.id);
      } catch (error) {
        console.error('Failed to sync operation:', operation, error);
        // Keep in queue for retry
      }
    }

    this.saveSyncQueue();
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

  private convertFromFirestore(data: any, localId: number): any {
    const { userId, createdAt, updatedAt, ...cleanData } = data;
    return {
      ...cleanData,
      id: localId,
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
}

// Export a singleton instance
export const firebaseDataService = new FirebaseDataService();