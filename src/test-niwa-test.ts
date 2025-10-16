// Simple NIWA tide test
const NIWA_API_URL = 'https://api.niwa.co.nz/tides/data';
const NIWA_API_KEY = process.env.NIWA_API_KEY || 'demo';

export async function testNwaTideAPI() {
  if (!NIWA_API_KEY) {
    console.log('❌ No NIWA API key. Please add VITE_NIWA_API_KEY to .env');
    return null;
  }

  console.log('Testing NIWA API with key:', NIWA_API_KEY.substring(0, 8) + '******');

  const url = new URL(NIWA_API_URL);
  url.searchParams.set('lat', '-38.9994');
  url.searchParams.set('long', '174.8183');
  url.searchParams.set('datum', 'LAT');
  url.searchParams.set('numberOfDays', '1');
  url.searchParams.set('apikey', NIWA_API_KEY);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log('❌ NIWA API error:', response.status);
      return null;
    }

    const data = await response.json();
    
    console.log('✅ NIWA Response:', data);
    return data;
  } catch (error) {
    console.log('❌ NIWA error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
