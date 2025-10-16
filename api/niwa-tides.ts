// NIWA Tide API Proxy - Handles CORS and forwards requests to NIWA
// Logging: Server-side diagnostics - console outputs visible in Vercel logs

// Server-side logging helpers (always output, no tree-shaking needed on server)
const logRequest = (msg: string) => console.log(`[NIWA-PROXY] ${msg}`);
const logError = (msg: string, err?: any) => {
  if (err) console.error(`[NIWA-PROXY] ❌ ${msg}`, err);
  else console.error(`[NIWA-PROXY] ❌ ${msg}`);
};

export default async function handler(req: any, res: any) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests first
  if (req.method === 'OPTIONS') {
    res.status(200);
    res.end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // If Vercel authentication is applied, forward proper status for public access
  if ((req as any).auth && (req as any).auth.type === 'protected') {
    return res.status(401).json({ error: 'Unauthorized: Vercel protection enabled.' });
  }

  try {
    const NIWA_API_BASE = 'https://api.niwa.co.nz/tides/data';
    const NIWA_API_KEY = process.env.NIWA_API_KEY;

    if (!NIWA_API_KEY) {
      logError('NIWA API key not configured');
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
      }

      if ((value === undefined || value === null || value === '') && paramName !== 'interval') {
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

    logRequest(`Proxying NIWA request to: ${url.toString().replace(NIWA_API_KEY, '***')}`);

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
      logError(`NIWA API error: ${niwaResponse.status} ${niwaResponse.statusText}`);
      logError(`Error details: ${rawBody}`);
      
      // Sanitize error details for client consumption
      const sanitizedErrorDetails = rawBody.length > 500 
        ? rawBody.substring(0, 500) + '...' 
        : rawBody;
      
      return res.status(niwaResponse.status).json({
        error: `NIWA API error: ${niwaResponse.statusText}`,
        status: niwaResponse.status,
        details: sanitizedErrorDetails,
        timestamp: new Date().toISOString()
      });
    }

    if (!rawBody || !rawBody.trim()) {
      logError('NIWA API returned empty response');
      return res.status(502).json({
        error: 'NIWA API returned empty response',
        status: 'empty_response',
        timestamp: new Date().toISOString()
      });
    }

    // Check if response looks like JSON (starts with { or [)
    const trimmedBody = rawBody.trim();
    if (!trimmedBody.startsWith('{') && !trimmedBody.startsWith('[')) {
      logError('NIWA API returned non-JSON response');
      logError(`Raw response (first 200 chars): ${rawBody.substring(0, 200)}`);
      
      // Try to identify common error patterns
      let errorType = 'unknown';
      if (trimmedBody.toLowerCase().includes('html')) {
        errorType = 'html_response';
      } else if (trimmedBody.toLowerCase().includes('error')) {
        errorType = 'plain_text_error';
      } else if (trimmedBody.toLowerCase().includes('unauthorized')) {
        errorType = 'authentication_error';
      }
      
      return res.status(502).json({
        error: 'NIWA API returned unexpected format',
        errorType,
        status: 'invalid_format',
        details: rawBody.length > 200 ? rawBody.substring(0, 200) + '...' : rawBody,
        timestamp: new Date().toISOString()
      });
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (parseError) {
      logError('Failed to parse NIWA JSON response');
      logError(`Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`);
      logError(`Raw response (first 300 chars): ${rawBody.substring(0, 300)}`);
      
      return res.status(502).json({
        error: 'Failed to parse NIWA API response',
        status: 'parse_error',
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        details: rawBody.length > 300 ? rawBody.substring(0, 300) + '...' : rawBody,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate that the parsed data has expected structure
    if (!data || typeof data !== 'object') {
      logError('NIWA API returned invalid JSON structure');
      return res.status(502).json({
        error: 'NIWA API returned invalid JSON structure',
        status: 'invalid_structure',
        timestamp: new Date().toISOString()
      });
    }

    if (!data.values || !Array.isArray(data.values)) {
      logError('NIWA API response missing values array');
      logError(`Response structure: ${JSON.stringify(Object.keys(data))}`);
      return res.status(502).json({
        error: 'NIWA API response missing tide values',
        status: 'missing_values',
        responseKeys: Object.keys(data),
        timestamp: new Date().toISOString()
      });
    }

    logRequest(`NIWA response successful: ${data.values?.length || 0} tide points`);
    
    // Forward NIWA response with safety metadata
    const safeResponse = {
      ...data,
      _proxyMetadata: {
        timestamp: new Date().toISOString(),
        dataPoints: data.values.length,
        source: 'niwa-api-proxy'
      }
    };
    
    return res.status(200).json(safeResponse);

  } catch (error) {
    logError('Proxy error', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
