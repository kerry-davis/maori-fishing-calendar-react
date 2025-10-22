// Test current tide data for Kawhia compared to authoritative sources
import { fetchTideForLocation } from '@shared/services/tideService';

// Kawhia coordinates approx
const KAWHIA_LOCATION = {
  lat: -37.9,
  lon: 174.9,
  name: 'Kawhia'
};

async function compareTideData() {
  console.log('=== Current vs Authoritative Tide Data Comparison ===');
  
  try {
    // Get today's tide data from our service
    const today = new Date();
    const ourData = await fetchTideForLocation(KAWHIA_LOCATION, today);
    
    console.log('Today:', today.toISOString().split('T')[0]);
    console.log('Our tide service output:');
    console.log('Provider:', ourData.timezone);
    console.log('Units:', ourData.units);
    console.log('Extrema:', ourData.extrema.map(e => ({
      type: e.type,
      time: e.time,
      height: e.height
    })));
    
    // Authoritative data from MetService (example from web search)
    console.log('\nAuthoritative data (Tides.Today source):');
    console.log('High: 11:40 AM (3.15m)');
    console.log('Low: 5:27 PM (0.68m)');
    
    // Calculate discrepancies
    console.log('\n=== Analysis ===');
    for (const extremum of ourData.extrema) {
      console.log(`${extremum.type}: ${extremum.time} (${extremum.height.toFixed(2)} ${ourData.units})`);
    }
    
  } catch (error) {
    console.error('Error fetching tide data:', error);
  }
}

// Run the comparison
compareTideData();
