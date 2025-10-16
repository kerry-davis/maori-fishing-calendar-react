import { 
  fetchTideForecast, 
  checkTideCoverage,
  type TideForecast, 
  type TideCoverageStatus 
} from "./tideService";
import { 
  nwaTideProvider, 
  fetchNwaTideForecast, 
  checkNwaTideCoverage 
} from "./niwaTideService";
import type { UserLocation } from "../types";
import { DEV_LOG } from "../utils/loggingHelpers";

export interface TideProvider {
  readonly name: string;
  readonly priority: number; // Lower number = higher priority
  readonly supportsLocation: (lat: number, lon: number) => boolean;
  fetchForecast: (lat: number, lon: number, date: Date) => Promise<TideForecast>;
  checkCoverage: (lat: number, lon: number) => Promise<TideCoverageStatus>;
}

// NIWA tide provider - official NZ tide data (preferred for accuracy)
class NwaTideProviderWrapper implements TideProvider {
  readonly name = "NIWA API (Official NZ)";
  readonly priority = 1; // Primary provider for accurate NZ harbor predictions

  supportsLocation(lat: number, lon: number): boolean {
    return nwaTideProvider.supportsLocation(lat, lon);
  }

  async fetchForecast(lat: number, lon: number, date: Date): Promise<TideForecast> {
    return fetchNwaTideForecast(lat, lon, date);
  }

  async checkCoverage(lat: number, lon: number): Promise<TideCoverageStatus> {
    return checkNwaTideCoverage(lat, lon);
  }
}

// Open-Meteo enhanced NZ harbour support (secondary)
class OpenMeteoTideProvider implements TideProvider {
  readonly name = "Open-Meteo (Enhanced NZ)";
  readonly priority = 2; // Secondary backup provider

  supportsLocation(): boolean {
    return true; // Always available as fallback
  }

  async fetchForecast(lat: number, lon: number, date: Date): Promise<TideForecast> {
    return fetchTideForecast(lat, lon, date);
  }

  async checkCoverage(lat: number, lon: number): Promise<TideCoverageStatus> {
    return checkTideCoverage(lat, lon);
  }
}

// Fallback provider using the original implementation
class FallbackTideProvider implements TideProvider {
  readonly name = "Original Tide Service";
  readonly priority = 3; // Tertiary fallback
  
  supportsLocation(): boolean {
    return true; // Always available as fallback
  }

  async fetchForecast(lat: number, lon: number, date: Date): Promise<TideForecast> {
    return fetchTideForecast(lat, lon, date);
  }

  async checkCoverage(lat: number, lon: number): Promise<TideCoverageStatus> {
    return checkTideCoverage(lat, lon);
  }
}

// Provider factory with NIWA as primary and reliable fallbacks
export class TideProviderFactory {
  private static providers: TideProvider[] = [
    new NwaTideProviderWrapper(),
    new OpenMeteoTideProvider(),
    new FallbackTideProvider()
  ];

  static {
    DEV_LOG('🌊 Tide Provider Factory initialized:');
    DEV_LOG('   1️⃣ Primary: NIWA API (Official NZ tide data)');
    DEV_LOG('   2️⃣ Secondary: Open-Meteo (Enhanced NZ)');
    DEV_LOG('   3️⃣ Fallback: Original Tide Service');
  }

  // Get best available provider for location
  static getProvider(lat: number, lon: number): TideProvider {
    DEV_LOG(`🔍 Checking providers for location: ${lat}, ${lon}`);
    
    const availableProviders = this.providers
      .filter(provider => {
        const supports = provider.supportsLocation(lat, lon);
        DEV_LOG(`  - ${provider.name}: ${supports ? '✅ SUPPORTS' : '❌ NOT SUPPORTED'}`);
        return supports;
      })
      .sort((a, b) => a.priority - b.priority);

    const selectedProvider = availableProviders[0] || this.providers[this.providers.length - 1];
    DEV_LOG(`📡 Selected provider: ${selectedProvider.name} (priority: ${selectedProvider.priority})`);
    
    return selectedProvider;
  }

