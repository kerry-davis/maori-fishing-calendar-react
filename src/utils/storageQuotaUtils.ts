/**
 * Local Storage Quota Management
 * Provides utilities to check and manage localStorage quota
 * 
 * Limitations of localStorage:
 * - Limited storage capacity (typically 5-10MB, varies by browser)
 * - Synchronous API that can block the main thread
 * - No built-in eviction policy (data persists until explicitly removed)
 * - Shared across all tabs/windows of the same origin
 * - Data stored as strings, requiring serialization/deserialization
 * - No transaction support or rollback mechanisms
 * - Limited querying capabilities (no indexing/searching)
 * 
 * Edge Cases Handled:
 * 1. Quota Estimation:
 *    - Dynamic quota measurement by testing write capacity to handle browser differences
 *    - Cached quota values refreshed periodically to account for runtime changes
 * 2. Circular References:
 *    - Safe payload size calculation with try-catch handling for circular references
 *    - Conservative size estimates when serialization fails
 * 3. Cleanup Operations:
 *    - Limited key processing to prevent main thread blocking
 *    - Smart cleanup targeting old guest data first
 * 4. Storage Switching:
 *    - Threshold-based recommendation to switch to IndexedDB (80% full)
 *    - Prevents localStorage overload scenarios
 * 5. Error Handling:
 *    - Graceful degradation when localStorage is unavailable
 *    - Detailed error messages for quota exceeded conditions
 * 6. Debugging Support:
 *    - Optional debugging logs enable/disable via localStorage flag
 *    - Storage usage tracking for performance monitoring
 */

// TypeScript interfaces for better type safety
interface StorageUsage {
  used: number;
  quota: number;
  percentage: number;
}

interface SaveResult {
  success: boolean;
  message?: string;
}

interface CleanupResult {
  freedSpace: number;
  processedKeys: number;
  totalKeys: number;
}

/**
 * Dynamically estimate localStorage quota by testing write capacity
 * This provides a more accurate quota estimation than hardcoded values
 */
export function estimateLocalStorageQuota(): number {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 0;
  }

  try {
    const testKey = '__quota_test__';
    const chunkSize = 1024; // 1KB chunks
    let totalSize = 0;
    let chunk = 'a'.repeat(chunkSize);
    
    // Keep writing until we hit the quota limit
    while (totalSize < 10 * 1024 * 1024) { // Max 10MB test
      try {
        window.localStorage.setItem(`${testKey}_${totalSize}`, chunk);
        totalSize += chunkSize;
      } catch (e) {
        // We've hit the quota limit
        break;
      }
    }
    
    // Clean up test data
    for (let i = 0; i < totalSize; i += chunkSize) {
      window.localStorage.removeItem(`${testKey}_${i}`);
    }
    
    // Return estimated quota (with some buffer for safety)
    return Math.max(1024 * 1024, totalSize * 0.9); // Minimum 1MB, 90% of measured capacity
  } catch (error) {
    // Fallback to estimated quota if dynamic estimation fails
    return 5 * 1024 * 1024; // 5MB default
  }
}

// Cache the quota to avoid repeated measurements
let cachedQuota: number | null = null;
let quotaLastMeasured: number | null = null;

/**
 * Get localStorage quota (cached for performance)
 */
function getLocalStorageQuota(): number {
  const now = Date.now();
  // Refresh quota measurement every 5 minutes
  if (!cachedQuota || !quotaLastMeasured || now - quotaLastMeasured > 5 * 60 * 1000) {
    cachedQuota = estimateLocalStorageQuota();
    quotaLastMeasured = now;
  }
  return cachedQuota;
}

/**
 * Check how much localStorage space is currently used
 */
export function getLocalStorageUsage(): StorageUsage {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length + key.length;
    }
  }
  const quota = getLocalStorageQuota();
  return {
    used: total,
    quota: quota,
    percentage: total > 0 ? Math.min(100, (total / quota) * 100) : 0
  };
}

/**
 * Check if there's sufficient space in localStorage for a given payload
 * Handles circular references with try-catch
 */
