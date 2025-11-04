import { useCallback, useEffect, useRef, useState } from 'react';
import { firebaseDataService } from '@shared/services/firebaseDataService';
import type {
  SavedLocation,
  SavedLocationCreateInput,
  SavedLocationUpdateInput,
} from '@shared/types';
import { MAX_SAVED_LOCATIONS } from '@shared/types';

interface UseSavedLocationsResult {
  savedLocations: SavedLocation[];
  savedLocationsLoading: boolean;
  savedLocationsError: string | null;
  createSavedLocation: (input: SavedLocationCreateInput) => Promise<SavedLocation>;
  updateSavedLocation: (id: string, updates: SavedLocationUpdateInput) => Promise<void>;
  deleteSavedLocation: (id: string) => Promise<void>;
  refreshSavedLocations: () => Promise<SavedLocation[]>;
  getSavedLocationById: (id: string) => Promise<SavedLocation | null>;
  savedLocationsLimit: number;
}

const DEFAULT_ERROR_MESSAGE = 'Failed to process saved locations request.';

const sortSavedLocationsList = (locations: SavedLocation[]): SavedLocation[] => {
  return [...locations].sort((a, b) => {
    const aTime = a.createdAt ?? '';
    const bTime = b.createdAt ?? '';
    if (aTime && bTime && aTime !== bTime) {
      return aTime.localeCompare(bTime);
    }
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
};

function resolveErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return fallback;
}

export function useSavedLocations(): UseSavedLocationsResult {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [savedLocationsLoading, setSavedLocationsLoading] = useState(false);
  const [savedLocationsError, setSavedLocationsError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const mutationInFlightRef = useRef(false);
  const savedLocationsRef = useRef<SavedLocation[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    savedLocationsRef.current = savedLocations;
  }, [savedLocations]);

  const loadSavedLocations = useCallback(async (): Promise<SavedLocation[]> => {
    if (!firebaseDataService.isReady() || !firebaseDataService.isAuthenticated()) {
      return savedLocationsRef.current;
    }

    if (mountedRef.current) {
      setSavedLocationsLoading(true);
      setSavedLocationsError(null);
    }

    try {
      const locations = await firebaseDataService.getSavedLocations();
      if (mountedRef.current) {
        setSavedLocations(locations);
      }
      return locations;
    } catch (error) {
      console.error('[useSavedLocations] Error loading locations:', error);
      const message = resolveErrorMessage(error, 'Failed to load saved locations.');
      if (mountedRef.current) {
        setSavedLocationsError(message);
      }
      return [];
    } finally {
      if (mountedRef.current) {
        setSavedLocationsLoading(false);
      }
    }
  }, []);

  const refreshSavedLocations = useCallback(async () => {
    return await loadSavedLocations();
  }, [loadSavedLocations]);

  useEffect(() => {
    const handleAuthReady = () => {
      void loadSavedLocations();
    };

    window.addEventListener('userDataReady', handleAuthReady);
    window.addEventListener('databaseDataReady', handleAuthReady);

    // Initial load attempt in case the service is already ready
    handleAuthReady();

    return () => {
      window.removeEventListener('userDataReady', handleAuthReady);
      window.removeEventListener('databaseDataReady', handleAuthReady);
    };
  }, [loadSavedLocations]);

  useEffect(() => {
    const handleExternalUpdate = () => {
      if (mutationInFlightRef.current) {
        return;
      }
      void loadSavedLocations();
    };

    const handleUserDataReady = () => {
      void loadSavedLocations();
    };

    const handleDatabaseDataReady = () => {
      void loadSavedLocations();
    };

    window.addEventListener('savedLocationsChanged', handleExternalUpdate as EventListener);
    window.addEventListener('userDataReady', handleUserDataReady);
    window.addEventListener('databaseDataReady', handleDatabaseDataReady);

    return () => {
      window.removeEventListener('savedLocationsChanged', handleExternalUpdate as EventListener);
      window.removeEventListener('userDataReady', handleUserDataReady);
      window.removeEventListener('databaseDataReady', handleDatabaseDataReady);
    };
  }, [loadSavedLocations]);

  const createSavedLocation = useCallback(async (input: SavedLocationCreateInput) => {
    mutationInFlightRef.current = true;
    try {
      const created = await firebaseDataService.createSavedLocation(input);
      
      const locations = await loadSavedLocations();

      const hasCreated = locations.some((location) => location.id === created.id);
      
      if (!hasCreated && mountedRef.current) {
        setSavedLocations((prev) => {
          const merged = prev.filter((location) => location.id !== created.id).concat(created);
          return sortSavedLocationsList(merged);
        });
      }

      return created;
    } catch (error) {
      console.error('[useSavedLocations] Error creating location:', error);
      const message = resolveErrorMessage(error);
      if (mountedRef.current) {
        setSavedLocationsError(message);
      }
      throw error instanceof Error ? error : new Error(message);
    } finally {
      mutationInFlightRef.current = false;
    }
  }, [loadSavedLocations]);

  const updateSavedLocation = useCallback(async (id: string, updates: SavedLocationUpdateInput) => {
    mutationInFlightRef.current = true;
    try {
      await firebaseDataService.updateSavedLocation(id, updates);
      await loadSavedLocations();
    } catch (error) {
      const message = resolveErrorMessage(error);
      if (mountedRef.current) {
        setSavedLocationsError(message);
      }
      throw error instanceof Error ? error : new Error(message);
    } finally {
      mutationInFlightRef.current = false;
    }
  }, [loadSavedLocations]);

  const deleteSavedLocation = useCallback(async (id: string) => {
    mutationInFlightRef.current = true;
    try {
      await firebaseDataService.deleteSavedLocation(id);
      await loadSavedLocations();
    } catch (error) {
      const message = resolveErrorMessage(error);
      if (mountedRef.current) {
        setSavedLocationsError(message);
      }
      throw error instanceof Error ? error : new Error(message);
    } finally {
      mutationInFlightRef.current = false;
    }
  }, [loadSavedLocations]);

  const getSavedLocationById = useCallback(async (id: string): Promise<SavedLocation | null> => {
    const existing = savedLocations.find((location) => location.id === id);
    if (existing) {
      return existing;
    }
    const refreshed = await refreshSavedLocations();
    return refreshed.find((location) => location.id === id) ?? null;
  }, [savedLocations, refreshSavedLocations]);

  return {
    savedLocations,
    savedLocationsLoading,
    savedLocationsError,
    createSavedLocation,
    updateSavedLocation,
    deleteSavedLocation,
    refreshSavedLocations,
    getSavedLocationById,
    savedLocationsLimit: MAX_SAVED_LOCATIONS,
  };
}
