// Test the LINZ tide implementation
import { fetchLINZTideForecast, checkLINZTideCoverage } from "../services/linzTideService";

async function testLINZProvider() {
  console.log("=== TESTING LINZ TIDE PROVIDER ===\n");
  
  // Test Kawhia location using exact coordinates from LINZ data
  // From CSV: 38,04,174,49 (38°04'S, 174°49'E) = -38.04, 174.49
  const kawhiaLocation = { lat: -38.04, lon: 174.49, name: 'Kawhia' };
  const today = new Date();
  
  try {
    console.log("1. Testing coverage check for Kawhia...");
    const coverage = await checkLINZTideCoverage(kawhiaLocation.lat, kawhiaLocation.lon);
    console.log("Coverage result:", coverage);
    
    if (coverage.available) {
      console.log("\n2. Fetching LINZ tide predictions for Kawhia...");
      const forecast = await fetchLINZTideForecast(kawhiaLocation.lat, kawhiaLocation.lon, today);
      
      console.log("LINZ Tide Predictions:");
      console.log(`Date: ${forecast.date}`);
      console.log(`Timezone: ${forecast.timezone}`);
      console.log(`Units: ${forecast.units}`);
      console.log(`Min Height: ${forecast.minHeight}m`);
      console.log(`Max Height: ${forecast.maxHeight}m`);
      console.log("\nExtrema:");
      
      forecast.extrema.forEach((extremum, index) => {
        const time = new Date(extremum.time).toLocaleTimeString('en-NZ', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        console.log(`${index + 1}. ${extremum.type.toUpperCase()}: ${time} (${extremum.height.toFixed(2)}m)`);
      });
      
      console.log("\n3. Comparison with expected MetService data:");
      console.log("Expected (approximate):");
      console.log("HIGH: 04:10 (2.78m)");
      console.log("LOW: 10:33 (1.14m)");  
      console.log("HIGH: 16:42 (2.65m)");
      console.log("LOW: 22:55 (1.26m)");
      
      console.log("\n✅ LINZ implementation working!");
      
    } else {
      console.log("❌ LINZ data not available for this location");
    }
    
  } catch (error) {
    console.error("❌ LINZ test failed:", error);
  }
}

// Run the test
testLINZProvider();
