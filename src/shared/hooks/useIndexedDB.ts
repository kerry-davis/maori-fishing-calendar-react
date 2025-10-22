import { useState, useEffect, useCallback } from "react";
import { databaseService } from "@shared/services/databaseService";
import type { Trip, WeatherLog, FishCaught, DatabaseError } from "../types";

// Hook state interface
interface UseIndexedDBState {
  isLoading: boolean;
  error: DatabaseError | null;
  isReady: boolean;
}

// Hook return type
interface UseIndexedDBReturn extends UseIndexedDBState {
  // Trip operations
  trips: {
    create: (tripData: Omit<Trip, "id">) => Promise<number>;
    getById: (id: number) => Promise<Trip | null>;
    getByDate: (date: string) => Promise<Trip[]>;
    getAll: () => Promise<Trip[]>;
    update: (trip: Trip) => Promise<void>;
    delete: (id: number) => Promise<void>;
    hasTripsOnDate: (date: string) => Promise<boolean>;
    getDatesWithTrips: () => Promise<string[]>;
  };

  // Weather log operations
  weather: {
    create: (weatherData: Omit<WeatherLog, "id">) => Promise<string>;
    getById: (id: string) => Promise<WeatherLog | null>;
    getByTripId: (tripId: number) => Promise<WeatherLog[]>;
    getAll: () => Promise<WeatherLog[]>;
    update: (weatherLog: WeatherLog) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };

  // Fish caught operations
  fish: {
    create: (fishData: Omit<FishCaught, "id">) => Promise<string>;
    getById: (id: string) => Promise<FishCaught | null>;
    getByTripId: (tripId: number) => Promise<FishCaught[]>;
    getAll: () => Promise<FishCaught[]>;
    update: (fishCaught: FishCaught) => Promise<void>;
    delete: (id: string) => Promise<void>;
    getCountForTrip: (tripId: number) => Promise<number>;
  };

  // Utility operations
  clearAllData: () => Promise<void>;
  initialize: () => Promise<void>;
}

/**
 * Custom hook for IndexedDB operations with proper error handling and loading states
 * Provides typed methods for each data store (trips, weather, fish)
 */
export const useIndexedDB = (): UseIndexedDBReturn => {
  const [state, setState] = useState<UseIndexedDBState>({
    isLoading: false,
    error: null,
    isReady: false,
  });

  // Initialize database on hook mount
  useEffect(() => {
    const initializeDatabase = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await databaseService.initialize();
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isReady: true,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isReady: false,
          error: error as DatabaseError,
        }));
      }
    };

    initializeDatabase();
  }, []);

  // Generic operation wrapper with error handling and loading states
  const withErrorHandling = useCallback(
    async <T>(operation: () => Promise<T>, setLoading = true): Promise<T> => {
      if (setLoading) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        const result = await operation();
        if (setLoading) {
          setState((prev) => ({ ...prev, isLoading: false, error: null }));
        }
        return result;
      } catch (error) {
        const dbError = error as DatabaseError;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: dbError,
        }));
        throw dbError;
      }
    },
    [],
  );

  // Trip operations
  const trips = {
    create: useCallback(
      (tripData: Omit<Trip, "id">) =>
        withErrorHandling(() => databaseService.createTrip(tripData)),
      [withErrorHandling],
    ),

    getById: useCallback(
      (id: number) => withErrorHandling(() => databaseService.getTripById(id)),
      [withErrorHandling],
    ),

    getByDate: useCallback(
      (date: string) =>
        withErrorHandling(() => databaseService.getTripsByDate(date)),
      [withErrorHandling],
    ),

    getAll: useCallback(
      () => withErrorHandling(() => databaseService.getAllTrips()),
      [withErrorHandling],
    ),

    update: useCallback(
      (trip: Trip) => withErrorHandling(() => databaseService.updateTrip(trip)),
      [withErrorHandling],
    ),

    delete: useCallback(
      (id: number) => withErrorHandling(() => databaseService.deleteTrip(id)),
      [withErrorHandling],
    ),

    hasTripsOnDate: useCallback(
      (date: string) =>
        withErrorHandling(() => databaseService.hasTripsOnDate(date), false),
      [withErrorHandling],
    ),

    getDatesWithTrips: useCallback(
      () => withErrorHandling(() => databaseService.getDatesWithTrips()),
      [withErrorHandling],
    ),
  };

  // Weather log operations
  const weather = {
    create: useCallback(
      (weatherData: Omit<WeatherLog, "id">) =>
        withErrorHandling(() => databaseService.createWeatherLog(weatherData)),
      [withErrorHandling],
    ),

    getById: useCallback(
      (id: string) =>
        withErrorHandling(() => databaseService.getWeatherLogById(id)),
      [withErrorHandling],
    ),

    getByTripId: useCallback(
      (tripId: number) =>
        withErrorHandling(() => databaseService.getWeatherLogsByTripId(tripId)),
      [withErrorHandling],
    ),

    getAll: useCallback(
      () => withErrorHandling(() => databaseService.getAllWeatherLogs()),
      [withErrorHandling],
    ),

    update: useCallback(
      (weatherLog: WeatherLog) =>
        withErrorHandling(() => databaseService.updateWeatherLog(weatherLog)),
      [withErrorHandling],
    ),

    delete: useCallback(
      (id: string) =>
        withErrorHandling(() => databaseService.deleteWeatherLog(id)),
      [withErrorHandling],
    ),
  };

  // Fish caught operations
  const fish = {
    create: useCallback(
      (fishData: Omit<FishCaught, "id">) =>
        withErrorHandling(() => databaseService.createFishCaught(fishData)),
      [withErrorHandling],
    ),

    getById: useCallback(
      (id: string) =>
        withErrorHandling(() => databaseService.getFishCaughtById(id)),
      [withErrorHandling],
    ),

    getByTripId: useCallback(
      (tripId: number) =>
        withErrorHandling(() => databaseService.getFishCaughtByTripId(tripId)),
      [withErrorHandling],
    ),

    getAll: useCallback(
      () => withErrorHandling(() => databaseService.getAllFishCaught()),
      [withErrorHandling],
    ),

    update: useCallback(
      (fishCaught: FishCaught) =>
        withErrorHandling(() => databaseService.updateFishCaught(fishCaught)),
      [withErrorHandling],
    ),

    delete: useCallback(
      (id: string) =>
        withErrorHandling(() => databaseService.deleteFishCaught(id)),
      [withErrorHandling],
    ),

    getCountForTrip: useCallback(
      (tripId: number) =>
        withErrorHandling(
          () => databaseService.getFishCountForTrip(tripId),
          false,
        ),
      [withErrorHandling],
    ),
  };

  // Utility operations
  const clearAllData = useCallback(
    () => withErrorHandling(() => databaseService.clearAllData()),
    [withErrorHandling],
  );

  const initialize = useCallback(
    () => withErrorHandling(() => databaseService.initialize()),
    [withErrorHandling],
  );

  return {
    ...state,
    trips,
    weather,
    fish,
    clearAllData,
    initialize,
  };
};
