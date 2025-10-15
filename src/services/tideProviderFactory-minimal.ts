import { 
  fetchTideForecast, 
  checkTideCoverage,
  type TideForecast, 
  type TideCoverageStatus 
} from "./tideService";
import type { UserLocation } from "../types";

export interface TideProvider {
  readonly name: string;
  readonly priority: number; // Lower number = higher priority
  readonly supportsLocation: (lat: number, lon: number) => boolean;
  fetchForecast: (lat: number, lon: number, date: Date) => Promise<TideForecast>;
  checkCoverage: (lat: number, lon: number) => Promise<TideCoverageStatus>;
}

// NIWA tide provider - Official NZ tide data
class NwaTideProvider implements TideProvider {
  readonly name = "NIWA API (Official NZ)";
  readonly priority = 1; // Primary provider for accurate NZ accuracy

  supportsLocation(lat: number, lon: number): boolean {
    return lat >= -55 && lat <= -25 && lon >= 160 && lon <= 185;
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
  readonly priority = 2; // Secondary fallback
  
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

// Simple provider factory with just NIWA and original fallback
export class SimpleTideProviderFactory {
  private static providers: TideProvider[] = [
    new NwaTideProvider(),
    new FallbackTideProvider()
  ];

  // Get best available provider for location
  static getProvider(lat: number, lon: number): TideProvider {
    const availableProviders = this.providers
      .filter(provider => provider.supportsLocation(lat, lon))
      .sort((a, b) => a.priority - b.priority);

    return availableProviders[0] || this.providers[this.providers.length - 1];
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

    for (const provider of providers) {
      try {
        console.log(`Attempting tide fetch with ${provider.name}`);
        const forecast = await provider.fetchForecast(lat, lon, date);
        
        // Validate forecast data
        if (this.validateForecast(forecast)) {
          console.log(`${provider.name} SUCCESS! Using data from ${provider.name}`);
          return {
            forecast,
            provider,
            fallbackUsed: provider.priority > 1
          };
        } else {
          console.warn(`${provider.name} returned invalid data, trying next provider`);
        }
      } catch (error) {
        console.warn(`${provider.name} failed:`, error);
        lastError = error as Error;
        continue;
      }
    }

    // If all providers fail
    throw lastError || new Error("All tide providers failed");
  }

  // Validate tide data quality
  private static validateForecast(forecast: TideForecast): boolean {
    // Basic validation
    if (!forecast || !forecast.extrema || forecast.extrema.length === 0) {
      return false;
    }

    // Check for reasonable tide heights (NZ specific bounds)
    const heights = forecast.extrema.map(e => e.height);
    const maxValidHeight = 8.0; // meters - generous upper bound for NZ
    const minValidHeight = -3.0; // meters - allow slight negative values
    
    if (heights.some(h => h > maxValidHeight || h < minValidHeight)) {
      return false;
    }

    // Check for reasonable number of extrema (2-4 per day)
    if (forecast.extrema.length > 6) {
      return false;
    }

    // Check for time spread (within 24-48 hours)
    const times = forecast.extrema.map(e => new Date(e.time).getTime());
    const timeSpan = Math.max(...times) - Math.min(...times);
    const hoursSpan = timeSpan / (1000 * 60);
    
    if (hoursSpan > 48 || hoursSpan < 6) { // Allow buffer for timezone issues
      return false;
    }

    return true;
  }
}

// Main export function for use in the app
export async function fetchTideForLocation(
  location: UserLocation,
  date: Date,
  _options?: { forceRefresh?: boolean }
): Promise<TideForecast> {
  const result = await SimpleTideProviderFactory.fetchTideWithFallback(
    location.lat,
    location.lon,
    date
  );

  if (result.fallbackUsed) {
    console.log(`Using fallback provider: ${result.provider.name}`);
  }

  return result.forecast;
}

// Re-export types for convenience
export type { TideForecast, TideCoverageStatus } from "./tideService";
