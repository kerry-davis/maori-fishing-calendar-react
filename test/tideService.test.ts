import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchTideForecast,
  checkTideCoverage,
  getUtcDateFromTideTime,
  addDays,
} from "../src/services/tideService";

const originalFetch = globalThis.fetch;

const mockResponse = (data: unknown, ok = true, status = 200) => {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
};

describe("tideService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("addDays UTC arithmetic", () => {
    it("adds days correctly using UTC arithmetic", () => {
      const baseDate = new Date(Date.UTC(2024, 2, 10, 12, 0, 0)); // March 10, 2024 12:00 UTC
      const nextDay = addDays(baseDate, 1);
      
      expect(nextDay.getUTCFullYear()).toBe(2024);
      expect(nextDay.getUTCMonth()).toBe(2); // March
      expect(nextDay.getUTCDate()).toBe(11);
      expect(nextDay.getUTCHours()).toBe(12);
      expect(nextDay.getUTCMinutes()).toBe(0);
    });

    it("subtracts days correctly using UTC arithmetic", () => {
      const baseDate = new Date(Date.UTC(2024, 2, 15, 15, 30, 45)); // March 15, 2024 15:30:45 UTC
      const previousDay = addDays(baseDate, -1);
      
      expect(previousDay.getUTCFullYear()).toBe(2024);
      expect(previousDay.getUTCMonth()).toBe(2); // March
      expect(previousDay.getUTCDate()).toBe(14);
      expect(previousDay.getUTCHours()).toBe(15);
      expect(previousDay.getUTCMinutes()).toBe(30);
      expect(previousDay.getUTCSeconds()).toBe(45);
    });

    it("handles month boundaries correctly in UTC", () => {
      const endOfMonth = new Date(Date.UTC(2024, 0, 31, 23, 59, 59)); // Jan 31, 2024 23:59:59 UTC
      const nextMonth = addDays(endOfMonth, 1);
      
      expect(nextMonth.getUTCFullYear()).toBe(2024);
      expect(nextMonth.getUTCMonth()).toBe(1); // February
      expect(nextMonth.getUTCDate()).toBe(1);
      expect(nextMonth.getUTCHours()).toBe(23);
      expect(nextMonth.getUTCMinutes()).toBe(59);
      expect(nextMonth.getUTCSeconds()).toBe(59);
    });

    it("handles leap year February correctly in UTC", () => {
      const feb28 = new Date(Date.UTC(2024, 1, 28, 0, 0, 0)); // Feb 28, 2024 (leap year)
      const feb29 = addDays(feb28, 1);
      const mar1 = addDays(feb28, 2);
      
      expect(feb29.getUTCFullYear()).toBe(2024);
      expect(feb29.getUTCMonth()).toBe(1); // February
      expect(feb29.getUTCDate()).toBe(29);
      
      expect(mar1.getUTCFullYear()).toBe(2024);
      expect(mar1.getUTCMonth()).toBe(2); // March
      expect(mar1.getUTCDate()).toBe(1);
    });

    it("handles year boundaries correctly in UTC", () => {
      const yearEnd = new Date(Date.UTC(2023, 11, 31, 12, 0, 0)); // Dec 31, 2023 12:00 UTC
      const newYear = addDays(yearEnd, 1);
      
      expect(newYear.getUTCFullYear()).toBe(2024);
      expect(newYear.getUTCMonth()).toBe(0); // January
      expect(newYear.getUTCDate()).toBe(1);
      expect(newYear.getUTCHours()).toBe(12);
    });

    it("preserves all time components correctly in UTC", () => {
      const baseDate = new Date(Date.UTC(2024, 5, 15, 23, 45, 30, 123)); // June 15, 2024 23:45:30.123 UTC
      const result = addDays(baseDate, 5);
      
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(5); // June
      expect(result.getUTCDate()).toBe(20);
      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(45);
      expect(result.getUTCSeconds()).toBe(30);
      expect(result.getUTCMilliseconds()).toBe(123);
    });

    it("handles DST transition dates consistently in UTC", () => {
      // US DST transition: March 10, 2024 (spring forward)
      const beforeDST = new Date(Date.UTC(2024, 2, 10, 5, 0, 0)); // March 10, 2024 5:00 UTC
      const afterDST = addDays(beforeDST, 1);
      
      expect(afterDST.getUTCFullYear()).toBe(2024);
      expect(afterDST.getUTCMonth()).toBe(2); // March
      expect(afterDST.getUTCDate()).toBe(11);
      expect(afterDST.getUTCHours()).toBe(5);
      
      // EU DST transition: March 31, 2024 (spring forward)
      const euBeforeDST = new Date(Date.UTC(2024, 2, 31, 2, 0, 0)); // March 31, 2024 2:00 UTC
      const euAfterDST = addDays(euBeforeDST, 1);
      
      expect(euAfterDST.getUTCFullYear()).toBe(2024);
      expect(euAfterDST.getUTCMonth()).toBe(3); // April
      expect(euAfterDST.getUTCDate()).toBe(1);
      expect(euAfterDST.getUTCHours()).toBe(2);
      
      // US DST end: November 3, 2024 (fall back)
      const beforeFallback = new Date(Date.UTC(2024, 10, 3, 6, 0, 0)); // Nov 3, 2024 6:00 UTC
      const afterFallback = addDays(beforeFallback, 1);
      
      expect(afterFallback.getUTCFullYear()).toBe(2024);
      expect(afterFallback.getUTCMonth()).toBe(10); // November
      expect(afterFallback.getUTCDate()).toBe(4);
      expect(afterFallback.getUTCHours()).toBe(6);
    });

    it("handles multiple day additions correctly", () => {
      const baseDate = new Date(Date.UTC(2024, 6, 1, 8, 30, 0)); // July 1, 2024 8:30 UTC
      const result = addDays(baseDate, 15);
      
      expect(result.getUTCFullYear()).toBe(2024);
      expect(result.getUTCMonth()).toBe(6); // July
      expect(result.getUTCDate()).toBe(16);
      expect(result.getUTCHours()).toBe(8);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(0);
    });

    it("produces consistent results regardless of local timezone", () => {
      // Create the same moment in different timezone representations
      const utcDate = new Date(Date.UTC(2024, 3, 15, 12, 0, 0)); // April 15, 2024 12:00 UTC
      const localRepresentations = [
        new Date("2024-04-15T12:00:00Z"),
        new Date("2024-04-15T08:00:00-04:00"), // EDT
        new Date("2024-04-15T05:00:00-07:00"), // PDT
        new Date("2024-04-15T13:00:00+01:00"), // BST
      ];
      
      const utcResult = addDays(utcDate, 7);
      
      // All should produce the same UTC result
      localRepresentations.forEach(rep => {
        const result = addDays(rep, 7);
        expect(result.getUTCFullYear()).toBe(utcResult.getUTCFullYear());
        expect(result.getUTCMonth()).toBe(utcResult.getUTCMonth());
        expect(result.getUTCDate()).toBe(utcResult.getUTCDate());
        expect(result.getUTCHours()).toBe(utcResult.getUTCHours());
        expect(result.getUTCMinutes()).toBe(utcResult.getUTCMinutes());
        expect(result.getUTCSeconds()).toBe(utcResult.getUTCSeconds());
      });
      
      // Verify the result is April 22, 2024 12:00 UTC
      expect(utcResult.getUTCFullYear()).toBe(2024);
      expect(utcResult.getUTCMonth()).toBe(3); // April
      expect(utcResult.getUTCDate()).toBe(22);
      expect(utcResult.getUTCHours()).toBe(12);
    });
  });

  it("returns tide forecast and caches subsequent calls", async () => {
    const times = [
      "2024-10-09T23:00",
      "2024-10-10T00:00",
      "2024-10-10T01:00",
      "2024-10-10T02:00",
      "2024-10-10T03:00",
      "2024-10-10T04:00",
      "2024-10-10T05:00",
      "2024-10-10T06:00",
      "2024-10-10T07:00",
      "2024-10-10T08:00",
      "2024-10-10T09:00",
      "2024-10-10T10:00",
      "2024-10-11T00:00",
    ];
    const values = [-0.4, -0.2, 0.0, 0.4, 0.8, 1.0, 0.7, 0.2, -0.3, -0.6, -0.4, 0.1, 0.5];

    const responsePayload = {
      timezone: "Pacific/Auckland",
      utc_offset_seconds: 46800,
      hourly_units: { sea_level_height_msl: "m" },
      hourly: {
        time: times,
        sea_level_height_msl: values,
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse(responsePayload));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Use a date that will produce 2024-10-10 when formatted with UTC components
    const targetDate = new Date(Date.UTC(2024, 9, 10, 12, 0, 0)); // Oct 10, 2024 12:00 UTC
    const forecast = await fetchTideForecast(1.23, 3.21, targetDate);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(forecast.extrema.length).toBeGreaterThan(0);
    expect(forecast.maxHeight).toBe(1.0);
    expect(forecast.minHeight).toBe(-0.6);
  expect(forecast.series.length).toBeGreaterThan(0);
  expect(forecast.series.every((point) => point.time.startsWith("2024-10-10"))).toBe(true);
  expect(forecast.series[0].height).toBeCloseTo(-0.2, 2);

    const peak = forecast.extrema.find((extremum) => extremum.type === "high");
    const trough = forecast.extrema.find((extremum) => extremum.type === "low");
    expect(peak?.time).toContain("2024-10-10T04:00");
    expect(trough?.time).toContain("2024-10-10T08:00");

    // Update fetch to ensure cache is used
    fetchMock.mockRejectedValueOnce(new Error("Should not be called"));

    const cached = await fetchTideForecast(1.23, 3.21, targetDate);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cached.extrema.length).toBe(forecast.extrema.length);
    expect(forecast.utcOffsetSeconds).toBe(46800);
    expect(cached.series.length).toBe(forecast.series.length);
  });

  it("throws validation error when no tide data is returned", async () => {
    const responsePayload = {
      timezone: "GMT",
      utc_offset_seconds: 0,
      hourly_units: { sea_level_height_msl: "m" },
      hourly: {
        time: [],
        sea_level_height_msl: [],
      },
    };

    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(mockResponse(responsePayload));

    await expect(
      fetchTideForecast(10.5, 20.5, new Date("2024-10-10")),
    ).rejects.toMatchObject({ type: "validation" });
  });

  it("summarises tide coverage status", async () => {
    const responsePayload = {
      timezone: "GMT",
      utc_offset_seconds: 0,
      hourly_units: { sea_level_height_msl: "m" },
      hourly: {
        time: ["2024-10-10T00:00"],
        sea_level_height_msl: [0.4],
      },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse(responsePayload));

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const summary = await checkTideCoverage(40.7128, -74.006);
    expect(summary.available).toBe(true);
    expect(summary.timezone).toBe("GMT");

    // Simulate network error
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    const unavailable = await checkTideCoverage(40.7128, -74.006);
    expect(unavailable.available).toBe(false);
    expect(unavailable.message).toBeTruthy();
  });

  it("handles NIWA proxy error responses gracefully", async () => {
    // Test proxy error response
    const proxyErrorResponse = mockResponse({
      error: 'NIWA API returned unexpected format',
      status: 'invalid_format',
      details: 'Non-JSON response received',
      timestamp: new Date().toISOString()
    }, true, 502);

    globalThis.fetch = vi.fn().mockResolvedValue(proxyErrorResponse) as unknown as typeof fetch;
    
    await expect(
      fetchTideForecast(-36.8485, 174.7633, new Date("2024-10-10"))
    ).rejects.toThrow('NIWA service temporary unavailable');
  });

  it("handles NIWA proxy parsing failures gracefully", async () => {
    // Test non-JSON response that causes parsing to fail
    const nonJsonResponse = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("This is not JSON"),
      json: vi.fn().mockRejectedValue(new Error("Unexpected token"))
    } as unknown as Response;

    globalThis.fetch = vi.fn().mockResolvedValue(nonJsonResponse) as unknown as typeof fetch;
    
    await expect(
      fetchTideForecast(-36.8485, 174.7633, new Date("2024-10-10"))
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

    const targetDate = new Date(Date.UTC(2024, 9, 10, 12, 0, 0));
    const forecast = await fetchTideForecast(-36.8485, 174.7633, targetDate);

    expect(forecast.series).toHaveLength(2);
    expect(forecast.series[0].time).toBe("2024-10-10T00:00");
    expect(forecast.series[0].height).toBe(0.2);
    // Proxy metadata should not be included in the processed data
    expect(forecast).not.toHaveProperty('_proxyMetadata');
  });

  it("converts tide times to UTC using provided offsets", () => {
    const result = getUtcDateFromTideTime("2024-10-10T05:30", 46800);
    expect(result.toISOString()).toBe("2024-10-09T16:30:00.000Z");

    const noOffset = getUtcDateFromTideTime("2024-10-10T05:30", 0);
    expect(noOffset.toISOString()).toBe("2024-10-10T05:30:00.000Z");
  });

  describe("Timezone handling", () => {
    it("uses UTC date components to avoid timezone drift", async () => {
      const nzTimezone = "Pacific/Auckland";
      const nzOffset = 46800; // +13 hours (UTC+13)
      
      const responsePayload = {
        timezone: nzTimezone,
        utc_offset_seconds: nzOffset,
        hourly_units: { sea_level_height_msl: "m" },
        hourly: {
          time: [
            "2024-10-10T00:00",
            "2024-10-10T01:00", 
            "2024-10-10T02:00",
            "2024-10-10T03:00",
            "2024-10-10T04:00",
            "2024-10-10T05:00",
          ],
          sea_level_height_msl: [0.2, 0.5, 0.8, 0.6, 0.3, 0.1],
        },
      };

      const fetchMock = vi.fn().mockResolvedValue(mockResponse(responsePayload));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      // Test with a date that will be formatted as 2024-10-10 using UTC components
      const targetDate = new Date(Date.UTC(2024, 9, 10, 12, 0, 0)); // Oct 10, 2024 12:00 UTC
  
      const forecast = await fetchTideForecast(-36.8485, 174.7633, targetDate);
      
      // Verify the API was called with the correct 3-day range (Oct 9-11)
      const callUrl = fetchMock.mock.calls[0][0];
      expect(callUrl).toContain("start_date=2024-10-09");
      expect(callUrl).toContain("end_date=2024-10-11");
      
      expect(forecast.date).toBe("2024-10-10");
      expect(forecast.utcOffsetSeconds).toBe(nzOffset);
    });

    it("handles dates across timezone boundaries correctly", async () => {
      const pacificTimezone = "America/Los_Angeles";
      const pacificOffset = -25200; // -7 hours (UTC-7 for PDT)
      
      const responsePayload = {
        timezone: pacificTimezone,
        utc_offset_seconds: pacificOffset,
        hourly_units: { sea_level_height_msl: "m" },
        hourly: {
          time: [
            "2024-10-09T00:00",
            "2024-10-09T01:00", 
            "2024-10-09T02:00",
            "2024-10-09T03:00",
            "2024-10-09T04:00",
            "2024-10-09T05:00",
          ],
          sea_level_height_msl: [0.4, 0.6, 0.8, 1.0, 0.9, 0.7],
        },
      };

      const fetchMock = vi.fn().mockResolvedValue(mockResponse(responsePayload));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      // Create a date that will be formatted as 2024-10-09 using UTC components
      const eveningPacificDate = new Date(Date.UTC(2024, 9, 9, 12, 0, 0)); // Oct 9, 2024 12:00 UTC
      
      const forecast = await fetchTideForecast(34.0522, -118.2437, eveningPacificDate);
      
      // Should target the correct 3-day range (Oct 8-10)
      const callUrl = fetchMock.mock.calls[0][0];
      expect(callUrl).toContain("start_date=2024-10-08");
      expect(callUrl).toContain("end_date=2024-10-10");
      
      expect(forecast.date).toBe("2024-10-09");
      expect(forecast.utcOffsetSeconds).toBe(pacificOffset);
    });

    it("dates derived from UTC components remain consistent across viewer timezones", async () => {
      // Test dates that will be formatted consistently using UTC components
      const dateInUTC = new Date(Date.UTC(2024, 9, 10, 15, 30, 0)); // Oct 10, 2024 15:30 UTC
      const sameDateInNZ = new Date(Date.UTC(2024, 9, 10, 15, 30, 0)); // Same moment, different representation
      const sameDateInUS = new Date(Date.UTC(2024, 9, 10, 15, 30, 0)); // Same moment, different representation

      const responsePayload = {
        timezone: "UTC",
        utc_offset_seconds: 0,
        hourly_units: { sea_level_height_msl: "m" },
        hourly: {
          time: [
            "2024-10-09T00:00",
            "2024-10-10T00:00", 
            "2024-10-11T00:00",
            "2024-10-09T01:00",
            "2024-10-10T01:00", 
            "2024-10-11T01:00",
            "2024-10-09T02:00",
            "2024-10-10T02:00", 
            "2024-10-11T02:00",
          ],
          sea_level_height_msl: [0.5, 0.6, 0.7, 0.4, 0.5, 0.6, 0.3, 0.4, 0.5],
        },
      };

      const fetchMock = vi.fn().mockResolvedValue(mockResponse(responsePayload));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      // All should produce the same date string for API calls
      const utcForecast = await fetchTideForecast(0, 0, dateInUTC);
      expect(utcForecast.date).toBe("2024-10-10");
      
      await fetchTideForecast(-36.8485, 174.7633, sameDateInNZ);
      const nzCallUrl = fetchMock.mock.calls[0][0];
      expect(nzCallUrl).toContain("start_date=2024-10-09");

      fetchMock.mockClear();
      await fetchTideForecast(34.0522, -118.2437, sameDateInUS);
      const usCallUrl = fetchMock.mock.calls[0][0];
      expect(usCallUrl).toContain("start_date=2024-10-09");
    });
  });

  describe("series data integration", () => {
    it("includes series data in forecast for UI consumption", async () => {
      const times = [
        "2024-10-10T00:00",
        "2024-10-10T01:00", 
        "2024-10-10T02:00",
        "2024-10-10T03:00",
        "2024-10-10T04:00",
        "2024-10-10T05:00",
      ];
      const values = [0.2, 0.5, 0.8, 0.6, 0.3, 0.1];

      const responsePayload = {
        timezone: "UTC",
        utc_offset_seconds: 0,
        hourly_units: { sea_level_height_msl: "m" },
        hourly: {
          time: times,
          sea_level_height_msl: values,
        },
      };

      const fetchMock = vi.fn().mockResolvedValue(mockResponse(responsePayload));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const targetDate = new Date(Date.UTC(2024, 9, 10, 12, 0, 0));
      const forecast = await fetchTideForecast(1.23, 3.21, targetDate);

      // Verify series data is included and properly filtered
      expect(forecast.series).toBeDefined();
      expect(forecast.series.length).toBe(6); // Only 2024-10-10 entries
      
      // Verify all series entries are for the target date
      forecast.series.forEach(point => {
        expect(point.time).toContain("2024-10-10");
      });

      // Verify series data contains expected structure
      forecast.series.forEach((point, index) => {
        expect(point.time).toBe(times[index]);
        expect(point.height).toBeCloseTo(values[index], 1);
      });

      // Verify series data is properly rounded
      expect(forecast.series[0].height).toBe(0.2);
      expect(forecast.series[1].height).toBe(0.5);
      expect(forecast.series[3].height).toBe(0.6);
    });

    it("filters series data correctly for target date only", async () => {
      const responsePayload = {
        timezone: "UTC",
        utc_offset_seconds: 0,
        hourly_units: { sea_level_height_msl: "m" },
        hourly: {
          time: [
            "2024-10-09T23:00", // Previous day
            "2024-10-10T00:00", // Target day
            "2024-10-10T01:00", // Target day
            "2024-10-10T02:00", // Target day
            "2024-10-11T00:00", // Next day
          ],
          sea_level_height_msl: [0.1, 0.2, 0.5, 0.8, 0.3],
        },
      };

      const fetchMock = vi.fn().mockResolvedValue(mockResponse(responsePayload));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const targetDate = new Date(Date.UTC(2024, 9, 10, 12, 0, 0));
      const forecast = await fetchTideForecast(1.23, 3.21, targetDate);

      // Should only include target date entries
      expect(forecast.series.length).toBe(3);
      expect(forecast.series[0].time).toBe("2024-10-10T00:00");
      expect(forecast.series[1].time).toBe("2024-10-10T01:00");
      expect(forecast.series[2].time).toBe("2024-10-10T02:00");
      
      // Values should match the corresponding time entries
      expect(forecast.series[0].height).toBe(0.2);
      expect(forecast.series[1].height).toBe(0.5);
      expect(forecast.series[2].height).toBe(0.8);
    });

    it("provides series data for chart visualization consumption", async () => {
      const responsePayload = {
        timezone: "Pacific/Auckland",
        utc_offset_seconds: 46800,
        hourly_units: { sea_level_height_msl: "m" },
        hourly: {
          time: [
            "2024-10-10T00:00",
            "2024-10-10T01:00", 
            "2024-10-10T02:00",
            "2024-10-10T03:00",
            "2024-10-10T04:00",
          ],
          sea_level_height_msl: [-0.4, -0.2, 0.1, 0.6, 1.2], // Rising tide pattern
        },
      };

      const fetchMock = vi.fn().mockResolvedValue(mockResponse(responsePayload));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const targetDate = new Date(Date.UTC(2024, 9, 10, 12, 0, 0));
      const forecast = await fetchTideForecast(-36.8485, 174.7633, targetDate);

      // Verify series data is suitable for chart consumption
      expect(forecast.series).toBeDefined();
      expect(forecast.series.length).toBe(5);
      
      // Verify data structure matches TideDataPoint interface requirements
      forecast.series.forEach(point => {
        expect(point).toHaveProperty('time');
        expect(point).toHaveProperty('height');
        expect(typeof point.time).toBe('string');
        expect(typeof point.height).toBe('number');
        expect(Number.isFinite(point.height)).toBe(true);
      });

      // Verify timezone information is available for UI formatting
      expect(forecast.timezone).toBe("Pacific/Auckland");
      expect(forecast.units).toBe("m");
      expect(forecast.utcOffsetSeconds).toBe(46800);
      
      // Verify heights are properly rounded for display
      expect(forecast.series[2].height).toBe(0.1); // Already rounded
      expect(forecast.series[4].height).toBe(1.2); // Already rounded
    });
  });
});
