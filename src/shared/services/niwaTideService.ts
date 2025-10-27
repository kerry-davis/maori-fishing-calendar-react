// NIWA Tide Service - Official NZ tide data from NIWA
import type { TideForecast, TideCoverageStatus } from "./tideService";
import { DEV_LOG, DEV_WARN, DEV_ERROR, PROD_WARN, PROD_SECURITY, TideLogging } from "../utils/loggingHelpers";

const RAW_PROXY_URL = (import.meta.env.VITE_NIWA_PROXY_URL ?? "").trim();
const NZ_TIMEZONE = "Pacific/Auckland";
const nzDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NZ_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const NIWA_DATUM = "LAT"; // Align heights with NIWA public site (LAT datum)

function shiftNzDateString(baseDate: string, offsetDays: number): string {
  const [year, month, day] = baseDate.split("-").map(Number);
  const baseUtc = Date.UTC(year, month - 1, day);
  const shiftedUtc = baseUtc + offsetDays * DAY_IN_MS;
  return nzDateFormatter.format(new Date(shiftedUtc));
}

function getNzOffsetSeconds(referenceUtc: Date): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: NZ_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts = formatter.formatToParts(referenceUtc);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "00";
  const localUtcMs = Date.UTC(
    Number(valueFor("year")),
    Number(valueFor("month")) - 1,
    Number(valueFor("day")),
    Number(valueFor("hour")),
    Number(valueFor("minute")),
    Number(valueFor("second"))
  );
  return Math.round((localUtcMs - referenceUtc.getTime()) / 1000);
}

// ENFORCED: NIWA only works through proxy - no direct browser calls allowed
export const NIWA_PROVIDER_ENABLED = RAW_PROXY_URL !== "";

if (!NIWA_PROVIDER_ENABLED) {
  PROD_WARN('NIWA_PROXY_URL not configured - will use Open-Meteo as fallback');
}

// Only proxy URL is allowed - direct browser calls are explicitly prohibited
const NIWA_API_BASE = RAW_PROXY_URL;

