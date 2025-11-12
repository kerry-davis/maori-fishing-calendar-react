import { encryptionService } from '@shared/services/encryptionService';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import { databaseService } from '@shared/services/databaseService';

/**
 * Basic fallback cleanup for severe error scenarios.
 * Executed when comprehensive cleanup routines fail.
 */
export async function fallbackBasicCleanup(): Promise<void> {
  console.log('🔧 Running basic fallback cleanup...');

  if (typeof window === 'undefined') {
    console.log('🔧 Non-browser context detected, skipping storage cleanup');
    return;
  }

  const criticalKeys = ['userLocation', 'tacklebox', 'gearTypes', 'theme'];

  for (const key of criticalKeys) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Failed to remove ${key}:`, error);
    }
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (error) {
    console.warn('Failed to clear sessionStorage:', error);
  }

  try {
    encryptionService.clear();
  } catch (error) {
    console.warn('Failed to clear encryption:', error);
  }

  try {
    firebaseDataService.clearSyncQueue();
    databaseService.clearAllData();
  } catch (error) {
    console.warn('Firebase services cleanup not available:', error);
  }
}
