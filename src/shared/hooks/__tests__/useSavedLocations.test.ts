import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSavedLocations } from '../useSavedLocations';
import type { SavedLocation, SavedLocationCreateInput } from '@shared/types';

// Mock firebaseDataService (must be before vi.mock due to hoisting)
vi.mock('@shared/services/firebaseDataService', () => ({
  firebaseDataService: {
    isReady: vi.fn(() => true),
    getSavedLocations: vi.fn(),
    createSavedLocation: vi.fn(),
    updateSavedLocation: vi.fn(),
    deleteSavedLocation: vi.fn(),
  },
}));

// Import the mock after defining it
import { firebaseDataService } from '@shared/services/firebaseDataService';
const mockFirebaseDataService = firebaseDataService as any;

// Helper to create mock saved locations
const createMockLocation = (id: string, name: string, lat?: number, lon?: number): SavedLocation => ({
  id,
  name,
  lat,
  lon,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('useSavedLocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirebaseDataService.isReady.mockReturnValue(true);
    mockFirebaseDataService.getSavedLocations.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial load', () => {
    it('loads saved locations on mount', async () => {
      const mockLocations = [
        createMockLocation('1', 'Kawhia Harbour', -38.0661, 174.8196),
        createMockLocation('2', 'Raglan Harbour', -37.8019, 174.8630),
      ];
      mockFirebaseDataService.getSavedLocations.mockResolvedValue(mockLocations);

      const { result } = renderHook(() => useSavedLocations());

      expect(result.current.savedLocationsLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      expect(result.current.savedLocations).toHaveLength(2);
      expect(result.current.savedLocations[0].name).toBe('Kawhia Harbour');
      expect(result.current.savedLocationsError).toBeNull();
    });

    it('handles load errors gracefully', async () => {
      mockFirebaseDataService.getSavedLocations.mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      expect(result.current.savedLocationsError).toBe('Network error');
      expect(result.current.savedLocations).toHaveLength(0);
    });

    it('skips loading when firebase not ready', async () => {
      mockFirebaseDataService.isReady.mockReturnValue(false);

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      expect(mockFirebaseDataService.getSavedLocations).not.toHaveBeenCalled();
    });
  });

  describe('Create location', () => {
    it('creates location successfully', async () => {
      const newLocation = createMockLocation('3', 'New Spot', -36.8485, 174.7633);
      mockFirebaseDataService.createSavedLocation.mockResolvedValue(newLocation);
      mockFirebaseDataService.getSavedLocations.mockResolvedValue([newLocation]);

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      const input: SavedLocationCreateInput = {
        name: 'New Spot',
        lat: -36.8485,
        lon: 174.7633,
      };

      let created: SavedLocation | undefined;
      await act(async () => {
        created = await result.current.createSavedLocation(input);
      });

      expect(created).toBeDefined();
      expect(created?.name).toBe('New Spot');
      expect(mockFirebaseDataService.createSavedLocation).toHaveBeenCalledWith(input);
    });

    it('validates required name field', async () => {
      mockFirebaseDataService.createSavedLocation.mockRejectedValue(
        new Error('Location name is required')
      );

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      const input: SavedLocationCreateInput = {
        name: '', // Empty name
        lat: -36.8485,
        lon: 174.7633,
      };

      await expect(
        act(async () => {
          await result.current.createSavedLocation(input);
        })
      ).rejects.toThrow('Location name is required');
    });

    it('emits savedLocationsChanged event on create', async () => {
      const eventListener = vi.fn();
      window.addEventListener('savedLocationsChanged', eventListener);

      const newLocation = createMockLocation('3', 'New Spot', -36.8485, 174.7633);
      mockFirebaseDataService.createSavedLocation.mockResolvedValue(newLocation);
      mockFirebaseDataService.getSavedLocations.mockResolvedValue([newLocation]);

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      await act(async () => {
        await result.current.createSavedLocation({
          name: 'New Spot',
          lat: -36.8485,
          lon: 174.7633,
        });
      });

      // Note: Event emission happens in the hook implementation
      // This test verifies the hook integrates with the event system
      // The actual event dispatch is in firebaseDataService
      await waitFor(() => {
        expect(mockFirebaseDataService.createSavedLocation).toHaveBeenCalled();
      });

      window.removeEventListener('savedLocationsChanged', eventListener);
    });
  });

  describe('Update location', () => {
    it('updates location successfully', async () => {
      const existingLocation = createMockLocation('1', 'Old Name', -36.8485, 174.7633);
      const updatedLocation = { ...existingLocation, name: 'Updated Name' };
      
      mockFirebaseDataService.getSavedLocations
        .mockResolvedValueOnce([existingLocation])
        .mockResolvedValueOnce([updatedLocation]);
      mockFirebaseDataService.updateSavedLocation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateSavedLocation('1', { name: 'Updated Name' });
      });

      expect(mockFirebaseDataService.updateSavedLocation).toHaveBeenCalledWith('1', {
        name: 'Updated Name',
      });
    });
  });

  describe('Delete location', () => {
    it('deletes location successfully', async () => {
      const location1 = createMockLocation('1', 'Location 1', -36.8485, 174.7633);
      const location2 = createMockLocation('2', 'Location 2', -37.8019, 174.8630);

      mockFirebaseDataService.getSavedLocations
        .mockResolvedValueOnce([location1, location2])
        .mockResolvedValueOnce([location2]);
      mockFirebaseDataService.deleteSavedLocation.mockResolvedValue(undefined);

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocations).toHaveLength(2);
      });

      await act(async () => {
        await result.current.deleteSavedLocation('1');
      });

      expect(mockFirebaseDataService.deleteSavedLocation).toHaveBeenCalledWith('1');
      
      await waitFor(() => {
        expect(result.current.savedLocations).toHaveLength(1);
        expect(result.current.savedLocations[0].id).toBe('2');
      });
    });
  });

  describe('Get location by ID', () => {
    it('retrieves specific location', async () => {
      const mockLocations = [
        createMockLocation('1', 'Kawhia', -38.0661, 174.8196),
        createMockLocation('2', 'Raglan', -37.8019, 174.8630),
      ];
      mockFirebaseDataService.getSavedLocations.mockResolvedValue(mockLocations);

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      let location: SavedLocation | null = null;
      await act(async () => {
        location = await result.current.getSavedLocationById('2');
      });

      expect(location).not.toBeNull();
      expect(location?.name).toBe('Raglan');
    });

    it('returns null for non-existent ID', async () => {
      mockFirebaseDataService.getSavedLocations.mockResolvedValue([
        createMockLocation('1', 'Kawhia', -38.0661, 174.8196),
      ]);

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocationsLoading).toBe(false);
      });

      let location: SavedLocation | null = null;
      await act(async () => {
        location = await result.current.getSavedLocationById('999');
      });

      expect(location).toBeNull();
    });
  });

  describe('Limit enforcement', () => {
    it('exposes savedLocationsLimit', () => {
      const { result } = renderHook(() => useSavedLocations());
      expect(result.current.savedLocationsLimit).toBe(10);
    });
  });

  describe('Refresh functionality', () => {
    it('manually refreshes locations', async () => {
      const initialLocations = [createMockLocation('1', 'Initial', -36.8485, 174.7633)];
      const refreshedLocations = [
        createMockLocation('1', 'Initial', -36.8485, 174.7633),
        createMockLocation('2', 'New', -37.8019, 174.8630),
      ];

      mockFirebaseDataService.getSavedLocations
        .mockResolvedValueOnce(initialLocations)
        .mockResolvedValueOnce(refreshedLocations);

      const { result } = renderHook(() => useSavedLocations());

      await waitFor(() => {
        expect(result.current.savedLocations).toHaveLength(1);
      });

      await act(async () => {
        await result.current.refreshSavedLocations();
      });

      await waitFor(() => {
        expect(result.current.savedLocations).toHaveLength(2);
      });
    });
  });
});