function buildNiwaRequestUrl(base: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params);

  if (/^https?:\/\//i.test(base)) {
    const url = new URL(base);
    if (url.hostname === "api.niwa.co.nz") {
      PROD_SECURITY('Direct NIWA API calls attempted - proxy required');
      throw new Error("Direct NIWA API calls not allowed - use proxy instead");
    }
    query.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${query.toString()}`;
}

interface NIWATideValues {
  time: string;
  value: number; // tide height in meters (positive = high, negative = low)
}

interface NIWAResponse {
  values?: NIWATideValues[];
  error?: string;
  status?: string;
  details?: string;
  timestamp?: string;
  errorType?: string;
  parseError?: string;
  responseKeys?: string[];
  _proxyMetadata?: {
    timestamp: string;
    dataPoints: number;
    source: string;
  };
}

export class NwaTideProvider {
  supportsLocation(lat: number, lon: number): boolean {
    // ENFORCED: NIWA provider only works through proxy
    if (!NIWA_PROVIDER_ENABLED) {
      TideLogging.dev.providerFallback('NIWA', 'Open-Meteo', 'proxy not configured');
      return false;
    }
    
    // NIWA covers New Zealand waters approximately - generous marine bounds
    const inBounds = lat >= -55 && lat <= -25 && lon >= 165 && lon <= 185;
    DEV_LOG(`🌊 NIWA location check: ${lat}, ${lon} -> ${inBounds ? 'IN_BOUNDS' : 'OUT_OF_BOUNDS'}`);
    // Detailed bounds validation only in development
    DEV_LOG(`   Bounds验证: lat[${lat}] >= -55? ${lat >= -55}, <= -25? ${lat <= -25}`);
    DEV_LOG(`   Bounds验证: lon[${lon}] >= 165? ${lon >= 165}, <= 185? ${lon <= 185}`);
    return inBounds;
  }

  async fetchForecast(lat: number, lon: number, date: Date): Promise<TideForecast> {
    if (!NIWA_PROVIDER_ENABLED) {
      throw new Error("NIWA tide provider disabled: configure VITE_NIWA_PROXY_URL to enable official NZ tides.");
    }

    // Format the date for NZ timezone
    // Input date should already be in UTC representing the calendar date
    const targetDateNz = nzDateFormatter.format(date);
    const startDateNz = shiftNzDateString(targetDateNz, -3);
    const endDateNz = shiftNzDateString(targetDateNz, 2);
    const numberOfDays = Math.max(
      1,
      Math.round(
        (Date.parse(`${endDateNz}T00:00:00Z`) - Date.parse(`${startDateNz}T00:00:00Z`)) /
          DAY_IN_MS
      ) + 1
    );

    const params: Record<string, string> = {
      lat: lat.toString(),
      long: lon.toString(),
      datum: NIWA_DATUM,
      startDate: startDateNz,
      numberOfDays: numberOfDays.toString()
    };

    // Never send API key from client - proxy will handle it server-side
    // Direct API calls without proxy are not supported for security reasons
    const url = buildNiwaRequestUrl(NIWA_API_BASE, params);

    DEV_LOG(`🌊 Fetching NIWA tide data via proxy: ${lat}, ${lon}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        // ENFORCED: Only proxy calls allowed - if proxy fails, NIWA is disabled
        TideLogging.dev.providerFallback('NIWA', 'Open-Meteo', `proxy error ${response.status}`);
        throw new Error(`NIWA proxy unavailable. Open-Meteo will provide tide data instead.`);
      }

      let data: NIWAResponse;
      try {
        data = await response.json();
      } catch {
        TideLogging.dev.providerFallback('NIWA', 'Open-Meteo', 'response parsing failed');
        DEV_ERROR(`Parse error: Unknown error`);
        throw new Error(`NIWA proxy returned invalid response. Open-Meteo will provide tide data instead.`);
      }

      // Handle proxy error responses gracefully
      if (data.error) {
        DEV_WARN(`NIWA proxy returned error: ${data.error}`);
        let errorMsg = 'NIWA service temporary unavailable. Open-Meteo will provide tide data instead.';
        
        // Provide more specific error messages based on proxy error type
        if (data.status === 'missing_values' || data.status === 'invalid_structure') {
          errorMsg = 'NIWA service data format issue. Open-Meteo will provide tide data instead.';
        } else if (data.status === 'authentication_error') {
          errorMsg = 'NIWA service authentication issue. Open-Meteo will provide tide data instead.';
        } else if (data.status === 'parse_error') {
          errorMsg = 'NIWA service data processing issue. Open-Meteo will provide tide data instead.';
        }
        
        throw new Error(errorMsg);
      }

      // Extract actual data from proxy response (ignore metadata)
      const niwaData = data._proxyMetadata ? {
        values: data.values,
        // Copy other relevant NIWA data fields if they exist
        ...Object.fromEntries(
          Object.entries(data).filter(([key]) => key !== '_proxyMetadata')
        )
      } : data;

      DEV_LOG(`✅ NIWA data received via proxy: ${niwaData.values?.length || 0} tide points`);
      return processTideData(niwaData, targetDateNz);

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`NIWA tide service: ${error.message}`);
      }
      throw new Error('NIWA tide service failed');
    }
  }

  async checkCoverage(lat: number, lon: number): Promise<TideCoverageStatus> {
    try {
      // NIWA API key is now only required server-side in proxy
      if (!NIWA_PROVIDER_ENABLED) {
        return {
          available: false,
          checkedAt: new Date().toISOString(),
          message: 'NIWA proxy not configured'
        };
      }

      // Test with current date
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const params: Record<string, string> = {
        lat: lat.toString(),
        long: lon.toString(),
        datum: NIWA_DATUM,
        startDate: todayStr,
        numberOfDays: "1"
      };

      // Never send API key from client - proxy will handle it server-side
      const url = buildNiwaRequestUrl(NIWA_API_BASE, params);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        // ENFORCED: Only proxy calls allowed - if proxy fails, NIWA is disabled
        DEV_WARN(`NIWA coverage check proxy unavailable (${response.status})`);
        return {
          available: false,
          checkedAt: new Date().toISOString(),
          message: 'NIWA proxy unavailable - Open-Meteo will provide tide data'
        };
      }

      let data: NIWAResponse;
      try {
        data = await response.json();
      } catch {
        DEV_WARN('NIWA coverage check response parsing failed');
        return {
          available: false,
          checkedAt: new Date().toISOString(),
          message: 'NIWA proxy response invalid - Open-Meteo will provide tide data'
        };
      }

      // Handle proxy error responses gracefully in coverage check
      if (data.error) {
        let message = 'NIWA service temporary unavailable';
        
        if (data.status === 'missing_values' || data.status === 'invalid_structure') {
          message = 'NIWA service data format issue';
        } else if (data.status === 'authentication_error') {
          message = 'NIWA service authentication issue';
        } else if (data.status === 'parse_error') {
          message = 'NIWA service data processing issue';
        }
        
        return {
          available: false,
          checkedAt: new Date().toISOString(),
          message: `${message} - Open-Meteo will provide tide data`
        };
      }

      // Extract actual data from proxy response (ignore metadata)
      const niwaData = data._proxyMetadata ? {
        values: data.values,
        ...Object.fromEntries(
          Object.entries(data).filter(([key]) => key !== '_proxyMetadata')
        )
      } : data;
      
      return {
        available: !!(niwaData.values && niwaData.values.length > 0),
        checkedAt: new Date().toISOString(),
        timezone: 'Pacific/Auckland',
        units: 'm',
        message: niwaData.values && niwaData.values.length > 0 
          ? 'NIWA official NZ tide data available' 
          : 'NIWA tide data not available for this location'
      };

    } catch {
      return {
        available: false,
        checkedAt: new Date().toISOString(),
        message: 'Failed to check NIWA coverage'
      };
    }
  }
}

