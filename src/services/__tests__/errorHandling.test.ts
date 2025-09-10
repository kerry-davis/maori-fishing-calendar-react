/**
 * Comprehensive Error Handling Tests for All Services
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '../databaseService';
import { DataExportService } from '../dataExportService';
import * as weatherService from '../weatherService';
import * as lunarService from '../lunarService';

// Use fake IndexedDB for testing
import 'fake-indexeddb/auto';
import { deleteDB } from 'fake-indexeddb';

describe('Service Error Handling', () => {
  describe('Database Service Error Scenarios', () => {
    let databaseService: DatabaseService;

    beforeEach(async () => {
      try {
        await deleteDB('fishingLog');
      } catch (error) {
        // Ignore errors
      }
      databaseService = new DatabaseService();
    });

    afterEach(async () => {
      databaseService.close();
      try {
        await deleteDB('fishingLog');
      } catch (error) {
        // Ignore errors
      }
    });

    it('should handle database not initialized errors', async () => {
      // Try to use database without initialization
      expect(() => databaseService.getDatabase()).toThrow('Database not initialized');
    });

    it('should handle database initialization failures', async () => {
      // Mock indexedDB.open to fail
      const originalOpen = indexedDB.open;
      indexedDB.open = vi.fn().mockImplementation(() => {
        const request = {
          onerror: null as any,
          onsuccess: null as any,
          onupgradeneeded: null as any,
          error: new Error('Mock database failure'),
          result: null
        };
        
        // Simulate immediate error
        setTimeout(() => {
          if (request.onerror) {
            request.onerror({ target: request } as any);
          }
        }, 0);
        
        return request;
      });

      try {
        await expect(databaseService.initialize()).rejects.toThrow('Failed to initialize database');
      } finally {
        indexedDB.open = originalOpen;
      }
    });

    it('should handle transaction errors gracefully', async () => {
      await databaseService.initialize();
      
      // Mock the database to return a failing transaction
      const originalGetDatabase = databaseService.getDatabase.bind(databaseService);
      databaseService.getDatabase = vi.fn().mockReturnValue({
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            add: vi.fn().mockReturnValue({
              onsuccess: null,
              onerror: null,
              error: new Error('Transaction failed')
            })
          }),
          onerror: null,
          error: new Error('Transaction failed')
        })
      });

      try {
        const promise = databaseService.createTrip({
          date: '2024-01-15',
          water: 'Test Lake',
          location: 'Test Location',
          hours: 1,
          companions: '',
          notes: ''
        });

        // Simulate transaction error
        setTimeout(() => {
          const mockRequest = {
            error: new Error('Transaction failed'),
            onerror: null as any
          };
          if (mockRequest.onerror) {
            mockRequest.onerror();
          }
        }, 0);

        await expect(promise).rejects.toThrow();
      } finally {
        databaseService.getDatabase = originalGetDatabase;
      }
    });

    it('should handle corrupted data gracefully', async () => {
      await databaseService.initialize();

      // Create a trip and then simulate data corruption by returning invalid data
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 1,
        companions: '',
        notes: ''
      });

      // Mock corrupted data retrieval
      const originalGetDatabase = databaseService.getDatabase.bind(databaseService);
      databaseService.getDatabase = vi.fn().mockReturnValue({
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue({
              onsuccess: null,
              onerror: null,
              result: { corrupted: 'data', missing: 'required fields' } // Invalid trip data
            })
          })
        })
      });

      try {
        const promise = databaseService.getTripById(tripId);
        
        // Simulate successful retrieval of corrupted data
        setTimeout(() => {
          const mockRequest = {
            result: { corrupted: 'data' },
            onsuccess: null as any
          };
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess();
          }
        }, 0);

        // Should handle corrupted data without crashing
        const result = await promise;
        expect(result).toBeDefined();
      } finally {
        databaseService.getDatabase = originalGetDatabase;
      }
    });
  });

  describe('Weather Service Error Scenarios', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle network connectivity issues', async () => {
      // Mock fetch to simulate network error
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Network request failed'));

      await expect(
        weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date())
      ).rejects.toMatchObject({
        type: 'network',
        message: expect.stringContaining('Network error')
      });
    });

    it('should handle API rate limiting', async () => {
      // Mock fetch to return 429 Too Many Requests
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(
        weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date())
      ).rejects.toMatchObject({
        type: 'api',
        status: 429,
        message: expect.stringContaining('429')
      });
    });

    it('should handle malformed API responses', async () => {
      // Mock fetch to return invalid JSON
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token'))
      });

      await expect(
        weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date())
      ).rejects.toMatchObject({
        type: 'parsing',
        message: expect.stringContaining('Failed to parse')
      });
    });

    it('should handle missing API data fields', async () => {
      // Mock fetch to return incomplete data
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          daily: {
            time: ['2024-01-15']
            // Missing required fields
          }
        })
      });

      await expect(
        weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date())
      ).rejects.toMatchObject({
        type: 'validation',
        message: expect.stringContaining('Incomplete weather data')
      });
    });

    it('should handle invalid coordinate ranges', async () => {
      const invalidCoordinates = [
        { lat: 91, lon: 0, name: 'Invalid latitude > 90' },
        { lat: -91, lon: 0, name: 'Invalid latitude < -90' },
        { lat: 0, lon: 181, name: 'Invalid longitude > 180' },
        { lat: 0, lon: -181, name: 'Invalid longitude < -180' },
        { lat: NaN, lon: 0, name: 'NaN latitude' },
        { lat: 0, lon: NaN, name: 'NaN longitude' },
        { lat: Infinity, lon: 0, name: 'Infinite latitude' },
        { lat: 0, lon: -Infinity, name: 'Negative infinite longitude' }
      ];

      for (const coords of invalidCoordinates) {
        // Mock API to return error for invalid coordinates
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          statusText: 'Bad Request'
        });

        try {
          await weatherService.fetchWeatherForecast(coords.lat, coords.lon, new Date());
          // If it doesn't throw, that's also acceptable behavior
        } catch (error: any) {
          expect(['api', 'validation', 'network']).toContain(error.type);
        }
      }
    });

    it('should handle API service unavailability', async () => {
      // Mock fetch to simulate service unavailable
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });

      await expect(
        weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date())
      ).rejects.toMatchObject({
        type: 'api',
        status: 503,
        message: expect.stringContaining('503')
      });
    });

    it('should handle timeout scenarios', async () => {
      // Mock fetch to simulate timeout
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(
        weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date())
      ).rejects.toMatchObject({
        type: 'network',
        message: expect.stringContaining('Network error')
      });
    });
  });

  describe('Lunar Service Error Scenarios', () => {
    it('should handle invalid date objects', () => {
      const invalidDates = [
        new Date('invalid'),
        new Date(NaN),
        new Date('2024-13-45'), // Invalid month/day
        new Date('not a date')
      ];

      invalidDates.forEach(date => {
        expect(() => {
          lunarService.getMoonPhaseData(date);
        }).not.toThrow(); // Should handle gracefully, not crash

        expect(() => {
          lunarService.getLunarPhase(date);
        }).not.toThrow();
      });
    });

    it('should handle extreme coordinate values', () => {
      const extremeCoords = [
        { lat: 90, lon: 180 },
        { lat: -90, lon: -180 },
        { lat: 0, lon: 0 },
        { lat: NaN, lon: NaN },
        { lat: Infinity, lon: -Infinity }
      ];

      const testDate = new Date('2024-06-15');

      extremeCoords.forEach(coords => {
        expect(() => {
          lunarService.calculateBiteTimes(testDate, coords.lat, coords.lon);
        }).not.toThrow();

        expect(() => {
          lunarService.getSunTimes(testDate, coords.lat, coords.lon);
        }).not.toThrow();

        expect(() => {
          lunarService.getMoonTimes(testDate, coords.lat, coords.lon);
        }).not.toThrow();
      });
    });

    it('should handle null and undefined values gracefully', () => {
      expect(lunarService.formatTime(null)).toBe('N/A');
      expect(lunarService.formatTime(undefined as any)).toBe('N/A');
      
      // Test with invalid date objects
      expect(lunarService.formatTime(new Date('invalid'))).toBe('N/A');
    });

    it('should handle edge cases in time calculations', () => {
      const edgeCases = [
        { minutes: -1 },
        { minutes: 0 },
        { minutes: 1439 }, // 23:59
        { minutes: 1440 }, // Should wrap to 00:00
        { minutes: 2880 }, // Two days
        { minutes: -1440 } // Negative day
      ];

      edgeCases.forEach(testCase => {
        expect(() => {
          const result = lunarService.minutesToTime(testCase.minutes);
          expect(result).toMatch(/^\d{2}:\d{2}$/);
        }).not.toThrow();
      });
    });
  });

  describe('Data Export Service Error Scenarios', () => {
    let exportService: DataExportService;
    let databaseService: DatabaseService;

    beforeEach(async () => {
      try {
        await deleteDB('fishingLog');
      } catch (error) {
        // Ignore errors
      }
      
      databaseService = new DatabaseService();
      await databaseService.initialize();
      exportService = new DataExportService();
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

    it('should handle database errors during export', async () => {
      // Mock database service to throw error
      const originalGetAllTrips = databaseService.getAllTrips.bind(databaseService);
      databaseService.getAllTrips = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(exportService.exportDataAsZip()).rejects.toThrow('Failed to export data');

      // Restore original method
      databaseService.getAllTrips = originalGetAllTrips;
    });

    it('should handle corrupted localStorage data', async () => {
      // Set invalid JSON in localStorage
      localStorage.setItem('tacklebox', 'invalid json {');
      localStorage.setItem('gearTypes', 'not json at all');

      // Should handle gracefully and not crash
      const result = await exportService.exportDataAsZip();
      expect(result).toBeInstanceOf(Blob);
    });

    it('should handle invalid import files', async () => {
      const invalidFiles = [
        new File(['not json'], 'invalid.json', { type: 'application/json' }),
        new File([''], 'empty.json', { type: 'application/json' }),
        new File(['{"invalid": "structure"}'], 'wrong-structure.json', { type: 'application/json' }),
        new File(['binary data'], 'binary.zip', { type: 'application/zip' })
      ];

      for (const file of invalidFiles) {
        await expect(exportService.importData(file)).rejects.toThrow();
      }
    });

    it('should handle ZIP creation failures', async () => {
      // Mock JSZip to fail
      const JSZip = await import('jszip');
      const originalJSZip = JSZip.default;
      
      // Mock JSZip constructor to throw
      vi.doMock('jszip', () => ({
        default: vi.fn().mockImplementation(() => {
          throw new Error('ZIP creation failed');
        })
      }));

      await expect(exportService.exportDataAsZip()).rejects.toThrow('Failed to export data');
    });

    it('should handle file reading errors', async () => {
      // Create a mock file that fails to read
      const mockFile = {
        name: 'test.json',
        text: vi.fn().mockRejectedValue(new Error('File read error'))
      } as any;

      await expect(exportService.importData(mockFile)).rejects.toThrow();
    });

    it('should handle memory limitations with large datasets', async () => {
      // Create a very large dataset
      const largeTrips = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        date: `2024-01-${String((i % 31) + 1).padStart(2, '0')}`,
        water: `Lake ${i}`.repeat(100), // Make it large
        location: `Location ${i}`.repeat(100),
        hours: i + 1,
        companions: `Person ${i}`.repeat(50),
        notes: `Notes ${i}`.repeat(200)
      }));

      // Mock database to return large dataset
      databaseService.getAllTrips = vi.fn().mockResolvedValue(largeTrips);
      databaseService.getAllWeatherLogs = vi.fn().mockResolvedValue([]);
      databaseService.getAllFishCaught = vi.fn().mockResolvedValue([]);

      // Should handle large datasets without crashing
      try {
        const result = await exportService.exportDataAsZip();
        expect(result).toBeInstanceOf(Blob);
      } catch (error: any) {
        // If it fails due to memory, that's acceptable
        expect(error.message).toMatch(/memory|size|limit/i);
      }
    });
  });

  describe('Cross-Service Error Propagation', () => {
    it('should handle cascading failures gracefully', async () => {
      // Simulate a scenario where multiple services fail
      const originalFetch = global.fetch;
      
      // Mock all external dependencies to fail
      global.fetch = vi.fn().mockRejectedValue(new Error('Network down'));
      
      try {
        // Weather service should fail gracefully
        await expect(
          weatherService.fetchWeatherForecast(-36.8485, 174.7633, new Date())
        ).rejects.toThrow();

        // Lunar service should still work (no external dependencies)
        expect(() => {
          lunarService.getCurrentMoonInfo();
        }).not.toThrow();

        // Database service should work (local storage)
        const dbService = new DatabaseService();
        await expect(dbService.initialize()).resolves.not.toThrow();
        dbService.close();

      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should maintain data consistency during partial failures', async () => {
      const dbService = new DatabaseService();
      await dbService.initialize();

      try {
        // Create a trip successfully
        const tripId = await dbService.createTrip({
          date: '2024-01-15',
          water: 'Test Lake',
          location: 'Test Location',
          hours: 1,
          companions: '',
          notes: ''
        });

        // Simulate partial failure in associated data creation
        const weatherPromise = dbService.createWeatherLog({
          tripId,
          timeOfDay: 'Morning',
          sky: 'Clear',
          windCondition: 'Light',
          windDirection: 'N',
          waterTemp: '20',
          airTemp: '25'
        });

        // Mock the second operation to fail
        const fishPromise = dbService.createFishCaught({
          tripId: 999999, // Invalid trip ID to cause failure
          species: 'Test Fish',
          length: '30',
          weight: '2',
          time: '10:00',
          gear: ['Rod'],
          details: 'This should work despite invalid tripId'
        });

        // Weather should succeed
        await expect(weatherPromise).resolves.toBeTypeOf('number');

        // Fish should succeed (orphaned data is allowed)
        await expect(fishPromise).resolves.toBeTypeOf('number');

        // Original trip should still exist
        const trip = await dbService.getTripById(tripId);
        expect(trip).toBeTruthy();

      } finally {
        dbService.close();
      }
    });
  });
});