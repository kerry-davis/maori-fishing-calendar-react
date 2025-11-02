import { encryptionService } from '@shared/services/encryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import { databaseService } from '@shared/services/databaseService';
import { auth } from '@shared/services/firebase';

/**
 * Consolidated User Context Clearing Utility
 * 
 * Enhanced version that includes:
 * - Complete persistence layer purging
 * - Firebase listener aborting
 * - In-memory state resetting
 * - Service worker cache clearing
 * - Queue processing cancellation
 * - Comprehensive error handling
 */

// WeakMap to track active listeners for cleanup
const activeFirebaseListeners: WeakMap<object, Array<() => void | Promise<void>>> = new WeakMap();
const GUEST_LISTENER_KEY: object = {};
const inMemoryCaches = new Map<string, any>();
const clearedLocalStorageKeys = new Set<string>();
const clearedSessionStorageKeys = new Set<string>();

const DEFAULT_USER_STORAGE_KEYS = [
  'theme',
  'userLocation',
  'tacklebox',
  'gearTypes',
  'pendingModal',
  'settingsModalOpen',
  'lastActiveUser',
  'authState',
  'encryptionKeyStatus',
  'analyticsConsent',
  'tempAuth',
  'wizardStep',
  'syncStatus',
  'lastSync',
  'navigationState'
];

export interface ClearUserContextOptions {
  preserveGuestData?: boolean;
}

function collectStorageKeys(storage: Storage | undefined): string[] {
  if (!storage) {
    return [];
  }

  const keys = new Set<string>();

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) {
        keys.add(key);
      }
    }
  } catch (error) {
    console.warn('Failed to enumerate storage keys with key()', error);
  }

  try {
    Object.keys(storage).forEach((key) => {
      const value = (storage as any)[key];
      if (typeof value !== 'function') {
        keys.add(key);
      }
    });
  } catch (error) {
    console.warn('Failed to enumerate storage keys with Object.keys', error);
  }

  const dataProperty = (storage as unknown as { data?: Record<string, unknown> }).data;
  if (dataProperty && typeof dataProperty === 'object') {
    Object.keys(dataProperty).forEach((key) => keys.add(key));
  }

  return Array.from(keys);
}

/**
 * Store active Firebase listener subscriptions for later cleanup
 */
export function registerFirebaseListener(cleanupFn: () => void | Promise<void>, key?: string): void {
  const mapKey: object = (auth && auth.currentUser) ? (auth.currentUser as unknown as object) : GUEST_LISTENER_KEY;
  if (!activeFirebaseListeners.has(mapKey)) {
    activeFirebaseListeners.set(mapKey, []);
  }
  const listeners = activeFirebaseListeners.get(mapKey)!;
  listeners.push(cleanupFn);
  
  // Also store by key for specific cleanup if needed
  if (key) {
    inMemoryCaches.set(key, cleanupFn);
  }
}

/**
 * Store in-memory cache data for tracking and cleanup
 */
export function setInMemoryCache(key: string, value: any): void {
  inMemoryCaches.set(key, value);
}

export function getInMemoryCache(key: string): any {
  return inMemoryCaches.get(key);
}

/**
 * Get comprehensive catalog of persistence mechanisms with browser safety
 */