function processTideData(data: NIWAResponse, targetDate: string): TideForecast {
  if (!data.values || data.values.length === 0) {
    throw new Error('NIWA API: No tide data available for location');
  }

  // Filter for target date - convert UTC timestamps to NZ time before filtering
  DEV_LOG(`🔍 NIWA Processing: Looking for date ${targetDate} in ${data.values.length} data points`);
  const firstDate = data.values[0]?.time?.split('T')[0];
  const lastDate = data.values[data.values.length-1]?.time?.split('T')[0];
  DEV_LOG(`🔍 NIWA Date range: ${firstDate} to ${lastDate} (UTC)`);

  const [targetYear, targetMonth, targetDay] = targetDate.split('-').map(Number);
  const targetReferenceUtc = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0));
  const nzOffsetSeconds = getNzOffsetSeconds(targetReferenceUtc);

  const targetDateValues = data.values.filter((point, index) => {
    const utcDate = new Date(point.time);
    const nzDateString = nzDateFormatter.format(utcDate);
    const isTarget = nzDateString === targetDate;

    if (index < 3 || isTarget) {
      DEV_LOG(`🔧 UTC: ${point.time} -> NZ: ${nzDateString} (target: ${targetDate})`);
    }

    return isTarget;
  });

  DEV_LOG(`🔍 NIWA UTC->NZ conversion: ${targetDateValues.length} points for NZ date ${targetDate}`);
  
  const seriesForDate = targetDateValues
    .map(point => ({
      time: point.time,
      height: Math.round(point.value * 100) / 100
    }));
  const extremaForDate: Array<{
    type: 'high' | 'low';
    time: string;
    height: number;
  }> = [];

  if (targetDateValues.length >= 2) {
    const first = targetDateValues[0];
    const second = targetDateValues[1];
    extremaForDate.push({
      type: first.value <= second.value ? 'low' : 'high',
      time: first.time,
      height: Math.round(first.value * 100) / 100
    });
  }

  // Detect local maxima and minima in the tide data
  for (let i = 1; i < targetDateValues.length - 1; i++) {
    const prev = targetDateValues[i - 1];
    const current = targetDateValues[i];
    const next = targetDateValues[i + 1];
    
    // Local maximum (high tide)
    if (current.value > prev.value && current.value > next.value) {
      extremaForDate.push({
        type: 'high',
        time: current.time,
        height: Math.round(current.value * 100) / 100
      });
    }
    // Local minimum (low tide)
    else if (current.value < prev.value && current.value < next.value) {
      extremaForDate.push({
        type: 'low',
        time: current.time,
        height: Math.round(current.value * 100) / 100
      });
    }
  }

  if (targetDateValues.length >= 2) {
    const last = targetDateValues[targetDateValues.length - 1];
    const prev = targetDateValues[targetDateValues.length - 2];
    extremaForDate.push({
      type: last.value >= prev.value ? 'high' : 'low',
      time: last.time,
      height: Math.round(last.value * 100) / 100
    });
  }

  // Remove duplicates and sort by time
  const uniqueExtrema = extremaForDate
    .filter((extremum, index, self) => 
      self.findIndex(e => e.time === extremum.time) === index
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  if (seriesForDate.length === 0) {
    throw new Error('NIWA API: No tide data available for selected date');
  }
  
  // If we couldn't detect extrema (less than 3 points), create artifical extrema from min/max
  let finalExtrema = uniqueExtrema;
  if (uniqueExtrema.length === 0 && seriesForDate.length > 0) {
    const heights = seriesForDate.map(point => point.height);
    const maxHeight = Math.max(...heights);
    const minHeight = Math.min(...heights);
    
    // Find the times of min and max
    const maxPoint = seriesForDate.find(point => point.height === maxHeight);
    const minPoint = seriesForDate.find(point => point.height === minHeight);
    
    if (maxPoint && minPoint) {
      finalExtrema = [
        { type: 'high' as const, time: maxPoint.time, height: maxHeight },
        { type: 'low' as const, time: minPoint.time, height: minHeight }
      ];
      DEV_LOG('🔧 NIWA: Generated extrema from min/max (insufficient points for local detection)');
    }
  }
  
  if (finalExtrema.length === 0) {
    throw new Error('NIWA API: No tide data available for selected date');
  }

  const heights = seriesForDate.map(point => point.height);
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);

  return {
    date: targetDate,
    timezone: 'Pacific/Auckland', // NZ timezone
    units: 'm',
    extrema: finalExtrema.slice(0, 4), // Limit to 4 extrema (2 pairs)
    minHeight: Math.round(minHeight * 100) / 100,
    maxHeight: Math.round(maxHeight * 100) / 100,
    series: seriesForDate,
    utcOffsetSeconds: nzOffsetSeconds
  };
}

export const nwaTideProvider = new NwaTideProvider();

// Export functions for use in provider factory
export async function fetchNwaTideForecast(
  lat: number,
  lon: number,
  date: Date
): Promise<TideForecast> {
  return nwaTideProvider.fetchForecast(lat, lon, date);
}

export async function checkNwaTideCoverage(
  lat: number,
  lon: number
): Promise<TideCoverageStatus> {
  return nwaTideProvider.checkCoverage(lat, lon);
}
