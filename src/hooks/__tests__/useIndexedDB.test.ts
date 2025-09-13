import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { useIndexedDB } from "../useIndexedDB";
import { databaseService } from "../../services/databaseService";
import type { Trip, WeatherLog, FishCaught, DatabaseError } from "../../types";

// Mock the database service
vi.mock("../../services/databaseService", () => ({
  databaseService: {
    initialize: vi.fn(),
    createTrip: vi.fn(),
    getTripById: vi.fn(),
    getTripsByDate: vi.fn(),
    getAllTrips: vi.fn(),
    updateTrip: vi.fn(),
    deleteTrip: vi.fn(),
    hasTripsOnDate: vi.fn(),
    getDatesWithTrips: vi.fn(),
    createWeatherLog: vi.fn(),
    getWeatherLogById: vi.fn(),
    getWeatherLogsByTripId: vi.fn(),
    getAllWeatherLogs: vi.fn(),
    updateWeatherLog: vi.fn(),
    deleteWeatherLog: vi.fn(),
    createFishCaught: vi.fn(),
    getFishCaughtById: vi.fn(),
    getFishCaughtByTripId: vi.fn(),
    getAllFishCaught: vi.fn(),
    updateFishCaught: vi.fn(),
    deleteFishCaught: vi.fn(),
    getFishCountForTrip: vi.fn(),
    clearAllData: vi.fn(),
  },
}));