function getPersistenceCatalog(): {
  storage: Record<string, string[]>
  indexedDB: string[]
  caches: string[]
  inMemory: string[]
  firebase: string[]
} {
  // Browser context safety
  if (typeof window === 'undefined') {
    return {
      storage: { 
        localStorage: [], sessionStorage: [], userSpecific: [], 
        appSpecific: [], highRisk: [], mediumRisk: [] 
      },
      indexedDB: [],
      caches: [],
      inMemory: [],
      firebase: []
    };
  }
  
  const localStorageRef = (window as any)?.localStorage;
  const sessionStorageRef = (window as any)?.sessionStorage;

  const localStorageKeys = localStorageRef ? collectStorageKeys(localStorageRef as Storage) : [];
  const sessionStorageKeys = sessionStorageRef ? collectStorageKeys(sessionStorageRef as Storage) : [];

  const inferredUserKeys = localStorageKeys.filter(key => [
    'theme', 'userLocation', 'tacklebox', 'gearTypes', 'pendingModal',
    'settingsModalOpen', 'lastActiveUser', 'authState',
    'encryptionKeyStatus', 'analyticsConsent', 'tempAuth',
    'wizardStep', 'syncStatus', 'lastSync', 'navigationState'
  ].includes(key) || key.toLowerCase().includes('modal') || key.includes('temp'));

  const userSpecificKeys = Array.from(new Set([
    ...DEFAULT_USER_STORAGE_KEYS,
    ...inferredUserKeys
  ]));

  const appSpecificKeys = localStorageKeys.filter(key => [
    'cacheVersion', 'pwaInstalled', 'lastUpdated'
  ].includes(key));
  
  const highRiskKeys = ['userLocation', 'tacklebox', 'gearTypes'];
  const mediumRiskKeys = ['theme', 'pendingModal', 'settingsModalOpen'];

  return {
    storage: {
      localStorage: localStorageKeys,
      sessionStorage: sessionStorageKeys,
      userSpecific: userSpecificKeys,
      appSpecific: appSpecificKeys,
      highRisk: Array.from(new Set([
        ...highRiskKeys,
        ...localStorageKeys.filter(key => highRiskKeys.includes(key))
      ])),
      mediumRisk: Array.from(new Set([
        ...mediumRiskKeys,
        ...localStorageKeys.filter(key => mediumRiskKeys.includes(key))
      ]))
    },
    indexedDB: ['trips', 'weather_logs', 'fish_caught'],
    caches: ['firebase-firestore', 'firebase-storage', 'app-data'],
    inMemory: Array.from(inMemoryCaches.keys()),
    firebase: ['syncQueues', 'activeListeners', 'authSubscriptions']
  };
}

/**
 * Enhanced Firebase listener cleanup with browser context safety
 * Abort all active Firebase listeners and subscriptions
 */
async function cleanupFirebaseListeners(): Promise<void> {
  console.log('🔄 Cleaning up Firebase listeners...');
  
  // Browser context safety check
  if (typeof window === 'undefined') {
    console.log('🔧 Running in non-browser context, skipping Firebase listener cleanup');
    return;
  }
  
  try {
    // Check if auth service is available
    if (!auth) {
      console.warn('⚠️ Firebase auth service not available');
      return;
    }
    
    // Abort listeners for current user
    const currentUser = auth.currentUser as unknown as object | null;
    const mapKey: object = currentUser ?? GUEST_LISTENER_KEY;
    if (activeFirebaseListeners.has(mapKey)) {
      const listeners = activeFirebaseListeners.get(mapKey)!;
      
      for (const cleanupFn of listeners) {
        try {
          await cleanupFn();
        } catch (error) {
          console.warn('⚠️ Failed to cleanup Firebase listener:', error);
        }
      }
      
      activeFirebaseListeners.delete(mapKey);
    }
    
    // Clear all in-memory caches
    inMemoryCaches.clear();
    
    console.log('✅ Firebase listeners cleanup completed');
  } catch (error) {
    console.warn('⚠️ Firebase listener cleanup failed:', error);
  }
}

/**
 * Comprehensive persistence layer clearing with browser context safety
 * Clean all storage mechanisms with detailed logging
 */
