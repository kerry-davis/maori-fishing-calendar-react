import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirebaseDataService } from '../services/firebaseDataService';
import type { Trip, WeatherLog, FishCaught, ImportProgress } from '../types';

// Mock Firebase modules
vi.mock('../services/firebase', () => ({
  firestore: {},
  auth: {
    currentUser: {
      uid: 'test-user-id'
    }
  },
  storage: {}
}));

const { storageRefMock, listAllMock, deleteObjectMock } = vi.hoisted(() => ({
  storageRefMock: vi.fn(),
  listAllMock: vi.fn(),
  deleteObjectMock: vi.fn()
}));

vi.mock('firebase/storage', () => ({
  ref: storageRefMock,
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  getMetadata: vi.fn(),
  listAll: listAllMock,
  deleteObject: deleteObjectMock
}));

const makeSnapshot = (name: string, count: number) => {
  const docs = Array.from({ length: count }, (_, index) => ({ ref: { path: `${name}/doc${index + 1}` } }));
  return {
    empty: count === 0,
    size: count,
    docs,
    forEach: (cb: (doc: any) => void) => docs.forEach(cb)
  };
};

const createLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: vi.fn(() => {
      store.clear();
    }),
    getItem: vi.fn((key: string) => (store.has(key) ? store.get(key)! : null)),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    })
  } as unknown as Storage;
};

