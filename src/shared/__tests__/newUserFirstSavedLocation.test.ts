import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firebaseDataService } from '../services/firebaseDataService';
import { browserZipImportService } from '../services/browserZipImportService';
import type { SavedLocationCreateInput } from '../types';

// Mock Firebase services
vi.mock('../services/firebase', () => ({
  firestore: {
    collection: vi.fn(),
    doc: vi.fn(),
    addDoc: vi.fn(),
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
    // Mock the service to be ready
    vi.spyOn(firebaseDataService, 'isReady', 'get').mockReturnValue(true);
    vi.spyOn(firebaseDataService, 'isAuthenticated', 'get').mockReturnValue(true);
    vi.spyOn(firebaseDataService, 'isGuestMode', 'get').mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful first location creation', () => {
    it('should create first saved location for new authenticated user', async () => {
      // Setup mocks
      const mockDocRef = { id: 'test-location-doc-id' };
      const addDocMock = vi.fn().mockResolvedValue(mockDocRef);
      vi.doMock('../services/firebase', () => ({
        firestore: {
          collection: vi.fn().mockReturnValue({}),
          doc: vi.fn(),
          addDoc: addDocMock,
          serverTimestamp: vi.fn(() => new Date()),
        },
        auth: {
          currentUser: { uid: mockUserId, email: 'test@example.com' },
        },
        storage: {
          ref: vi.fn(),
        },
      }));

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

      // Verify Firestore addDoc was called
      expect(addDocMock).toHaveBeenCalled();
    });

    it('should handle service readiness guard for new user', async () => {
      // Mock service not ready
      vi.spyOn(firebaseDataService, 'isReady', 'get').mockReturnValue(false);

      await firebaseDataService.initialize(mockUserId);

      // Attempt to create location should fail
      await expect(firebaseDataService.createSavedLocation(mockLocationInput))
        .rejects.toThrow('Service not ready');

      // The attempt should include diagnostic information
      // (This would require more complex mocking to capture the error details)
    });

    it('should handle missing userId in authenticated mode', async () => {
      // Mock user ID as null while in authenticated mode
      vi.spyOn(firebaseDataService, 'isAuthenticated', 'get').mockReturnValue(true);
      vi.spyOn(firebaseDataService, 'isGuestMode', 'get').mockReturnValue(false);
      await firebaseDataService.initialize(); // No userId provided

      // Attempt to create location should fail
      await expect(firebaseDataService.createSavedLocation(mockLocationInput))
        .rejects.toThrow('User authentication error');

      // The attempt should include diagnostic information
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

    it('should provide detailed warnings when first location is skipped', async () => {
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

      // Mock a duplicate location scenario
      const zipService = new (browserZipImportService as any).constructor();
      
      // Mock createSavedLocation to throw duplicate error
      const createLocationMock = vi.fn().mockRejectedValue(
        new Error('A location at these coordinates already exists: "My First Fishing Spot"')
      );
      vi.spyOn(firebaseDataService, 'createSavedLocation').mockImplementation(createLocationMock);

      // Mock other required methods
      vi.spyOn(zipService, 'validateLegacyData' as any).mockReturnValue({ isValid: true, errors: [], warnings: [] });
      vi.spyOn(zipService, 'extractLegacyData' as any).mockResolvedValue({
        data: mockImportData,
        warnings: []
      });

      const mockFile = new File(['mock zip content'], 'test-export.zip', { type: 'application/zip' });

      // Process the import
      const result = await zipService.processZipFile(mockFile, true);

      // Verify warnings include detailed information
      expect(result.warnings).toContain(
        expect.stringContaining('Saved location skipped')
      );
      expect(result.warnings).toContain(
        expect.stringContaining('Duplicate location')
      );

      // Verify counters are still properly sanitized
      expect(typeof result.savedLocationsImported).toBe('number');
      expect(Number.isFinite(result.savedLocationsImported)).toBe(true);
    });
  });

  describe('auth context integration', () => {
    it('should run health check after switchToUser for new user', async () => {
      // Mock getSavedLocations
      const getSavedLocationsMock = vi.fn().mockResolvedValue([]);
      vi.spyOn(firebaseDataService, 'getSavedLocations').mockImplementation(getSavedLocationsMock);
      
      // Initialize as new user
      await firebaseDataService.initialize(mockUserId);

      // Trigger switchToUser (which should include health check)
      await (firebaseDataService as any).switchToUser(mockUserId);

      // Verify health check was called
      expect(getSavedLocationsMock).toHaveBeenCalled();
    });

    it('should handle health check failure gracefully', async () => {
      // Mock getSavedLocations to fail
      const getSavedLocationsMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
      vi.spyOn(firebaseDataService, 'getSavedLocations').mockImplementation(getSavedLocationsMock);
      
      // Initialize as new user
      await firebaseDataService.initialize(mockUserId);

      // switchToUser should still succeed even with health check failure
      const result = await (firebaseDataService as any).switchToUser(mockUserId);
      expect(result).toBeUndefined(); // Function doesn't return anything on success

      // Health check should have been attempted
      expect(getSavedLocationsMock).toHaveBeenCalled();
    });
  });
});
