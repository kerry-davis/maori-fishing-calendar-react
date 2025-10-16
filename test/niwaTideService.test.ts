import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  nwaTideProvider,
  fetchNwaTideForecast,
  checkNwaTideCoverage,
} from "../src/services/niwaTideService";

const originalFetch = globalThis.fetch;
const originalEnv = import.meta.env;

const mockResponse = (data: unknown, ok = true, status = 200) => {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
};

describe("niwaTideService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_NIWA_PROXY_URL", "/api/niwa-tides");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("handles NIWA proxy error responses gracefully", async () => {
    const proxyErrorResponse = mockResponse({
      error: 'NIWA API returned unexpected format',
      status: 'invalid_format',
      details: 'Non-JSON response received',
      timestamp: new Date().toISOString()
    }, true, 502);

    globalThis.fetch = vi.fn().mockResolvedValue(proxyErrorResponse) as unknown as typeof fetch;
    
    await expect(
      fetchNwaTideForecast(-36.8485, 174.7633, new Date("2024-10-10"))
    ).rejects.toThrow('NIWA service temporary unavailable');
  });

  it("handles NIWA proxy parsing failures gracefully", async () => {
    const nonJsonResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error("Unexpected token"))
    } as unknown as Response;

    globalThis.fetch = vi.fn().mockResolvedValue(nonJsonResponse) as unknown as typeof fetch;
    
    await expect(
      fetchNwaTideForecast(-36.8485, 174.7633, new Date("2024-10-10"))
    ).rejects.toThrow('NIWA proxy returned invalid response');
  });

  it("filters proxy metadata from NIWA responses", async () => {
    const niwaResponseWithMetadata = {
      values: [
        { time: "2024-10-10T00:00", value: 0.2 },
        { time: "2024-10-10T01:00", value: 0.5 }
      ],
      _proxyMetadata: {
        timestamp: new Date().toISOString(),
        dataPoints: 2,
        source: 'niwa-api-proxy'
      }
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse(niwaResponseWithMetadata));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const forecast = await fetchNwaTideForecast(-36.8485, 174.7633, new Date("2024-10-10"));

    expect(forecast.series).toHaveLength(2);
    expect(forecast.series[0].time).toBe("2024-10-10T00:00");
    expect(forecast.series[0].height).toBe(0.2);
    // Proxy metadata should not be included in the processed data
    expect(forecast).not.toHaveProperty('_proxyMetadata');
  });

  it("handles coverage check with proxy errors", async () => {
    const proxyErrorResponse = mockResponse({
      error: 'NIWA API authentication issue',
      status: 'authentication_error',
      details: 'Invalid API key',
      timestamp: new Date().toISOString()
    }, true, 500);

    globalThis.fetch = vi.fn().mockResolvedValue(proxyErrorResponse) as unknown as typeof fetch;
    
    const coverage = await checkNwaTideCoverage(-36.8485, 174.7633);
    expect(coverage.available).toBe(false);
    expect(coverage.message).toContain('authentication issue');
  });

  it("validates location support correctly", () => {
    // Test with proxy configured (this test has proxy configured in beforeEach)
    expect(nwaTideProvider.supportsLocation(-36.8485, 174.7633)).toBe(true);
    
    // Should return false for non-NZ location even with proxy
    expect(nwaTideProvider.supportsLocation(40.7128, -74.006)).toBe(false);
    
    // Test boundary conditions
    expect(nwaTideProvider.supportsLocation(-55, 165)).toBe(true); // Exact boundary
    expect(nwaTideProvider.supportsLocation(-25, 185)).toBe(true); // Exact boundary
    expect(nwaTideProvider.supportsLocation(-56, 165)).toBe(false); // Outside lat
    expect(nwaTideProvider.supportsLocation(-25, 186)).toBe(false); // Outside lon
  });

  it("processes multi-day NIWA responses with complete tide pairs", async () => {
    // Simulate a comprehensive 5-day NIWA response (target-3 → target+2)
    const multiDayResponse = {
      values: [
        // Day -3 (before target)
        { time: "2024-10-07T00:00", value: 0.1 },
        { time: "2024-10-07T06:00", value: 1.2 },
        { time: "2024-10-07T12:00", value: 0.5 },
        { time: "2024-10-07T18:00", value: -0.3 },
        { time: "2024-10-07T23:00", value: -0.5 },
        // Day -2  
        { time: "2024-10-08T02:00", value: -0.2 },
        { time: "2024-10-08T08:00", value: 0.8 },
        { time: "2024-10-08T14:00", value: 1.5 },
        { time: "2024-10-08T20:00", value: 1.1 },
        { time: "2024-10-08T23:00", value: 0.7 },
        // Day -1
        { time: "2024-10-09T03:00", value: 0.3 },
        { time: "2024-10-09T09:00", value: 1.8 },
        { time: "2024-10-09T15:00", value: 2.2 },
        { time: "2024-10-09T21:00", value: 1.6 },
        { time: "2024-10-09T23:00", value: 0.9 },
        // Target Day (2024-10-10)
        { time: "2024-10-10T01:00", value: 0.1 },    // Low tide start
        { time: "2024-10-10T04:00", value: 0.8 },
        { time: "2024-10-10T07:00", value: 2.1 },    // High tide
        { time: "2024-10-10T10:00", value: 1.4 },
        { time: "2024-10-10T13:00", value: 0.2 },    // Low tide  
        { time: "2024-10-10T16:00", value: 1.1 },
        { time: "2024-10-10T19:00", value: 2.4 },    // High tide
        { time: "2024-10-10T22:00", value: 1.8 },
        { time: "2024-10-10T23:00", value: 1.2 },
        // Day +1
        { time: "2024-10-11T02:00", value: 0.6 },
        { time: "2024-10-11T05:00", value: -0.1 },   // Low tide
        { time: "2024-10-11T08:00", value: 0.7 },
        { time: "2024-10-11T11:00", value: 2.0 },    // High tide
        { time: "2024-10-11T14:00", value: 1.5 },
        { time: "2024-10-11T17:00", value: 0.8 },
        { time: "2024-10-11T20:00", value: 0.3 },
        { time: "2024-10-11T23:00", value: -0.4 },   // Low tide
        // Day +2
        { time: "2024-10-12T03:00", value: -0.2 },
        { time: "2024-10-12T07:00", value: 0.9 },
        { time: "2024-10-12T11:00", value: 2.3 },
        { time: "2024-10-12T15:00", value: 1.7 },
        { time: "2024-10-12T19:00", value: 0.8 }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue(mockResponse(multiDayResponse));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Test target date processing
    const targetDate = new Date("2024-10-10");
    const forecast = await fetchNwaTideForecast(-36.8485, 174.7633, targetDate);

    // Verify target date filtering worked correctly
    expect(forecast.date).toBe("2024-10-10");
    
    // Should have filtered to only target date points
    expect(forecast.series.length).toBe(9);
    forecast.series.forEach(point => {
      expect(point.time).toContain("2024-10-10");
    });

    // Verify extrema detection includes both tide pairs
    expect(forecast.extrema.length).toBeGreaterThan(2); // At least 3 points due to seeding
    
    // Verify we have both high and low tides
    const highTides = forecast.extrema.filter(e => e.type === 'high');
    const lowTides = forecast.extrema.filter(e => e.type === 'low');
    
    expect(highTides.length).toBeGreaterThanOrEqual(1);
    expect(lowTides.length).toBeGreaterThanOrEqual(1);
    
    // Verify the specific times match our test data
    expect(highTides.some(h => h.time === "2024-10-10T07:00" && h.height === 2.1)).toBe(true);
    expect(lowTides.some(l => l.time === "2024-10-10T01:00" && l.height === 0.1)).toBe(true);
    expect(highTides.some(h => h.time === "2024-10-10T19:00" && h.height === 2.4)).toBe(true);
    expect(lowTides.some(l => l.time === "2024-10-10T13:00" && l.height === 0.2)).toBe(true);
    
    // Verify heights are properly rounded
    forecast.extrema.forEach(extremum => {
      expect(extremum.height).toBe(Number(extremum.height.toFixed(2)));
    });

    console.log("✅ Multi-day regression test passed - both tide pairs detected");
  });
});