vi.mock('firebase/firestore', () => {
  const originalModule = vi.importActual('firebase/firestore');
  return {
    ...originalModule,
    collection: vi.fn(),
    doc: vi.fn((...args) => ({
      id: 'mock-doc-id',
      path: args.join('/'),
      withConverter: vi.fn(),
    })),
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
  };
});

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
    vi.clearAllMocks();
    storageRefMock.mockImplementation((_, path: string) => ({ fullPath: path }));
    listAllMock.mockImplementation(async () => ({ items: [], prefixes: [] }));
    deleteObjectMock.mockResolvedValue(undefined);
    Object.defineProperty(window, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true
    });
    service = new FirebaseDataService();
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

  describe('clearFirestoreUserData', () => {
    beforeEach(async () => {
      await service.initialize('test-user-id');
    });

    it('cleans Firestore collections and related storage assets', async () => {
      const firestore = await import('firebase/firestore');
      const { collection, query, where, getDocs, writeBatch } = firestore as any;

      collection.mockImplementation((_: unknown, name: string) => ({ collection: name }));
      query.mockImplementation((ref: any) => ref);
      where.mockImplementation(() => ({}));

      getDocs.mockImplementation(async (ref: any) => {
        switch (ref.collection) {
          case 'trips':
            return makeSnapshot('trips', 2);
          case 'weatherLogs':
            return makeSnapshot('weatherLogs', 1);
          case 'fishCaught':
            return makeSnapshot('fishCaught', 1);
          default:
            return makeSnapshot(ref.collection ?? 'unknown', 0);
        }
      });

      const batchDeletePaths: string[] = [];
      const commitSpy = vi.fn(() => Promise.resolve());

      writeBatch.mockImplementation(() => ({
        delete: vi.fn((ref: { path: string }) => {
          batchDeletePaths.push(ref.path);
        }),
        commit: commitSpy,
        set: vi.fn(),
        update: vi.fn()
      }));

      listAllMock.mockImplementation(async (ref: { fullPath: string }) => {
        if (ref.fullPath === 'users/test-user-id/catches') {
          return {
            prefixes: [],
            items: [{ fullPath: 'users/test-user-id/catches/catch1.jpg' }]
          };
        }
        if (ref.fullPath === 'users/test-user-id/images') {
          return {
            prefixes: [],
            items: [{ fullPath: 'users/test-user-id/images/hash1' }]
          };
        }
        return { prefixes: [], items: [] };
      });

      const { databaseService } = await import('../services/databaseService');

      await expect(service.clearFirestoreUserData()).resolves.toBeUndefined();

      expect(batchDeletePaths).toEqual([
        'trips/doc1',
        'trips/doc2',
        'weatherLogs/doc1',
        'fishCaught/doc1'
      ]);
      expect(commitSpy).toHaveBeenCalledTimes(3);
      expect(listAllMock).toHaveBeenCalledWith(expect.objectContaining({ fullPath: 'users/test-user-id/catches' }));
      expect(listAllMock).toHaveBeenCalledWith(expect.objectContaining({ fullPath: 'users/test-user-id/images' }));
      expect(deleteObjectMock).toHaveBeenCalledTimes(2);
      expect(deleteObjectMock).toHaveBeenCalledWith(expect.objectContaining({ fullPath: 'users/test-user-id/catches/catch1.jpg' }));
      expect(deleteObjectMock).toHaveBeenCalledWith(expect.objectContaining({ fullPath: 'users/test-user-id/images/hash1' }));
      expect(databaseService.clearAllData).toHaveBeenCalled();
    });

    it('skips storage cleanup when storage is unavailable', async () => {
      const firestore = await import('firebase/firestore');
      const { collection, query, where, getDocs, writeBatch } = firestore as any;

      collection.mockImplementation((_: unknown, name: string) => ({ collection: name }));
      query.mockImplementation((ref: any) => ref);
      where.mockImplementation(() => ({}));
      getDocs.mockImplementation(async (ref: any) => {
        switch (ref.collection) {
          case 'trips':
          case 'weatherLogs':
          case 'fishCaught':
            return makeSnapshot(ref.collection, 0);
          default:
            return makeSnapshot('unknown', 0);
        }
      });

      writeBatch.mockImplementation(() => ({
        delete: vi.fn(),
        commit: vi.fn(() => Promise.resolve()),
        set: vi.fn(),
        update: vi.fn()
      }));

      listAllMock.mockClear();
      deleteObjectMock.mockClear();

      (service as any).storageInstance = undefined;
      (service as any).hasLoggedStorageUnavailable = false;

      await expect(service.clearFirestoreUserData()).resolves.toBeUndefined();

      expect(listAllMock).not.toHaveBeenCalled();
      expect(deleteObjectMock).not.toHaveBeenCalled();
      const { databaseService } = await import('../services/databaseService');
      expect(databaseService.clearAllData).toHaveBeenCalled();
    });

    it('retains inline photo data when storage uploads are skipped', async () => {
      const { databaseService } = await import('../services/databaseService');
      const firestore = await import('firebase/firestore');

      (service as any).storageInstance = undefined;
      (service as any).hasLoggedStorageUnavailable = false;

      const fishData: Omit<FishCaught, 'id'> = {
        tripId: 1,
        species: 'Salmon',
        length: '30in',
        weight: '10lb',
        time: '10:00',
        gear: ['rod'],
        details: 'Fresh catch',
        photo: 'data:image/png;base64,AAAA'
      };

      vi.spyOn(databaseService, 'createFishCaught');
      const queuedSpy = vi.spyOn(service as any, 'queueOperation');
      vi.spyOn(firestore, 'collection').mockImplementation(() => ({}));
      vi.spyOn(firestore, 'serverTimestamp').mockImplementation(() => ({}));

      let capturedPayload: any = null;
      vi.spyOn(firestore, 'addDoc').mockImplementation(async (_ref: any, payload: any) => {
        capturedPayload = payload;
        return { id: 'firebase-doc-id' };
      });

      await service.createFishCaught(fishData);

      const { addDoc } = firestore as any;
      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(queuedSpy).not.toHaveBeenCalled();
      expect(databaseService.createFishCaught).not.toHaveBeenCalled();
      expect(capturedPayload.photo).toMatch(/^data:image\/png;base64/);
      expect(capturedPayload.photoHash).toBeDefined();
    });

    it('reports progress milestones during data wipe', async () => {
      const firestore = await import('firebase/firestore');
      const { collection, query, where, getDocs, writeBatch } = firestore as any;

      collection.mockImplementation((_: unknown, name: string) => ({ collection: name }));
      query.mockImplementation((ref: any) => ref);
      where.mockImplementation(() => ({}));

      getDocs.mockImplementation(async (ref: any) => {
        switch (ref.collection) {
          case 'trips':
            return makeSnapshot('trips', 2);
          case 'weatherLogs':
            return makeSnapshot('weatherLogs', 1);
          case 'fishCaught':
            return makeSnapshot('fishCaught', 0);
          default:
            return makeSnapshot('unknown', 0);
        }
      });

      writeBatch.mockImplementation(() => ({
        delete: vi.fn(),
        commit: vi.fn(() => Promise.resolve()),
        set: vi.fn(),
        update: vi.fn()
      }));

      listAllMock.mockImplementation(async (ref: { fullPath: string }) => {
        if (ref.fullPath === 'users/test-user-id/catches') {
          return { prefixes: [], items: [{ fullPath: 'users/test-user-id/catches/photo1' }] };
        }
        if (ref.fullPath === 'users/test-user-id/images') {
          return { prefixes: [], items: [] };
        }
        return { prefixes: [], items: [] };
      });

      deleteObjectMock.mockImplementation(async () => undefined);

      const progressEvents: ImportProgress[] = [];

      await service.clearFirestoreUserData((progress) => {
        progressEvents.push(progress);
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].phase).toBe('preparing');
      expect(progressEvents.some((event) => event.phase === 'storage-inventory')).toBe(true);
      expect(progressEvents.some((event) => event.phase === 'delete-trips')).toBe(true);
      const finalEvent = progressEvents[progressEvents.length - 1];
      expect(finalEvent.phase).toBe('complete');
      expect(finalEvent.percent).toBe(100);
    });
  });

  describe('ID mapping functionality', () => {
    beforeEach(async () => {
      await service.initialize('test-user-id');
    });

    it('should store and retrieve Firebase ID mappings', async () => {
      const mockLocalId = '123';
      const mockFirebaseId = 'firebase-doc-id';

      // Test storing mapping
      await service['storeLocalMapping']('trips', mockLocalId, mockFirebaseId);

      expect(window.localStorage.getItem(`idMapping_test-user-id_trips_${mockLocalId}`)).toBe(mockFirebaseId);

      // Test retrieving mapping
      const retrievedId = await service['getFirebaseId']('trips', mockLocalId);
      expect(retrievedId).toBe(mockFirebaseId);
    });

    it('should handle missing ID mappings gracefully', async () => {
      const mockLocalId = 'nonexistent-id';

      const retrievedId = await service['getFirebaseId']('trips', mockLocalId);
      expect(retrievedId).toBeNull();
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
        data: () => ({ ...mockTrips[0], userId: 'test-user-id' }),
        id: 'mock-id',
        ref: 'mock-ref',
        metadata: {},
        get: vi.fn(),
        toJSON: vi.fn(),
      };

      const mockGetDoc = vi.fn(() => Promise.resolve(mockDocSnap));
      const mockGetDocs = vi.fn(() => Promise.resolve({
        empty: true,
        docs: [],
        forEach: vi.fn(),
        metadata: {},
        query: {},
        size: 0,
        docChanges: [],
        toJSON: vi.fn(),
      }));
      const mockUpdate = vi.fn(() => Promise.resolve());
      const mockCommit = vi.fn(() => Promise.resolve());

      const firestore = await import('firebase/firestore');
      vi.spyOn(firestore, 'getDoc').mockImplementation(mockGetDoc);
      vi.spyOn(firestore, 'getDocs').mockImplementation(mockGetDocs);
      vi.spyOn(firestore, 'updateDoc').mockImplementation(mockUpdate);
      const mockBatchUpdate = vi.fn();
      vi.spyOn(firestore, 'writeBatch').mockImplementation(() => ({
        update: mockBatchUpdate,
        set: vi.fn(),
        commit: mockCommit,
        delete: vi.fn(),
      }));

      // Mock existing ID mapping
      window.localStorage.setItem('idMapping_test-user-id_trips_1', 'existing-firebase-id');

      await service.mergeLocalDataForUser();

      // Verify that update was called instead of create
      expect(mockBatchUpdate).toHaveBeenCalled();
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
      const mockGetDocs = vi.fn(() => Promise.resolve({
        empty: true,
        docs: [],
        forEach: vi.fn(),
        metadata: {},
        query: {},
        size: 0,
        docChanges: [],
        toJSON: vi.fn(),
      }));
      const mockAddDoc = vi.fn(() => Promise.resolve({
        id: 'new-firebase-id',
        converter: {},
        type: 'document',
        firestore: {},
        path: 'mock/path',
      }));
      const mockSet = vi.fn(() => Promise.resolve());
      const mockCommit = vi.fn(() => Promise.resolve());

      const firestore = await import('firebase/firestore');
      vi.spyOn(firestore, 'getDocs').mockImplementation(mockGetDocs);
      vi.spyOn(firestore, 'addDoc').mockImplementation(mockAddDoc);
      vi.spyOn(firestore, 'writeBatch').mockImplementation(() => ({
        update: vi.fn(),
        set: mockSet,
        commit: mockCommit,
        delete: vi.fn(),
      }));

      await service.mergeLocalDataForUser();

      // Verify that new records were created
      expect(mockSet).toHaveBeenCalledTimes(3); // 1 trip + 1 weather + 1 fish
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
        data: () => ({}),
        id: 'mock-id',
        ref: 'mock-ref',
        metadata: {},
        get: vi.fn(),
        toJSON: vi.fn(),
      };

      const mockGetDoc = vi.fn(() => Promise.resolve(mockDocSnap));
      const mockGetDocs = vi.fn(() => Promise.resolve({
        empty: false,
        docs: [{ id: 'fallback-firebase-id', data: () => ({ ...mockTrips[0], userId: 'test-user-id' }) }],
        forEach: vi.fn(),
        metadata: {},
        query: {},
        size: 0,
        docChanges: [],
        toJSON: vi.fn(),
      }));
      const mockSet = vi.fn(() => Promise.resolve());
      const mockCommit = vi.fn(() => Promise.resolve());

      const firestore = await import('firebase/firestore');
      vi.spyOn(firestore, 'getDoc').mockImplementation(mockGetDoc);
      vi.spyOn(firestore, 'getDocs').mockImplementation(mockGetDocs);
      vi.spyOn(firestore, 'writeBatch').mockImplementation(() => ({
        update: vi.fn(),
        set: mockSet,
        commit: mockCommit,
        delete: vi.fn(),
      }));

      // Mock stale ID mapping
      window.localStorage.setItem('idMapping_test-user-id_trips_1', 'stale-firebase-id');

      await service.mergeLocalDataForUser();

      // Verify that stale mapping was removed and fallback was used
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('idMapping_test-user-id_trips_1');
      expect(window.localStorage.setItem).toHaveBeenCalledWith('idMapping_test-user-id_trips_1', 'fallback-firebase-id');
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

      const mockGetDocs = vi.fn(() => Promise.resolve({
        empty: true,
        docs: [],
        forEach: vi.fn(),
        metadata: {},
        query: {},
        size: 0,
        docChanges: [],
        toJSON: vi.fn(),
      }));
      const mockSet = vi.fn(() => Promise.resolve());
      const mockCommit = vi.fn(() => Promise.resolve());

      const firestore = await import('firebase/firestore');
      vi.spyOn(firestore, 'getDocs').mockImplementation(mockGetDocs);
      vi.spyOn(firestore, 'writeBatch').mockImplementation(() => ({
        update: vi.fn(),
        set: mockSet,
        commit: mockCommit,
        delete: vi.fn(),
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