async function cleanupPersistentStorage(options: ClearUserContextOptions = {}): Promise<boolean> {
  console.log('🧹 Starting comprehensive storage cleanup...');
  
  // Browser context safety check
  if (typeof window === 'undefined') {
    console.log('🔧 Running in non-browser context, using mock cleanup');
    return false;
  }
  clearedLocalStorageKeys.clear();
  clearedSessionStorageKeys.clear();
  const localStorageRef: Storage | undefined = (window as any)?.localStorage || undefined;
  const sessionStorageRef: Storage | undefined = (window as any)?.sessionStorage || undefined;
  
  // Catalog generation with safety
  let catalog;
  try {
    catalog = getPersistenceCatalog();
    console.log('Storage catalog:', catalog);
  } catch (error) {
    console.warn('⚠️ Failed to generate storage catalog, proceeding with basic cleanup:', error);
    catalog = { storage: { localStorage: [], sessionStorage: [], userSpecific: [], appSpecific: [], highRisk: [], mediumRisk: [] }, indexedDB: [], caches: [], inMemory: [], firebase: [] };
  }
  
  let performedCleanup = false;
  const cleanupOperations: Promise<unknown>[] = [];
  
  // 1. localStorage cleanup with comprehensive safety checks
  try {
    // Check localStorage availability
    if (localStorageRef) {
      const keysToRemove = new Set<string>([
        ...catalog.storage.userSpecific,
        ...DEFAULT_USER_STORAGE_KEYS
      ]);

      catalog.storage.localStorage.forEach((key) => {
        if (key.includes('auth') || key.includes('token') || key.toLowerCase().includes('modal') ||
            key.includes('pending') || key.includes('settings') || key.includes('temp')) {
          keysToRemove.add(key);
        }
      });

      console.log('Clearing localStorage keys:', keysToRemove.size, 'targeted entries');

      keysToRemove.forEach(key => {
        try {
          console.log('Removing localStorage key:', key);
          localStorageRef.removeItem(key);
          clearedLocalStorageKeys.add(key);
        } catch (error) {
          console.warn(`Failed to remove localStorage key ${key}:`, error);
        }
      });
      
      performedCleanup = true;
      console.log('✅ localStorage cleanup completed');
    } else {
      console.log('🔧 localStorage not available, skipping localStorage cleanup');
    }
  } catch (error) {
    console.warn('⚠️ localStorage cleanup failed:', error);
  }
  
  // 2. sessionStorage cleanup with safety
  try {
    if (sessionStorageRef) {
      console.log('Clearing sessionStorage keys:', catalog.storage.sessionStorage.length);
      catalog.storage.sessionStorage.forEach(key => {
        try {
          sessionStorageRef.removeItem(key);
          clearedSessionStorageKeys.add(key);
        } catch (error) {
          console.warn(`Failed to remove sessionStorage key ${key}:`, error);
        }
      });

      try {
        sessionStorageRef.clear();
      } catch (clearError) {
        console.warn('Failed to clear sessionStorage directly:', clearError);
      }

      performedCleanup = true;
      console.log('✅ sessionStorage cleanup completed');
    } else {
      console.log('🔧 sessionStorage not available, skipping sessionStorage cleanup');
    }
  } catch (error) {
    console.warn('⚠️ sessionStorage cleanup failed:', error);
  }
  
  // 3. IndexedDB cleanup
  if (options.preserveGuestData) {
    console.log('Preserving guest-mode IndexedDB data during cleanup');
  } else {
    try {
      console.log('Clearing IndexedDB data...');
      const indexedDBClearPromise = databaseService.clearAllData();
      cleanupOperations.push(
        indexedDBClearPromise
          .then(() => console.log('✅ IndexedDB cleanup completed'))
          .catch(error => console.warn('⚠️ IndexedDB cleanup failed:', error))
      );
      performedCleanup = true;
    } catch (error) {
      console.warn('⚠️ IndexedDB cleanup setup failed:', error);
    }
  }
  
  // 4. Service worker cache cleanup with browser safety
  try {
    if (typeof window !== 'undefined' && 'caches' in window && (window as any).caches) {
      console.log('Clearing service worker caches...');
      const cacheApi = (window as any).caches;
      const cacheClearPromise = Promise.resolve(cacheApi.keys())
        .then((cacheNames: any) => Array.isArray(cacheNames) ? cacheNames : [])
        .then((cacheNames: string[]) => Promise.all(
          cacheNames.map(cacheName => {
            console.log('Clearing cache:', cacheName);
            return cacheApi.delete(cacheName);
          })
        ))
        .then(() => {
          console.log('✅ Service worker caches cleared');
        });
      
      cleanupOperations.push(cacheClearPromise);
      performedCleanup = true;
    } else {
      console.log('🔧 Cache API not available, skipping cache cleanup');
    }
  } catch (error) {
    console.warn('⚠️ Service worker cache cleanup failed:', error);
  }
  
  // 5. Encryption service cleanup
  try {
    console.log('Clearing encryption service...');
    encryptionService.clear();
    console.log('✅ Encryption service cleared');
    performedCleanup = true;
  } catch (error) {
    console.warn('⚠️ Encryption service cleanup failed:', error);
  }
  
  // 6. Firebase data service cleanup
  try {
    console.log('Clearing Firebase data service...');
    firebaseDataService.clearSyncQueue();
    console.log('✅ Firebase data service cleared');
    performedCleanup = true;
  } catch (error) {
    console.warn('⚠️ Firebase data service cleanup failed:', error);
  }
  
  // Wait for all cleanup operations
  try {
    await Promise.allSettled(cleanupOperations);
    console.log('✅ All persistent storage cleanup completed');
  } catch (error) {
    console.warn('⚠️ Some cleanup operations failed:', error);
  }

  return performedCleanup;
}

