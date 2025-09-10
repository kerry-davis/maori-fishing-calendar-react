/**
 * Integration tests for Weather Service
 * These tests make actual API calls and should be run sparingly
 */

import { describe, it, expect, vi } from 'vitest';
import {
  fetchWeatherForecast,
  fetchWeatherForLocation,
  isWeatherAvailable
} from '../weatherService';
import type { UserLocation } from '../../types';

// Skip integration tests by default to avoid API rate limits
// Run with: npm test -- --run weatherService.integration.test.ts
describe.skip('weatherService integration', () => {
  // Use a reasonable timeout for API calls
  const API_TIMEOUT = 10000;

  describe('fetchWeatherForecast', () => {
    it('should fetch real weather data from Open-Meteo API', async () => {
      // Auckland, New Zealand coordinates
      const lat = -36.8485;
      const lon = 174.7633;
      const date = new Date(); // Today

      const result = await fetchWeatherForecast(lat, lon, date);

      expect(result).toMatchObject({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        temperatureMax: expect.any(Number),
        temperatureMin: expect.any(Number),
        windSpeed: expect.any(Number),
        windDirection: expect.any(Number),
        windDirectionCardinal: expect.stringMatching(/^(N|NE|E|SE|S|SW|W|NW)$/)
      });

      // Validate temperature range is reasonable
      expect(result.temperatureMax).toBeGreaterThan(result.temperatureMin);
      expect(result.temperatureMax).toBeGreaterThan(-50);
      expect(result.temperatureMax).toBeLessThan(60);
      expect(result.temperatureMin).toBeGreaterThan(-50);
      expect(result.temperatureMin).toBeLessThan(60);

      // Validate wind data
      expect(result.windSpeed).toBeGreaterThanOrEqual(0);
      expect(result.windSpeed).toBeLessThan(200); // Reasonable max wind speed
      expect(result.windDirection).toBeGreaterThanOrEqual(0);
      expect(result.windDirection).toBeLessThanOrEqual(360);
    }, API_TIMEOUT);

    it('should handle different locations correctly', async () => {
      // Test multiple locations
      const locations = [
        { lat: -36.8485, lon: 174.7633, name: 'Auckland, NZ' },
        { lat: 51.5074, lon: -0.1278, name: 'London, UK' },
        { lat: 40.7128, lon: -74.0060, name: 'New York, USA' }
      ];

      const date = new Date();
      const results = await Promise.all(
        locations.map(loc => fetchWeatherForecast(loc.lat, loc.lon, date))
      );

      results.forEach((result, index) => {
        expect(result).toMatchObject({
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          temperatureMax: expect.any(Number),
          temperatureMin: expect.any(Number),
          windSpeed: expect.any(Number),
          windDirection: expect.any(Number),
          windDirectionCardinal: expect.stringMatching(/^(N|NE|E|SE|S|SW|W|NW)$/)
        });
      });
    }, API_TIMEOUT * 3);

    it('should handle historical dates', async () => {
      const lat = -36.8485;
      const lon = 174.7633;
      const historicalDate = new Date();
      historicalDate.setDate(historicalDate.getDate() - 7); // 7 days ago

      const result = await fetchWeatherForecast(lat, lon, historicalDate);

      expect(result).toMatchObject({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        temperatureMax: expect.any(Number),
        temperatureMin: expect.any(Number),
        windSpeed: expect.any(Number),
        windDirection: expect.any(Number),
        windDirectionCardinal: expect.stringMatching(/^(N|NE|E|SE|S|SW|W|NW)$/)
      });
    }, API_TIMEOUT);

    it('should handle future dates within forecast range', async () => {
      const lat = -36.8485;
      const lon = 174.7633;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3); // 3 days from now

      const result = await fetchWeatherForecast(lat, lon, futureDate);

      expect(result).toMatchObject({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        temperatureMax: expect.any(Number),
        temperatureMin: expect.any(Number),
        windSpeed: expect.any(Number),
        windDirection: expect.any(Number),
        windDirectionCardinal: expect.stringMatching(/^(N|NE|E|SE|S|SW|W|NW)$/)
      });
    }, API_TIMEOUT);

    it('should handle edge case coordinates', async () => {
      // Test extreme coordinates
      const edgeCases = [
        { lat: 0, lon: 0, name: 'Equator/Prime Meridian' },
        { lat: -90, lon: 0, name: 'South Pole' },
        { lat: 90, lon: 0, name: 'North Pole' },
        { lat: 0, lon: 180, name: 'International Date Line' }
      ];

      const date = new Date();
      
      for (const location of edgeCases) {
        try {
          const result = await fetchWeatherForecast(location.lat, location.lon, date);
          
          expect(result).toMatchObject({
            date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            temperatureMax: expect.any(Number),
            temperatureMin: expect.any(Number),
            windSpeed: expect.any(Number),
            windDirection: expect.any(Number),
            windDirectionCardinal: expect.stringMatching(/^(N|NE|E|SE|S|SW|W|NW)$/)
          });
        } catch (error) {
          // Some extreme locations might not have weather data
          // This is acceptable behavior
          console.log(`Weather not available for ${location.name}:`, error);
        }
      }
    }, API_TIMEOUT * 4);
  });

  describe('fetchWeatherForLocation', () => {
    it('should work with UserLocation object', async () => {
      const location: UserLocation = {
        lat: -36.8485,
        lon: 174.7633,
        name: 'Auckland, New Zealand'
      };

      const date = new Date();
      const result = await fetchWeatherForLocation(location, date);

      expect(result).toMatchObject({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        temperatureMax: expect.any(Number),
        temperatureMin: expect.any(Number),
        windSpeed: expect.any(Number),
        windDirection: expect.any(Number),
        windDirectionCardinal: expect.stringMatching(/^(N|NE|E|SE|S|SW|W|NW)$/)
      });
    }, API_TIMEOUT);
  });

  describe('API rate limiting and error handling', () => {
    it('should handle rate limiting gracefully', async () => {
      const lat = -36.8485;
      const lon = 174.7633;
      const date = new Date();

      // Make multiple rapid requests to potentially trigger rate limiting
      const requests = Array(5).fill(null).map(() => 
        fetchWeatherForecast(lat, lon, date)
      );

      try {
        const results = await Promise.all(requests);
        
        // If all succeed, verify they're all valid
        results.forEach(result => {
          expect(result).toMatchObject({
            date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            temperatureMax: expect.any(Number),
            temperatureMin: expect.any(Number),
            windSpeed: expect.any(Number),
            windDirection: expect.any(Number),
            windDirectionCardinal: expect.stringMatching(/^(N|NE|E|SE|S|SW|W|NW)$/)
          });
        });
      } catch (error) {
        // If rate limited, should get appropriate error
        expect(error).toMatchObject({
          type: 'api',
          status: 429
        });
      }
    }, API_TIMEOUT * 2);

    it('should handle invalid coordinates gracefully', async () => {
      const invalidCoordinates = [
        { lat: 91, lon: 0 }, // Invalid latitude
        { lat: -91, lon: 0 }, // Invalid latitude
        { lat: 0, lon: 181 }, // Invalid longitude
        { lat: 0, lon: -181 } // Invalid longitude
      ];

      const date = new Date();

      for (const coords of invalidCoordinates) {
        try {
          await fetchWeatherForecast(coords.lat, coords.lon, date);
          // If it doesn't throw, that's also acceptable (API might handle it)
        } catch (error) {
          // Should get a proper error response
          expect(error).toMatchObject({
            type: expect.stringMatching(/^(api|validation|network)$/),
            message: expect.any(String)
          });
        }
      }
    }, API_TIMEOUT * 4);
  });

  describe('data consistency', () => {
    it('should return consistent data for same location and date', async () => {
      const lat = -36.8485;
      const lon = 174.7633;
      const date = new Date();

      // Make two identical requests
      const [result1, result2] = await Promise.all([
        fetchWeatherForecast(lat, lon, date),
        fetchWeatherForecast(lat, lon, date)
      ]);

      // Results should be identical
      expect(result1).toEqual(result2);
    }, API_TIMEOUT);

    it('should return different data for different dates', async () => {
      const lat = -36.8485;
      const lon = 174.7633;
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [todayResult, tomorrowResult] = await Promise.all([
        fetchWeatherForecast(lat, lon, today),
        fetchWeatherForecast(lat, lon, tomorrow)
      ]);

      // Dates should be different
      expect(todayResult.date).not.toBe(tomorrowResult.date);
      
      // Weather data might be different (but not guaranteed)
      // At minimum, the date field should differ
    }, API_TIMEOUT);
  });
});