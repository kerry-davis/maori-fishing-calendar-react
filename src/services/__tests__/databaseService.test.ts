import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '../databaseService';
import { Trip, WeatherLog, FishCaught } from '../../types';

// Mock IndexedDB
const mockIDBDatabase = {
  transaction: vi.fn(),
  close: vi.fn(),
  objectStoreNames: {
    contains: vi.fn()
  },
  createObjectStore: vi.fn(),
  deleteObjectStore: vi.fn()
};

const mockIDBTransaction = {
  objectStore: vi.fn(),
  oncomplete: null as any,
  onerror: null as any,
  error: null
};

const mockIDBObjectStore = {
  add: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  index: vi.fn(),
  createIndex: vi.fn(),
  openCursor: vi.fn()
};

const mockIDBIndex = {
  getAll: vi.fn(),
  openCursor: vi.fn()
};

const mockIDBRequest = {
  onsuccess: null as any,
  onerror: null as any,
  result: null as any,
  error: null
};

const mockIDBOpenRequest = {
  ...mockIDBRequest,
  onupgradeneeded: null as any
};

// Mock IndexedDB global
global.indexedDB = {
  open: vi.fn(() => mockIDBOpenRequest),
  deleteDatabase: vi.fn(),
  databases: vi.fn(),
  cmp: vi.fn()
} as any;

global.IDBKeyRange = {
  only: vi.fn((value) => ({ only: value }))
} as any;

