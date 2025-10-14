import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firebaseDataService } from '../services/firebaseDataService';
import { guestDataRetentionService } from '../services/guestDataRetentionService';
import type { Trip, WeatherLog, FishCaught } from '../types';

// Mock databaseService for test environment
vi.mock('../services/databaseService', () => {
  let nextTripId = 1;
  let nextWeatherId = 1;
  let nextFishId = 1;
  let createdTrips: Trip[] = [];
  let createdWeatherLogs: WeatherLog[] = [];
  let createdFish: FishCaught[] = [];

  const mockDb = {
    createTrip: vi.fn().mockImplementation(async (trip: Omit<Trip, 'id'>) => {
      const id = nextTripId++;
      const record = { ...trip, id } as Trip;
      createdTrips.push(record);
      return id;
    }),
    getAllTrips: vi.fn().mockImplementation(async () => createdTrips.map(trip => ({ ...trip }))),
    updateTrip: vi.fn().mockImplementation(async (trip: Trip) => {
      const index = createdTrips.findIndex(t => t.id === trip.id);
      if (index >= 0) {
        createdTrips[index] = { ...createdTrips[index], ...trip };
      }
    }),
    deleteTrip: vi.fn().mockImplementation(async (id: number) => {
      const index = createdTrips.findIndex(t => t.id === id);
      if (index >= 0) {
        createdTrips.splice(index, 1);
      }
    }),
    createWeatherLog: vi.fn().mockImplementation(async (weather: Omit<WeatherLog, 'id'>) => {
      const id = `weather-${nextWeatherId++}`;
      const record = { ...weather, id } as WeatherLog;
      createdWeatherLogs.push(record);
      return id;
    }),
    getAllWeatherLogs: vi.fn().mockImplementation(async () => createdWeatherLogs.map(weather => ({ ...weather }))),
    updateWeatherLog: vi.fn().mockImplementation(async (weather: WeatherLog) => {
      const index = createdWeatherLogs.findIndex(w => w.id === weather.id);
      if (index >= 0) {
        createdWeatherLogs[index] = { ...createdWeatherLogs[index], ...weather };
      }
    }),
    deleteWeatherLog: vi.fn().mockImplementation(async (id: string) => {
      const index = createdWeatherLogs.findIndex(w => w.id === id);
      if (index >= 0) {
        createdWeatherLogs.splice(index, 1);
      }
    }),
    createFishCaught: vi.fn().mockImplementation(async (fish: Omit<FishCaught, 'id'>) => {
      const id = `fish-${nextFishId++}`;
      const record = { ...fish, id } as FishCaught;
      createdFish.push(record);
      return id;
    }),
    getAllFishCaught: vi.fn().mockImplementation(async () => createdFish.map(f => ({ ...f }))),
    updateFishCaught: vi.fn().mockImplementation(async (fish: FishCaught) => {
      const index = createdFish.findIndex(f => f.id === fish.id);
      if (index >= 0) {
        createdFish[index] = { ...createdFish[index], ...fish };
      }
    }),
    deleteFishCaught: vi.fn().mockImplementation(async (id: string) => {
      const index = createdFish.findIndex(f => f.id === id);
      if (index >= 0) {
        createdFish.splice(index, 1);
      }
    }),
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
    clearAllData: vi.fn().mockImplementation(async () => {
      createdTrips = [];
      createdWeatherLogs = [];
      createdFish = [];
      nextTripId = 1;
      nextWeatherId = 1;
      nextFishId = 1;
    }),
    clearSyncQueue: vi.fn().mockResolvedValue(undefined),
  };
  
  return {
    databaseService: mockDb,
    __esModule: true,
    default: mockDb,
  };
});

