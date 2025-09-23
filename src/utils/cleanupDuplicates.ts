import { firebaseDataService } from '../services/firebaseDataService';

export const cleanupDuplicateTrips = async () => {
  console.log('=== CLEANING UP DUPLICATE TRIPS ===');
  
  try {
    if (firebaseDataService.isGuest) {
      console.log('Cannot cleanup - user not logged in');
      return;
    }

    const allTrips = await firebaseDataService.getAllTrips();
    console.log(`Found ${allTrips.length} trips total`);

    // Group trips by date, water, location, and hours to find duplicates
    const tripGroups = new Map();
    
    allTrips.forEach(trip => {
      const key = `${trip.date}-${trip.water}-${trip.location}-${trip.hours}`;
      if (!tripGroups.has(key)) {
        tripGroups.set(key, []);
      }
      tripGroups.get(key).push(trip);
    });

    // Find groups with duplicates
    const duplicateGroups = Array.from(tripGroups.entries()).filter(([key, trips]) => trips.length > 1);
    
    console.log(`Found ${duplicateGroups.length} groups with duplicates`);
    
    for (const [key, trips] of duplicateGroups) {
      console.log(`Group ${key}: ${trips.length} duplicates`);
      console.log('Trip IDs:', trips.map(t => t.id));
      
      // Keep the first trip, mark others for deletion
      const [keepTrip, ...deleteTrips] = trips;
      console.log(`Keeping trip ${keepTrip.id}, will delete:`, deleteTrips.map(t => t.id));
      
      // Delete the duplicates
      for (const trip of deleteTrips) {
        try {
          await firebaseDataService.deleteTrip(trip.id, trip.firebaseDocId);
          console.log(`Deleted duplicate trip ${trip.id}`);
        } catch (error) {
          console.error(`Failed to delete trip ${trip.id}:`, error);
        }
      }
    }
    
    console.log('Cleanup completed!');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
  
  console.log('=== CLEANUP FINISHED ===');
};

// Expose to window for easy access
(window as any).cleanupDuplicateTrips = cleanupDuplicateTrips;