describe("useIndexedDB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize database on mount", async () => {
      (databaseService.initialize as Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useIndexedDB());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isReady).toBe(false);
      expect(result.current.error).toBe(null);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(databaseService.initialize).toHaveBeenCalledOnce();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isReady).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it("should handle initialization errors", async () => {
      const mockError: DatabaseError = {
        type: "connection",
        message: "Failed to initialize database",
        recoverable: false,
      };
      (databaseService.initialize as Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isReady).toBe(false);
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("trip operations", () => {
    beforeEach(() => {
      (databaseService.initialize as Mock).mockResolvedValue(undefined);
    });

    it("should create a trip successfully", async () => {
      const mockTripData: Omit<Trip, "id"> = {
        date: "2024-01-15",
        water: "Lake Taupo",
        location: "Taupo",
        hours: 4,
        companions: "John",
        notes: "Great day fishing",
      };
      const mockTripId = 1;
      (databaseService.createTrip as Mock).mockResolvedValue(mockTripId);

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let createdId: number;
      await act(async () => {
        createdId = await result.current.trips.create(mockTripData);
      });

      expect(databaseService.createTrip).toHaveBeenCalledWith(mockTripData);
      expect(createdId!).toBe(mockTripId);
      expect(result.current.error).toBe(null);
    });

    it("should handle trip creation errors", async () => {
      const mockTripData: Omit<Trip, "id"> = {
        date: "2024-01-15",
        water: "Lake Taupo",
        location: "Taupo",
        hours: 4,
        companions: "John",
        notes: "Great day fishing",
      };
      const mockError: DatabaseError = {
        type: "transaction",
        message: "Failed to create trip",
        recoverable: true,
      };
      (databaseService.createTrip as Mock).mockRejectedValue(mockError);

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        try {
          await result.current.trips.create(mockTripData);
        } catch (error) {
          expect(error).toEqual(mockError);
        }
      });

      expect(result.current.error).toEqual(mockError);
    });

    it("should get trip by ID", async () => {
      const mockTrip: Trip = {
        id: 1,
        date: "2024-01-15",
        water: "Lake Taupo",
        location: "Taupo",
        hours: 4,
        companions: "John",
        notes: "Great day fishing",
      };
      (databaseService.getTripById as Mock).mockResolvedValue(mockTrip);

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let trip: Trip | null;
      await act(async () => {
        trip = await result.current.trips.getById(1);
      });

      expect(databaseService.getTripById).toHaveBeenCalledWith(1);
      expect(trip!).toEqual(mockTrip);
    });

    it("should get trips by date", async () => {
      const mockTrips: Trip[] = [
        {
          id: 1,
          date: "2024-01-15",
          water: "Lake Taupo",
          location: "Taupo",
          hours: 4,
          companions: "John",
          notes: "Great day fishing",
        },
      ];
      (databaseService.getTripsByDate as Mock).mockResolvedValue(mockTrips);

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let trips: Trip[];
      await act(async () => {
        trips = await result.current.trips.getByDate("2024-01-15");
      });

      expect(databaseService.getTripsByDate).toHaveBeenCalledWith("2024-01-15");
      expect(trips!).toEqual(mockTrips);
    });
  });

  describe("weather operations", () => {
    beforeEach(() => {
      (databaseService.initialize as Mock).mockResolvedValue(undefined);
    });

    it("should create a weather log successfully", async () => {
      const mockWeatherData: Omit<WeatherLog, "id"> = {
        tripId: 1,
        timeOfDay: "Morning",
        sky: "Clear",
        windCondition: "Light",
        windDirection: "NE",
        waterTemp: "18°C",
        airTemp: "22°C",
      };
      const mockWeatherId = 1;
      (databaseService.createWeatherLog as Mock).mockResolvedValue(
        mockWeatherId,
      );

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let createdId: number;
      await act(async () => {
        createdId = await result.current.weather.create(mockWeatherData);
      });

      expect(databaseService.createWeatherLog).toHaveBeenCalledWith(
        mockWeatherData,
      );
      expect(createdId!).toBe(mockWeatherId);
    });

    it("should get weather logs by trip ID", async () => {
      const mockWeatherLogs: WeatherLog[] = [
        {
          id: 1,
          tripId: 1,
          timeOfDay: "Morning",
          sky: "Clear",
          windCondition: "Light",
          windDirection: "NE",
          waterTemp: "18°C",
          airTemp: "22°C",
        },
      ];
      (databaseService.getWeatherLogsByTripId as Mock).mockResolvedValue(
        mockWeatherLogs,
      );

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let weatherLogs: WeatherLog[];
      await act(async () => {
        weatherLogs = await result.current.weather.getByTripId(1);
      });

      expect(databaseService.getWeatherLogsByTripId).toHaveBeenCalledWith(1);
      expect(weatherLogs!).toEqual(mockWeatherLogs);
    });
  });

  describe("fish operations", () => {
    beforeEach(() => {
      (databaseService.initialize as Mock).mockResolvedValue(undefined);
    });

    it("should create a fish caught record successfully", async () => {
      const mockFishData: Omit<FishCaught, "id"> = {
        tripId: 1,
        species: "Trout",
        length: "35cm",
        weight: "1.2kg",
        time: "10:30",
        gear: ["Rod", "Reel"],
        details: "Nice catch",
      };
      const mockFishId = 1;
      (databaseService.createFishCaught as Mock).mockResolvedValue(mockFishId);

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let createdId: number;
      await act(async () => {
        createdId = await result.current.fish.create(mockFishData);
      });

      expect(databaseService.createFishCaught).toHaveBeenCalledWith(
        mockFishData,
      );
      expect(createdId!).toBe(mockFishId);
    });

    it("should get fish count for trip", async () => {
      const mockCount = 3;
      (databaseService.getFishCountForTrip as Mock).mockResolvedValue(
        mockCount,
      );

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      let count: number;
      await act(async () => {
        count = await result.current.fish.getCountForTrip(1);
      });

      expect(databaseService.getFishCountForTrip).toHaveBeenCalledWith(1);
      expect(count!).toBe(mockCount);
    });
  });

  describe("utility operations", () => {
    beforeEach(() => {
      (databaseService.initialize as Mock).mockResolvedValue(undefined);
    });

    it("should clear all data", async () => {
      (databaseService.clearAllData as Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.clearAllData();
      });

      expect(databaseService.clearAllData).toHaveBeenCalledOnce();
    });

    it("should handle loading states correctly", async () => {
      (databaseService.getAllTrips as Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );

      const { result } = renderHook(() => useIndexedDB());

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Start an operation that takes time
      act(() => {
        result.current.trips.getAll();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
