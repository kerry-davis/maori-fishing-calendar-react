// NIWA Proxy Unit Tests - Validates sanitized error responses
// Tests server-side error handling without external dependencies

import { createMocks } from 'node-mocks-http';
import handler from '../../api/niwa-tides';

// Use vi for Vitest
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

// Mock environment variables
const originalEnv = { ...process.env };

describe('NIWA Proxy Error Response Sanitization', () => {
  beforeEach(() => {
    process.env.NIWA_API_KEY = 'test-api-key';
    vi.clearAllMocks();
    
    // Mock global fetch at the module level
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
    
    // Restore original fetch
    const originalFetch = globalThis.fetch;
    global.fetch = originalFetch;
  });

  describe('Non-JSON Response Handling', () => {
    it('returns sanitized error for HTML response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(`<html><head><title>Error</title></head><body>Not authorized - check API credentials</body></html>`)
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(502);
      const response = JSON.parse(res._getData());
      
      expect(response.error).toBe('NIWA API returned unexpected format');
      expect(response.errorType).toBe('html_response');
      expect(response.status).toBe('invalid_format');
      expect(response.details).toContain('Not authorized - check API credentials');
      expect(response.timestamp).toBeDefined();
      expect(response.details.length).toBeLessThanOrEqual(203); // Truncated for safety
    });

    it('returns sanitized error for plain text error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 500,
        text: vi.fn().mockResolvedValue('API Error: Request limit exceeded. Please try again later.')
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(502);
      const response = JSON.parse(res._getData());
      
      expect(response.error).toBe('NIWA API returned unexpected format');
      expect(response.errorType).toBe('plain_text_error');
      expect(response.status).toBe('invalid_format');
    });

    it('returns sanitized error for empty response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('')
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(502);
      const response = JSON.parse(res._getData());
      
      expect(response.error).toBe('NIWA API returned empty response');
      expect(response.status).toBe('empty_response');
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('Authentication Failure Response', () => {
    it('returns sanitized error for unauthorized request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Unauthorized: Invalid API key provided')
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const response = JSON.parse(res._getData());
      
      expect(response.error).toContain('NIWA API error: Unauthorized');
      expect(response.status).toBe(401);
      expect(response.details).toBe('Unauthorized: Invalid API key provided');
      expect(response.timestamp).toBeDefined();
    });

    it('returns sanitized error for missing API key', async () => {
      // Remove API key from environment
      delete process.env.NIWA_API_KEY;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = res._getData();
      
      expect(data).toContain('NIWA API key not configured');
    });
  });

  describe('JSON Parse Error Response', () => {
    it('returns sanitized error for malformed JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"values": [{"time": "2024-10-10T00:00", "value": 0.5, invalid_json}')
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(502);
      const response = JSON.parse(res._getData());
      
      expect(response.error).toBe('Failed to parse NIWA API response');
      expect(response.status).toBe('parse_error');
      expect(response.parseError).toBeDefined();
      expect(response.details).toContain('invalid_json');
      expect(response.timestamp).toBeDefined();
    });

    it('limits error detail length to prevent response bloat', async () => {
      const longErrorMessage = 'A'.repeat(500);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(longErrorMessage)
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(502);
      const response = JSON.parse(res._getData());
      
      expect(response.details.length).toBeLessThanOrEqual(303); // Limited for safety
      expect(response.details).toContain('...');
    });
  });

  describe('Response Structure Validation', () => {
    it('returns sanitized error for missing values array', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"metadata": "test", "other": "data"}')
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(502);
      const response = JSON.parse(res._getData());
      
      expect(response.error).toBe('NIWA API response missing tide values');
      expect(response.status).toBe('missing_values');
      expect(response.responseKeys).toContain('metadata');
      expect(response.responseKeys).toContain('other');
      expect(response.timestamp).toBeDefined();
    });

    it('returns sanitized error for response with empty values array', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"values": []}')
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());
      
      // Should succeed but with metadata about empty results
      expect(response._proxyMetadata).toBeDefined();
      expect(response._proxyMetadata.dataPoints).toBe(0);
      expect(response.values).toEqual([]);
    });
  });

  describe('Successful Response with Metadata', () => {
    it('adds proxy metadata to successful responses', async () => {
      const mockResponse = {
        values: [
          { time: "2024-10-10T00:00", value: 0.1 },
          { time: "2024-10-10T01:00", value: 0.5 }
        ],
        timezone: "Pacific/Auckland"
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify(mockResponse))
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ 
        method: 'GET',
        query: { lat: '-36.8', long: '174.7' }
      });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const response = JSON.parse(res._getData());
      
      expect(response._proxyMetadata).toBeDefined();
      expect(response._proxyMetadata.source).toBe('niwa-api-proxy');
      expect(response._proxyMetadata.dataPoints).toBe(2);
      expect(response._proxyMetadata.timestamp).toBeDefined();
      expect(response.values).toEqual(mockResponse.values);
    });

    it('sanitizes unsuccessful error details while preserving key information', async () => {
      const longErrorDetails = 'A'.repeat(1000) + ' Critical system error occurred';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue(longErrorDetails)
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ method: 'GET' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const response = JSON.parse(res._getData());
      
      expect(response.error).toContain('NIWA API error:');
      expect(response.details.length).toBeLessThanOrEqual(503); // "500..." + rest
      expect(response.details).toContain('...');
    });
  });

  describe('HTTP Method Validation', () => {
    it('returns 405 for non-GET methods', async () => {
      const { req, res } = createMocks({ method: 'POST' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(res._getHeaders()['allow']).toBe('GET, OPTIONS');
      const response = JSON.parse(res._getData());
      
      expect(response.error).toBe('Method not allowed');
    });

    it('handles OPTIONS preflight request', async () => {
      const { req, res } = createMocks({ method: 'OPTIONS' });
      
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getHeaders()['access-control-allow-origin']).toBe('*');
      expect(res._getHeaders()['access-control-allow-methods']).toBe('GET, OPTIONS');
      expect(res._getHeaders()['access-control-allow-headers']).toBe('Content-Type, Authorization');
    });
  });

  describe('Parameter Validation and Forwarding', () => {
    it('correctly forwards query parameters to NIWA API', async () => {
      let capturedUrl: string | null = null;
      
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue('{"values": []}')
        });
      });
      
      global.fetch = mockFetch;

      const { req, res } = createMocks({ 
        method: 'GET',
        query: { 
          lat: '-36.8485',
          lng: '174.7633', // Should be converted to 'long'
          datum: 'LAT',
          startDate: '2024-10-07',
          endDate: '2024-10-12'
        }
      });
      
      await handler(req, res);

      expect(capturedUrl).toContain('lat=-36.8485');
      expect(capturedUrl).toContain('long=174.7633'); // lng converted to long
      expect(capturedUrl).toContain('datum=LAT');
      expect(capturedUrl).toContain('startDate=2024-10-07');
      expect(capturedUrl).toContain('endDate=2024-10-12');
      expect(capturedUrl).toContain('apikey=test-api-key');
    });
  });
});

// Helper function for creating mock HTTP requests/responses
function createMocks({
  method = 'GET',
  query = {},
  headers = {}
}: {
  method?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const req: any = {
    method,
    query,
    headers,
    auth: undefined
  };

  const res: any = {
    _status: 200,
    _headers: {},
    _data: '',

    status(code: number) {
      this._status = code;
      return this;
    },

    setHeader(name: string, value: string) {
      this._headers[name.toLowerCase()] = value; // normalize to lowercase
      return this;
    },

    json(data: any) {
      this._data = JSON.stringify(data);
      return this;
    },

    end() {
      return this;
    },

    _getStatusCode() {
      return this._status;
    },

    _getHeaders() {
      return this._headers;
    },

    _getData() {
      return this._data;
    }
  };

  return { req, res };
}