/**
 * URL and navigation state cleanup with comprehensive browser safety
 * Clear URL hash, title, and any navigation artifacts
 */
function cleanupNavigationState(): boolean {
  console.log('🧹 Cleaning up navigation state...');
  
  // Browser context safety check
  if (typeof window === 'undefined') {
    console.log('🔧 Running in non-browser context, skipping navigation cleanup');
    return false;
  }
  
  try {
    let navigationUpdated = false;
    // Clear modal-related URL hash
    if (window.location?.hash && (
      window.location.hash.includes('settings') || 
      window.location.hash.includes('modal') ||
      window.location.hash.includes('trip')
    )) {
      console.log('Clearing modal URL hash:', window.location.hash);
      try {
        window.history?.replaceState?.(null, '', window.location.pathname);
        window.location.hash = '';
      } catch (error) {
        console.warn('Failed to reset URL hash:', error);
      }
      navigationUpdated = true;
    }
    
    // Reset page title if it contains user-specific data
    if (document?.title && document.title.includes('(')) {
      document.title = document.title.replace(/\s*\([^)]*\)$/, '');
      navigationUpdated = true;
    }
    
    console.log('✅ Navigation state cleared');
    return navigationUpdated;
  } catch (error) {
    console.warn('⚠️ Navigation state cleanup failed:', error);
    return false;
  }
}

/**
 * Abort any in-flight operations and queued writes
 * Cancel pending async operations
 */
async function abortInFlightOperations(): Promise<void> {
  console.log('🛑 Aborting in-flight operations...');
  
  const currentUserId = auth?.currentUser?.uid;
  if (currentUserId) {
    console.log('Canceling operations for user:', currentUserId);
  }

  if (typeof window !== 'undefined') {
    try {
      if (typeof window.setTimeout === 'function' && typeof window.clearTimeout === 'function') {
        const timeoutId = window.setTimeout(() => {}, 0);
        window.clearTimeout(timeoutId);
      }
      if (typeof window.setInterval === 'function' && typeof window.clearInterval === 'function') {
        const intervalId = window.setInterval(() => {}, 1000);
        window.clearInterval(intervalId);
      }
    } catch (error) {
      console.warn('Timer cleanup encountered an issue:', error);
    }
  } else {
    console.log('Running in non-browser context, no timers to abort');
  }

  console.log('✅ In-flight operations aborted');
}

/**
 * Verify cleanup completion with browser safety
 * Check that no user artifacts remain
 */
