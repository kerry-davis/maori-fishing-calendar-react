import { databaseService } from '../services/databaseService';
import { firebaseDataService } from '../services/firebaseDataService';

export const debugDataStatus = async () => {
  console.log('=== DATA STATUS DEBUG ===');
  
  try {
    // Check local data
    const localTrips = await databaseService.getAllTrips();
    const localWeather = await databaseService.getAllWeatherLogs();
    const localFish = await databaseService.getAllFishCaught();
    
    console.log('LOCAL DATA:');
    console.log(`- Trips: ${localTrips.length}`);
    console.log(`- Weather logs: ${localWeather.length}`);
    console.log(`- Fish caught: ${localFish.length}`);
    
    // Check if Firebase service is ready and user is authenticated
    if (firebaseDataService.isReady() && !(firebaseDataService as any).isGuest) {
      console.log('FIREBASE DATA:');
      try {
        const firebaseTrips = await firebaseDataService.getAllTrips();
        const firebaseWeather = await firebaseDataService.getAllWeatherLogs();
        const firebaseFish = await firebaseDataService.getAllFishCaught();
        
        console.log(`- Trips: ${firebaseTrips.length}`);
        console.log(`- Weather logs: ${firebaseWeather.length}`);
        console.log(`- Fish caught: ${firebaseFish.length}`);
      } catch (error) {
        console.log('- Error fetching Firebase data:', error);
      }
    } else {
      console.log('FIREBASE: Not authenticated or service not ready');
    }
    
  } catch (error) {
    console.error('Error checking data status:', error);
  }
  
  console.log('=== END DATA STATUS DEBUG ===');
};

// Force refresh calendar data
export const forceRefreshData = () => {
  console.log('Forcing calendar refresh...');
  window.dispatchEvent(new CustomEvent('forceCalendarRefresh'));
};

// Analyze trips for potential duplicates (safer approach)
export const analyzeDuplicateTrips = async () => {
  console.log('=== ANALYZING TRIPS FOR DUPLICATES ===');
  
  try {
    const { firebaseDataService } = await import('../services/firebaseDataService');
    
    if ((firebaseDataService as any).isGuest) {
      console.log('Cannot analyze - user not logged in');
      return;
    }

    const allTrips = await firebaseDataService.getAllTrips();
    console.log(`Found ${allTrips.length} trips total`);

    console.log('All trips:');
    allTrips.forEach((trip: any, index: number) => {
      console.log(`${index + 1}. ${trip.date} at ${trip.water} - ${trip.location} (${trip.hours}h)`);
      console.log(`   ID: ${trip.id}, Notes: "${trip.notes || 'no notes'}"`);
    });

    // Group trips by ALL fields to find exact duplicates
    const tripGroups = new Map();
    
    allTrips.forEach(trip => {
      // Create a comprehensive key including all major fields
      const key = `${trip.date}-${trip.water}-${trip.location}-${trip.hours}-${trip.companions || 'none'}-${trip.notes || 'none'}`;
      if (!tripGroups.has(key)) {
        tripGroups.set(key, []);
      }
      tripGroups.get(key).push(trip);
    });

    // Find groups with exact duplicates
    const duplicateGroups = Array.from(tripGroups.entries()).filter(([, trips]) => trips.length > 1);
    
    console.log(`Found ${duplicateGroups.length} groups with potential exact duplicates`);
    
    if (duplicateGroups.length === 0) {
      console.log('✅ No exact duplicates found. Your trips appear to be unique.');
      return;
    }
    
    for (const [key, trips] of duplicateGroups) {
      console.log(`\n🔍 POTENTIAL DUPLICATES FOUND:`);
      console.log(`Key: ${key}`);
      console.log(`Count: ${trips.length} trips`);
      trips.forEach((trip: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${trip.id}, Firebase ID: ${trip.firebaseDocId}`);
        console.log(`     Date: ${trip.date}, Location: ${trip.water} - ${trip.location}`);
        console.log(`     Hours: ${trip.hours}, Companions: ${trip.companions || 'none'}`);
        console.log(`     Notes: ${trip.notes || 'no notes'}`);
      });
    }
    
    console.log('\n⚠️  MANUAL REVIEW REQUIRED');
    console.log('Please review the above trips to confirm they are duplicates before deleting.');
    console.log('If you want to delete specific trips, use: deleteSpecificTrip(tripId)');
    
  } catch (error) {
    console.error('Error during analysis:', error);
  }
  
  console.log('=== ANALYSIS FINISHED ===');
};

// Delete a specific trip by ID (safer manual approach)
export const deleteSpecificTrip = async (tripId: number) => {
  console.log(`=== DELETING SPECIFIC TRIP ${tripId} ===`);
  
  try {
    const { firebaseDataService } = await import('../services/firebaseDataService');
    
    if ((firebaseDataService as any).isGuest) {
      console.log('Cannot delete - user not logged in');
      return;
    }

    const allTrips = await firebaseDataService.getAllTrips();
    const tripToDelete = allTrips.find(trip => trip.id === tripId);
    
    if (!tripToDelete) {
      console.log(`Trip with ID ${tripId} not found`);
      return;
    }
    
    console.log('Trip to delete:');
    console.log(`  Date: ${tripToDelete.date}`);
    console.log(`  Location: ${tripToDelete.water} - ${tripToDelete.location}`);
    console.log(`  Hours: ${tripToDelete.hours}`);
    console.log(`  Notes: ${tripToDelete.notes || 'no notes'}`);
    
    await firebaseDataService.deleteTrip(tripId, tripToDelete.firebaseDocId);
    console.log(`✅ Successfully deleted trip ${tripId}`);
    console.log('Refresh the page to see changes.');
    
  } catch (error) {
    console.error(`Error deleting trip ${tripId}:`, error);
  }
  
  console.log('=== DELETION FINISHED ===');
};

// Expose to window for easy debugging
(window as any).debugDataStatus = debugDataStatus;
(window as any).forceRefreshData = forceRefreshData;
(window as any).analyzeDuplicateTrips = analyzeDuplicateTrips;
(window as any).deleteSpecificTrip = deleteSpecificTrip;