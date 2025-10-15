// NIWA Tide API Proxy - Handles CORS and forwards requests to NIWA
export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // If Vercel authentication is applied, forward proper status for public access
  if ((req as any).auth && (req as any).auth.type === 'protected') {
    return res.status(401).json({ error: 'Unauthorized: Vercel protection enabled.' });
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const NIWA_API_BASE = 'https://api.niwa.co.nz/tides/data';
    const NIWA_API_KEY = process.env.NIWA_API_KEY;

    if (!NIWA_API_KEY) {
      console.error('❌ NIWA API key not configured');
      return res.status(500).json({ error: 'NIWA API key not configured' });
    }

    // Build the NIWA URL with query parameters
    const url = new URL(NIWA_API_BASE);
    
    // Forward query parameters to NIWA with proper parameter mapping
    Object.keys(req.query).forEach(key => {
      const value = req.query[key];
      
      // Handle parameter mapping for NIWA API
      let paramName = key;
      if (key === 'lng') {
        paramName = 'long'; // NIWA expects 'long' not 'lng'
      } else if (key === 'numberOfDays') {
        paramName = 'days'; // NIWA expects 'days' not 'numberOfDays'
      }
      
      // Skip unsupported parameters that NIWA doesn't accept
      if (key === 'startDate' || key === 'endDate' || key === 'numberOfDays' && !value) {
        return;
      }
      
      if (typeof value === 'string') {
        url.searchParams.set(paramName, value);
      } else if (Array.isArray(value)) {
        url.searchParams.set(paramName, value.join(','));
      }
    });
    
    // Add API key to parameters (override if provided)
    url.searchParams.set('apikey', NIWA_API_KEY);

    console.log(`🌊 Proxying NIWA request to: ${url.toString().replace(NIWA_API_KEY, '***')}`);

    // Make request to NIWA API
    const niwaResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Maori-Fishing-Calendar-Proxy/1.0'
      }
    });

    const rawBody = await niwaResponse.text();

    if (!niwaResponse.ok) {
      console.error(`❌ NIWA API error: ${niwaResponse.status} ${niwaResponse.statusText}`);
      console.error(`Error details: ${rawBody}`);
      
      return res.status(niwaResponse.status).json({
        error: `NIWA API error: ${niwaResponse.statusText}`,
        status: niwaResponse.status,
        details: rawBody
      });
    }

    if (!rawBody || !rawBody.trim().startsWith('{')) {
      console.error('❌ NIWA API returned non-JSON response');
      console.error(`Raw response: ${rawBody}`);
      return res.status(502).json({
        error: 'NIWA API returned unexpected format',
        details: rawBody
      });
    }

    const data = JSON.parse(rawBody);
    
    console.log(`✅ NIWA response successful: ${data.values?.length || 0} tide points`);
    
    // Forward NIWA response
    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ Proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
