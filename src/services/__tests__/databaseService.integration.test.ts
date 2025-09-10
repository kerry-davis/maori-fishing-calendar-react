import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../databaseService';
import { Trip, WeatherLog, FishCaught } from '../../types';

// Integration tests using fake-indexeddb
import 'fake-indexeddb/auto';
import { deleteDB } from 'fake-indexeddb';

describe('DatabaseService Integration Tests', () => {
  let databaseService: DatabaseService;

  beforeEach(async () => {
    // Delete any existing database to ensure clean state
    try {
      await deleteDB('fishingLog');
    } catch (error) {
      // Ignore errors if database doesn't exist
    }
    
    // Create a fresh database service for each test
    databaseService = new DatabaseService();
    await databaseService.initialize();
  });

  afterEach(async () => {
    databaseService.close();
    // Clean up the database after each test
    try {
      await deleteDB('fishingLog');
    } catch (error) {
      // Ignore errors
    }
  });

  describe('Trip Operations', () => {
    it('should create, read, update, and delete trips', async () => {
      // Create a trip
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing day'
      };

      const tripId = await databaseService.createTrip(tripData);
      expect(tripId).toBeTypeOf('number');

      // Read the trip
      const retrievedTrip = await databaseService.getTripById(tripId);
      expect(retrievedTrip).toMatchObject(tripData);
      expect(retrievedTrip?.id).toBe(tripId);

      // Update the trip
      const updatedTrip: Trip = {
        ...retrievedTrip!,
        hours: 5,
        notes: 'Updated notes'
      };
      await databaseService.updateTrip(updatedTrip);

      const updatedRetrievedTrip = await databaseService.getTripById(tripId);
      expect(updatedRetrievedTrip?.hours).toBe(5);
      expect(updatedRetrievedTrip?.notes).toBe('Updated notes');

      // Delete the trip
      await databaseService.deleteTrip(tripId);
      const deletedTrip = await databaseService.getTripById(tripId);
      expect(deletedTrip).toBeNull();
    });

    it('should get trips by date', async () => {
      const date = '2024-01-15';
      const tripData1: Omit<Trip, 'id'> = {
        date,
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'First trip'
      };

      const tripData2: Omit<Trip, 'id'> = {
        date,
        water: 'Lake Rotorua',
        location: 'Eastern Shore',
        hours: 3,
        companions: 'Jane Smith',
        notes: 'Second trip'
      };

      await databaseService.createTrip(tripData1);
      await databaseService.createTrip(tripData2);

      const trips = await databaseService.getTripsByDate(date);
      expect(trips).toHaveLength(2);
      expect(trips.map(t => t.water)).toContain('Lake Taupo');
      expect(trips.map(t => t.water)).toContain('Lake Rotorua');
    });
  });

  describe('Weather Log Operations', () => {
    it('should create and retrieve weather logs', async () => {
      // First create a trip
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing day'
      };
      const tripId = await databaseService.createTrip(tripData);

      // Create weather log
      const weatherData: Omit<WeatherLog, 'id'> = {
        tripId,
        timeOfDay: 'Morning',
        sky: 'Partly Cloudy',
        windCondition: 'Light',
        windDirection: 'NE',
        waterTemp: '18',
        airTemp: '22'
      };

      const weatherId = await databaseService.createWeatherLog(weatherData);
      expect(weatherId).toBeTypeOf('number');

      // Retrieve weather log
      const retrievedWeather = await databaseService.getWeatherLogById(weatherId);
      expect(retrievedWeather).toMatchObject(weatherData);

      // Get weather logs by trip ID
      const weatherLogs = await databaseService.getWeatherLogsByTripId(tripId);
      expect(weatherLogs).toHaveLength(1);
      expect(weatherLogs[0]).toMatchObject(weatherData);
    });
  });

  describe('Fish Caught Operations', () => {
    it('should create and retrieve fish caught records', async () => {
      // First create a trip
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing day'
      };
      const tripId = await databaseService.createTrip(tripData);

      // Create fish caught record
      const fishData: Omit<FishCaught, 'id'> = {
        tripId,
        species: 'Rainbow Trout',
        length: '45',
        weight: '2.5',
        time: '10:30',
        gear: ['Spinner', 'Light Rod'],
        details: 'Caught near the rocks'
      };

      const fishId = await databaseService.createFishCaught(fishData);
      expect(fishId).toBeTypeOf('number');

      // Retrieve fish caught record
      const retrievedFish = await databaseService.getFishCaughtById(fishId);
      expect(retrievedFish).toMatchObject(fishData);

      // Get fish caught records by trip ID
      const fishRecords = await databaseService.getFishCaughtByTripId(tripId);
      expect(fishRecords).toHaveLength(1);
      expect(fishRecords[0]).toMatchObject(fishData);

      // Test fish count
      const fishCount = await databaseService.getFishCountForTrip(tripId);
      expect(fishCount).toBe(1);
    });
  });

  describe('Utility Methods', () => {
    it('should check if date has trips', async () => {
      const date = '2024-01-20'; // Use a unique date
      
      // Create a trip
      const tripData: Omit<Trip, 'id'> = {
        date,
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing day'
      };
      await databaseService.createTrip(tripData);

      // Should have trips
      const hasTrips = await databaseService.hasTripsOnDate(date);
      expect(hasTrips).toBe(true);

      // Should not have trips on different date
      const hasTripsOtherDate = await databaseService.hasTripsOnDate('2024-01-21');
      expect(hasTripsOtherDate).toBe(false);
    });

    it('should get dates with trips', async () => {
      const date1 = '2024-01-15';
      const date2 = '2024-01-16';

      // Create trips on different dates
      await databaseService.createTrip({
        date: date1,
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'First trip'
      });

      await databaseService.createTrip({
        date: date2,
        water: 'Lake Rotorua',
        location: 'Eastern Shore',
        hours: 3,
        companions: 'Jane Smith',
        notes: 'Second trip'
      });

      // Create another trip on the same date as first
      await databaseService.createTrip({
        date: date1,
        water: 'Lake Taupo',
        location: 'Northern Bay',
        hours: 2,
        companions: '',
        notes: 'Solo trip'
      });

      const datesWithTrips = await databaseService.getDatesWithTrips();
      expect(datesWithTrips).toHaveLength(2);
      expect(datesWithTrips).toContain(date1);
      expect(datesWithTrips).toContain(date2);
    });

    it('should clear all data', async () => {
      // Create some test data
      const tripId = await databaseService.createTrip({
        date: '2024-01-25',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Test trip'
      });

      await databaseService.createWeatherLog({
        tripId,
        timeOfDay: 'Morning',
        sky: 'Clear',
        windCondition: 'Calm',
        windDirection: 'N',
        waterTemp: '20',
        airTemp: '25'
      });

      await databaseService.createFishCaught({
        tripId,
        species: 'Trout',
        length: '40',
        weight: '2.0',
        time: '09:00',
        gear: ['Rod'],
        details: 'Test fish'
      });

      // Clear all data
      await databaseService.clearAllData();

      // Verify data is cleared
      const tripsAfterClear = await databaseService.getAllTrips();
      const weatherAfterClear = await databaseService.getAllWeatherLogs();
      const fishAfterClear = await databaseService.getAllFishCaught();

      expect(tripsAfterClear).toHaveLength(0);
      expect(weatherAfterClear).toHaveLength(0);
      expect(fishAfterClear).toHaveLength(0);
    });
  });

  describe('Cascading Deletes', () => {
    it('should delete associated weather logs and fish when deleting a trip', async () => {
      // Create a trip
      const tripId = await databaseService.createTrip({
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Test trip'
      });

      // Create associated weather log
      await databaseService.createWeatherLog({
        tripId,
        timeOfDay: 'Morning',
        sky: 'Clear',
        windCondition: 'Calm',
        windDirection: 'N',
        waterTemp: '20',
        airTemp: '25'
      });

      // Create associated fish caught record
      await databaseService.createFishCaught({
        tripId,
        species: 'Trout',
        length: '40',
        weight: '2.0',
        time: '09:00',
        gear: ['Rod'],
        details: 'Test fish'
      });

      // Verify associated data exists
      const weatherBefore = await databaseService.getWeatherLogsByTripId(tripId);
      const fishBefore = await databaseService.getFishCaughtByTripId(tripId);
      expect(weatherBefore).toHaveLength(1);
      expect(fishBefore).toHaveLength(1);

      // Delete the trip
      await databaseService.deleteTrip(tripId);

      // Verify trip is deleted
      const deletedTrip = await databaseService.getTripById(tripId);
      expect(deletedTrip).toBeNull();

      // Verify associated data is also deleted
      const weatherAfter = await databaseService.getWeatherLogsByTripId(tripId);
      const fishAfter = await databaseService.getFishCaughtByTripId(tripId);
      expect(weatherAfter).toHaveLength(0);
      expect(fishAfter).toHaveLength(0);
    });
  });
});