  // Fetch tide data with automatic fallback
  static async fetchTideWithFallback(
    lat: number, 
    lon: number, 
    date: Date
  ): Promise<{
    forecast: TideForecast;
    provider: TideProvider;
    fallbackUsed: boolean;
  }> {
    const providers = this.providers
      .filter(provider => provider.supportsLocation(lat, lon))
      .sort((a, b) => a.priority - b.priority);

    let lastError: Error | null = null;

    DEV_LOG('REFERENCE: MetService Kawhia TODAY (Wed 15 Oct)');
    DEV_LOG('HIGH: 05:30 (2.9m)');
    DEV_LOG('LOW: 11:22 (1.3m)'); 
    DEV_LOG('HIGH: 18:09 (3.0m)');
    DEV_LOG('=================================================');

    for (const provider of providers) {
      try {
        DEV_LOG(`Attempting tide fetch with ${provider.name}`);
        const forecast = await provider.fetchForecast(lat, lon, date);
        
        // Validate forecast data
        if (this.validateForecast(forecast)) {
          DEV_LOG(`${provider.name} SUCCESS! Using data from ${provider.name}`);
          DEV_LOG(`=== TIDE COMPARISON FOR ${provider.name} ===`);
          DEV_LOG('HIGH TIDES:', forecast.extrema.filter(e => e.type === 'high').map(e => `${e.time.split('T')[1].substring(0,5)} (${e.height}m)`));
          DEV_LOG('LOW TIDES:', forecast.extrema.filter(e => e.type === 'low').map(e => `${e.time.split('T')[1].substring(0,5)} (${e.height}m)`));
          DEV_LOG('=======================================');
          return {
            forecast,
            provider,
            fallbackUsed: provider.priority > 1
          };
        } else {
          console.warn(`${provider.name} returned invalid data, trying next provider`);
          DEV_LOG('Validation failed on forecast:', forecast);
          if (forecast && forecast.extrema) {
            DEV_LOG('FAILED TIDE DATA:');
            DEV_LOG('HIGH TIDES:', forecast.extrema.filter(e => e.type === 'high').map(e => `${e.time.split('T')[1].substring(0,5)} (${e.height}m)`));
            DEV_LOG('LOW TIDES:', forecast.extrema.filter(e => e.type === 'low').map(e => `${e.time.split('T')[1].substring(0,5)} (${e.height}m)`));
          }
        }
      } catch (error) {
        console.warn(`${provider.name} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }

    // All providers failed
    throw lastError || new Error("All tide providers failed");
  }

  // Validate forecast data quality
  private static validateForecast(forecast: TideForecast): boolean {
    // Basic validation
    if (!forecast || !forecast.extrema || forecast.extrema.length === 0) {
      return false;
    }

    // Check for reasonable tide heights (NZ specific bounds)
    const heights = forecast.extrema.map(e => e.height);
    const maxValidHeight = 8.0; // meters - generous upper bound for NZ (some harbours can exceed 5m)
    const minValidHeight = -3.0; // meters - allow more negative values for safety
    
    if (heights.some(h => h > maxValidHeight || h < minValidHeight)) {
      return false;
    }

    // Check for reasonable number of extrema (2-4 per day)
    if (forecast.extrema.length > 6) {
      return false;
    }

    // Check for time spread (allow reasonable range for multi-day forecasts)
    const times = forecast.extrema.map(e => new Date(e.time).getTime());
    const timeSpan = Math.max(...times) - Math.min(...times);
    const hoursSpan = timeSpan / (1000 * 60 * 60);
    
    if (hoursSpan > 72 || hoursSpan < 6) { // Allow up to 3 days, minimum 6 hours
      return false;
    }

    return true;
  }

  // Get all available providers (for testing/monitoring)
  static getAllProviders(): TideProvider[] {
    return [...this.providers];
  }
}

// Main export function for use in the app
export async function fetchTideForLocation(
  location: UserLocation,
  date: Date,
  _options?: { forceRefresh?: boolean }
): Promise<TideForecast> {
  const result = await TideProviderFactory.fetchTideWithFallback(
    location.lat,
    location.lon,
    date
  );

  if (result.fallbackUsed) {
    DEV_LOG(`Using fallback provider: ${result.provider.name}`);
  }

  return result.forecast;
}

// Re-export types for convenience
export type { TideForecast, TideCoverageStatus, TideError } from "./tideService";
export { getTideErrorMessage } from "./tideService";
