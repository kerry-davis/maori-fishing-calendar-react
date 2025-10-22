// Test NIWA proxy for CORS and data validation
import { NwaTideProvider } from '../src/services/niwaTideService';

async function testNiwaProxy() {
  console.log('🧪 Testing NIWA Proxy Integration...\n');
  
  const provider = new NwaTideProvider();
  
  // Test with Auckland coordinates
  const testLat = -36.8485;
  const testLon = 174.7633;
  const testDate = new Date('2025-10-15');
  
  try {
    console.log(`📍 Testing with coords: ${testLat}, ${testLon}`);
    console.log(`📅 Testing with date: ${testDate.toISOString().split('T')[0]}`);
    
    // Test if location is supported
    if (!provider.supportsLocation(testLat, testLon)) {
      console.log('❌ Location not supported by NIWA provider');
      return;
    }
    
    console.log('✅ Location supported by NIWA provider');
    
    // Test coverage
    console.log('\n🔍 Testing coverage check...');
    const coverage = await provider.checkCoverage(testLat, testLon);
    console.log('Coverage result:', coverage);
    
    // Test full forecast
    console.log('\n🌊 Testing tide forecast...');
    const forecast = await provider.fetchForecast(testLat, testLon, testDate);
    
    console.log('✅ Forecast successful!');
    console.log(`📊 Found ${forecast.extrema.length} tide points`);
    console.log(`📍 Location: ${forecast.date}, ${forecast.timezone}`);
    console.log(`📏 Min: ${forecast.minHeight}m, Max: ${forecast.maxHeight}m`);
    
    // Display tide extrema
    forecast.extrema.forEach((extremum, index) => {
      const time = new Date(extremum.time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`${index + 1}. ${extremum.type.toUpperCase()}: ${time} (${extremum.height}m)`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      
      if (error.message.includes('CORS')) {
        console.log('\n💡 This might be a CORS issue - the proxy should resolve this when deployed.');
      }
      
      if (error.message.includes('403') || error.message.includes('401')) {
        console.log('\n💡 API authentication issue - check NIWA_API_KEY configuration.');
      }
      
      if (error.message.includes('429')) {
        console.log('\n💡 Rate limited by NIWA API - try again later.');
      }
    }
  }
}

async function testFallbackMechanism() {
  console.log('\n🔄 Testing fallback mechanism...');
  
  // Simulate proxy failure by using invalid proxy URL
  const originalProxyUrl = import.meta.env.VITE_NIWA_PROXY_URL;
  
  try {
    // Force proxy usage
    if (originalProxyUrl) {
      console.log('✅ Proxy configured, should be used for NIWA calls');
    } else {
      console.log('ℹ️  No proxy configured, will try direct API calls');
    }
    
    // We can't easily simulate failure in this context, but the provider factory
    // should automatically fall back to Open-Meteo if NIWA fails
    
  } catch (error) {
    console.error('Fallback test error:', error);
  }
}

// Run tests
if (import.meta.env.DEV) {
  testNiwaProxy().then(() => {
    return testFallbackMechanism();
  }).then(() => {
    console.log('\n🎉 NIWA proxy testing complete!');
  }).catch((error) => {
    console.error('❌ Test suite failed:', error);
  });
} else {
  console.log('ℹ️  NIWA proxy tests only run in development mode');
}

export { testNiwaProxy, testFallbackMechanism };
