// NIWA Tide API Proxy - Cloudflare Pages Function
// Handles CORS and forwards requests to NIWA
// Logging: Server-side diagnostics - console outputs visible in Cloudflare logs

// Server-side logging helpers
const logRequest = (msg: string) => console.log(`[NIWA-PROXY] ${msg}`);
const logError = (msg: string, err?: any) => {
  if (err) console.error(`[NIWA-PROXY] ❌ ${msg}`, err);
  else console.error(`[NIWA-PROXY] ❌ ${msg}`);
};

// Environment interface for Cloudflare Pages Functions
interface Env {
  NIWA_API_KEY: string;
}

export async function onRequest({ request, env }: { request: Request; env: Env }) {

  // Create response with CORS headers
  const createResponse = (status: number, data: any) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  };

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Allow': 'GET, OPTIONS'
      }
    });
  }

  try {
    const NIWA_API_BASE = 'https://api.niwa.co.nz/tides/data';

    // Parse query parameters from request URL
    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);

    // Build the NIWA URL with query parameters
    const niwaUrl = new URL(NIWA_API_BASE);
    
    // Forward query parameters to NIWA with proper parameter mapping
    for (const [key, value] of params.entries()) {
      // Handle parameter mapping for NIWA API
      let paramName = key;
      if (key === 'lng') {
        paramName = 'long'; // NIWA expects 'long' not 'lng'
      }

      if ((value === undefined || value === null || value === '') && paramName !== 'interval') {
        continue;
      }

      niwaUrl.searchParams.set(paramName, value);
    }
    
    // Add API key to parameters (override if provided)
    if (!env.NIWA_API_KEY) {
      logError('NIWA_API_KEY environment variable not configured');
      return createResponse(500, {
        error: 'API configuration error',
        message: 'NIWA API key not configured'
      });
    }
    niwaUrl.searchParams.set('apikey', env.NIWA_API_KEY);

    logRequest(`Proxying NIWA request to: ${niwaUrl.toString().replace(env.NIWA_API_KEY, '***')}`);

    // Make request to NIWA API (send API key in header as well for compatibility)
    const niwaResponse = await fetch(niwaUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Maori-Fishing-Calendar-Proxy/1.0',
        'x-apikey': env.NIWA_API_KEY
      }
    });

    const rawBody = await niwaResponse.text();

    if (!niwaResponse.ok) {
      logError(`NIWA API error: ${niwaResponse.status} ${niwaResponse.statusText}`);
      logError(`Error details: ${rawBody}`);

      const sanitizedErrorDetails = rawBody.length > 500
        ? rawBody.substring(0, 500) + '...'
        : rawBody;

      const trimmed = rawBody.trim();
      const lower = trimmed.toLowerCase();

      // Special-case authentication errors to preserve numeric status in payload
      if (niwaResponse.status === 401 || lower.includes('unauthorized')) {
        return createResponse(niwaResponse.status, {
          error: `NIWA API error: ${niwaResponse.statusText}`,
          status: niwaResponse.status,
          errorType: 'authentication_error',
          details: sanitizedErrorDetails,
          timestamp: new Date().toISOString()
        });
      }

      // Non-JSON error bodies: classify and return invalid_format status string
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        let errorType: string = 'unknown';
        if (lower.includes('html')) errorType = 'html_response';
        else if (lower.includes('error')) errorType = 'plain_text_error';

        return createResponse(niwaResponse.status, {
          error: `NIWA API error: ${niwaResponse.statusText}`,
          status: 'invalid_format',
          errorType,
          details: sanitizedErrorDetails,
          timestamp: new Date().toISOString()
        });
      }

      // Default: non-OK JSON body, keep numeric status field
      return createResponse(niwaResponse.status, {
        error: `NIWA API error: ${niwaResponse.statusText}`,
        status: niwaResponse.status,
        details: sanitizedErrorDetails,
        timestamp: new Date().toISOString()
      });
    }

    if (!rawBody || !rawBody.trim()) {
      logError('NIWA API returned empty response');
      return createResponse(502, {
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
      
      return createResponse(502, {
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
    } catch (parseError: unknown) {
      logError('Failed to parse NIWA JSON response');
      const errorMessage = parseError instanceof Error
        ? parseError.message
        : 'Unknown parsing error';
      logError(`Parse error: ${errorMessage}`);
      logError(`Raw response (first 300 chars): ${rawBody.substring(0, 300)}`);

      return createResponse(502, {
        error: 'Failed to parse NIWA API response',
        status: 'parse_error',
        parseError: errorMessage,
        details: rawBody.length > 300 ? rawBody.substring(0, 300) + '...' : rawBody,
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate that the parsed data has expected structure
    if (!data || typeof data !== 'object') {
      logError('NIWA API returned invalid JSON structure');
      return createResponse(502, {
        error: 'NIWA API returned invalid JSON structure',
        status: 'invalid_structure',
        timestamp: new Date().toISOString()
      });
    }

    if (!data.values || !Array.isArray(data.values)) {
      logError('NIWA API response missing values array');
      logError(`Response structure: ${JSON.stringify(Object.keys(data))}`);
      return createResponse(502, {
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
    
    return createResponse(200, safeResponse);

  } catch (error) {
    logError('Proxy error', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
