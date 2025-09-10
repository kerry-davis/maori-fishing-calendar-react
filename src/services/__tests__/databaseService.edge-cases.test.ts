/**
 * Database Service Edge Cases and Error Handling Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../databaseService';
import type { Trip, WeatherLog, FishCaught } from '../../types';

// Use fake IndexedDB for testing
import 'fake-indexeddb/auto';
import { deleteDB } from 'fake-indexeddb';

describe('DatabaseService Edge Cases', () => {
  let databaseService: DatabaseService;

  beforeEach(async () => {
    // Clean up any existing database
    try {
      await deleteDB('fishingLog');
    } catch (error) {
      // Ignore errors if database doesn't exist
    }
    
    databaseService = new DatabaseService();
    await databaseService.initialize();
  });

  afterEach(async () => {
    databaseService.close();
    try {
      await deleteDB('fishingLog');
    } catch (error) {
      // Ignore errors
    }
  });

  describe('Data Validation and Edge Cases', () => {
    it('should handle trips with extreme date values', async () => {
      const extremeDates = [
        '1900-01-01',
        '2100-12-31',
        '2024-02-29', // Leap year
        '2023-02-28', // Non-leap year last day
      ];

      for (const date of extremeDates) {
        const tripData: Omit<Trip, 'id'> = {
          date,
          water: 'Test Lake',
          location: 'Test Location',
          hours: 1,
          companions: '',
          notes: `Trip on ${date}`
        };

        const tripId = await databaseService.createTrip(tripData);
        expect(tripId).toBeTypeOf('number');

        const retrievedTrip = await databaseService.getTripById(tripId);
        expect(retrievedTrip?.date).toBe(date);
      }
    });

    it('should handle trips with maximum field lengths', async () => {
      const longString = 'A'.repeat(10000); // 10KB string
      
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: longString,
        location: longString,
        hours: 999999,
        companions: longString,
        notes: longString
      };

      const tripId = await databaseService.createTrip(tripData);
      const retrievedTrip = await databaseService.getTripById(tripId);
      
      expect(retrievedTrip?.water).toBe(longString);
      expect(retrievedTrip?.location).toBe(longString);
      expect(retrievedTrip?.hours).toBe(999999);
      expect(retrievedTrip?.companions).toBe(longString);
      expect(retrievedTrip?.notes).toBe(longString);
    });

    it('should handle special characters and unicode', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~"\'\\';
      const unicode = '🐟🎣🌊⭐️🌙🌞❄️🔥💧🌈';
      const multilingual = 'Māori 中文 العربية Русский Español';
      
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: `Lake ${unicode}`,
        location: `${multilingual} Bay`,
        hours: 4,
        companions: `John ${specialChars} Doe`,
        notes: `Great day! ${unicode} ${multilingual} ${specialChars}`
      };

      const tripId = await databaseService.createTrip(tripData);
      const retrievedTrip = await databaseService.getTripById(tripId);
      
      expect(retrievedTrip).toMatchObject(tripData);
    });

    it('should handle empty and whitespace-only values', async () => {
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: '',
        location: '   ',
        hours: 0,
        companions: '\t\n\r',
        notes: '     \n\t     '
      };

      const tripId = await databaseService.createTrip(tripData);
      const retrievedTrip = await databaseService.getTripById(tripId);
      
      expect(retrievedTrip).toMatchObject(tripData);
    });

    it('should handle negative and decimal hours', async () => {
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: -5.5, // Negative decimal hours
        companions: '',
        notes: 'Test with negative hours'
      };

      const tripId = await databaseService.createTrip(tripData);
      const retrievedTrip = await databaseService.getTripById(tripId);
      
      expect(retrievedTrip?.hours).toBe(-5.5);
    });
  });

  describe('Weather Log Edge Cases', () => {
    it('should handle extreme temperature values', async () => {
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 1,
        companions: '',
        notes: ''
      });

      const extremeWeather: Omit<WeatherLog, 'id'> = {
        tripId,
        timeOfDay: 'Extreme',
        sky: 'Apocalyptic',
        windCondition: 'Hurricane',
        windDirection: 'Everywhere',
        waterTemp: '-50',
        airTemp: '60'
      };

      const weatherId = await databaseService.createWeatherLog(extremeWeather);
      const retrievedWeather = await databaseService.getWeatherLogById(weatherId);
      
      expect(retrievedWeather).toMatchObject(extremeWeather);
    });

    it('should handle weather logs with special characters', async () => {
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 1,
        companions: '',
        notes: ''
      });

      const weatherData: Omit<WeatherLog, 'id'> = {
        tripId,
        timeOfDay: 'Morning ☀️',
        sky: 'Partly ☁️ Cloudy',
        windCondition: 'Light 💨',
        windDirection: 'N→E',
        waterTemp: '18°C',
        airTemp: '22°F'
      };

      const weatherId = await databaseService.createWeatherLog(weatherData);
      const retrievedWeather = await databaseService.getWeatherLogById(weatherId);
      
      expect(retrievedWeather).toMatchObject(weatherData);
    });
  });

  describe('Fish Caught Edge Cases', () => {
    it('should handle fish with extreme measurements', async () => {
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 1,
        companions: '',
        notes: ''
      });

      const extremeFish: Omit<FishCaught, 'id'> = {
        tripId,
        species: 'Megalodon 🦈',
        length: '999999.99',
        weight: '0.001',
        time: '25:99', // Invalid time format
        gear: ['Legendary Rod', 'Magic Bait', '💎 Diamond Line'],
        details: 'Caught the biggest fish ever! 🐟👑'
      };

      const fishId = await databaseService.createFishCaught(extremeFish);
      const retrievedFish = await databaseService.getFishCaughtById(fishId);
      
      expect(retrievedFish).toMatchObject(extremeFish);
    });

    it('should handle fish with empty gear array', async () => {
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 1,
        companions: '',
        notes: ''
      });

      const fishData: Omit<FishCaught, 'id'> = {
        tripId,
        species: 'Mystery Fish',
        length: '',
        weight: '',
        time: '',
        gear: [], // Empty gear array
        details: ''
      };

      const fishId = await databaseService.createFishCaught(fishData);
      const retrievedFish = await databaseService.getFishCaughtById(fishId);
      
      expect(retrievedFish?.gear).toEqual([]);
    });

    it('should handle fish with very large gear array', async () => {
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 1,
        companions: '',
        notes: ''
      });

      const largeGearArray = Array.from({ length: 100 }, (_, i) => `Gear Item ${i + 1}`);
      
      const fishData: Omit<FishCaught, 'id'> = {
        tripId,
        species: 'Well-Equipped Fish',
        length: '30',
        weight: '2',
        time: '10:00',
        gear: largeGearArray,
        details: 'Used all the gear!'
      };

      const fishId = await databaseService.createFishCaught(fishData);
      const retrievedFish = await databaseService.getFishCaughtById(fishId);
      
      expect(retrievedFish?.gear).toHaveLength(100);
      expect(retrievedFish?.gear).toEqual(largeGearArray);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous trip creations', async () => {
      const promises = Array.from({ length: 50 }, (_, i) => 
        databaseService.createTrip({
          date: `2024-01-${String((i % 31) + 1).padStart(2, '0')}`,
          water: `Lake ${i}`,
          location: `Location ${i}`,
          hours: i + 1,
          companions: `Person ${i}`,
          notes: `Concurrent trip ${i}`
        })
      );

      const tripIds = await Promise.all(promises);
      
      expect(tripIds).toHaveLength(50);
      expect(new Set(tripIds).size).toBe(50); // All IDs should be unique
      
      const allTrips = await databaseService.getAllTrips();
      expect(allTrips).toHaveLength(50);
    });

    it('should handle concurrent reads and writes', async () => {
      // Create initial trip
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 1,
        companions: '',
        notes: 'Initial trip'
      });

      // Perform concurrent operations
      const operations = [
        // Reads
        databaseService.getTripById(tripId),
        databaseService.getAllTrips(),
        databaseService.getTripsByDate('2024-01-15'),
        databaseService.hasTripsOnDate('2024-01-15'),
        
        // Writes
        databaseService.createWeatherLog({
          tripId,
          timeOfDay: 'Morning',
          sky: 'Clear',
          windCondition: 'Light',
          windDirection: 'N',
          waterTemp: '20',
          airTemp: '25'
        }),
        databaseService.createFishCaught({
          tripId,
          species: 'Test Fish',
          length: '30',
          weight: '2',
          time: '10:00',
          gear: ['Rod'],
          details: 'Concurrent catch'
        })
      ];

      const results = await Promise.all(operations);
      
      // Verify all operations completed successfully
      expect(results[0]).toBeTruthy(); // getTripById
      expect(results[1]).toHaveLength(1); // getAllTrips
      expect(results[2]).toHaveLength(1); // getTripsByDate
      expect(results[3]).toBe(true); // hasTripsOnDate
      expect(typeof results[4]).toBe('number'); // createWeatherLog
      expect(typeof results[5]).toBe('number'); // createFishCaught
    });
  });

  describe('Data Integrity', () => {
    it('should maintain referential integrity on trip deletion', async () => {
      // Create trip with associated data
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 1,
        companions: '',
        notes: 'Trip to be deleted'
      });

      // Add multiple weather logs and fish
      const weatherIds = [];
      const fishIds = [];

      for (let i = 0; i < 5; i++) {
        const weatherId = await databaseService.createWeatherLog({
          tripId,
          timeOfDay: `Time ${i}`,
          sky: `Sky ${i}`,
          windCondition: `Wind ${i}`,
          windDirection: 'N',
          waterTemp: String(20 + i),
          airTemp: String(25 + i)
        });
        weatherIds.push(weatherId);

        const fishId = await databaseService.createFishCaught({
          tripId,
          species: `Fish ${i}`,
          length: String(30 + i),
          weight: String(2 + i),
          time: `1${i}:00`,
          gear: [`Gear ${i}`],
          details: `Fish ${i} details`
        });
        fishIds.push(fishId);
      }

      // Verify data exists
      expect(await databaseService.getWeatherLogsByTripId(tripId)).toHaveLength(5);
      expect(await databaseService.getFishCaughtByTripId(tripId)).toHaveLength(5);

      // Delete the trip
      await databaseService.deleteTrip(tripId);

      // Verify trip is deleted
      expect(await databaseService.getTripById(tripId)).toBeNull();

      // Verify associated data is also deleted
      expect(await databaseService.getWeatherLogsByTripId(tripId)).toHaveLength(0);
      expect(await databaseService.getFishCaughtByTripId(tripId)).toHaveLength(0);

      // Verify individual records are deleted
      for (const weatherId of weatherIds) {
        expect(await databaseService.getWeatherLogById(weatherId)).toBeNull();
      }
      for (const fishId of fishIds) {
        expect(await databaseService.getFishCaughtById(fishId)).toBeNull();
      }
    });

    it('should handle orphaned data gracefully', async () => {
      // Create weather log and fish with non-existent trip ID
      const nonExistentTripId = 99999;

      const weatherId = await databaseService.createWeatherLog({
        tripId: nonExistentTripId,
        timeOfDay: 'Morning',
        sky: 'Clear',
        windCondition: 'Light',
        windDirection: 'N',
        waterTemp: '20',
        airTemp: '25'
      });

      const fishId = await databaseService.createFishCaught({
        tripId: nonExistentTripId,
        species: 'Orphaned Fish',
        length: '30',
        weight: '2',
        time: '10:00',
        gear: ['Rod'],
        details: 'This fish has no parent trip'
      });

      // Verify orphaned data can be retrieved
      const orphanedWeather = await databaseService.getWeatherLogById(weatherId);
      const orphanedFish = await databaseService.getFishCaughtById(fishId);

      expect(orphanedWeather?.tripId).toBe(nonExistentTripId);
      expect(orphanedFish?.tripId).toBe(nonExistentTripId);

      // Verify they appear in trip-specific queries
      const weatherByTrip = await databaseService.getWeatherLogsByTripId(nonExistentTripId);
      const fishByTrip = await databaseService.getFishCaughtByTripId(nonExistentTripId);

      expect(weatherByTrip).toHaveLength(1);
      expect(fishByTrip).toHaveLength(1);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = performance.now();

      // Create 1000 trips
      const tripPromises = Array.from({ length: 1000 }, (_, i) => 
        databaseService.createTrip({
          date: `2024-${String(Math.floor(i / 31) + 1).padStart(2, '0')}-${String((i % 31) + 1).padStart(2, '0')}`,
          water: `Lake ${i}`,
          location: `Location ${i}`,
          hours: (i % 24) + 1,
          companions: i % 2 === 0 ? `Person ${i}` : '',
          notes: `Performance test trip ${i}`
        })
      );

      await Promise.all(tripPromises);

      const creationTime = performance.now() - startTime;

      // Verify all trips were created
      const allTrips = await databaseService.getAllTrips();
      expect(allTrips).toHaveLength(1000);

      // Test retrieval performance
      const retrievalStart = performance.now();
      const datesWithTrips = await databaseService.getDatesWithTrips();
      const retrievalTime = performance.now() - retrievalStart;

      expect(datesWithTrips.length).toBeGreaterThan(0);

      // Performance should be reasonable (adjust thresholds as needed)
      expect(creationTime).toBeLessThan(10000); // 10 seconds
      expect(retrievalTime).toBeLessThan(1000); // 1 second
    });

    it('should handle rapid sequential operations', async () => {
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Performance Lake',
        location: 'Speed Location',
        hours: 1,
        companions: '',
        notes: 'Rapid operations test'
      });

      const startTime = performance.now();

      // Perform 100 rapid operations
      for (let i = 0; i < 100; i++) {
        await databaseService.createWeatherLog({
          tripId,
          timeOfDay: `Rapid ${i}`,
          sky: `Sky ${i}`,
          windCondition: `Wind ${i}`,
          windDirection: 'N',
          waterTemp: String(20 + (i % 10)),
          airTemp: String(25 + (i % 10))
        });
      }

      const operationTime = performance.now() - startTime;

      // Verify all operations completed
      const weatherLogs = await databaseService.getWeatherLogsByTripId(tripId);
      expect(weatherLogs).toHaveLength(100);

      // Should complete in reasonable time
      expect(operationTime).toBeLessThan(5000); // 5 seconds
    });
  });
});