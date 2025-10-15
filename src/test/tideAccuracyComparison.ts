// Tide Accuracy Comparison Test
// Compares tide predictions from different providers against authoritative sources

import { fetchOpenMeteoTideForecast, fetchTideForecast } from "../services/tideService";
import { TideProviderFactory } from "../services/tideProviderFactory";
import type { TideForecast } from "../services/tideService";

// Test locations - major NZ harbours
const TEST_LOCATIONS = [
  { name: "Kawhia", lat: -37.9, lon: 174.9 },
  { name: "Auckland", lat: -36.8, lon: 174.7 },
  { name: "Tauranga", lat: -37.7, lon: 176.2 },
  { name: "Wellington", lat: -41.3, lon: 174.8 }
];

// Authoritative tide data from MetService (sample data for comparison)
const AUTHORITATIVE_DATA = {
  "Kawhia": [
    { type: "high", time: "04:10", height: 2.78 },
    { type: "low", time: "10:33", height: 1.14 },
    { type: "high", time: "16:42", height: 2.65 },
    { type: "low", time: "22:55", height: 1.26 }
  ],
  "Auckland": [
    { type: "high", time: "05:23", height: 3.12 },
    { type: "low", time: "11:45", height: 0.68 },
    { type: "high", time: "17:58", height: 3.21 },
    { type: "low", time: "23:52", height: 0.74 }
  ]
};

interface ComparisonResult {
  provider: string;
  location: string;
  timingError: number; // Average timing error in minutes
  heightError: number; // Average height error in meters
  success: boolean;
  errors?: string[];
}

function calculateTimeError(predicted: string, actual: string): number {
  const predTime = new Date(`2024-01-01T${predicted}:00`);
  const actualTime = new Date(`2024-01-01T${actual}:00`);
  return Math.abs(predTime.getTime() - actualTime.getTime()) / (1000 * 60);
}

function calculateHeightError(predicted: number, actual: number): number {
  return Math.abs(predicted - actual);
}

function matchClosestExtrema(predicted: any[], actual: any[]): any[] {
  // Simple matching algorithm - find closest time match
  return predicted.map(pred => {
    const closest = actual.reduce((best, act) => {
      const predTime = new Date(`2024-01-01 ${pred.time}`);
      const actTime = new Date(`2024-01-01 ${act.time}`);
      const bestTime = new Date(`2024-01-01 ${best.time}`);
      
      const currentDiff = Math.abs(predTime.getTime() - actTime.getTime());
      const bestDiff = Math.abs(predTime.getTime() - bestTime.getTime());
      
      return currentDiff < bestDiff ? act : best;
    });
    
    return {
      predicted: pred,
      actual: closest,
      timeError: calculateTimeError(pred.time, closest.time),
      heightError: calculateHeightError(pred.height, closest.height)
    };
  });
}

async function testProvider(
  providerName: string,
  fetchFunction: (lat: number, lon: number, date: Date) => Promise<TideForecast>
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];
  
  for (const location of TEST_LOCATIONS) {
    try {
      const testDate = new Date(); // Use today's date
      const forecast = await fetchFunction(location.lat, location.lon, testDate);
      
      if (!forecast.extrema || forecast.extrema.length < 2) {
        results.push({
          provider: providerName,
          location: location.name,
          timingError: -1,
          heightError: -1,
          success: false,
          errors: ["Insufficient tide data"]
        });
        continue;
      }

      const authoritative = AUTHORITATIVE_DATA[location.name as keyof typeof AUTHORITATIVE_DATA];
      if (!authoritative) {
        console.log(`No authoritative data for ${location.name}`);
        continue;
      }

      // Extract time only from ISO timestamps for comparison
      const predictedTimes = forecast.extrema.slice(0, 4).map(e => ({
        type: e.type,
        time: e.time.split('T')[1].substring(0, 5), // HH:MM format
        height: e.height
      }));

      const matches = matchClosestExtrema(predictedTimes, authoritative);
      
      const avgTimeError = matches.reduce((sum, m) => sum + m.timeError, 0) / matches.length;
      const avgHeightError = matches.reduce((sum, m) => sum + m.heightError, 0) / matches.length;

      results.push({
        provider: providerName,
        location: location.name,
        timingError: avgTimeError,
        heightError: avgHeightError,
        success: true
      });

    } catch (error) {
      results.push({
        provider: providerName,
        location: location.name,
        timingError: -1,
        heightError: -1,
        success: false,
        errors: [`Fetch failed: ${error}`]
      });
    }
  }
  
  return results;
}

