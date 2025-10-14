import { guestDataRetentionService } from '../services/guestDataRetentionService';
import { firebaseDataService } from '../services/firebaseDataService';
import { databaseService } from '../services/databaseService';

/**
 * Determine if the user is currently in guest mode
 * Note: This is synchronous for compatibility with current usage
 * For async version, use checkIsGuestUser()
 */
export const isGuestUser = (): boolean => {
  // Check if firebaseDataService is in guest mode (no authenticated user)
  if (firebaseDataService.isGuestMode()) {
    return true;
  }
  
  // For sync check, we'll assume false if we can't check async
  // For full async check, use checkIsGuestUser()
  return false;
};

/**
 * Determine if the user is currently in guest mode (async version)
 */
export const checkIsGuestUser = async (): Promise<boolean> => {
  // Check if firebaseDataService is in guest mode (no authenticated user)
  if (firebaseDataService.isGuestMode()) {
    return true;
  }
  
  // Check if there's any guest data retention
  return await guestDataRetentionService.isGuestUser();
};

/**
 * Store current guest data temporarily
 */
export const storeGuestData = async (): Promise<void> => {
  // Get data from the current storage (either local via databaseService or firebaseDataService)
  // We'll get it from databaseService since that's the local storage layer
  try {
    const trips = await databaseService.getAllTrips();
    const weatherLogs = await databaseService.getAllWeatherLogs();
    const fishCaught = await databaseService.getAllFishCaught();
    
    // Only store if there's actual data
    if (trips.length > 0 || weatherLogs.length > 0 || fishCaught.length > 0) {
      await guestDataRetentionService.storeCurrentGuestData({
        trips,
        weatherLogs,
        fishCaught
      });
      
      console.log(`[guestDataRetention] Stored ${trips.length} trips, ${weatherLogs.length} weather logs, ${fishCaught.length} fish caught for guest session`);
    }
  } catch (error) {
    console.error('[guestDataRetention] Failed to store guest data:', error);
    throw error;
  }
};

/**
 * Apply any retained guest data to the current session
 */
export const applyRetainedGuestData = async (): Promise<boolean> => {
  try {
    const guestData = await guestDataRetentionService.retrieveAndApplyPendingGuestData();
    
    if (guestData && (guestData.trips.length > 0 || guestData.weatherLogs.length > 0 || guestData.fishCaught.length > 0)) {
      // Apply the guest data to the current session
      for (const trip of guestData.trips) {
        try {
          await databaseService.updateTrip(trip);
        } catch (error) {
          console.warn('[guestDataRetention] Failed to apply trip:', error);
        }
      }
      
      for (const weatherLog of guestData.weatherLogs) {
        try {
          await databaseService.updateWeatherLog(weatherLog);
        } catch (error) {
          console.warn('[guestDataRetention] Failed to apply weather log:', error);
        }
      }
      
      for (const fish of guestData.fishCaught) {
        try {
          await databaseService.updateFishCaught(fish);
        } catch (error) {
          console.warn('[guestDataRetention] Failed to apply fish caught:', error);
        }
      }
      
      console.log(`[guestDataRetention] Applied ${guestData.trips.length} trips, ${guestData.weatherLogs.length} weather logs, ${guestData.fishCaught.length} fish caught from retention`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[guestDataRetention] Failed to apply retained guest data:', error);
    return false;
  }
};

/**
 * Check if there's guest data to merge for a specific user (async version)
 */
export const hasGuestDataToMergeForUser = async (userId: string): Promise<boolean> => {
  const mergedSessionIds: string[] = []; // In a real implementation, you'd get these from the guest session service
  return await guestDataRetentionService.hasGuestDataToMerge(userId, mergedSessionIds);
};