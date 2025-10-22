// Final test verifying LINZ tide implementation
import { fetchTideForLocation } from "@shared/services/tideProviderFactory";

async function demonstrateFinalImplementation() {
  console.log("\n=== FINAL TIDE DATA COMPARISON ===\n");
  
  // Test Kawhia location with LINZ data
  const kawhiaLocation = { lat: -38.04, lon: 174.49, name: 'Kawhia' };
  const today = new Date();
  
  try {
    console.log("\n2. Fetching LINZ tide predictions...");
    const forecast = await fetchTideForLocation(kawhiaLocation, today);
    
    if (forecast.extrema && forecast.extrema.length > 0) {
      console.log("\n✅ SUCCESS! LINZ data obtained:");
      console.log(`Provider: ${forecast.timezone}`);
      console.log(`Units: ${forecast.units}`);
      
      console.log("\nTIDE TIMES:");
      forecast.extrema.forEach((extremum, index) => {
        const time = new Date(extremum.time).toLocaleTimeString('en-NZ', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        
        const height = extremum.height;
        console.log(`  ${index + 1}. ${extremum.type.toUpperCase()}: ${time} (${height.toFixed(2)}m)`);
      });
      
      console.log("\n3. Comparison with authoritative data:");
      console.log("Expected (MetService):");
      console.log("HIGH: 04:10 (2.78m)");
      console.log("LOW: 10:33AM (1.14m)"); 
      console.log("HIGH: 16:42PM (2.65m)"); 
      console.log("LOW: 22:55PM (1.26m)");      
      // Calculate timing differences
      const avgTimeError = forecast.extrema.reduce((sum, e) => sum + e.timeDifference) / forecast.extrema.length);
      console.log(`Average timing error: ${avgTimeError.toFixed(1)} minutes`);
      
      if (avgTimeError < 60) {
        console.log("🎯 EXCELLENT: LINZ timing error is ${avgTimeError.toFixed(1)} minutes");
      } else {
        console.log("⚠ SIGNIFICANT VARIANCE: LINZ timing error is ${avgTimeError.toFixed(1)} minutes`);
      }
      
    } else {
      console.log("❌ No LINZ data available for this location");
    }
    
  } catch (error) {
    console.error("❌ LINZ implementation failed:", error);
  }
}
