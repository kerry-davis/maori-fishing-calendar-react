import type { Trip, WeatherLog, FishCaught, DatabaseError } from "../types";
import { DB_CONFIG } from "../types";
import { DEV_LOG, DEV_ERROR, PROD_ERROR, PROD_WARN } from "../utils/loggingHelpers";
import { generateULID } from "../utils/ulid";

/**
 * IndexedDB Service for the Māori Fishing Calendar
 * Maintains compatibility with existing vanilla JS schema
 */
export class DatabaseService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      let triedRecovery = false;
      const openDb = () => {
        const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          DEV_LOG("Upgrading database schema...");
          // ...existing code...
          // Trips store (no changes needed)
          if (!db.objectStoreNames.contains(DB_CONFIG.STORES.TRIPS)) {
            const tripsStore = db.createObjectStore(DB_CONFIG.STORES.TRIPS, {
              keyPath: "id",
              autoIncrement: true,
            });
            tripsStore.createIndex("date", "date", { unique: false });
            DEV_LOG(`'${DB_CONFIG.STORES.TRIPS}' object store created.`);
          }
          // ...existing code...
          // Non-destructive migration for weather_logs
          if (db.objectStoreNames.contains(DB_CONFIG.STORES.WEATHER_LOGS)) {
              const store = transaction.objectStore(DB_CONFIG.STORES.WEATHER_LOGS);
              if (store.autoIncrement) {
                  DEV_LOG('Migrating weather_logs store...');
                  const data: WeatherLog[] = [];
                  store.openCursor().onsuccess = (e) => {
                      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
                      if (cursor) {
                          data.push(cursor.value);
                          cursor.continue();
                      } else {
                          db.deleteObjectStore(DB_CONFIG.STORES.WEATHER_LOGS);
                          const newStore = db.createObjectStore(DB_CONFIG.STORES.WEATHER_LOGS, { keyPath: 'id' });
                          newStore.createIndex('tripId', 'tripId', { unique: false });
                          data.forEach((item: WeatherLog) => {
                              const newItem = { ...item, id: `${item.tripId}-${generateULID()}` };
                              newStore.add(newItem);
                          });
                          DEV_LOG('weather_logs store migration complete.');
                      }
                  };
              }
          } else {
              const newStore = db.createObjectStore(DB_CONFIG.STORES.WEATHER_LOGS, { keyPath: 'id' });
              newStore.createIndex('tripId', 'tripId', { unique: false });
              DEV_LOG(`'${DB_CONFIG.STORES.WEATHER_LOGS}' object store created.`);
          }
          // ...existing code...
          // Non-destructive migration for fish_caught
          if (db.objectStoreNames.contains(DB_CONFIG.STORES.FISH_CAUGHT)) {
              const store = transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT);
              if (store.autoIncrement) {
                  DEV_LOG('Migrating fish_caught store...');
                  const data: FishCaught[] = [];
                  store.openCursor().onsuccess = (e) => {
                      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
                      if (cursor) {
                          data.push(cursor.value);
                          cursor.continue();
                      } else {
                          db.deleteObjectStore(DB_CONFIG.STORES.FISH_CAUGHT);
                          const newStore = db.createObjectStore(DB_CONFIG.STORES.FISH_CAUGHT, { keyPath: 'id' });
                          newStore.createIndex('tripId', 'tripId', { unique: false });
                          data.forEach((item: FishCaught) => {
                              const newItem = { ...item, id: `${item.tripId}-${generateULID()}` };
                              newStore.add(newItem);
                          });
                          DEV_LOG('fish_caught store migration complete.');
                      }
                  };
              }
          } else {
              const newStore = db.createObjectStore(DB_CONFIG.STORES.FISH_CAUGHT, { keyPath: 'id' });
              newStore.createIndex('tripId', 'tripId', { unique: false });
              DEV_LOG(`'${DB_CONFIG.STORES.FISH_CAUGHT}' object store created.`);
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          this.isInitialized = true;
          DEV_LOG("Database initialized successfully.");
          resolve();
        };

        request.onerror = (event) => {
          const error = (event.target as IDBOpenDBRequest).error;
          PROD_ERROR("Database initialization error:", error);
          // If error is a version error, attempt recovery
          if (!triedRecovery && error?.name === "VersionError") {
            triedRecovery = true;
            PROD_WARN("IndexedDB version mismatch detected. Attempting recovery by deleting database...");
            const deleteRequest = indexedDB.deleteDatabase(DB_CONFIG.NAME);
            deleteRequest.onsuccess = () => {
              DEV_LOG("Database deleted successfully. Retrying initialization...");
              openDb();
            };
            deleteRequest.onerror = (e) => {
              PROD_ERROR("Failed to delete database during recovery:", (e.target as IDBOpenDBRequest).error);
              reject(
                this.createDatabaseError(
                  "connection",
                  `Failed to delete database during recovery: ${(e.target as IDBOpenDBRequest).error?.message}`,
                ),
              );
            };
          } else {
            reject(
              this.createDatabaseError(
                "connection",
                `Failed to initialize database: ${error?.message}`,
              ),
            );
          }
        };
      };
      openDb();
    });

    return this.initPromise;
  }

  /**
   * Get the database instance
   */
  getDatabase(): IDBDatabase {
    if (!this.db) {
      throw this.createDatabaseError(
        "connection",
        "Database not initialized. Call initialize() first.",
      );
    }
    return this.db;
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  // TRIP OPERATIONS

  /**
   * Create a new trip
   */
  async createTrip(tripData: Omit<Trip, "id">): Promise<number> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.TRIPS],
        "readwrite",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.TRIPS);
      const request = store.add(tripData);

      request.onsuccess = () => {
        const id = request.result as number;
        DEV_LOG("Trip created successfully with ID:", id);
        resolve(id);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to create trip: ${request.error?.message}`,
        );
        DEV_ERROR("Error creating trip:", error);
        reject(error);
      };

      transaction.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Transaction failed: ${transaction.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get a trip by ID
   */
  async getTripById(id: number): Promise<Trip | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.TRIPS],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.TRIPS);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve((request.result as Trip) || null);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get trip: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get all trips for a specific date
   */
  async getTripsByDate(date: string): Promise<Trip[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.TRIPS],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.TRIPS);
      const index = store.index("date");
      const request = index.getAll(date);

      request.onsuccess = () => {
        resolve((request.result as Trip[]) || []);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get trips by date: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get all trips
   */
  async getAllTrips(): Promise<Trip[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.TRIPS],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.TRIPS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result as Trip[]) || []);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get all trips: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Update a trip
   */
  async updateTrip(trip: Trip): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.TRIPS],
        "readwrite",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.TRIPS);
      const request = store.put(trip);

      request.onsuccess = () => {
        DEV_LOG("Trip updated successfully:", trip.id);
        resolve();
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to update trip: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Delete a trip and all associated data
   */
  async deleteTrip(id: number, _firebaseDocId?: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [
          DB_CONFIG.STORES.TRIPS,
          DB_CONFIG.STORES.WEATHER_LOGS,
          DB_CONFIG.STORES.FISH_CAUGHT,
        ],
        "readwrite",
      );

      transaction.oncomplete = () => {
        DEV_LOG("Trip and all associated data deleted successfully.");
        resolve();
      };

      transaction.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to delete trip: ${transaction.error!.message}`,
        );
        reject(error);
      };

      // Delete associated weather logs
      const weatherStore = transaction.objectStore(
        DB_CONFIG.STORES.WEATHER_LOGS,
      );
      const weatherIndex = weatherStore.index("tripId");
      const weatherRequest = weatherIndex.openCursor(IDBKeyRange.only(id));

      weatherRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete associated fish caught
      const fishStore = transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT);
      const fishIndex = fishStore.index("tripId");
      const fishRequest = fishIndex.openCursor(IDBKeyRange.only(id));

      fishRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Delete the trip itself
      const tripsStore = transaction.objectStore(DB_CONFIG.STORES.TRIPS);
      tripsStore.delete(id);
    });
  }

  // WEATHER LOG OPERATIONS

  /**
   * Create a new weather log
   */
  async createWeatherLog(weatherData: Omit<WeatherLog, "id">): Promise<string> {
    await this.initialize();

    const newId = `${weatherData.tripId}-${generateULID()}`;
    const weatherLogWithId: WeatherLog = { ...weatherData, id: newId };

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.WEATHER_LOGS],
        "readwrite",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.WEATHER_LOGS);
      const request = store.add(weatherLogWithId);

      request.onsuccess = () => {
        DEV_LOG("Weather log created successfully with ID:", newId);
        resolve(newId);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to create weather log: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get weather log by ID
   */
  async getWeatherLogById(id: string): Promise<WeatherLog | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.WEATHER_LOGS],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.WEATHER_LOGS);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get weather log: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get all weather logs for a trip
   */
  async getWeatherLogsByTripId(tripId: number): Promise<WeatherLog[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.WEATHER_LOGS],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.WEATHER_LOGS);
      const index = store.index("tripId");
      const request = index.getAll(tripId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get weather logs by trip ID: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get all weather logs
   */
  async getAllWeatherLogs(): Promise<WeatherLog[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.WEATHER_LOGS],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.WEATHER_LOGS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get all weather logs: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Update a weather log
   */
  async updateWeatherLog(weatherLog: WeatherLog): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.WEATHER_LOGS],
        "readwrite",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.WEATHER_LOGS);
      const request = store.put(weatherLog);

      request.onsuccess = () => {
        DEV_LOG("Weather log updated successfully:", weatherLog.id);
        resolve();
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to update weather log: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Delete a weather log
   */
  async deleteWeatherLog(id: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.WEATHER_LOGS],
        "readwrite",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.WEATHER_LOGS);
      const request = store.delete(id);

      request.onsuccess = () => {
        DEV_LOG("Weather log deleted successfully:", id);
        resolve();
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to delete weather log: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  // FISH CAUGHT OPERATIONS

  /**
   * Create a new fish caught record
   */
  async createFishCaught(fishData: Omit<FishCaught, "id">): Promise<string> {
    await this.initialize();

    const newId = `${fishData.tripId}-${generateULID()}`;
    const fishCaughtWithId: FishCaught = { ...fishData, id: newId };

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.FISH_CAUGHT],
        "readwrite",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT);
      const request = store.add(fishCaughtWithId);

      request.onsuccess = () => {
        DEV_LOG("Fish caught record created successfully with ID:", newId);
        resolve(newId);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to create fish caught record: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get fish caught record by ID
   */
  async getFishCaughtById(id: string): Promise<FishCaught | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.FISH_CAUGHT],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get fish caught record: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get all fish caught records for a trip
   */
  async getFishCaughtByTripId(tripId: number): Promise<FishCaught[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.FISH_CAUGHT],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT);
      const index = store.index("tripId");
      const request = index.getAll(tripId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get fish caught records by trip ID: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Get all fish caught records
   */
  async getAllFishCaught(): Promise<FishCaught[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.FISH_CAUGHT],
        "readonly",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to get all fish caught records: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Update a fish caught record
   */
  async updateFishCaught(fishCaught: FishCaught): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.FISH_CAUGHT],
        "readwrite",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT);
      const request = store.put(fishCaught);

      request.onsuccess = () => {
        DEV_LOG("Fish caught record updated successfully:", fishCaught.id);
        resolve();
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to update fish caught record: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  /**
   * Delete a fish caught record
   */
  async deleteFishCaught(id: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [DB_CONFIG.STORES.FISH_CAUGHT],
        "readwrite",
      );
      const store = transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT);
      const request = store.delete(id);

      request.onsuccess = () => {
        DEV_LOG("Fish caught record deleted successfully:", id);
        resolve();
      };

      request.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to delete fish caught record: ${request.error?.message}`,
        );
        reject(error);
      };
    });
  }

  // UTILITY METHODS

  /**
   * Get fish count for a specific trip
   */
  async getFishCountForTrip(tripId: number): Promise<number> {
    const fishRecords = await this.getFishCaughtByTripId(tripId);
    return fishRecords.length;
  }

  /**
   * Check if a date has any trips
   */
  async hasTripsOnDate(date: string): Promise<boolean> {
    const trips = await this.getTripsByDate(date);
    return trips.length > 0;
  }

  /**
   * Get all dates that have trips (for calendar highlighting)
   */
  async getDatesWithTrips(): Promise<string[]> {
    const trips = await this.getAllTrips();
    const dates = new Set(trips.map((trip) => trip.date));
    return Array.from(dates);
  }

  /**
   * Clear all data (for testing or reset purposes)
   */
  async clearAllData(): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.getDatabase().transaction(
        [
          DB_CONFIG.STORES.TRIPS,
          DB_CONFIG.STORES.WEATHER_LOGS,
          DB_CONFIG.STORES.FISH_CAUGHT,
        ],
        "readwrite",
      );

      transaction.oncomplete = () => {
        DEV_LOG("All data cleared successfully.");
        resolve();
      };

      transaction.onerror = () => {
        const error = this.createDatabaseError(
          "transaction",
          `Failed to clear data: ${transaction.error?.message}`,
        );
        reject(error);
      };

      // Clear all stores
      transaction.objectStore(DB_CONFIG.STORES.TRIPS).clear();
      transaction.objectStore(DB_CONFIG.STORES.WEATHER_LOGS).clear();
      transaction.objectStore(DB_CONFIG.STORES.FISH_CAUGHT).clear();
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      this.initPromise = null;
      DEV_LOG("Database connection closed.");
    }
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
export const databaseService = new DatabaseService();
