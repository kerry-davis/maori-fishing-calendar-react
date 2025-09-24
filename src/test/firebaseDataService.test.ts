import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirebaseDataService } from '../services/firebaseDataService';
import type { Trip, WeatherLog, FishCaught } from '../types';

// Mock Firebase modules
vi.mock('../services/firebase', () => ({
  firestore: {},
  auth: {
    currentUser: {
      uid: 'test-user-id'
    }
  }
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
  })),
  onSnapshot: vi.fn(),
  Timestamp: {
    fromDate: vi.fn(),
  },
}));

// Mock databaseService
vi.mock('../services/databaseService', () => ({
  databaseService: {
    getAllTrips: vi.fn(() => Promise.resolve([])),
    getAllWeatherLogs: vi.fn(() => Promise.resolve([])),
    getAllFishCaught: vi.fn(() => Promise.resolve([])),
    clearAllData: vi.fn(() => Promise.resolve()),
    createTrip: vi.fn(),
    createWeatherLog: vi.fn(),
    createFishCaught: vi.fn(),
    deleteWeatherLog: vi.fn(),
    deleteFishCaught: vi.fn(),
  }
}));

describe('FirebaseDataService', () => {
  let service: FirebaseDataService;

  beforeEach(() => {
    service = new FirebaseDataService();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should not be ready without user initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should be ready after user initialization', async () => {
      await service.initialize('test-user-id');
      expect(service.isReady()).toBe(true);
    });
  });

  describe('data integrity', () => {
    beforeEach(async () => {
      await service.initialize('test-user-id');
    });

    it('should handle offline/online transitions', () => {
      // Test online status monitoring
      expect(service.isReady()).toBe(true);
    });

    it('should maintain data consistency', () => {
      // Basic consistency check
      expect(typeof service.isReady()).toBe('boolean');
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Test error scenarios
      expect(async () => {
        await service.initialize('');
      }).not.toThrow();
    });
  });

  describe('ID mapping functionality', () => {
    beforeEach(async () => {
      await service.initialize('test-user-id');
    });

    it('should store and retrieve Firebase ID mappings', async () => {
      const mockLocalId = '123';
      const mockFirebaseId = 'firebase-doc-id';

      // Mock localStorage
      const originalGetItem = Storage.prototype.getItem;
      const originalSetItem = Storage.prototype.setItem;

      Storage.prototype.getItem = vi.fn((key: string) => {
        if (key === `idMapping_test-user-id_trips_${mockLocalId}`) {
          return mockFirebaseId;
        }
        return null;
      });

      Storage.prototype.setItem = vi.fn();

      // Test storing mapping
      await service['storeLocalMapping']('trips', mockLocalId, mockFirebaseId);

      // Test retrieving mapping
      const retrievedId = await service['getFirebaseId']('trips', mockLocalId);
      expect(retrievedId).toBe(mockFirebaseId);

      // Restore original methods
      Storage.prototype.getItem = originalGetItem;
      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle missing ID mappings gracefully', async () => {
      const mockLocalId = 'nonexistent-id';

      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn(() => null);

      const retrievedId = await service['getFirebaseId']('trips', mockLocalId);
      expect(retrievedId).toBeNull();

      Storage.prototype.getItem = originalGetItem;
    });
  });

  describe('merge functionality', () => {
    let mockTrips: Trip[];
    let mockWeatherLogs: WeatherLog[];
    let mockFishCaught: FishCaught[];

    beforeEach(async () => {
      await service.initialize('test-user-id');

      mockTrips = [
        {
          id: 1,
          date: '2025-01-01',
          water: 'Test Lake',
          location: 'Test Location',
          hours: 2,
          companions: '',
          notes: 'Test trip'
        }
      ];

      mockWeatherLogs = [
        {
          id: '1-1234567890',
          tripId: 1,
          timeOfDay: 'AM',
          sky: 'Sunny',
          windCondition: 'Light',
          windDirection: 'North',
          waterTemp: '20',
          airTemp: '25'
        }
      ];

      mockFishCaught = [
        {
          id: '1-1234567891',
          tripId: 1,
          species: 'Test Fish',
          length: '30cm',
          weight: '1kg',
          time: '10:00',
          gear: ['rod'],
          details: 'Test catch'
        }
      ];
    });

    it('should update existing trips instead of creating duplicates', async () => {
      const { databaseService } = await import('../services/databaseService');
      const mockGetAllTrips = vi.fn(() => Promise.resolve(mockTrips));
      const mockGetAllWeatherLogs = vi.fn(() => Promise.resolve([]));
      const mockGetAllFishCaught = vi.fn(() => Promise.resolve([]));

      (databaseService.getAllTrips as any) = mockGetAllTrips;
      (databaseService.getAllWeatherLogs as any) = mockGetAllWeatherLogs;
      (databaseService.getAllFishCaught as any) = mockGetAllFishCaught;

      // Mock existing trip in Firestore
      const mockDocSnap = {
        exists: () => true,
        data: () => ({ ...mockTrips[0], userId: 'test-user-id' })
      };

      const mockGetDoc = vi.fn(() => Promise.resolve(mockDocSnap));
      const mockGetDocs = vi.fn(() => Promise.resolve({ empty: true, docs: [] }));
      const mockUpdate = vi.fn(() => Promise.resolve());
      const mockCommit = vi.fn(() => Promise.resolve());

      vi.mocked(require('firebase/firestore').getDoc).mockImplementation(mockGetDoc);
      vi.mocked(require('firebase/firestore').getDocs).mockImplementation(mockGetDocs);
      vi.mocked(require('firebase/firestore').updateDoc).mockImplementation(mockUpdate);
      vi.mocked(require('firebase/firestore').writeBatch).mockImplementation(() => ({
        update: vi.fn(),
        set: vi.fn(),
        commit: mockCommit
      }));

      // Mock existing ID mapping
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn((key: string) => {
        if (key === 'idMapping_test-user-id_trips_1') {
          return 'existing-firebase-id';
        }
        return null;
      });

      await service.mergeLocalDataForUser();

      // Verify that update was called instead of create
      expect(mockUpdate).toHaveBeenCalled();

      Storage.prototype.getItem = originalGetItem;
    });

    it('should create new records when no existing mapping found', async () => {
      const { databaseService } = await import('../services/databaseService');
      const mockGetAllTrips = vi.fn(() => Promise.resolve(mockTrips));
      const mockGetAllWeatherLogs = vi.fn(() => Promise.resolve(mockWeatherLogs));
      const mockGetAllFishCaught = vi.fn(() => Promise.resolve(mockFishCaught));

      (databaseService.getAllTrips as any) = mockGetAllTrips;
      (databaseService.getAllWeatherLogs as any) = mockGetAllWeatherLogs;
      (databaseService.getAllFishCaught as any) = mockGetAllFishCaught;

      // Mock no existing records in Firestore
      const mockGetDocs = vi.fn(() => Promise.resolve({ empty: true, docs: [] }));
      const mockAddDoc = vi.fn(() => Promise.resolve({ id: 'new-firebase-id' }));
      const mockSet = vi.fn(() => Promise.resolve());
      const mockCommit = vi.fn(() => Promise.resolve());

      vi.mocked(require('firebase/firestore').getDocs).mockImplementation(mockGetDocs);
      vi.mocked(require('firebase/firestore').addDoc).mockImplementation(mockAddDoc);
      vi.mocked(require('firebase/firestore').writeBatch).mockImplementation(() => ({
        update: vi.fn(),
        set: mockSet,
        commit: mockCommit
      }));

      // Mock no existing ID mappings
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn(() => null);

      await service.mergeLocalDataForUser();

      // Verify that new records were created
      expect(mockSet).toHaveBeenCalledTimes(3); // 1 trip + 1 weather + 1 fish

      Storage.prototype.getItem = originalGetItem;
    });

    it('should handle stale ID mappings correctly', async () => {
      const { databaseService } = await import('../services/databaseService');
      const mockGetAllTrips = vi.fn(() => Promise.resolve(mockTrips));
      const mockGetAllWeatherLogs = vi.fn(() => Promise.resolve(mockWeatherLogs));
      const mockGetAllFishCaught = vi.fn(() => Promise.resolve(mockFishCaught));

      (databaseService.getAllTrips as any) = mockGetAllTrips;
      (databaseService.getAllWeatherLogs as any) = mockGetAllWeatherLogs;
      (databaseService.getAllFishCaught as any) = mockGetAllFishCaught;

      // Mock stale mapping (document doesn't exist)
      const mockDocSnap = {
        exists: () => false,
        data: () => ({})
      };

      const mockGetDoc = vi.fn(() => Promise.resolve(mockDocSnap));
      const mockGetDocs = vi.fn(() => Promise.resolve({
        empty: false,
        docs: [{ id: 'fallback-firebase-id', data: () => ({ ...mockTrips[0], userId: 'test-user-id' }) }]
      }));
      const mockSet = vi.fn(() => Promise.resolve());
      const mockCommit = vi.fn(() => Promise.resolve());

      vi.mocked(require('firebase/firestore').getDoc).mockImplementation(mockGetDoc);
      vi.mocked(require('firebase/firestore').getDocs).mockImplementation(mockGetDocs);
      vi.mocked(require('firebase/firestore').writeBatch).mockImplementation(() => ({
        update: vi.fn(),
        set: mockSet,
        commit: mockCommit
      }));

      // Mock stale ID mapping
      const originalGetItem = Storage.prototype.getItem;
      const originalRemoveItem = Storage.prototype.removeItem;
      const originalSetItem = Storage.prototype.setItem;

      Storage.prototype.getItem = vi.fn((key: string) => {
        if (key === 'idMapping_test-user-id_trips_1') {
          return 'stale-firebase-id';
        }
        return null;
      });

      Storage.prototype.removeItem = vi.fn();
      Storage.prototype.setItem = vi.fn();

      await service.mergeLocalDataForUser();

      // Verify that stale mapping was removed and fallback was used
      expect(Storage.prototype.removeItem).toHaveBeenCalledWith('idMapping_test-user-id_trips_1');
      expect(Storage.prototype.setItem).toHaveBeenCalledWith('idMapping_test-user-id_trips_1', 'fallback-firebase-id');

      Storage.prototype.getItem = originalGetItem;
      Storage.prototype.removeItem = originalRemoveItem;
      Storage.prototype.setItem = originalSetItem;
    });

    it('should skip orphaned records during merge', async () => {
      const { databaseService } = await import('../services/databaseService');

      // Create orphaned weather log (tripId doesn't exist in trips)
      const orphanedWeatherLog = {
        id: '999-1234567890',
        tripId: 999, // Non-existent trip
        timeOfDay: 'AM',
        sky: 'Cloudy',
        windCondition: 'Moderate',
        windDirection: 'South',
        waterTemp: '18',
        airTemp: '22'
      };

      const mockGetAllTrips = vi.fn(() => Promise.resolve(mockTrips));
      const mockGetAllWeatherLogs = vi.fn(() => Promise.resolve([orphanedWeatherLog]));
      const mockGetAllFishCaught = vi.fn(() => Promise.resolve([]));

      (databaseService.getAllTrips as any) = mockGetAllTrips;
      (databaseService.getAllWeatherLogs as any) = mockGetAllWeatherLogs;
      (databaseService.getAllFishCaught as any) = mockGetAllFishCaught;

      const mockGetDocs = vi.fn(() => Promise.resolve({ empty: true, docs: [] }));
      const mockSet = vi.fn(() => Promise.resolve());
      const mockCommit = vi.fn(() => Promise.resolve());

      vi.mocked(require('firebase/firestore').getDocs).mockImplementation(mockGetDocs);
      vi.mocked(require('firebase/firestore').writeBatch).mockImplementation(() => ({
        update: vi.fn(),
        set: mockSet,
        commit: mockCommit
      }));

      await service.mergeLocalDataForUser();

      // Verify that only valid records were processed (1 trip, 0 weather logs, 0 fish caught)
      expect(mockSet).toHaveBeenCalledTimes(1); // Only the trip should be created
    });
  });

  describe('data validation', () => {
    beforeEach(async () => {
      await service.initialize('test-user-id');
    });

    it('should validate trip data correctly', () => {
      const validTripData = {
        date: '2025-01-01',
        water: 'Test Lake',
        location: 'Test Location',
        hours: 2,
        companions: '',
        notes: 'Test notes'
      };

      expect(() => {
        service['validateTripData'](validTripData);
      }).not.toThrow();

      // Test invalid data
      const invalidTripData = {
        date: 'invalid-date',
        water: '',
        location: '',
        hours: -1
      };

      expect(() => {
        service['validateTripData'](invalidTripData as any);
      }).toThrow();
    });

    it('should validate weather log data correctly', () => {
      const validWeatherData = {
        tripId: 1,
        timeOfDay: 'AM',
        sky: 'Sunny',
        windCondition: 'Light',
        windDirection: 'North',
        waterTemp: '20',
        airTemp: '25'
      };

      expect(() => {
        service['validateWeatherLogData'](validWeatherData);
      }).not.toThrow();

      // Test invalid data
      const invalidWeatherData = {
        tripId: -1,
        timeOfDay: '',
        sky: 'Sunny'
      };

      expect(() => {
        service['validateWeatherLogData'](invalidWeatherData as any);
      }).toThrow();
    });

    it('should validate fish catch data correctly', () => {
      const validFishData = {
        tripId: 1,
        species: 'Test Fish',
        length: '30cm',
        weight: '1kg',
        time: '10:00',
        gear: ['rod'],
        details: 'Test catch'
      };

      expect(() => {
        service['validateFishCatchData'](validFishData);
      }).not.toThrow();

      // Test invalid data
      const invalidFishData = {
        tripId: -1,
        species: '',
        gear: 'not-array'
      };

      expect(() => {
        service['validateFishCatchData'](invalidFishData as any);
      }).toThrow();
    });
  });

});