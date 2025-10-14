import type { Trip, WeatherLog, FishCaught } from '../types';
import { getOrCreateGuestSessionId } from './guestSessionService';
import { saveToLocalStorage, getLocalStorageUsage } from '../utils/storageQuotaUtils';
import { encryptGuestDataFields, decryptGuestDataFields } from '../utils/guestEncryptionUtils';

const GUEST_DATA_KEY = 'guestDataRetention';
const DATABASE_NAME = 'GuestDataDB';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'guestSessions';
const MAX_GUEST_SESSIONS = 10; // Limit to prevent storage bloat

export interface GuestData {
  trips: Trip[];
  weatherLogs: WeatherLog[];
  fishCaught: FishCaught[];
  lastModified: number;
}

export interface GuestStorageState {
  activeSessionId: string | null;
  sessions: Record<string, GuestData>;
  sessionOrder: string[]; // Track order of sessions for cleanup
}

class GuestDataRetentionService {
  private storageKey = GUEST_DATA_KEY;
  private dbName = DATABASE_NAME;
  private dbVersion = DATABASE_VERSION;
  private storeName = OBJECT_STORE_NAME;
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<void> | null = null;
  private isStorageAvailableCache: boolean | null = null;

  /**
   * Initialize IndexedDB for guest data storage
   */
  private async initializeDatabase(): Promise<void> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('[guestDataRetention] IndexedDB unavailable, falling back to localStorage');
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.warn('[guestDataRetention] Failed to open IndexedDB, falling back to localStorage:', event);
        // Use reject to indicate the initialization failed
        reject(request.error || new Error('IndexedDB initialization failed'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log('[guestDataRetention] IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // Create object store with sessionId as keyPath
          const store = db.createObjectStore(this.storeName, { keyPath: 'sessionId' });
          // Create an index for efficient lookups by lastModified date
          store.createIndex('lastModified', 'lastModified', { unique: false });
          console.log('[guestDataRetention] Created object store with index:', this.storeName);
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Check if browser storage (localStorage or IndexedDB) is available
   */
  private isStorageAvailable(): boolean {
    if (this.isStorageAvailableCache !== null) {
      return this.isStorageAvailableCache;
    }

    try {
      if (typeof window === 'undefined' || (!window.localStorage && !window.indexedDB)) {
        this.isStorageAvailableCache = false;
        return false;
      }

      // Test if we can write to localStorage (fallback)
      if (window.localStorage) {
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
      }

      this.isStorageAvailableCache = true;
      return true;
    } catch (error) {
      console.warn('[guestDataRetention] Storage unavailable:', error);
      this.isStorageAvailableCache = false;
      return false;
    }
  }

  /**
   * Attempt to save to IndexedDB, fallback to localStorage
   */
  private async saveToStorage(state: GuestStorageState): Promise<boolean> {
    try {
      // Try IndexedDB first - save individual sessions for better performance
      if (this.db) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        // Clear existing data first
        await new Promise<void>((resolve, reject) => {
          const clearRequest = store.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => reject(clearRequest.error);
        });

        // Batch put all sessions
        const promises = [];
        for (const sessionId in state.sessions) {
          const sessionData = {
            sessionId,
            ...state.sessions[sessionId],
            sessionOrder: state.sessionOrder,
            activeSessionId: state.activeSessionId
          };
          
          promises.push(new Promise<void>((resolve, reject) => {
            const putRequest = store.put(sessionData);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          }));
        }

        // Wait for all operations to complete
        await Promise.all(promises);

        console.log('[guestDataRetention] Data saved to IndexedDB');
        return true;
      }
    } catch (error) {
      console.warn('[guestDataRetention] IndexedDB save failed, falling back to localStorage:', error);
    }

    // Fallback to localStorage with quota check
    try {
      if (window.localStorage) {
        const saveResult = saveToLocalStorage(this.storageKey, state);
        if (saveResult.success) {
          console.log('[guestDataRetention] Data saved to localStorage');
          return true;
        } else {
          console.warn('[guestDataRetention] localStorage quota exceeded or save failed:', saveResult.message);
          // Dispatch custom event for UI to handle quota exceeded situation
          window.dispatchEvent(new CustomEvent('localStorageQuotaExceeded', {
            detail: { message: saveResult.message, usage: getLocalStorageUsage() }
          }));
          return false;
        }
      }
    } catch (error) {
      console.warn('[guestDataRetention] localStorage save failed:', error);
    }

    return false;
  }

  /**
   * Attempt to read from IndexedDB, fallback to localStorage
   */
  private async readFromStorage(): Promise<GuestStorageState> {
    // Try IndexedDB first
    try {
      if (this.db) {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);

        // Get all entries
        const allSessions = await new Promise<any[]>((resolve, reject) => {
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => resolve(getAllRequest.result);
          getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        if (allSessions && allSessions.length > 0) {
          const state: GuestStorageState = {
            activeSessionId: null,
            sessions: {},
            sessionOrder: []
          };

          // Reconstruct the state from individual sessions
          for (const session of allSessions) {
            // Extract the actual session data (excluding metadata)
            state.sessions[session.sessionId] = {
              trips: session.trips || [],
              weatherLogs: session.weatherLogs || [],
              fishCaught: session.fishCaught || [],
              lastModified: session.lastModified || 0
            };
            
            // Use the last entry's metadata (they should all be consistent)
            if (session.activeSessionId !== undefined) {
              state.activeSessionId = session.activeSessionId;
            }
            if (session.sessionOrder && Array.isArray(session.sessionOrder)) {
              state.sessionOrder = session.sessionOrder;
            }
          }

          console.log('[guestDataRetention] Data loaded from IndexedDB');
          return state;
        }
      }
    } catch (error) {
      console.warn('[guestDataRetention] IndexedDB read failed, falling back to localStorage:', error);
    }

    // Fallback to localStorage
    try {
      if (window.localStorage) {
        const raw = window.localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as GuestStorageState;
          if (parsed && typeof parsed === 'object') {
            console.log('[guestDataRetention] Data loaded from localStorage');
            return {
              activeSessionId: parsed.activeSessionId ?? null,
              sessions: parsed.sessions ?? {},
              sessionOrder: Array.isArray(parsed.sessionOrder) ? parsed.sessionOrder : [],
            };
          }
        }
      }
    } catch (error) {
      console.warn('[guestDataRetention] localStorage read failed:', error);
    }

    return { activeSessionId: null, sessions: {}, sessionOrder: [] };
  }

  /**
   * Limit the number of stored sessions to prevent storage bloat
   */
  private limitSessions(state: GuestStorageState): GuestStorageState {
    if (state.sessionOrder.length <= MAX_GUEST_SESSIONS) {
      return state;
    }

    const sessionsToRemove = state.sessionOrder.slice(0, state.sessionOrder.length - MAX_GUEST_SESSIONS);
    
    sessionsToRemove.forEach(sessionId => {
      delete state.sessions[sessionId];
    });
    
    state.sessionOrder = state.sessionOrder.slice(state.sessionOrder.length - MAX_GUEST_SESSIONS);
    return state;
  }

  /**
   * Save guest data for a specific session
   */
  async saveGuestData(sessionId: string, data: GuestData): Promise<void> {
    if (!this.isStorageAvailable()) return;

    await this.initializeDatabase();

    const state = await this.readFromStorage();
    
    // Encrypt sensitive data before storing
    const encryptedData = encryptGuestDataFields({
      ...data,
      lastModified: Date.now()
    });
    
    // Update the session data
    state.sessions[sessionId] = encryptedData;
    
    // Update session order (move to the end to mark as most recent)
    state.sessionOrder = state.sessionOrder.filter(id => id !== sessionId);
    state.sessionOrder.push(sessionId);
    
    // Set this as the active session
    state.activeSessionId = sessionId;
    
    // Apply limits and save
    const limitedState = this.limitSessions(state);
    await this.saveToStorage(limitedState);
  }

  /**
   * Load guest data for a specific session
   */
  async getGuestData(sessionId: string): Promise<GuestData | null> {
    if (!this.isStorageAvailable()) return null;

    await this.initializeDatabase();

    const state = await this.readFromStorage();
    const sessionData = state.sessions[sessionId];
    
    if (!sessionData) {
      return null;
    }
    
    // Check if the data is still valid (not expired)
    // For now, we'll consider data valid for 30 days
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    
    if (now - sessionData.lastModified > thirtyDaysInMs) {
      // Data is too old, remove it
      await this.removeGuestSession(sessionId);
      return null;
    }
    
    // Decrypt sensitive data before returning
    return decryptGuestDataFields(sessionData);
  }

  /**
   * Get all guest sessions
   */
  async getAllGuestSessions(): Promise<GuestStorageState> {
    if (!this.isStorageAvailable()) {
      return { activeSessionId: null, sessions: {}, sessionOrder: [] };
    }

    await this.initializeDatabase();
    return await this.readFromStorage();
  }

  /**
   * Remove a specific guest session
   */
  async removeGuestSession(sessionId: string): Promise<void> {
    if (!this.isStorageAvailable()) return;

    await this.initializeDatabase();

    const state = await this.readFromStorage();
    
    delete state.sessions[sessionId];
    state.sessionOrder = state.sessionOrder.filter(id => id !== sessionId);
    
    // If we removed the active session, clear the active session ID
    if (state.activeSessionId === sessionId) {
      state.activeSessionId = null;
    }
    
    await this.saveToStorage(state);
  }

  /**
   * Remove all guest data
   */
  async clearAllGuestData(): Promise<void> {
    if (!this.isStorageAvailable()) return;

    await this.initializeDatabase();

    try {
      // Try IndexedDB first
      if (this.db) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        await new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.warn('[guestDataRetention] Failed to clear IndexedDB, clearing localStorage instead:', error);
    }

    // Also clear localStorage
    try {
      if (window.localStorage) {
        window.localStorage.removeItem(this.storageKey);
      }
    } catch (error) {
      console.warn('[guestDataRetention] Failed to clear localStorage:', error);
    }
  }

  /**
   * Get data for all unmerged guest sessions to be merged to a user
   */
  async getUnmergedGuestDataForUser(_userId: string, mergedSessionIds: string[]): Promise<GuestStorageState> {
    await this.initializeDatabase();
    const state = await this.readFromStorage();
    
    // Filter out sessions that have already been merged
    const unmergedSessions: Record<string, GuestData> = {};
    const unmergedSessionOrder: string[] = [];
    
    for (const sessionId of state.sessionOrder) {
      if (!mergedSessionIds.includes(sessionId)) {
        const sessionData = state.sessions[sessionId];
        if (sessionData) {
          unmergedSessions[sessionId] = sessionData;
          unmergedSessionOrder.push(sessionId);
        }
      }
    }
    
    return {
      activeSessionId: state.activeSessionId,
      sessions: unmergedSessions,
      sessionOrder: unmergedSessionOrder,
    };
  }

  /**
   * Check if there's any guest data to merge
   */
  async hasGuestDataToMerge(userId: string, mergedSessionIds: string[]): Promise<boolean> {
    const state = await this.getUnmergedGuestDataForUser(userId, mergedSessionIds);
    return Object.keys(state.sessions).length > 0;
  }

  /**
   * Detect if the current user is a guest user by checking if there's an active session
   * or guest data in storage
   */
  async isGuestUser(): Promise<boolean> {
    const state = await this.getAllGuestSessions();
    const hasStoredData = Object.keys(state.sessions).length > 0;
    const hasActiveSession = state.activeSessionId !== null;
    
    // A user is considered a guest if there's guest data available
    return hasStoredData || hasActiveSession;
  }

  /**
   * Get the current guest session ID, creating one if needed
   */
  getCurrentGuestSessionId(): string {
    return getOrCreateGuestSessionId();
  }

  /**
   * Retrieve and apply any pending guest data to the current session
   */
  async retrieveAndApplyPendingGuestData(): Promise<GuestData | null> {
    const currentSessionId = this.getCurrentGuestSessionId();
    return await this.getGuestData(currentSessionId);
  }

  /**
   * Clear all temporary guest data storage after successful migration
   */
  async clearAllTemporaryStorage(): Promise<void> {
    await this.clearAllGuestData();
    console.log('[guestDataRetention] Cleared all temporary guest data storage');
  }

  /**
   * Store current application data for guest retention
   */
  async storeCurrentGuestData(data: { 
    trips: Trip[]; 
    weatherLogs: WeatherLog[]; 
    fishCaught: FishCaught[] 
  }): Promise<void> {
    const currentSessionId = this.getCurrentGuestSessionId();
    const guestData: GuestData = {
      ...data,
      lastModified: Date.now()
    };
    
    await this.saveGuestData(currentSessionId, guestData);
  }
}

export const guestDataRetentionService = new GuestDataRetentionService();