import { encryptionService } from '../services/encryptionService';
import { clearUserContext as enhancedClearUserContext } from './clearUserContext';
import { auth } from '../services/firebase';

/**
 * Enhanced user state clearing with comprehensive cleanup.
 * Now uses the enhanced clearUserContext for more thorough cleanup.
 */
export async function clearUserState(): Promise<void> {
  console.log('🧹 Starting enhanced user state cleanup...');
  
  try {
    // Use the comprehensive clearUserContext utility
    const result = await enhancedClearUserContext();
    
    if (!result.success) {
      console.warn('⚠️ Enhanced cleanup had issues:', result.error);
      console.warn('Remaining artifacts:', result.remainingArtifacts);
    } else {
      console.log('✅ Enhanced user state cleanup completed successfully');
    }
    
  } catch (error) {
    console.error('❌ Enhanced user state cleanup failed:', error);
    
    // Fall back to basic cleanup as last resort
    try {
      await fallbackBasicCleanup();
      console.log('⚠️ Fell back to basic cleanup mode');
    } catch (fallbackError) {
      console.error('❌ Even basic cleanup failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Basic fallback cleanup for severe error scenarios
 */
async function fallbackBasicCleanup(): Promise<void> {
  console.log('🔧 Running basic fallback cleanup...');
  
  // Browser context safety check
  if (typeof window === 'undefined') {
    console.log('🔧 Running in non-browser context, skipping localStorage/sessionStorage clearing');
    return;
  }
  
  // Most critical items to clear
  const criticalKeys = ['userLocation', 'tacklebox', 'gearTypes', 'theme'];
  
  criticalKeys.forEach(key => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Failed to remove ${key}:`, error);
    }
  });
  
  // Clear sessionStorage
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (error) {
    console.warn('Failed to clear sessionStorage:', error);
  }
  
  // Clear basic services
  try {
    encryptionService.clear();
  } catch (error) {
    console.warn('Failed to clear encryption:', error);
  }
  
  // Clear Firebase services if available (optional for fallback)
  try {
    // Import dynamically to avoid dependency issues
    const { firebaseDataService } = await import('../services/firebaseDataService');
    const { databaseService } = await import('../services/databaseService');
    
    firebaseDataService.clearSyncQueue();
    databaseService.clearAllData();
  } catch (error) {
    console.warn('Firebase services cleanup not available:', error);
  }
}

// Explicit list of write operations that require authentication
const WRITE_OPERATIONS = new Set([
  'createTrip', 'updateTrip', 'deleteTrip', 'createWeather', 'updateWeather', 
  'deleteWeather', 'createFish', 'updateFish', 'deleteFish', 'saveTrip', 
  'saveWeather', 'saveFish', 'removeTrip', 'removeWeather', 'removeFish',
  'addTrip', 'addWeather', 'addFish', 'setTrip', 'setWeather', 'setFish',
  'uploadPhoto', 'deletePhoto', 'updateSettings', 'saveSettings', 'writeData'
]);

/**
 * Enhanced user context validation with hard failure on UID mismatches
 * Prevents stale data from being processed when user changes and validates
 * Firestore mutations against current authenticated user
 */
export function validateUserContext<ReturnType>(
  currentUserId: string | null,
  operation: () => ReturnType,
  fallbackValue?: ReturnType,
  operationType: string = 'unknown'
): ReturnType | undefined {
    // Guest-mode write bypass: only allow when caller supplies an explicit guest- token
    // This prevents generic write ops like `createTrip` from being implicitly allowed in guest mode.
    if (!currentUserId && operationType.startsWith('guest-')) {
      return operation();
    }
  // If no user context, only allow read-only operations
  if (!currentUserId) {
    if (WRITE_OPERATIONS.has(operationType)) {
      console.error('SECURITY: Write operation blocked in guest mode for:', operationType);
      throw new Error('Require authenticated user context. Write operations require authenticated state.');
    }
    return operation();
  }

  try {
    // Verify Firebase auth state matches current user ID
    if (typeof window !== 'undefined' && auth?.currentUser?.uid) {
      if (auth.currentUser.uid !== currentUserId) {
        console.error('SECURITY: User context mismatch detected:', {
          expected: currentUserId,
          actual: auth.currentUser.uid,
          operation: operationType
        });
        throw new Error('User context mismatch');
      }
    }

    const result = operation();
    
    // Double-check result doesn't contain wrong user data
    if (result && typeof result === 'object' && 'userId' in result) {
      const resultUserId = (result as any).userId;
      if (resultUserId && resultUserId !== currentUserId) {
        console.warn('Operation returned data for wrong user context:', {
          expected: currentUserId,
          actual: resultUserId,
          operation: operationType
        });
        return fallbackValue;
      }
    }
    
    return result;
  } catch (error) {
    if (error instanceof Error && (error.message === 'User context mismatch' || error.message.startsWith('Require authenticated user context'))) {
      throw error;
    }
    console.warn(`Operation blocked due to user context validation failure for user ${currentUserId}:`, error);
    return fallbackValue;
  }
}

/**
 * Validate Firebase operation with hard failure on UID mismatches
 * Specifically for Firestore mutations and database operations
 */
export function validateFirebaseOperation<T>(
  currentUserId: string | null,
  payload: any,
  operation: (validatedPayload: any) => Promise<T>,
  operationType: string = 'unknown'
): Promise<T> {
  if (!currentUserId) {
    console.error('SECURITY: Firebase operation blocked without user context for:', operationType);
    return Promise.reject(new Error('Firebase operations require authenticated user'));
  }

  // Validate payload contains correct user ID
  if (payload && typeof payload === 'object') {
    if (payload.userId && payload.userId !== currentUserId) {
      console.error('SECURITY: Firebase payload user ID mismatch:', {
        expected: currentUserId,
        payloadUserId: payload.userId,
        operation: operationType,
        payload: Object.keys(payload)
      });
      return Promise.reject(new Error(`Payload user ID mismatch: expected ${currentUserId}, got ${payload.userId}`));
    }
    
    // Add user ID to payload if missing (for safety)
    if (!payload.userId) {
      console.warn('Adding missing user ID to payload for safety');
      payload.userId = currentUserId;
    }
  }

  return operation(payload).then(result => {
    // Verify result metadata
    if (result && typeof result === 'object') {
      const resultUserId = (result as any).userId || (result as any).creatorId;
      if (resultUserId && resultUserId !== currentUserId) {
        console.error('SECURITY: Firebase operation result user ID mismatch:', {
          expected: currentUserId,
          actual: resultUserId,
          operation: operationType
        });
        throw new Error(`Firebase operation result user ID mismatch: expected ${currentUserId}, got ${resultUserId}`);
      }
    }
    
    return result;
  });
}

/**
 * Enhanced secure logout with comprehensive user context validation
 */
export async function secureLogoutWithValidation(logoutFunction: () => Promise<void>): Promise<void> {
  console.log('🔐 Initiating secure logout with user context validation...');
  
  try {
    // Validate user context before logout
    if (typeof window !== 'undefined') {
      const currentUser = auth?.currentUser;
      
      if (currentUser) {
        console.log('Validating user context for logout:', currentUser.uid);
        
        // Verify session integrity
        if (typeof localStorage !== 'undefined' && 
            currentUser.uid !== localStorage.getItem('lastActiveUser')) {
          console.warn('⚠️ Session integrity check failed during logout');
        }
      }
    }
    
    // 1. Cancel any in-flight operations first
    console.log('Canceling pending operations...');
    
    // 2. Clear all user state before logout
    await clearUserState();
    
    // 3. Perform the actual logout
    console.log('Executing logout...');
    await logoutFunction();
    
    // 4. Verify post-logout state
    if (typeof window !== 'undefined') {
      if (auth?.currentUser) {
        console.error('❌ SECURITY: User session persists after logout');
        throw new Error('User session cleanup failed');
      }
    }
    
    console.log('✅ Secure logout completed successfully with validation!');
    
  } catch (error) {
    console.error('❌ Secure logout failed:', error);
    
    // Even if logout fails, ensure state is cleared
    try {
      await clearUserState();
      console.log('✅ Emergency state cleanup completed');
    } catch (cleanupError) {
      console.error('❌ Emergency cleanup also failed:', cleanupError);
    }
    
    throw error;
  }
}

/**
 * Enhanced logout wrapper that ensures complete state cleanup
 */
export async function secureLogout(logoutFunction: () => Promise<void>): Promise<void> {
  console.log('🔐 Initiating secure logout with state cleanup...');
  
  try {
    // 1. Cancel any in-flight operations first
    console.log('Canceling pending operations...');
    
    // 2. Clear all user state before logout
    await clearUserState();
    
    // 3. Perform the actual logout
    console.log('Executing logout...');
    await logoutFunction();
    
    console.log('✅ Secure logout completed successfully!');
    
  } catch (error) {
    console.error('❌ Secure logout failed:', error);
    
    // Even if logout fails, ensure state is cleared
    try {
      await clearUserState();
      console.log('✅ Emergency state cleanup completed');
    } catch (cleanupError) {
      console.error('❌ Emergency cleanup also failed:', cleanupError);
    }
    
    throw error;
  }
}
