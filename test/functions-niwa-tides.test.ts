import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onRequest } from '../functions/api/niwa-tides';

// Mock environment interface for testing
const mockEnv = {
  NIWA_API_KEY: 'test-api-key'
};

// Helper function to create mock Request objects
function createMockRequest(
  method: string = 'GET',
  url: string = 'https://example.com/api/niwa-tides',
  queryParams: Record<string, string> = {}
): Request {
  const urlObj = new URL(url);

  // Add query parameters
  Object.entries(queryParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  return new Request(urlObj.toString(), { method });
}

// Helper function to create mock fetch responses
function createMockFetchResponse(
  body: string,
  options: {
    status?: number;
    statusText?: string;
    ok?: boolean;
  } = {}
) {
  const { status = 200, statusText = 'OK', ok = true } = options;

  return {
    ok,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(body)
  };
}

describe('Cloudflare Pages Function: NIWA Tides API Proxy', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('OPTIONS Preflight Requests', () => {
    it('handles OPTIONS preflight with correct CORS headers', async () => {
      const request = createMockRequest('OPTIONS');
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(''));

      const response = await onRequest({ request, env: mockEnv });

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });
  });

  describe('GET Requests with Parameter Mapping', () => {
    it('successfully maps lng parameter to long for NIWA API', async () => {
      let capturedUrl = '';

      global.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve(createMockFetchResponse(JSON.stringify({
          values: [
            { time: '2024-10-19T00:00:00Z', value: 1.2 }
          ]
        })));
      });

      const request = createMockRequest('GET', 'https://example.com/api/niwa-tides', {
        lat: '-36.8485',
        lng: '174.7633',
        numberOfDays: '1'
      });

      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(capturedUrl).toContain('long=174.7633'); // lng should be mapped to long
      expect(capturedUrl).toContain('lat=-36.8485');
      expect(capturedUrl).toContain('numberOfDays=1');
      expect(capturedUrl).toContain('apikey=test-api-key');

      expect(response.status).toBe(200);
      expect(result.values).toHaveLength(1);
      expect(result._proxyMetadata).toBeDefined();
      expect(result._proxyMetadata.dataPoints).toBe(1);
    });

    it('includes CORS headers in successful GET response', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(JSON.stringify({
        values: []
      })));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Missing NIWA_API_KEY Handling', () => {
    it('returns 500 error when NIWA_API_KEY is missing', async () => {
      const envWithoutKey = { NIWA_API_KEY: '' };
      const request = createMockRequest('GET');

      // Mock fetch to ensure it's not called
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(''));

      const response = await onRequest({ request, env: envWithoutKey });
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe('API configuration error');
      expect(result.message).toBe('NIWA API key not configured');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns 500 error when NIWA_API_KEY is undefined', async () => {
      const envWithoutKey = {} as any;
      const request = createMockRequest('GET');

      const response = await onRequest({ request, env: envWithoutKey });
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe('API configuration error');
      expect(result.message).toBe('NIWA API key not configured');
    });
  });

  describe('Non-JSON Response Handling', () => {
    it('handles HTML error responses from NIWA API', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        '<html><body>Server Error</body></html>',
        { status: 500, statusText: 'Internal Server Error', ok: false }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe('NIWA API error: Internal Server Error');
      expect(result.errorType).toBe('html_response');
      expect(result.status).toBe('invalid_format');
      expect(result.details).toContain('Server Error');
    });

    it('handles plain text error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        'Internal server error occurred',
        { status: 500, ok: false }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.errorType).toBe('plain_text_error');
      expect(result.details).toContain('Internal server error');
    });

    it('handles empty responses from NIWA API', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        '',
        { status: 200, ok: true }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(502);
      expect(result.error).toBe('NIWA API returned empty response');
      expect(result.status).toBe('empty_response');
    });
  });

  describe('Error Response Handling', () => {
    it('handles NIWA API errors with proper error propagation', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        'Unauthorized access',
        { status: 401, statusText: 'Unauthorized', ok: false }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe('NIWA API error: Unauthorized');
      expect(result.status).toBe(401);
      expect(result.details).toBe('Unauthorized access');
    });

    it('sanitizes long error details to prevent response bloat', async () => {
      const longError = 'A'.repeat(1000) + ' Critical error details';
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        longError,
        { status: 500, ok: false }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.details.length).toBeLessThanOrEqual(503); // Limited for safety
      expect(result.details).toContain('...');
    });
  });

  describe('JSON Parsing and Validation', () => {
    it('handles malformed JSON responses', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        '{"values": [{"time": "2024-10-19T00:00", "value": 1.2, invalid_json}',
        { status: 200, ok: true }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(502);
      expect(result.error).toBe('Failed to parse NIWA API response');
      expect(result.status).toBe('parse_error');
      expect(result.parseError).toBeDefined();
    });

    it('validates response structure for missing values array', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        '{"metadata": "test", "other": "data"}',
        { status: 200, ok: true }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(502);
      expect(result.error).toBe('NIWA API response missing tide values');
      expect(result.status).toBe('missing_values');
      expect(result.responseKeys).toContain('metadata');
    });

    it('handles responses with empty values array', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        '{"values": []}',
        { status: 200, ok: true }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.values).toEqual([]);
      expect(result._proxyMetadata.dataPoints).toBe(0);
    });
  });

  describe('HTTP Method Validation', () => {
    it('returns 405 for non-GET methods', async () => {
      const request = createMockRequest('POST');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(405);
      expect(result.error).toBe('Method not allowed');
      expect(response.headers.get('Allow')).toBe('GET, OPTIONS');
    });

    it('rejects PUT requests', async () => {
      const request = createMockRequest('PUT');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(405);
      expect(result.error).toBe('Method not allowed');
    });

    it('rejects DELETE requests', async () => {
      const request = createMockRequest('DELETE');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(405);
      expect(result.error).toBe('Method not allowed');
    });
  });

  describe('Successful Response Metadata', () => {
    it('adds proxy metadata to successful responses', async () => {
      const mockTideData = {
        values: [
          { time: '2024-10-19T00:00:00Z', value: 1.2 },
          { time: '2024-10-19T01:00:00Z', value: 1.5 }
        ],
        timezone: 'Pacific/Auckland'
      };

      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        JSON.stringify(mockTideData)
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result._proxyMetadata).toBeDefined();
      expect(result._proxyMetadata.source).toBe('niwa-api-proxy');
      expect(result._proxyMetadata.dataPoints).toBe(2);
      expect(result._proxyMetadata.timestamp).toBeDefined();
      expect(result.values).toEqual(mockTideData.values);
    });
  });

  describe('CORS Headers Validation', () => {
    it('includes CORS headers in all responses', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        JSON.stringify({ values: [] })
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('includes CORS headers in error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue(createMockFetchResponse(
        'Server Error',
        { status: 500, ok: false }
      ));

      const request = createMockRequest('GET');
      const response = await onRequest({ request, env: mockEnv });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });
  });
});