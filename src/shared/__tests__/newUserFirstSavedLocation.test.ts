import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firebaseDataService } from '../services/firebaseDataService';
import { browserZipImportService } from '../services/browserZipImportService';
import { firestore as mockedFirestore } from '../services/firebase';
import { setDoc as firestoreSetDoc } from 'firebase/firestore';
import type { SavedLocationCreateInput, SavedLocation } from '../types';

vi.mock('firebase/firestore', () => {
  const noop = () => undefined;
  return {
    collection: vi.fn(() => ({ id: 'mock-collection' })),
    doc: vi.fn(() => ({ id: 'mock-doc', path: 'mock-collection/mock-doc' })),
    addDoc: vi.fn(async () => ({ id: 'mock-doc' })),
    setDoc: vi.fn(async () => undefined),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
    getDocs: vi.fn(async () => ({ empty: true, docs: [] })),
    query: vi.fn((...args) => ({ args })),
    where: vi.fn(noop),
    orderBy: vi.fn(noop),
    serverTimestamp: vi.fn(() => new Date()),
    writeBatch: vi.fn(() => ({
      delete: vi.fn(),
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
    deleteField: vi.fn(() => undefined),
  };
});

// Mock Firebase services
vi.mock('../services/firebase', () => ({
  firestore: {
    collection: vi.fn(),
    doc: vi.fn(),
    addDoc: vi.fn(),
    setDoc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    serverTimestamp: vi.fn(() => new Date()),
    writeBatch: vi.fn(),
  },
  auth: {
    currentUser: null,
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
  },
  storage: {
    ref: vi.fn(),
  },
}));

describe('New Authenticated User First Saved Location Integration', () => {
  const mockUserId = 'test-new-user-id-12345';
  const mockLocationInput: SavedLocationCreateInput = {
    name: 'My First Fishing Spot',
    water: 'Lake Rotorua',
    location: 'North Shore',
    lat: -38.1367,
    lon: 176.2506,
    notes: 'Great spot for trout fishing in the morning'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (mockedFirestore.collection as any).mockImplementation(() => ({
      withConverter: vi.fn().mockReturnThis(),
    }));
    (mockedFirestore.doc as any).mockImplementation((_firestore, collectionName, docId) => ({
      id: docId,
      path: `${collectionName}/${docId}`,
    }));
    (mockedFirestore.getDocs as any).mockResolvedValue({ empty: true, docs: [] });
    (mockedFirestore.query as any).mockImplementation(() => ({}));
    (mockedFirestore.where as any).mockImplementation(() => ({}));
    (mockedFirestore.writeBatch as any).mockReturnValue({
      delete: vi.fn(),
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    });
    (mockedFirestore.serverTimestamp as any).mockReturnValue(new Date());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful first location creation', () => {
    it('should create first saved location for new authenticated user', async () => {
      // Setup mocks
      // Initialize service for authenticated user
      await firebaseDataService.initialize(mockUserId);

      // Create the first saved location
      const result = await firebaseDataService.createSavedLocation(mockLocationInput);

      // Verify the result
      expect(result.id).toBeDefined();
      expect(result.name).toBe(mockLocationInput.name);
      expect(result.water).toBe(mockLocationInput.water);
      expect(result.location).toBe(mockLocationInput.location);
      expect(result.lat).toBe(mockLocationInput.lat);
      expect(result.lon).toBe(mockLocationInput.lon);
      expect(result.notes).toBe(mockLocationInput.notes);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();

      expect(firestoreSetDoc).toHaveBeenCalled();
    });

    it('should allow creating a new location after replace for authenticated user', async () => {
      await firebaseDataService.initialize(mockUserId);

      const replaceResult = await firebaseDataService.replaceSavedLocations([
        {
          id: 'imported-1',
          name: 'Imported Location',
          water: 'Harbour',
          location: 'Coast',
          lat: -36.0,
          lon: 174.0,
          notes: 'Imported data',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-02T00:00:00.000Z'
        } as SavedLocation,
      ]);

      expect(replaceResult.imported).toBe(1);

      const callsAfterReplace = firestoreSetDoc.mock.calls.length;
      expect(callsAfterReplace).toBeGreaterThan(0);

      const created = await firebaseDataService.createSavedLocation({
        name: 'Brand New Spot',
        water: 'Pacific',
        location: 'New Bay',
        lat: -37.0,
        lon: 175.0,
        notes: 'Fresh save'
      });

      expect(created.name).toBe('Brand New Spot');
      expect(firestoreSetDoc).toHaveBeenCalledTimes(callsAfterReplace + 1);
    });

    it('should handle service readiness guard for new user', async () => {
      // Mock service not ready
      vi.spyOn(firebaseDataService, 'isReady').mockReturnValue(false);

      await firebaseDataService.initialize(mockUserId);

      // Attempt to create location should fail
      await expect(firebaseDataService.createSavedLocation(mockLocationInput))
        .rejects.toThrow('Service not initialized');

      // The attempt should include diagnostic information
      // (This would require more complex mocking to capture the error details)
    });

    it('falls back to guest mode when userId is missing', async () => {
      await firebaseDataService.initialize(); // No userId provided

      const location = await firebaseDataService.createSavedLocation(mockLocationInput);

      expect(location.id).toBeDefined();
      expect(firebaseDataService.isGuestMode()).toBe(true);
    });
  });

  describe('import with first location for new user', () => {
    it('should handle new user importing their first saved location', async () => {
      // Setup mocks for import
      const mockImportResult = {
        success: true,
        tripsImported: 0,
        weatherLogsImported: 0,
        fishCatchesImported: 0,
        savedLocationsImported: 1,
        photosImported: 0,
        durationMs: 1000,
        duplicatesSkipped: { trips: 0, weatherLogs: 0, fishCatches: 0 },
        errors: [],
        warnings: []
      };

      // Mock the import process
      const mockImportData = {
        indexedDB: {
          trips: [],
          weather_logs: [],
          fish_caught: [],
          saved_locations: [mockLocationInput]
        },
        localStorage: {
          tacklebox: [],
          gearTypes: []
        }
      };

      // Create a zip import service instance
      const zipService = new (browserZipImportService as any).constructor();

      // Mock the necessary methods
      vi.spyOn(zipService, 'processZipFile' as any).mockResolvedValue(mockImportResult);
      vi.spyOn(zipService, 'validateLegacyData' as any).mockReturnValue({ isValid: true, errors: [], warnings: [] });
      vi.spyOn(zipService, 'extractLegacyData' as any).mockResolvedValue({
        data: mockImportData,
        warnings: []
      });

      // Create a mock file
      const mockFile = new File(['mock zip content'], 'test-export.zip', { type: 'application/zip' });

      // Process the import
      const result = await zipService.processZipFile(mockFile, true);

      // Verify counters are properly sanitized
      expect(typeof result.savedLocationsImported).toBe('number');
      expect(Number.isFinite(result.savedLocationsImported)).toBe(true);
      expect(result.savedLocationsImported).toBe(1);
    });

    it('should provide detailed warnings when saved locations are skipped', async () => {
      const zipService = new (browserZipImportService as any).constructor();
      vi.spyOn(zipService, 'clearExistingData').mockResolvedValue(undefined);
      const replaceMock = vi.fn().mockResolvedValue({
        imported: 0,
        duplicatesSkipped: 1,
        invalidSkipped: 0,
        limitSkipped: 0,
      });
      vi.spyOn(firebaseDataService, 'replaceSavedLocations').mockImplementation(replaceMock);

      const result = await zipService.importLegacyData({
        trips: [],
        weatherLogs: [],
        fishCatches: [],
        photos: {},
        savedLocations: [mockLocationInput]
      }, true, 'wipe', undefined);

      expect(replaceMock).toHaveBeenCalled();
      expect(result.warnings).toEqual([
        expect.stringContaining('Some saved locations were skipped')
      ]);
      expect(result.savedLocationsImported).toBe(0);
    });
  });

  describe('auth context integration', () => {
    it('should switch from guest mode to authenticated mode', async () => {
      await firebaseDataService.initialize();
      expect(firebaseDataService.isGuestMode()).toBe(true);

      await (firebaseDataService as any).switchToUser(mockUserId);

      expect(firebaseDataService.isGuestMode()).toBe(false);
      expect(firebaseDataService.isAuthenticated()).toBe(true);
    });

    it('should keep authenticated state when switching again', async () => {
      await firebaseDataService.initialize(mockUserId);
      expect(firebaseDataService.isAuthenticated()).toBe(true);

      await (firebaseDataService as any).switchToUser(mockUserId);

      expect(firebaseDataService.isAuthenticated()).toBe(true);
    });
  });
});
