// Marea Tide Service - Global tide predictions API
import type { TideForecast, TideCoverageStatus } from "./tideService";

const MAREA_API_BASE = "https://api.marea.ooo/v2";
const MARES_API_ENDPOINT = "/tides";
const MAREA_API_KEY = import.meta.env.VITE_MAREA_API_KEY || '';

// Marea API v2 response types
interface MareaResponse {
  status: number;
  latitude: number;
  longitude: number;
  unit: string;
  timezone: string;
  timestamp: number;
  datetime: string;
  heights: Array<{
    timestamp: number;
    datetime: string;
    height: number;
    state: 'FALLING' | 'RISING';
  }>;
  extremes: Array<{
    timestamp: number;
    datetime: string;
    height: number;
    state: 'HIGH TIDE' | 'LOW TIDE';
  }>;
  source: 'STATION' | 'FES2014' | 'EOT20';
  origin: {
    latitude: number;
    longitude: number;
    distance: number;
    unit: string;
    station?: {
      id: string;
      name: string;
      provider: string;
    };
  };
}

export class MareaTideProvider {
  // Support for global locations but optimized for NZ
  supportsLocation(lat: number, lon: number): boolean {
    // Global coverage, but particularly good for NZ waters
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  async fetchForecast(lat: number, lon: number, date: Date): Promise<TideForecast> {
    // Marea API v2 uses different parameter format
    const url = new URL(`${MAREA_API_BASE}${MARES_API_ENDPOINT}`);
    url.searchParams.set('latitude', lat.toString());
    url.searchParams.set('longitude', lon.toString());
    
    // Set timestamp for start of target date (midnight UTC)
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);
    const timestamp = Math.floor(targetDate.getTime() / 1000); // Unix timestamp in seconds
    
    url.searchParams.set('timestamp', timestamp.toString());
    url.searchParams.set('duration', '2880'); // 2 days (48 hours * 60 minutes)
    url.searchParams.set('interval', '60'); // 60-minute intervals
    
    console.log(`Fetching tide data from Marea for coords: ${lat}, ${lon}`);
    
    try {
      // Add API key as query parameter to avoid CORS header issues
      if (MAREA_API_KEY) {
        url.searchParams.set('token', MAREA_API_KEY);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Maori-Fishing-Calendar'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Marea API: Authentication required - limit may be reached');
        }
        if (response.status === 429) {
          throw new Error('Marea API: Rate limit exceeded');
        }
        throw new Error(`Marea API: Status ${response.status}`);
      }

      const data: MareaResponse = await response.json();
      
      if (data.status !== 200) {
        throw new Error('Marea API: Request failed');
      }

      if (!data.heights || data.heights.length === 0) {
        throw new Error('Marea API: No tide data available for location');
      }

      // Marea API v2 provides heights and extremes directly
      const targetDate = date.toISOString().split('T')[0];
      
      // Convert Marea v2 heights to our format and filter for target date
      const seriesForDate = data.heights
        .map((point) => ({
          time: new Date(point.timestamp * 1000).toISOString(), // Convert timestamp to ISO string
          height: Math.round(point.height * 100) / 100
        }))
        .filter(point => point.time.startsWith(targetDate));

      // Convert Marea v2 extremes to our format and filter for target date
      const extremaForDate = data.extremes
        .map((extremum) => ({
          type: extremum.state === 'HIGH TIDE' ? 'high' as const : 'low' as const,
          time: new Date(extremum.timestamp * 1000).toISOString(),
          height: Math.round(extremum.height * 100) / 100
        }))
        .filter(extremum => extremum.time.startsWith(targetDate))
        .sort((a, b) => a.time.localeCompare(b.time));

      if (seriesForDate.length === 0) {
        throw new Error('Marea API: No tide data for selected date');
      }

      const heights = seriesForDate.map(point => point.height);
      const minHeight = Math.min(...heights);
      const maxHeight = Math.max(...heights);

      // Marea API v2 timezone handling
      const timezone = data.timezone || 'UTC';
      const utcOffsetSeconds = this.getTimezoneOffset(timezone);

      return {
        date: targetDate,
        timezone,
        units: data.unit || 'm',
        extrema: extremaForDate.slice(0, 6), // Limit to 6 extrema (3 high/low pairs)
        minHeight: Math.round(minHeight * 100) / 100,
        maxHeight: Math.round(maxHeight * 100) / 100,
        series: seriesForDate,
        utcOffsetSeconds
      };

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Marea tide service: ${error.message}`);
      }
      throw new Error('Marea tide service failed');
    }
  }

  async checkCoverage(lat: number, lon: number): Promise<TideCoverageStatus> {
    try {
      // Test with current timestamp to check coverage
      const url = new URL(`${MAREA_API_BASE}${MARES_API_ENDPOINT}`);
      url.searchParams.set('latitude', lat.toString());
      url.searchParams.set('longitude', lon.toString());
      url.searchParams.set('timestamp', Math.floor(Date.now() / 1000).toString());
      url.searchParams.set('duration', '1440'); // 1 day
      url.searchParams.set('interval', '60');

      // Add API key as query parameter to avoid CORS header issues
      if (MAREA_API_KEY) {
        url.searchParams.set('token', MAREA_API_KEY);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data: MareaResponse = await response.json();
        return {
          available: data.status === 200 && !!data.heights,
          checkedAt: new Date().toISOString(),
          timezone: data.timezone || 'UTC',
          units: data.unit || 'm',
          message: data.origin.station 
            ? `Marea data available via ${data.origin.station.name} (${data.origin.distance.toFixed(1)}km away)`
            : 'Marea tide data available for this location'
        };
      }

      return {
        available: false,
        checkedAt: new Date().toISOString(),
        message: 'Marea API not accessible'
      };

    } catch (error) {
      return {
        available: false,
        checkedAt: new Date().toISOString(),
        message: 'Failed to check Marea coverage'
      };
    }
  }

  private getTimezoneOffset(timezone: string): number {
    // Simple timezone offset calculation
    // This is approximate - could be enhanced with proper timezone parsing
    const nzOffsets: Record<string, number> = {
      'Pacific/Auckland': 43200, // +12 hours
      'Pacific/Chatham': 45900,  // +12:45 hours
      'UTC': 0
    };

    return nzOffsets[timezone] ?? 0;
  }
}

export const mareaTideProvider = new MareaTideProvider();

// Export functions for use in provider factory
export async function fetchMareaTideForecast(
  lat: number,
  lon: number,
  date: Date
): Promise<TideForecast> {
  return mareaTideProvider.fetchForecast(lat, lon, date);
}

export async function checkMareaTideCoverage(
  lat: number,
  lon: number
): Promise<TideCoverageStatus> {
  return mareaTideProvider.checkCoverage(lat, lon);
}