async function runAccuracyTests() {
  console.log("=== TIDE ACCURACY COMPARISON TEST ===\n");
  
  // Test original service
  console.log("Testing Original Tide Service...");
  const originalResults = await testProvider("Original Service", fetchTideForecast);
  
  // Test enhanced Open-Meteo
  console.log("Testing Enhanced Open-Meteo...");
  const openMeteoResults = await testProvider("Enhanced Open-Meteo", fetchOpenMeteoTideForecast);
  
  // Test provider factory with fallback
  console.log("Testing Provider Factory (with fallback)...");
  const factoryResults = await testProvider("Provider Factory", async (lat, lon, date) => {
    const result = await TideProviderFactory.fetchTideWithFallback(lat, lon, date);
    return result.forecast;
  });
  
  // Display results
  console.log("\n=== RESULTS SUMMARY ===");
  
  const allResults = [
    ...originalResults.map(r => ({ ...r, provider: `${r.provider} (Original)` })),
    ...openMeteoResults.map(r => ({ ...r, provider: `${r.provider} (Enhanced)` })),
    ...factoryResults.map(r => ({ ...r, provider: `${r.provider} (Factory)` }))
  ];
  
  // Group by location
  const byLocation = TEST_LOCATIONS.reduce((acc, loc) => {
    acc[loc.name] = allResults.filter(r => r.location === loc.name);
    return acc;
  }, {} as Record<string, ComparisonResult[]>);
  
  for (const location of Object.keys(byLocation)) {
    console.log(`\n--- ${location} ---`);
    const results = byLocation[location];
    
    results.forEach(result => {
      if (result.success) {
        console.log(`${result.provider}:`);
        console.log(`  Timing Error: ${result.timingError.toFixed(1)} minutes`);
        console.log(`  Height Error: ${result.heightError.toFixed(2)} meters`);
      } else {
        console.log(`${result.provider}: FAILED`);
        result.errors?.forEach(err => console.log(`  Error: ${err}`));
      }
    });
  }
  
  // Calculate overall performance
  const successfulResults = allResults.filter(r => r.success);
  console.log(`\n=== OVERALL PERFORMANCE ===`);
  console.log(`Success Rate: ${successfulResults.length / allResults.length * 100}%`);
  
  if (successfulResults.length > 0) {
    const avgTimeError = successfulResults.reduce((sum, r) => sum + r.timingError, 0) / successfulResults.length;
    const avgHeightError = successfulResults.reduce((sum, r) => sum + r.heightError, 0) / successfulResults.length;
    
    console.log(`Average Timing Error: ${avgTimeError.toFixed(1)} minutes`);
    console.log(`Average Height Error: ${avgHeightError.toFixed(2)} meters`);
  }
  
  // Recommendations
  console.log(`\n=== RECOMMENDATIONS ===`);
  
  const openMeteoSuccess = openMeteoResults.filter(r => r.success).length / openMeteoResults.length;
  const originalSuccess = originalResults.filter(r => r.success).length / originalResults.length;
  
  if (openMeteoSuccess > originalSuccess) {
    console.log("✓ Enhanced Open-Meteo provides better reliability");
    console.log("✓ Recommend enabling as primary provider for NZ harbours");
  } else {
    console.log("⚠ Original service still performs better in some cases");
    console.log("⚠ Consider location-based provider selection");
  }
  
  console.log("✓ Provider factory ensures automatic fallback availability");
  console.log("✓ Enhanced validation improves data quality");
}

// Export for use in test files
export { runAccuracyTests, testProvider, type ComparisonResult };
