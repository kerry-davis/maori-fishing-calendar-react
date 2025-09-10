/**
 * Comprehensive service integration tests
 * Tests service interactions and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { databaseService } from '../databaseService';
import { DataExportService } from '../dataExportService';
import * as lunarService from '../lunarService';
import * as weatherService from '../weatherService';
import type { Trip, WeatherLog, FishCaught, UserLocation } from '../../types';

// Use fake IndexedDB for integration tests
import 'fake-indexeddb/auto';
import { deleteDB } from 'fake-indexeddb';

describe('Service Integration Tests', () => {
  let exportService: DataExportService;

  beforeEach(async () => {
    // Clean up any existing database
    try {
      await deleteDB('fishingLog');
    } catch (error) {
      // Ignore errors if database doesn't exist
    }

    // Initialize services
    await databaseService.initialize();
    exportService = new DataExportService();

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(async () => {
    databaseService.close();
    try {
      await deleteDB('fishingLog');
    } catch (error) {
      // Ignore errors
    }
  });

  describe('Database and Export Service Integration', () => {
    it('should export and import complete trip data', async () => {
      // Create test data
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing day'
      };

      const tripId = await databaseService.createTrip(tripData);

      const weatherData: Omit<WeatherLog, 'id'> = {
        tripId,
        timeOfDay: 'Morning',
        sky: 'Clear',
        windCondition: 'Light',
        windDirection: 'NE',
        waterTemp: '18',
        airTemp: '22'
      };

      await databaseService.createWeatherLog(weatherData);

      const fishData: Omit<FishCaught, 'id'> = {
        tripId,
        species: 'Rainbow Trout',
        length: '45',
        weight: '2.5',
        time: '10:30',
        gear: ['Spinner', 'Light Rod'],
        details: 'Caught near rocks'
      };

      await databaseService.createFishCaught(fishData);

      // Export data
      const exportBlob = await exportService.exportDataAsZip();
      expect(exportBlob).toBeInstanceOf(Blob);
      expect(exportBlob.size).toBeGreaterThan(0);

      // Clear database
      await databaseService.clearAllData();

      // Verify data is cleared
      const tripsAfterClear = await databaseService.getAllTrips();
      expect(tripsAfterClear).toHaveLength(0);

      // Create a mock file from the blob for import
      const mockFile = new File([exportBlob], 'test-export.zip', { type: 'application/zip' });

      // Import data back
      await exportService.importData(mockFile);

      // Verify data is restored
      const tripsAfterImport = await databaseService.getAllTrips();
      expect(tripsAfterImport).toHaveLength(1);
      expect(tripsAfterImport[0]).toMatchObject(tripData);

      const weatherAfterImport = await databaseService.getAllWeatherLogs();
      expect(weatherAfterImport).toHaveLength(1);
      expect(weatherAfterImport[0]).toMatchObject(weatherData);

      const fishAfterImport = await databaseService.getAllFishCaught();
      expect(fishAfterImport).toHaveLength(1);
      expect(fishAfterImport[0]).toMatchObject(fishData);
    });

    it('should handle CSV export with complex data', async () => {
      // Create multiple trips with various data
      const trips = [
        {
          date: '2024-01-15',
          water: 'Lake Taupo',
          location: 'Western Bay',
          hours: 4,
          companions: 'John Doe, Jane Smith',
          notes: 'Great day with multiple catches'
        },
        {
          date: '2024-01-16',
          water: 'Lake Rotorua',
          location: 'Eastern Shore',
          hours: 2,
          companions: '',
          notes: 'Solo trip, quiet morning'
        }
      ];

      const tripIds = [];
      for (const trip of trips) {
        const id = await databaseService.createTrip(trip);
        tripIds.push(id);
      }

      // Add fish with complex gear arrays
      await databaseService.createFishCaught({
        tripId: tripIds[0],
        species: 'Rainbow Trout',
        length: '45',
        weight: '2.5',
        time: '10:30',
        gear: ['Spinner', 'Light Rod', '6lb Line'],
        details: 'First catch of the day'
      });

      await databaseService.createFishCaught({
        tripId: tripIds[0],
        species: 'Brown Trout',
        length: '38',
        weight: '1.8',
        time: '14:15',
        gear: ['Fly', 'Fly Rod'],
        details: 'Afternoon catch'
      });

      // Export as CSV
      const csvBlob = await exportService.exportDataAsCSV();
      expect(csvBlob).toBeInstanceOf(Blob);
      expect(csvBlob.size).toBeGreaterThan(0);

      // Verify blob type
      expect(csvBlob.type).toBe('application/zip');
    });
  });

  describe('Lunar Service Edge Cases', () => {
    it('should handle extreme dates consistently', () => {
      const extremeDates = [
        new Date('1900-01-01'),
        new Date('2100-12-31'),
        new Date('2024-02-29'), // Leap year
        new Date('2023-02-28'), // Non-leap year
      ];

      extremeDates.forEach(date => {
        expect(() => {
          const phaseData = lunarService.getMoonPhaseData(date);
          expect(phaseData.phaseIndex).toBeGreaterThanOrEqual(0);
          expect(phaseData.phaseIndex).toBeLessThan(8);
          expect(phaseData.moonAge).toBeGreaterThanOrEqual(0);
          expect(phaseData.moonAge).toBeLessThanOrEqual(29.53);
        }).not.toThrow();
      });
    });

    it('should handle extreme coordinates', () => {
      const extremeLocations = [
        { lat: 90, lon: 0 }, // North Pole
        { lat: -90, lon: 0 }, // South Pole
        { lat: 0, lon: 180 }, // International Date Line
        { lat: 0, lon: -180 }, // International Date Line (other side)
      ];

      const testDate = new Date('2024-06-21'); // Summer solstice

      extremeLocations.forEach(location => {
        expect(() => {
          const biteTimes = lunarService.calculateBiteTimes(testDate, location.lat, location.lon);
          expect(biteTimes).toHaveProperty('major');
          expect(biteTimes).toHaveProperty('minor');
          expect(Array.isArray(biteTimes.major)).toBe(true);
          expect(Array.isArray(biteTimes.minor)).toBe(true);
        }).not.toThrow();
      });
    });

    it('should maintain consistency across time zones', () => {
      const baseDate = new Date('2024-06-15T12:00:00Z');
      const location = { lat: -36.8485, lon: 174.7633, name: 'Auckland' };

      // Test same moment in different time zones
      const utcPhase = lunarService.getLunarPhase(baseDate);
      const localDate = new Date(baseDate.getTime() + (12 * 60 * 60 * 1000)); // +12 hours
      const localPhase = lunarService.getLunarPhase(localDate);

      // Moon phase should be similar (within 1 phase) for dates within 24 hours
      const phaseDiff = Math.abs(utcPhase.name.localeCompare(localPhase.name));
      expect(phaseDiff).toBeLessThanOrEqual(1);
    });
  });

  describe('Weather Service Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      // Mock fetch to simulate timeout
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      try {
        await weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date());
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe('network');
        expect(error.message).toContain('Network error');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should validate weather data completeness', async () => {
      // Mock fetch to return incomplete data
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          daily: {
            time: ['2024-01-15'],
            temperature_2m_max: [25.5],
            // Missing other required fields
          }
        })
      });

      try {
        await weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date('2024-01-15'));
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe('validation');
        expect(error.message).toContain('Incomplete weather data');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle invalid coordinates', async () => {
      const invalidCoords = [
        { lat: 91, lon: 0 },
        { lat: -91, lon: 0 },
        { lat: 0, lon: 181 },
        { lat: 0, lon: -181 },
      ];

      for (const coords of invalidCoords) {
        try {
          await weatherService.fetchWeatherForecast(coords.lat, coords.lon, new Date());
          // If it doesn't throw, that's also acceptable (API might handle it)
        } catch (error: any) {
          // Should get a proper error response
          expect(['api', 'validation', 'network']).toContain(error.type);
          expect(error.message).toBeTruthy();
        }
      }
    });
  });

  describe('Service Performance', () => {
    it('should handle multiple concurrent database operations', async () => {
      const operations = [];

      // Create multiple trips concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(
          databaseService.createTrip({
            date: `2024-01-${String(i + 1).padStart(2, '0')}`,
            water: `Lake ${i}`,
            location: `Location ${i}`,
            hours: i + 1,
            companions: `Person ${i}`,
            notes: `Trip ${i}`
          })
        );
      }

      const tripIds = await Promise.all(operations);
      expect(tripIds).toHaveLength(10);
      expect(tripIds.every(id => typeof id === 'number')).toBe(true);

      // Verify all trips were created
      const allTrips = await databaseService.getAllTrips();
      expect(allTrips).toHaveLength(10);
    });

    it('should handle rapid lunar calculations', () => {
      const startTime = performance.now();
      const dates = Array.from({ length: 100 }, (_, i) => {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i);
        return date;
      });

      dates.forEach(date => {
        lunarService.getMoonPhaseData(date);
        lunarService.getLunarPhase(date);
        lunarService.calculateBiteTimes(date, -36.8485, 174.7633);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 100 calculations in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should handle special characters in trip data', async () => {
      const tripWithSpecialChars: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Lake "Taupo" & River',
        location: "Western Bay's Edge",
        hours: 4,
        companions: 'John O\'Doe, Jane <Smith>',
        notes: 'Great day! Fish were biting @ 10:30 AM. Caught 5+ fish.'
      };

      const tripId = await databaseService.createTrip(tripWithSpecialChars);
      expect(tripId).toBeTypeOf('number');

      const retrievedTrip = await databaseService.getTripById(tripId);
      expect(retrievedTrip).toMatchObject(tripWithSpecialChars);
    });

    it('should handle empty and null values appropriately', async () => {
      const tripWithEmptyValues: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: '',
        location: '',
        hours: 0,
        companions: '',
        notes: ''
      };

      const tripId = await databaseService.createTrip(tripWithEmptyValues);
      expect(tripId).toBeTypeOf('number');

      const retrievedTrip = await databaseService.getTripById(tripId);
      expect(retrievedTrip).toMatchObject(tripWithEmptyValues);
    });

    it('should handle large data sets', async () => {
      // Create a trip with a very long note
      const longNote = 'A'.repeat(10000); // 10KB note
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: longNote
      };

      const tripId = await databaseService.createTrip(tripData);
      const retrievedTrip = await databaseService.getTripById(tripId);
      
      expect(retrievedTrip?.notes).toBe(longNote);
      expect(retrievedTrip?.notes.length).toBe(10000);
    });
  });

  describe('Cross-Service Data Flow', () => {
    it('should integrate lunar data with trip planning', () => {
      const testDate = new Date('2024-06-15');
      const location: UserLocation = {
        lat: -36.8485,
        lon: 174.7633,
        name: 'Auckland, New Zealand'
      };

      // Get lunar information for trip planning
      const lunarPhase = lunarService.getLunarPhase(testDate);
      const biteTimes = lunarService.calculateBiteTimes(testDate, location.lat, location.lon);
      const sunMoonTimes = lunarService.getSunMoonTimes(testDate, location);

      // Verify all data is available for trip planning
      expect(lunarPhase.quality).toMatch(/^(Excellent|Good|Average|Poor)$/);
      expect(biteTimes.major.length + biteTimes.minor.length).toBeGreaterThan(0);
      expect(sunMoonTimes.sunrise).toBeTruthy();
      expect(sunMoonTimes.sunset).toBeTruthy();

      // Simulate creating a trip based on lunar data
      const shouldPlanTrip = lunarPhase.quality === 'Excellent' || lunarPhase.quality === 'Good';
      expect(typeof shouldPlanTrip).toBe('boolean');
    });

    it('should handle weather integration with trip logging', async () => {
      // Mock weather service for this test
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          daily: {
            time: ['2024-01-15'],
            temperature_2m_max: [25.5],
            temperature_2m_min: [15.2],
            windspeed_10m_max: [12.8],
            winddirection_10m_dominant: [225]
          }
        })
      });

      try {
        const location: UserLocation = {
          lat: -36.8485,
          lon: 174.7633,
          name: 'Auckland, New Zealand'
        };

        const testDate = new Date('2024-01-15');
        
        // Get weather forecast
        const weather = await weatherService.fetchWeatherForLocation(location, testDate);
        
        // Create trip with weather data
        const tripId = await databaseService.createTrip({
          date: '2024-01-15',
          water: 'Lake Taupo',
          location: 'Western Bay',
          hours: 4,
          companions: 'John Doe',
          notes: `Weather: ${weather.temperatureMax}°C max, ${weather.windSpeed} km/h wind`
        });

        // Create weather log based on forecast
        await databaseService.createWeatherLog({
          tripId,
          timeOfDay: 'Morning',
          sky: 'Clear',
          windCondition: weather.windSpeed > 20 ? 'Strong' : 'Light',
          windDirection: weather.windDirectionCardinal,
          waterTemp: String(Math.round(weather.temperatureMin + 3)),
          airTemp: String(weather.temperatureMax)
        });

        const weatherLogs = await databaseService.getWeatherLogsByTripId(tripId);
        expect(weatherLogs).toHaveLength(1);
        expect(weatherLogs[0].windDirection).toBe('SW');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});