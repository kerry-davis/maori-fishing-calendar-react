import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firebaseDataService } from '../services/firebaseDataService';
import { guestDataRetentionService } from '../services/guestDataRetentionService';
import type { Trip, WeatherLog, FishCaught } from '../types';

// Mock databaseService for test environment
vi.mock('../services/databaseService', () => {
  const mockDb = {
    createTrip: vi.fn().mockResolvedValue(1234567890),
    getAllTrips: vi.fn().mockResolvedValue([]),
    updateTrip: vi.fn().mockResolvedValue(undefined),
    deleteTrip: vi.fn().mockResolvedValue(undefined),
    createWeatherLog: vi.fn().mockResolvedValue('1-1234567890'),
    getAllWeatherLogs: vi.fn().mockResolvedValue([]),
    updateWeatherLog: vi.fn().mockResolvedValue(undefined),
    deleteWeatherLog: vi.fn().mockResolvedValue(undefined),
    createFishCaught: vi.fn().mockResolvedValue('1-1234567891'),
    getAllFishCaught: vi.fn().mockResolvedValue([]),
    updateFishCaught: vi.fn().mockResolvedValue(undefined),
    deleteFishCaught: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
    clearAllData: vi.fn().mockResolvedValue(undefined),
    clearSyncQueue: vi.fn().mockResolvedValue(undefined),
  };
  
  return {
    databaseService: mockDb,
    __esModule: true,
    default: mockDb,
  };
});

describe('Guest Mode Trip Creation', () => {
  let createdTrips: Trip[] = [];
  let createdWeatherLogs: WeatherLog[] = [];
  let createdFish: FishCaught[] = [];

  beforeEach(async () => {
    // Clear any existing data before each test
    await guestDataRetentionService.clearAllGuestData();
    createdTrips = [];
    createdWeatherLogs = [];
    createdFish = [];
    // Patch the mock to track created trips
    const { databaseService } = await import('../services/databaseService');
    let nextTripId = 1;
    let nextWeatherId = 1;
    let nextFishId = 1;

    databaseService.createTrip.mockImplementation(async (trip: Omit<Trip, 'id'>) => {
      const id = nextTripId++;
      const record = { ...trip, id } as Trip;
      createdTrips.push(record);
      return id;
    });
    databaseService.updateTrip.mockImplementation(async (trip: Trip) => {
      const index = createdTrips.findIndex(t => t.id === trip.id);
      if (index >= 0) {
        createdTrips[index] = { ...createdTrips[index], ...trip };
      }
    });
    databaseService.deleteTrip.mockImplementation(async (id: number) => {
      const index = createdTrips.findIndex(t => t.id === id);
      if (index >= 0) {
        createdTrips.splice(index, 1);
      }
    });
    databaseService.getAllTrips.mockImplementation(async () => createdTrips.map(trip => ({ ...trip })));

    databaseService.createWeatherLog.mockImplementation(async (weather: Omit<WeatherLog, 'id'>) => {
      const id = `weather-${nextWeatherId++}`;
      const record = { ...weather, id } as WeatherLog;
      createdWeatherLogs.push(record);
      return id;
    });
    databaseService.updateWeatherLog.mockImplementation(async (weather: WeatherLog) => {
      const index = createdWeatherLogs.findIndex(w => w.id === weather.id);
      if (index >= 0) {
        createdWeatherLogs[index] = { ...createdWeatherLogs[index], ...weather };
      }
    });
    databaseService.deleteWeatherLog.mockImplementation(async (id: string) => {
      const index = createdWeatherLogs.findIndex(w => w.id === id);
      if (index >= 0) {
        createdWeatherLogs.splice(index, 1);
      }
    });
    databaseService.getAllWeatherLogs.mockImplementation(async () => createdWeatherLogs.map(weather => ({ ...weather })));

    databaseService.createFishCaught.mockImplementation(async (fish: Omit<FishCaught, 'id'>) => {
      const id = `fish-${nextFishId++}`;
      const record = { ...fish, id } as FishCaught;
      createdFish.push(record);
      return id;
    });
    databaseService.updateFishCaught.mockImplementation(async (fish: FishCaught) => {
      const index = createdFish.findIndex(f => f.id === fish.id);
      if (index >= 0) {
        createdFish[index] = { ...createdFish[index], ...fish };
      }
    });
    databaseService.deleteFishCaught.mockImplementation(async (id: string) => {
      const index = createdFish.findIndex(f => f.id === id);
      if (index >= 0) {
        createdFish.splice(index, 1);
      }
    });
    databaseService.getAllFishCaught.mockImplementation(async () => createdFish.map(f => ({ ...f })));
  });

  afterEach(() => {
    localStorage.clear();
    createdTrips = [];
    createdWeatherLogs = [];
    createdFish = [];
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

    expect(createdTrips).toHaveLength(1);
    expect(createdTrips[0].notes).toBe('Calm by noon');

    await firebaseDataService.deleteTrip(tripId);
    expect(createdTrips).toHaveLength(0);
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

    expect(createdWeatherLogs).toHaveLength(1);

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

    expect(createdWeatherLogs[0].sky).toBe('Clear');

    await firebaseDataService.deleteWeatherLog(weatherId);
    expect(createdWeatherLogs).toHaveLength(0);
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
      photo: null,
    });

    expect(createdFish).toHaveLength(1);

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

    expect(createdFish[0].length).toBe('82cm');

    await firebaseDataService.deleteFishCaught(fishId);
    expect(createdFish).toHaveLength(0);
  });
});