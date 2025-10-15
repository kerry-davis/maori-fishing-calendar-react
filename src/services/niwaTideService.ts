// NIWA Tide Service - Official NZ tide data from NIWA
import type { TideForecast, TideCoverageStatus } from "./tideService";

const RAW_PROXY_URL = (import.meta.env.VITE_NIWA_PROXY_URL ?? "").trim();

// ENFORCED: NIWA only works through proxy - no direct browser calls allowed
export const NIWA_PROVIDER_ENABLED = RAW_PROXY_URL !== "";

if (!NIWA_PROVIDER_ENABLED) {
  console.warn("🚫 NIWA tide provider disabled: VITE_NIWA_PROXY_URL must be configured for proxy-only usage.");
  console.info("ℹ️  Open-Meteo will be used as fallback tide provider.");
}

// Only proxy URL is allowed - direct browser calls are explicitly prohibited
const NIWA_API_BASE = RAW_PROXY_URL;

function buildNiwaRequestUrl(base: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params);

  if (/^https?:\/\//i.test(base)) {
    const url = new URL(base);
    if (url.hostname === "api.niwa.co.nz") {
      console.error("🚫 SECURITY ERROR: Direct NIWA API calls are prohibited");
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
  values: NIWATideValues[];
}

export class NwaTideProvider {
  supportsLocation(lat: number, lon: number): boolean {
    // ENFORCED: NIWA provider only works through proxy
    if (!NIWA_PROVIDER_ENABLED) {
      console.log(`🚫 NIWA provider disabled (proxy not configured) - using Open-Meteo fallback`);
      return false;
    }
    
    // NIWA covers New Zealand waters approximately - generous marine bounds
    const inBounds = lat >= -55 && lat <= -25 && lon >= 165 && lon <= 185;
    console.log(`🌊 NIWA location check: ${lat}, ${lon} -> ${inBounds ? 'IN_BOUNDS' : 'OUT_OF_BOUNDS'}`);
    console.log(`   Bounds验证: lat[${lat}] >= -55? ${lat >= -55}, <= -25? ${lat <= -25}`);
    console.log(`   Bounds验证: lon[${lon}] >= 165? ${lon >= 165}, <= 185? ${lon <= 185}`);
    return inBounds;
  }

  async fetchForecast(lat: number, lon: number, date: Date): Promise<TideForecast> {
    if (!NIWA_PROVIDER_ENABLED) {
      throw new Error("NIWA tide provider disabled: configure VITE_NIWA_PROXY_URL to enable official NZ tides.");
    }

    const targetDate = date.toISOString().split('T')[0];
    const tomorrowDate = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const params: Record<string, string> = {
      lat: lat.toString(),
      long: lon.toString(),
      datum: 'MSL',
      startDate: targetDate,
      endDate: tomorrowDate
    };

    // Never send API key from client - proxy will handle it server-side
    // Direct API calls without proxy are not supported for security reasons
    const url = buildNiwaRequestUrl(NIWA_API_BASE, params);

    console.log(`🌊 Fetching NIWA tide data via proxy: ${lat}, ${lon}`);
    console.log(`📡 Proxy URL: PROXY: ${url}`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        // ENFORCED: Only proxy calls allowed - if proxy fails, NIWA is disabled
        console.warn(`⚠️ NIWA proxy unavailable (${response.status}), switching to Open-Meteo`);
        throw new Error(`NIWA proxy unavailable. Open-Meteo will provide tide data instead.`);
      }

      const data: NIWAResponse = await response.json();
      console.log(`✅ NIWA data received via proxy: ${data.values?.length || 0} tide points`);
      return processTideData(data, targetDate);

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
        datum: 'MSL',
        startDate: todayStr,
        endDate: todayStr
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
        console.warn(`⚠️ NIWA proxy unavailable (${response.status}), Open-Meteo will be used`);
        return {
          available: false,
          checkedAt: new Date().toISOString(),
          message: 'NIWA proxy unavailable - Open-Meteo will provide tide data'
        };
      }

      const data: NIWAResponse = await response.json();
      
      return {
        available: !!(data.values && data.values.length > 0),
        checkedAt: new Date().toISOString(),
        timezone: 'Pacific/Auckland',
        units: 'm',
        message: data.values && data.values.length > 0 
          ? 'NIWA official NZ tide data available' 
          : 'NIWA tide data not available for this location'
      };

    } catch (error) {
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

  // Filter for target date and convert to our format
  const seriesForDate = data.values
    .filter(point => point.time.startsWith(targetDate))
    .map(point => ({
      time: point.time,
      height: Math.round(point.value * 100) / 100
    }));

  // Find extrema (high/low tides) for target date by detecting local maxima and minima
  const targetDateValues = data.values.filter(point => point.time.startsWith(targetDate));
  const extremaForDate: Array<{
    type: 'high' | 'low';
    time: string;
    height: number;
  }> = [];

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

  // Remove duplicates and sort by time
  const uniqueExtrema = extremaForDate
    .filter((extremum, index, self) => 
      self.findIndex(e => e.time === extremum.time) === index
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  if (seriesForDate.length === 0 || uniqueExtrema.length === 0) {
    throw new Error('NIWA API: No tide data available for selected date');
  }

  const heights = seriesForDate.map(point => point.height);
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);

  return {
    date: targetDate,
    timezone: 'Pacific/Auckland', // NZ timezone
    units: 'm',
    extrema: uniqueExtrema.slice(0, 4), // Limit to 4 extrema (2 pairs)
    minHeight: Math.round(minHeight * 100) / 100,
    maxHeight: Math.round(maxHeight * 100) / 100,
    series: seriesForDate,
    utcOffsetSeconds: 43200 // NZST offset (12 hours)
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