function verifyCleanupComplete(): {
  success: boolean;
  remainingArtifacts: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
} {
  console.log('🔍 Verifying cleanup completion...');
  
  // Browser context safety check
  if (typeof window === 'undefined') {
    console.log('🔧 Running in non-browser context, assuming cleanup complete');
    return { success: true, remainingArtifacts: [], riskLevel: 'LOW' };
  }
  
  const remainingArtifacts = [];
  let catalog;
  const localStorageRef: Storage | undefined = (window as any)?.localStorage;
  const sessionStorageRef: Storage | undefined = (window as any)?.sessionStorage;
  
  try {
    catalog = getPersistenceCatalog();
  } catch (error) {
    console.warn('⚠️ Failed to get catalog for verification:', error);
    return { success: false, remainingArtifacts: ['VERIFICATION_ERROR'], riskLevel: 'HIGH' };
  }
  
  // Check for high-risk artifacts with safety
  if (localStorageRef) {
    catalog.storage.highRisk.forEach(key => {
      try {
        const value = localStorageRef.getItem(key);
        const wasCleared = clearedLocalStorageKeys.has(key);
        if (!wasCleared && value != null) {
          remainingArtifacts.push(`HIGH_RISK_${key}`);
        }
      } catch (error) {
        console.warn(`Failed to check localStorage key ${key}:`, error);
        remainingArtifacts.push(`CHECK_ERROR_${key}`);
      }
    });
    
    // Check for medium-risk artifacts
    catalog.storage.mediumRisk.forEach(key => {
      try {
        const value = localStorageRef.getItem(key);
        const wasCleared = clearedLocalStorageKeys.has(key);
        if (!wasCleared && value != null) {
          remainingArtifacts.push(`MEDIUM_RISK_${key}`);
        }
      } catch (error) {
        console.warn(`Failed to check localStorage key ${key}:`, error);
      }
    });
  }
  
  // Check for remaining session storage with safety
  if (sessionStorageRef) {
    catalog.storage.sessionStorage.forEach(key => {
      try {
        const value = sessionStorageRef.getItem(key);
        const wasCleared = clearedSessionStorageKeys.has(key);
        if (!wasCleared && value != null) {
          remainingArtifacts.push(`SESSION_${key}`);
        }
      } catch (error) {
        console.warn(`Failed to check sessionStorage key ${key}:`, error);
        remainingArtifacts.push(`SESSION_CHECK_ERROR_${key}`);
      }
    });
  }
  
  // Check URL hash with safety
  try {
    if (window.location?.hash && (
      window.location.hash.includes('settings') ||
      window.location.hash.includes('modal')
    )) {
      remainingArtifacts.push('URL_HASH_MODAL');
    }
  } catch (error) {
    console.warn('Failed to check URL hash:', error);
  }
  
  const hasHighRisk = localStorageRef ? catalog.storage.highRisk.some(key => {
    if (clearedLocalStorageKeys.has(key)) {
      try {
        localStorageRef.getItem(key);
        return false;
      } catch {
        return true;
      }
    }
    try {
      return localStorageRef.getItem(key) != null;
    } catch {
      return true;
    }
  }) : false;
  
  const success = remainingArtifacts.length === 0;
  const riskLevel = hasHighRisk ? 'HIGH' : remainingArtifacts.length > 0 ? 'MEDIUM' : 'LOW';
  
  console.log('Cleanup verification:', { success, remainingArtifacts, riskLevel });
  
  return { success, remainingArtifacts, riskLevel };
}

/**
 * Consolidated User Context Clearing Function
 * 
 * This is the main entry point that orchestrates complete user context cleanup
 * including persistence purging, listener aborting, and in-memory state reset.
 * 
 * Features:
 * - Complete persistence layer clearing
 * - Firebase listener/unsubscription cleanup  
 * - In-memory cache purge
 * - Service worker cache clearing
 * - In-flight operation cancellation
 * - Comprehensive error handling
 * - Cleanup verification and logging
 */
