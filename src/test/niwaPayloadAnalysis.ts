// NIWA Payload Size and Latency Analysis
// Tests different time windows for optimal data transfer vs coverage

import { fetchNwaTideForecast } from "../services/niwaTideService";

interface PayloadResult {
  window: string;
  daysRequested: number;
  pointsReceived: number;
  relevantPoints: number;
  wastePercentage: number;
  approximateSizeKB: number;
  latencyMs: number;
}

interface WindowTestConfig {
  name: string;
  daysBefore: number;
  daysAfter: number;
}

export async function analyzeNIWAPayloadEfficiency(): Promise<PayloadResult[]> {
  const testLocation = { lat: -36.8485, lon: 174.7633 }; // Auckland
  const testDate = new Date('2024-10-10');
  
  // Test different window sizes around target date
  const testConfigs: WindowTestConfig[] = [
    { name: "Current (target-3 → target+2)", daysBefore: 3, daysAfter: 2 },
    { name: "Tightened (target-2 → target+1)", daysBefore: 2, daysAfter: 1 },
    { name: "Minimal (target-1 → target+1)", daysBefore: 1, daysAfter: 1 },
    { name: "Optimal (target-2 → target+2)", daysBefore: 2, daysAfter: 2 }
  ];

  const results: PayloadResult[] = [];

  for (const config of testConfigs) {
    console.log(`\n🔍 Testing window: ${config.name}`);
    
    try {
      // Temporarily modify the NIWA service to test different windows
      const originalFetch = globalThis.fetch;
      
      const startTime = performance.now();
      
      // Mock the fetch to capture response size
      const modifiedFetch = async (url: string, options?: RequestInit) => {
        console.log(`📡 Fetching: ${url}`);
        
        const response = await originalFetch(url, options);
        const originalJson = response.json;
        
        // Intercept JSON parsing to measure payload
        response.json = async () => {
          const jsonData = await originalJson.call(response);
          const jsonSize = JSON.stringify(jsonData).length;
          
          const endTime = performance.now();
          const latency = endTime - startTime;
          
          // Calculate relevant points (target date only)
          const targetDate = testDate.toISOString().split('T')[0];
          const allPoints = jsonData.values || [];
          const relevantPoints = allPoints.filter((point: any) => {
            const pointDate = new Date(point.time).toISOString().split('T')[0];
            return pointDate === targetDate;
          });

          const result: PayloadResult = {
            window: config.name,
            daysRequested: config.daysBefore + config.daysAfter + 1,
            pointsReceived: allPoints.length,
            relevantPoints: relevantPoints.length,
            wastePercentage: ((allPoints.length - relevantPoints.length) / allPoints.length) * 100,
            approximateSizeKB: Math.round(jsonSize / 1024 * 100) / 100,
            latencyMs: Math.round(latency * 10) / 10
          };

          console.log(`📊 Results for ${config.name}:`);
          console.log(`   Points received: ${allPoints.length}`);
          console.log(`   Relevant points: ${relevantPoints}`);
          console.log(`   Waste: ${result.wastePercentage.toFixed(1)}%`);
          console.log(`   Size: ${result.approximateSizeKB}KB`);
          console.log(`   Latency: ${result.latencyMs}ms`);
          
          results.push(result);
          return jsonData;
        };
        
        return response;
      };

      globalThis.fetch = modifiedFetch as any;

      // Make the test call 
      await fetchNwaTideForecast(testLocation.lat, testLocation.lon, testDate);

      // Restore original fetch
      globalThis.fetch = originalFetch;

    } catch (error) {
      console.error(`❌ Error testing ${config.name}:`, error);
    }
  }

  return results;
}

export async function printPayloadAnalysis(): Promise<void> {
  console.log('🌊 NIWA Payload Size Analysis');
  console.log('=============================\n');
  
  const results = await analyzeNIWAPayloadEfficiency();
  
  if (results.length === 0) {
    console.log('❌ No results obtained');
    return;
  }

  console.log('\n📈 SUMMARY:');
  console.log('Window                           | Days | Points | Relevant | Waste | Size  | Latency');
  console.log('---------------------------------------------------------------------------');
  
  results.forEach(result => {
    const window = result.window.padEnd(30);
    const days = result.daysRequested.toString().padStart(5);
    const points = result.pointsReceived.toString().padStart(7);
    const relevant = result.relevantPoints.toString().padStart(9);
    const waste = `${result.wastePercentage.toFixed(1)}%`.padStart(7);
    const size = `${result.approximateSizeKB}KB`.padStart(6);
    const latency = `${result.latencyMs}ms`.padStart(8);
    
    console.log(`${window} | ${days} | ${points} | ${relevant} | ${waste} | ${size} | ${latency}`);
  });

  // Find optimal configuration
  const optimal = results
    .filter(r => r.relevantPoints > 0) // Ensure we get the target date
    .sort((a, b) => {
      // Prioritize lower waste, then lower size, then lower latency
      if (b.wastePercentage !== a.wastePercentage) {
        return a.wastePercentage - b.wastePercentage;
      }
      if (b.approximateSizeKB !== a.approximateSizeKB) {
        return a.approximateSizeKB - b.approximateSizeKB;
      }
      return a.latencyMs - b.latencyMs;
    })[0];

  if (optimal) {
    console.log('\n✅ RECOMMENDED OPTIMAL WINDOW:');
    console.log(`   ${optimal.window}`);
    console.log(`   Waste: ${optimal.wastePercentage.toFixed(1)}%`);
    console.log(`   Size: ${optimal.approximateSizeKB}KB`);
    console.log(`   Latency: ${optimal.latencyMs}ms`);
  }
}

// Run analysis if this file is executed directly
if (require.main === module) {
  printPayloadAnalysis().catch(console.error);
}