describe('Guest Mode Trip Creation', () => {

  beforeEach(async () => {
    // Clear any existing data before each test
    await guestDataRetentionService.clearAllGuestData();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should allow trip creation in guest mode', async () => {
    await firebaseDataService.initialize();
    expect(firebaseDataService.isGuestMode()).toBe(true);
    const tripData = {
      date: '2023-06-15',
      water: 'Lake Taupo',
      location: 'Main Bay',
      hours: 4,
      companions: 'John and Mike',
      notes: 'Great day fishing, caught several trout'
    };
    const tripId = await firebaseDataService.createTrip(tripData);
    expect(typeof tripId).toBe('number');
    expect(tripId).toBeGreaterThan(0);
    // Verify the trip was created in the mock
    const trips = await firebaseDataService.getAllTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].water).toBe('Lake Taupo');
    expect(trips[0].id).toBe(tripId);
  });

  it('should update and delete trips in guest mode', async () => {
    await firebaseDataService.initialize();
    const tripData = {
      date: '2023-06-16',
      water: 'Lake Rotorua',
      location: 'North Shore',
      hours: 5,
      companions: 'Ava',
      notes: 'Choppy conditions'
    };

    const tripId = await firebaseDataService.createTrip(tripData);
    await firebaseDataService.updateTrip({ ...tripData, id: tripId, notes: 'Calm by noon' });

    const trips = await firebaseDataService.getAllTrips();
    expect(trips).toHaveLength(1);
    expect(trips[0].notes).toBe('Calm by noon');

    await firebaseDataService.deleteTrip(tripId);
    const tripsAfterDelete = await firebaseDataService.getAllTrips();
    expect(tripsAfterDelete).toHaveLength(0);
  });

  it('should handle weather logs locally in guest mode', async () => {
    await firebaseDataService.initialize();
    const tripData = {
      date: '2023-06-17',
      water: 'Harbour',
      location: 'West Pier',
      hours: 2,
      companions: 'Noah',
      notes: 'Quick outing'
    };

    const tripId = await firebaseDataService.createTrip(tripData);
    const weatherId = await firebaseDataService.createWeatherLog({
      tripId,
      timeOfDay: 'Evening',
      sky: 'Overcast',
      windCondition: 'Light breeze',
      windDirection: 'SW',
      waterTemp: '16',
      airTemp: '15'
    });

    const weatherLogs = await firebaseDataService.getAllWeatherLogs();
    expect(weatherLogs).toHaveLength(1);

    await firebaseDataService.updateWeatherLog({
      id: weatherId,
      tripId,
      timeOfDay: 'Evening',
      sky: 'Clear',
      windCondition: 'Light breeze',
      windDirection: 'SW',
      waterTemp: '16',
      airTemp: '14'
    });

    const updatedWeatherLogs = await firebaseDataService.getAllWeatherLogs();
    expect(updatedWeatherLogs[0].sky).toBe('Clear');

    await firebaseDataService.deleteWeatherLog(weatherId);
    const weatherLogsAfterDelete = await firebaseDataService.getAllWeatherLogs();
    expect(weatherLogsAfterDelete).toHaveLength(0);
  });

  it('should handle fish records locally in guest mode', async () => {
    await firebaseDataService.initialize();
    const tripData = {
      date: '2023-06-18',
      water: 'Coast',
      location: 'Point Break',
      hours: 6,
      companions: 'Ella',
      notes: 'Surf and fish'
    };

    const tripId = await firebaseDataService.createTrip(tripData);
    const fishId = await firebaseDataService.createFishCaught({
      tripId,
      species: 'Kingfish',
      length: '80cm',
      weight: '6kg',
      time: '07:45',
      gear: ['jig'],
      details: 'Released',
      photo: undefined,
    });

    const fishCaught = await firebaseDataService.getAllFishCaught();
    expect(fishCaught).toHaveLength(1);

    await firebaseDataService.updateFishCaught({
      id: fishId,
      tripId,
      species: 'Kingfish',
      length: '82cm',
      weight: '6.5kg',
      time: '07:45',
      gear: ['jig'],
      details: 'Released'
    } as FishCaught);

    const updatedFish = await firebaseDataService.getAllFishCaught();
    expect(updatedFish[0].length).toBe('82cm');

    await firebaseDataService.deleteFishCaught(fishId);
    const fishAfterDelete = await firebaseDataService.getAllFishCaught();
    expect(fishAfterDelete).toHaveLength(0);
  });
});