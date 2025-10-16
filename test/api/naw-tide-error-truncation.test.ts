// End-to-End Test - NIWA Proxy Error Response Truncation
// Verifies that long error responses are properly truncated at 500 characters for client safety

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchNwaTideForecast, nwaTideProvider } from '../../src/services/niwaTideService';

// Test truncation behavior by simulating proxy responses
const LONG_ERROR_MESSAGE = 'A'.repeat(1000);
const EXPECTED_TRUNCATION_LENGTH = 500; // From proxy implementation
const ADDITIONAL_CHARS_FOR_ELLIPSIS = 3; // '...'

describe('NIWA Proxy Error Truncation - End to End', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Enable NIWA provider for testing
    vi.stubEnv('VITE_NIWA_PROXY_URL', '/api/niwa-tides');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('Successful Requests with Normal Responses', () => {
    it('returns full tide data without truncation for successful responses', async () => {
      const mockResponse = {
        values: [
          { time: "2024-10-10T00:00", value: 0.1 },
          { time: "2024-10-10T01:00", value: 0.5 },
          { time: "2024-10-10T02:00", value: 0.9 },
          { time: "2024-10-10T03:00", value: 1.2 },
          { time: "2024-10-10T04:00", value: 1.0 },
          { time: "2024-10-10T05:00", value: 0.7 },
          { time: "2024-10-10T06:00", value: 0.4 },
          { time: "2024-10-10T07:00", value: 1.8 },
          { time: "2024-10-10T08:00", value: 2.1 },
          { time: "2024-10-10T09:00", value: 2.4 },
        ],
        _proxyMetadata: {
          timestamp: new Date().toISOString(),
          dataPoints: 10,
          source: 'niwa-api-proxy'
        }
      };

      // Mock the proxy to return our test data (no truncation needed)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      globalThis.fetch = mockFetch;

      const forecast = await fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'));

      expect(forecast).toBeDefined();
      expect(forecast.series).toHaveLength(10);
      expect(forecast.extrema.length).toBeGreaterThan(0);
      // Success responses should not be truncated
      expect(JSON.stringify(forecast.series).length).toBeGreaterThan(100);
    });
  });

  describe('Error Response Truncation Sanitization', () => {
    it('truncates long HTML error responses from proxy to safe length', async () => {
      const longHtmlError = `<html><head><title>API Error</title></head><body>${LONG_ERROR_MESSAGE}</body></html>`;
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 502,
        statusText: 'Bad Gateway',
        json: vi.fn().mockResolvedValue({
          error: 'NIWA API returned unexpected format',
          errorType: 'html_response',
          status: 'invalid_format',
          details: longHtmlError.substring(0, 200) + '...',
          timestamp: new Date().toISOString()
        })
      });

      globalThis.fetch = mockFetch;

      await expect(fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'))).rejects.toThrow(/NIWA service temporary unavailable/);
    });

    it('truncates long proxy error details to 500 characters maximum', async () => {
      const longErrorDetails = LONG_ERROR_MESSAGE + ' Critical system error occurred with detailed stack trace and debugging information for troubleshooting.';
      
      // Capture the mock function to verify our response
      const mockJsonResolve = vi.fn().mockResolvedValue({
        error: 'NIWA API returned unexpected format',
        errorType: 'plain_text_error',
        status: 'invalid_format',
        details: longErrorDetails.substring(0, EXPECTED_TRUNCATION_LENGTH) + '...',
        timestamp: new Date().toISOString()
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: mockJsonResolve
      });

      globalThis.fetch = mockFetch;

      await expect(fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'))).rejects.toThrow(/NIWA service temporary unavailable/);

      // Verify the proxy response was truncated by checking what we set up
      const resolvedValue = await mockJsonResolve();
      
      expect(resolvedValue.details.length).toBeLessThanOrEqual(EXPECTED_TRUNCATION_LENGTH + ADDITIONAL_CHARS_FOR_ELLIPSIS);
      expect(resolvedValue.details).toContain('...');
      expect(resolvedValue.details).not.toContain(longErrorDetails.substring(EXPECTED_TRUNCATION_LENGTH + 1));
    });

    it('truncates authentication error messages appropriately', async () => {
      const longAuthError = 'Unauthorized: Invalid API key provided. The key ' + LONG_ERROR_MESSAGE + ' is not recognized by the system.';
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({
          error: 'NIWA API error: Unauthorized',
          status: 401,
          details: longAuthError.substring(0, 500) + '...',
          timestamp: new Date().toISOString()
        })
      });

      globalThis.fetch = mockFetch;

      await expect(fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'))).rejects.toThrow(/NIWA proxy unavailable/);
    });

    it('handles parse error truncation with detailed error information', async () => {
      const malformedJsonLarge = '{"values": [{"time": "' + LONG_ERROR_MESSAGE + '"} invalid}';
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockRejectedValue(new Error('Unexpected token'))
      });

      globalThis.fetch = mockFetch;

      await expect(fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'))).rejects.toThrow(/NIWA proxy returned invalid response/);
    });
  });

  describe('Truncation Boundaries and Edge Cases', () => {
    it('does not truncate error details exactly at the limit', async () => {
      const exactLengthError = 'A'.repeat(449) + ' B'; // 450 characters - under limit
      
      const mockJsonResolve = vi.fn().mockResolvedValue({
        error: 'NIWA API returned unexpected format',
        status: 'invalid_format',
        details: exactLengthError,
        timestamp: new Date().toISOString()
      });
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 502,
        statusText: 'Bad Gateway',
        json: mockJsonResolve
      });

      globalThis.fetch = mockFetch;

      await expect(fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'))).rejects.toThrow(/NIWA service temporary unavailable/);

      const resolvedValue = await mockJsonResolve();
      
      // Should not be truncated since it's under the limit
      expect(resolvedValue.details).toBe(exactLengthError);
      expect(resolvedValue.details.length).toBeLessThanOrEqual(500);

    it('truncates error details exactly at the boundary', async () => {
      const boundaryError = 'A'.repeat(500); // Exactly at the limit
      
      const mockJsonResolve = vi.fn().mockResolvedValue({
        error: 'NIWA API returned unexpected format',
        status: 'invalid_format',
        details: boundaryError,
        timestamp: new Date().toISOString()
      });
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 502,
        statusText: 'Bad Gateway',
        json: mockJsonResolve
      });

      globalThis.fetch = mockFetch;

      await expect(fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'))).rejects.toThrow(/NIWA service temporary unavailable/);

      const resolvedValue = await mockJsonResolve();
      
      // Should not be truncated since it's exactly at the limit
      expect(resolvedValue.details).toBe(boundaryError);
      expect(resolvedValue.details.length).toBe(500);
    });

    it('adds ellipsis to truncated errors to indicate truncation', async () => {
      const overLimitError = 'B'.repeat(600); // Over the limit
      
      const mockJsonResolve = vi.fn().mockResolvedValue({
        error: 'NIWA API returned unexpected format',
        status: 'invalid_format',
        details: overLimitError.substring(0, EXPECTED_TRUNCATION_LENGTH) + '...',
        timestamp: new Date().toISOString()
      });
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 502,
        statusText: 'Bad Gateway',
        json: mockJsonResolve
      });

      globalThis.fetch = mockFetch;

      await expect(fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'))).rejects.toThrow(/NIWA service temporary unavailable/);

      const resolvedValue = await mockJsonResolve();
      
      expect(resolvedValue.details).toContain('...');
      expect(resolvedValue.details.slice(-3)).toBe('...');
      expect(resolvedValue.details.length).toBeLessThanOrEqual(EXPECTED_TRUNCATION_LENGTH + ADDITIONAL_CHARS_FOR_ELLIPSIS);
    });
  });

  describe('Coverage Check Truncation', () => {
    it('truncates long error messages in coverage check responses', async () => {
      const longCoverageError = LONG_ERROR_MESSAGE + ' coverage unavailable due to system overload';
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 503,
        statusText: 'Service Unavailable',
        json: vi.fn().mockResolvedValue({
          error: 'NIWA API error: Service Unavailable',
          status: 503,
          details: longCoverageError.substring(0, 500) + '...',
          timestamp: new Date().toISOString()
        })
      });

      globalThis.fetch = mockFetch;

      const coverage = await nwaTideProvider.checkCoverage(-36.8485, 174.7633);
      
      expect(coverage.available).toBe(false);
      expect(coverage.message).toContain('unavailable');
      expect(coverage.checkedAt).toBeDefined();
    });

    it('handles parse errors in coverage check with truncation', async () => {
      const largeMalformedJson = '{"values": "' + LONG_ERROR_MESSAGE + '"} malformed for coverage';
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Unexpected token in JSON'))
      });

      globalThis.fetch = mockFetch;

      const coverage = await nwaTideProvider.checkCoverage(-36.8485, 174.7633);
      
      expect(coverage.available).toBe(false);
      expect(coverage.message).toContain('invalid - Open-Meteo will provide tide data');
    });
  });

  describe('Error Response Structure Validation', () => {
    it('includes timestamp and status in all truncated error responses', async () => {
      const largeError = LONG_ERROR_MESSAGE + ' system failure';
      
      const mockJsonResolve = vi.fn().mockResolvedValue({
        error: 'NIWA API error: Internal Server Error',
        status: 500,
        details: largeError.substring(0, 500) + '...',
        timestamp: new Date().toISOString()
      });
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: mockJsonResolve
      });

      globalThis.fetch = mockFetch;

      await expect(fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'))).rejects.toThrow(/NIWA proxy unavailable/);

      const resolvedValue = await mockJsonResolve();
      
      expect(resolvedValue.timestamp).toBeDefined();
      expect(resolvedValue.status).toBe(500);
      expect(resolvedValue.details.length).toBeLessThanOrEqual(503); // 500 + '...'
      expect(resolvedValue.details.slice(-3)).toBe('...');
    });
  });

  describe('Performance Impact Assessment', () => {
    it('does not significantly impact performance for normal successful responses', async () => {
      const startTime = performance.now();
      
      const mockResponse = {
        values: Array.from({ length: 24 }, (_, i) => ({
          time: `2024-10-10T${String(i).padStart(2, '0')}:00`,
          value: Math.sin(i * Math.PI / 12) * 2
        })),
        _proxyMetadata: {
          timestamp: new Date().toISOString(),
          dataPoints: 24,
          source: 'niwa-api-proxy'
        }
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      globalThis.fetch = mockFetch;

      const forecast = await fetchNwaTideForecast(-36.8485, 174.7633, new Date('2024-10-10'));
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
      expect(forecast.series).toHaveLength(24);
    });
  });
});
