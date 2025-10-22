// Demo to show the tide data discrepancy issue
import { fetchTideForLocation } from "@shared/services/tideProviderFactory";

async function demonstrateIssue() {
  console.log("=== TIDE DATA ACCURACY DEMONSTRATION ===\n");
  
  // Test Kawhia location
  const kawhiaLocation = {
    lat: -37.9,
    lon: 174.9,
    name: 'Kawhia'
  };
  
  const today = new Date();
  
  try {
    const forecast = await fetchTideForLocation(kawhiaLocation, today);
    
    console.log("OUR APP'S TIDE PREDICTIONS:");
    console.log(`Date: ${forecast.date}`);
    console.log(`Provider: ${forecast.timezone}`);
    console.log(`Units: ${forecast.units}`);
    
    forecast.extrema.forEach((extremum, index) => {
      const time = new Date(extremum.time).toLocaleTimeString('en-NZ', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      console.log(`${index + 1}. ${extremum.type.toUpperCase()}: ${time} (${extremum.height.toFixed(2)}m)`);
    });
    
    console.log("\nAUTHORITATIVE METSERVICE DATA (approximate):");
    console.log("HIGH: 04:10 (2.78m)");
    console.log("LOW: 10:33 (1.14m)");
    console.log("HIGH: 16:42 (2.65m)");
    console.log("LOW: 22:55 (1.26m)");
    
    console.log("\n=== ISSUE IDENTIFIED ===");
    console.log("If our times don't match MetService, that's the discrepancy!");
    console.log("Open-Meteo may not have accurate NZ harbour predictions.");
    
  } catch (error) {
    console.error("Failed to get tide data:", error);
  }
}

// Run this demo
demonstrateIssue();