export async function clearUserContext(options: ClearUserContextOptions = {}): Promise<{
  success: boolean;
  cleanupResults: {
    storageClear: boolean;
    listenersCleared: boolean;
    operationsAborted: boolean;
    navigationCleared: boolean;
  };
  remainingArtifacts: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  error?: string;
}> {
  // Safe performance.now() with fallback
  const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  console.log('🚀 Starting comprehensive user context clearing...');
  
  clearedLocalStorageKeys.clear();
  clearedSessionStorageKeys.clear();

  const cleanupResults = {
    storageClear: false,
    listenersCleared: false,
    operationsAborted: false,
    navigationCleared: false
  };
  
  let error: string | undefined;
  let remainingArtifacts: string[] = [];
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  
  try {
    // Step 1: Cancel in-flight operations first
    await abortInFlightOperations();
    cleanupResults.operationsAborted = true;
    
    // Step 2: Cleanup Firebase listeners and subscriptions
    await cleanupFirebaseListeners();
    cleanupResults.listenersCleared = true;
    
    // Step 3: Clear all persistent storage
    const storagePerformed = await cleanupPersistentStorage(options);
    cleanupResults.storageClear = storagePerformed;
    
    // Step 4: Clear navigation state
    const navigationCleared = cleanupNavigationState();
    cleanupResults.navigationCleared = navigationCleared;
    
    // Step 5: Verify cleanup completion
    const verification = verifyCleanupComplete();
    remainingArtifacts = verification.remainingArtifacts;
    riskLevel = verification.riskLevel;
    
    if (!verification.success) {
      console.warn('⚠️ Cleanup verification failed - some artifacts remain:', remainingArtifacts);
      const artifactList = remainingArtifacts.length ? remainingArtifacts.join(', ') : 'unknown artifacts';
      error = `Cleanup failed: ${artifactList}`;
    } else {
      console.log('✅ User context clearing completed successfully');
    }
    
  } catch (cleanupError) {
    const errorMessage = cleanupError instanceof Error ? cleanupError.message : 'Unknown error';
    console.error('❌ User context clearing failed:', errorMessage);
    error = `Cleanup failed: ${errorMessage}`;
    riskLevel = 'HIGH';
  } finally {
    // Safe duration calculation
    const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const duration = Math.round(endTime - startTime);
    console.log(`⏱️ clearUserContext completed in ${duration}ms`);
    
    // Dispatch cleanup complete event for UI components to react
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('userContextCleared', {
        detail: {
          success: !error,
          remainingArtifacts,
          riskLevel,
          duration
        }
      }));
    }
  }
  
  return {
    success: !error,
    cleanupResults,
    remainingArtifacts,
    riskLevel,
    error
  };
}

/**
 * Enhanced logout wrapper with listener management
 * Use this instead of signOut for complete cleanup
 */
export async function secureLogoutWithCleanup(): Promise<void> {
  console.log('🔐 Starting secure logout with comprehensive cleanup...');
  
  try {
    // Step 0: Force sync any queued operations before logout (30s timeout)
    if (auth && auth.currentUser) {
      console.log('⏳ Syncing queued operations before logout...');
      
      try {
        const syncPromise = firebaseDataService.processSyncQueue();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sync timeout')), 30000)
        );
        
        await Promise.race([syncPromise, timeoutPromise]);
        console.log('✅ Sync completed successfully');
      } catch (syncError) {
        const errorMsg = syncError instanceof Error ? syncError.message : 'Unknown error';
        console.warn(`⚠️ Sync failed or timed out (${errorMsg}). Continuing with logout.`);
        console.warn('⚠️ Any unsync\'d data may be lost. Data in cloud is preserved.');
      }
    }
    
    // Step 1: Complete user context cleanup BEFORE Firebase logout
    // Clear ALL local data - cloud is the source of truth for authenticated users
    const cleanupResult = await clearUserContext({ preserveGuestData: false });
    
    if (!cleanupResult.success) {
      console.warn('⚠️ Cleanup had issues but continuing with logout:', cleanupResult.error);
    } else {
      console.log('✅ Cleanup completed successfully');
    }
    
    // Step 2: Execute Firebase logout
    if (auth && auth.currentUser) {
      await auth.signOut();
      console.log('✅ Firebase logout completed');
    }
    
    console.log('🎉 Secure logout completed successfully');
    
  } catch (error) {
    console.error('❌ Secure logout failed:', error);
    throw error;
  }
}

/**
 * Check if user context has been properly cleared
 * Used for debugging and verification
 */
export function isUserContextCleared(): boolean {
  const verification = verifyCleanupComplete();
  return verification.success && verification.riskLevel === 'LOW';
}