export function wouldExceedQuota(payload: any): boolean {
  try {
    // Handle circular references that could cause JSON.stringify to fail
    const payloadSize = JSON.stringify(payload).length;
    const currentUsage = getLocalStorageUsage();
    return (currentUsage.used + payloadSize) > currentUsage.quota;
  } catch (error) {
    // If serialization fails due to circular references, estimate conservatively
    console.warn('[storageQuota] Circular reference detected in payload, estimating size conservatively:', error);
    // Conservative estimate: 1KB per top-level property
    const estimatedSize = Object.keys(payload || {}).length * 1024;
    const currentUsage = getLocalStorageUsage();
    return (currentUsage.used + estimatedSize) > currentUsage.quota;
  }
}

/**
 * Get approximate remaining storage space
 */
export function getRemainingStorage(): number {
  const currentUsage = getLocalStorageUsage();
  return Math.max(0, currentUsage.quota - currentUsage.used);
}

/**
 * Implement helper function to suggest switching to IndexedDB when localStorage is 80% full
 */
export function shouldUseIndexedDB(): boolean {
  const usage = getLocalStorageUsage();
  return usage.percentage > 80;
}

/**
 * Attempt to save to localStorage with quota check
 */
export function saveToLocalStorage(key: string, value: any): SaveResult {
  try {
    const serializedValue = JSON.stringify(value);
    if (wouldExceedQuota({ [key]: serializedValue })) {
      return {
        success: false,
        message: `Storage quota would be exceeded. ${Math.round(getRemainingStorage() / 1024)} KB remaining.`
      };
    }
    
    localStorage.setItem(key, serializedValue);
    return { success: true };
  } catch (error: unknown) {
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      return {
        success: false,
        message: `Storage quota exceeded. ${Math.round(getRemainingStorage() / 1024)} KB remaining. Please remove some data.`
      };
    }
    if (error instanceof Error) {
      return {
        success: false,
        message: `Error saving to storage: ${error.message}`
      };
    }
    return {
      success: false,
      message: 'Error saving to storage: Unknown error occurred'
    };
  }
}

/**
 * Optimize attemptStorageCleanup to limit processed keys and avoid blocking the main thread
 * Processes up to 50 keys at a time to prevent UI blocking
 */
export function attemptStorageCleanup(targetSpaceNeededBytes: number, maxKeysToProcess: number = 50): CleanupResult {
  const usage = getLocalStorageUsage();
  if (usage.quota - usage.used >= targetSpaceNeededBytes) {
    return { freedSpace: targetSpaceNeededBytes, processedKeys: 0, totalKeys: 0 }; // We already have enough space
  }

  // Try to remove some guest data entries that are older
  let freedSpace = 0;
  let processedKeys = 0;
  const now = Date.now();
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

  // Limit the number of keys we process to prevent blocking the main thread
  const allKeys = Object.keys(localStorage);
  const totalKeys = allKeys.length;
  
  for (let i = 0; i < Math.min(allKeys.length, maxKeysToProcess); i++) {
    const key = allKeys[i];
    if (key.startsWith('guestDataRetention')) {
      try {
        const data = JSON.parse(localStorage.getItem(key)!);
        // If this is guest data with a timestamp, and it's old, remove it
        if (data && typeof data === 'object' && data.lastModified) {
          if (now - data.lastModified > thirtyDaysInMs) {
            const size = localStorage.getItem(key)!.length + key.length;
            localStorage.removeItem(key);
            freedSpace += size;
            
            if (freedSpace >= targetSpaceNeededBytes) {
              processedKeys = i + 1;
              break; // We freed enough space
            }
          }
        }
      } catch (e) {
        // If parsing fails, try removing the key anyway if it looks like guest data
        if (key.includes('guest')) {
          const size = (localStorage.getItem(key)?.length || 0) + key.length;
          localStorage.removeItem(key);
          freedSpace += size;
          
          if (freedSpace >= targetSpaceNeededBytes) {
            processedKeys = i + 1;
            break;
          }
        }
      }
    }
    processedKeys = i + 1;
  }

  return { freedSpace, processedKeys, totalKeys };
}

/**
 * Check if localStorage is available and working
 */
export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }

    // Test if we can write to localStorage
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error: unknown) {
    return false;
  }
}

/**
 * Add optional debugging logs for storage usage and cleanup operations
 * Enable with localStorage.setItem('debugStorage', 'true')
 */
export function debugStorage(message: string, ...args: any[]): void {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('debugStorage') === 'true') {
    console.log(`[storageDebug] ${message}`, ...args);
  }
}