describe('DatabaseService', () => {
  let databaseService: DatabaseService;

  beforeEach(() => {
    databaseService = new DatabaseService();
    vi.clearAllMocks();
    
    // Setup default mock behaviors
    mockIDBDatabase.transaction.mockReturnValue(mockIDBTransaction);
    mockIDBTransaction.objectStore.mockReturnValue(mockIDBObjectStore);
    mockIDBObjectStore.index.mockReturnValue(mockIDBIndex);
    mockIDBObjectStore.add.mockReturnValue(mockIDBRequest);
    mockIDBObjectStore.get.mockReturnValue(mockIDBRequest);
    mockIDBObjectStore.getAll.mockReturnValue(mockIDBRequest);
    mockIDBObjectStore.put.mockReturnValue(mockIDBRequest);
    mockIDBObjectStore.delete.mockReturnValue(mockIDBRequest);
    mockIDBIndex.getAll.mockReturnValue(mockIDBRequest);
  });

  afterEach(() => {
    databaseService.close();
  });

  describe('initialization', () => {
    it('should initialize database successfully', async () => {
      // Setup successful initialization
      mockIDBDatabase.objectStoreNames.contains.mockReturnValue(false);
      mockIDBDatabase.createObjectStore.mockReturnValue(mockIDBObjectStore);
      
      const initPromise = databaseService.initialize();
      
      // Simulate successful database opening
      mockIDBOpenRequest.result = mockIDBDatabase;
      mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest } as any);
      
      await initPromise;
      
      expect(databaseService.isReady()).toBe(true);
      expect(global.indexedDB.open).toHaveBeenCalledWith('fishingLog', 2);
    });

    it('should handle database initialization error', async () => {
      const initPromise = databaseService.initialize();
      
      // Simulate database error
      const error = new Error('Database connection failed');
      mockIDBOpenRequest.error = error;
      mockIDBOpenRequest.onerror({ target: mockIDBOpenRequest } as any);
      
      await expect(initPromise).rejects.toThrow('Failed to initialize database');
    });

    it('should create object stores on upgrade', async () => {
      mockIDBDatabase.objectStoreNames.contains.mockReturnValue(false);
      mockIDBDatabase.createObjectStore.mockReturnValue(mockIDBObjectStore);
      
      const initPromise = databaseService.initialize();
      
      // Simulate database upgrade
      mockIDBOpenRequest.result = mockIDBDatabase;
      mockIDBOpenRequest.onupgradeneeded({ target: mockIDBOpenRequest } as any);
      mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest } as any);
      
      await initPromise;
      
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('trips', { keyPath: 'id', autoIncrement: true });
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('weather_logs', { keyPath: 'id', autoIncrement: true });
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('fish_caught', { keyPath: 'id', autoIncrement: true });
    });
  });

  describe('trip operations', () => {
    beforeEach(async () => {
      // Initialize database for each test
      const initPromise = databaseService.initialize();
      mockIDBOpenRequest.result = mockIDBDatabase;
      mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest } as any);
      await initPromise;
    });

    it('should create a trip successfully', async () => {
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing day'
      };

      const createPromise = databaseService.createTrip(tripData);
      
      // Simulate successful creation
      mockIDBRequest.result = 1;
      mockIDBRequest.onsuccess();
      
      const tripId = await createPromise;
      
      expect(tripId).toBe(1);
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(tripData);
    });

    it('should get trip by ID', async () => {
      const trip: Trip = {
        id: 1,
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing day'
      };

      const getPromise = databaseService.getTripById(1);
      
      // Simulate successful retrieval
      mockIDBRequest.result = trip;
      mockIDBRequest.onsuccess();
      
      const result = await getPromise;
      
      expect(result).toEqual(trip);
      expect(mockIDBObjectStore.get).toHaveBeenCalledWith(1);
    });

    it('should get trips by date', async () => {
      const trips: Trip[] = [
        {
          id: 1,
          date: '2024-01-15',
          water: 'Lake Taupo',
          location: 'Western Bay',
          hours: 4,
          companions: 'John Doe',
          notes: 'Great fishing day'
        }
      ];

      const getPromise = databaseService.getTripsByDate('2024-01-15');
      
      // Simulate successful retrieval
      mockIDBRequest.result = trips;
      mockIDBRequest.onsuccess();
      
      const result = await getPromise;
      
      expect(result).toEqual(trips);
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith('2024-01-15');
    });

    it('should update a trip', async () => {
      const trip: Trip = {
        id: 1,
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 5,
        companions: 'John Doe',
        notes: 'Updated notes'
      };

      const updatePromise = databaseService.updateTrip(trip);
      
      // Simulate successful update
      mockIDBRequest.onsuccess();
      
      await updatePromise;
      
      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(trip);
    });

    it('should delete a trip and associated data', async () => {
      const deletePromise = databaseService.deleteTrip(1);
      
      // Simulate successful deletion
      mockIDBTransaction.oncomplete();
      
      await deletePromise;
      
      expect(mockIDBObjectStore.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('weather log operations', () => {
    beforeEach(async () => {
      // Initialize database for each test
      const initPromise = databaseService.initialize();
      mockIDBOpenRequest.result = mockIDBDatabase;
      mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest } as any);
      await initPromise;
    });

    it('should create a weather log successfully', async () => {
      const weatherData: Omit<WeatherLog, 'id'> = {
        tripId: 1,
        timeOfDay: 'Morning',
        sky: 'Partly Cloudy',
        windCondition: 'Light',
        windDirection: 'NE',
        waterTemp: '18',
        airTemp: '22'
      };

      const createPromise = databaseService.createWeatherLog(weatherData);
      
      // Simulate successful creation
      mockIDBRequest.result = 1;
      mockIDBRequest.onsuccess();
      
      const weatherId = await createPromise;
      
      expect(weatherId).toBe(1);
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(weatherData);
    });

    it('should get weather logs by trip ID', async () => {
      const weatherLogs: WeatherLog[] = [
        {
          id: 1,
          tripId: 1,
          timeOfDay: 'Morning',
          sky: 'Partly Cloudy',
          windCondition: 'Light',
          windDirection: 'NE',
          waterTemp: '18',
          airTemp: '22'
        }
      ];

      const getPromise = databaseService.getWeatherLogsByTripId(1);
      
      // Simulate successful retrieval
      mockIDBRequest.result = weatherLogs;
      mockIDBRequest.onsuccess();
      
      const result = await getPromise;
      
      expect(result).toEqual(weatherLogs);
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith(1);
    });
  });

  describe('fish caught operations', () => {
    beforeEach(async () => {
      // Initialize database for each test
      const initPromise = databaseService.initialize();
      mockIDBOpenRequest.result = mockIDBDatabase;
      mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest } as any);
      await initPromise;
    });

    it('should create a fish caught record successfully', async () => {
      const fishData: Omit<FishCaught, 'id'> = {
        tripId: 1,
        species: 'Rainbow Trout',
        length: '45',
        weight: '2.5',
        time: '10:30',
        gear: ['Spinner', 'Light Rod'],
        details: 'Caught near the rocks'
      };

      const createPromise = databaseService.createFishCaught(fishData);
      
      // Simulate successful creation
      mockIDBRequest.result = 1;
      mockIDBRequest.onsuccess();
      
      const fishId = await createPromise;
      
      expect(fishId).toBe(1);
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(fishData);
    });

    it('should get fish caught records by trip ID', async () => {
      const fishRecords: FishCaught[] = [
        {
          id: 1,
          tripId: 1,
          species: 'Rainbow Trout',
          length: '45',
          weight: '2.5',
          time: '10:30',
          gear: ['Spinner', 'Light Rod'],
          details: 'Caught near the rocks'
        }
      ];

      const getPromise = databaseService.getFishCaughtByTripId(1);
      
      // Simulate successful retrieval
      mockIDBRequest.result = fishRecords;
      mockIDBRequest.onsuccess();
      
      const result = await getPromise;
      
      expect(result).toEqual(fishRecords);
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith(1);
    });

    it('should get fish count for trip', async () => {
      const fishRecords: FishCaught[] = [
        {
          id: 1,
          tripId: 1,
          species: 'Rainbow Trout',
          length: '45',
          weight: '2.5',
          time: '10:30',
          gear: ['Spinner'],
          details: 'First catch'
        },
        {
          id: 2,
          tripId: 1,
          species: 'Brown Trout',
          length: '38',
          weight: '1.8',
          time: '14:15',
          gear: ['Fly'],
          details: 'Second catch'
        }
      ];

      const countPromise = databaseService.getFishCountForTrip(1);
      
      // Simulate successful retrieval
      mockIDBRequest.result = fishRecords;
      mockIDBRequest.onsuccess();
      
      const count = await countPromise;
      
      expect(count).toBe(2);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      // Initialize database for each test
      const initPromise = databaseService.initialize();
      mockIDBOpenRequest.result = mockIDBDatabase;
      mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest } as any);
      await initPromise;
    });

    it('should check if date has trips', async () => {
      const trips: Trip[] = [
        {
          id: 1,
          date: '2024-01-15',
          water: 'Lake Taupo',
          location: 'Western Bay',
          hours: 4,
          companions: 'John Doe',
          notes: 'Great fishing day'
        }
      ];

      const hasTripsPromise = databaseService.hasTripsOnDate('2024-01-15');
      
      // Simulate successful retrieval
      mockIDBRequest.result = trips;
      mockIDBRequest.onsuccess();
      
      const hasTrips = await hasTripsPromise;
      
      expect(hasTrips).toBe(true);
    });

    it('should get dates with trips', async () => {
      const trips: Trip[] = [
        {
          id: 1,
          date: '2024-01-15',
          water: 'Lake Taupo',
          location: 'Western Bay',
          hours: 4,
          companions: 'John Doe',
          notes: 'Great fishing day'
        },
        {
          id: 2,
          date: '2024-01-16',
          water: 'Lake Rotorua',
          location: 'Eastern Shore',
          hours: 3,
          companions: 'Jane Smith',
          notes: 'Another good day'
        },
        {
          id: 3,
          date: '2024-01-15',
          water: 'Lake Taupo',
          location: 'Northern Bay',
          hours: 2,
          companions: '',
          notes: 'Solo trip'
        }
      ];

      const getDatesPromise = databaseService.getDatesWithTrips();
      
      // Simulate successful retrieval
      mockIDBRequest.result = trips;
      mockIDBRequest.onsuccess();
      
      const dates = await getDatesPromise;
      
      expect(dates).toEqual(['2024-01-15', '2024-01-16']);
    });

    it('should clear all data', async () => {
      const clearPromise = databaseService.clearAllData();
      
      // Simulate successful clearing
      mockIDBTransaction.oncomplete();
      
      await clearPromise;
      
      expect(mockIDBObjectStore.clear).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      // Initialize database for each test
      const initPromise = databaseService.initialize();
      mockIDBOpenRequest.result = mockIDBDatabase;
      mockIDBOpenRequest.onsuccess({ target: mockIDBOpenRequest } as any);
      await initPromise;
    });

    it('should handle transaction errors', async () => {
      const tripData: Omit<Trip, 'id'> = {
        date: '2024-01-15',
        water: 'Lake Taupo',
        location: 'Western Bay',
        hours: 4,
        companions: 'John Doe',
        notes: 'Great fishing day'
      };

      const createPromise = databaseService.createTrip(tripData);
      
      // Simulate transaction error
      const error = new Error('Transaction failed');
      mockIDBRequest.error = error;
      mockIDBRequest.onerror();
      
      await expect(createPromise).rejects.toThrow('Failed to create trip');
    });

    it('should throw error when database not initialized', () => {
      const uninitializedService = new DatabaseService();
      
      expect(() => uninitializedService.getDatabase()).toThrow('Database not initialized');
    });
  });
});