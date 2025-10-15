// Simple NIWA test
const NIWA_API_BASE = "https://api.niwa.co.nz/tides/data";
const NIWA_API_KEY = process.env.NIWA_API_KEY || 'demo';

async function testNwaTideAPI() {
  if (!NIWA_API_KEY) {
    console.log('❌ No NIWA API key found. Please add VITE_NIWA_API_KEY to .env');
    return null;
  }

  console.log('Testing NIWA API with key:', NIWA_API_KEY.substring(0, 8) + '******');

  try {
    const url = new URL(`${NIWA_API_BASE}`);
    console.log('Request URL:', url.toString());

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Test'
      }
    });

    if (!response.ok) {
      console.log('❌ NIWA API error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('✅ NIWA API response:', data);

    // Check if we have tide data
    if (data.values && data.values.length > 0) {
      const now = new Date();
      const targetDate = now.toISOString().split('T')[0];
      const targetDateTides = data.values.filter(point => point.time.startsWith(targetDate));
      
      console.log('Target date:', targetDate);
      const targetDateValues = data.values.filter(point => point.time.startsWith(targetDate));
      console.log('Target date tide points:', targetDateTides.slice(0, Math.min(targetDateTides.length, 10));
      
      return targetDateTides.length > 0;
    }

    return null;
  } catch (error) {
    console.log('❌ NIWA API error:', error);
    return null;
  }
}

// Simulate fetchTideForLocation
export async function testTideIntegration() {
  const testLocation = {
    lat: -38.9994; // Kawhia area
    lon: 174.8183;
  };

  const result = await testNwaTideAPI();
  
  if (result) {
    console.log('✅ NIWA Response:', result);
    return result;
  } else {
    console.log('❌ NIWA test failed');
  }
}

export async function main() {
  await testTideIntegration();
  
  // Compare with MetService reference
  const metServiceData = {
    HIGH: "05:30 (2.9m)",
    LOW: "11:22 (1.3m)",
    HIGH: "18:09 (3.0m)"
  };

  console.log('\n=== REFERENCE: MetService Kawhia TODAY');
  console.log('HIGH:', metServiceData.HIGH);
  console.log('LOW:', metServiceData.LOW);
  console.log('HIGH:', metServiceData.HIGH);
  console.log('===');
  
  if (result) {
    console.log('✅ NIWA SUCCESS! Using data from NIWA API');
    return result;
  } else {
    console.log('❌ NIWA API failed');
  }
}
}
