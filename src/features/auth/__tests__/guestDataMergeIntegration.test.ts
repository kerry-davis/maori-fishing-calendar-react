import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FirebaseDataService } from '@shared/services/firebaseDataService';
import type { Trip, WeatherLog, FishCaught } from '@shared/types';
import { resetGuestSessionState, getGuestSessionRecord, getOrCreateGuestSessionId } from '@shared/services/guestSessionService';

const tripsStore: Trip[] = [];
const weatherStore: WeatherLog[] = [];
const fishStore: FishCaught[] = [];
const batchSetCalls: any[] = [];
const batchUpdateCalls: any[] = [];

const createLocalStorageMock = () => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  } as unknown as Storage;
};

vi.mock('../services/databaseService', () => ({
  databaseService: {
    createTrip: vi.fn(async (tripData: Omit<Trip, 'id'>) => {
      const newTrip: Trip = {
        id: tripsStore.length + 1,
        companions: tripData.companions,
        date: tripData.date,
        hours: tripData.hours,
        location: tripData.location,
        notes: tripData.notes,
        water: tripData.water,
        guestSessionId: tripData.guestSessionId,
      };
      tripsStore.push(newTrip);
      return newTrip.id;
    }),
    createWeatherLog: vi.fn(async (weatherData: Omit<WeatherLog, 'id'>) => {
      const id = `${weatherData.tripId}-${Date.now()}`;
      const log: WeatherLog = { ...weatherData, id };
      weatherStore.push(log);
      return id;
    }),
    createFishCaught: vi.fn(async (fishData: Omit<FishCaught, 'id'>) => {
      const id = `${fishData.tripId}-${Date.now()}`;
      const fish: FishCaught = { ...fishData, id };
      fishStore.push(fish);
      return id;
    }),
    getAllTrips: vi.fn(async () => tripsStore.map((trip) => ({ ...trip }))),
    getAllWeatherLogs: vi.fn(async () => weatherStore.map((log) => ({ ...log }))),
    getAllFishCaught: vi.fn(async () => fishStore.map((fish) => ({ ...fish }))),
    deleteWeatherLog: vi.fn(async (id: string) => {
      const index = weatherStore.findIndex((log) => log.id === id);
      if (index >= 0) weatherStore.splice(index, 1);
    }),
    deleteFishCaught: vi.fn(async (id: string) => {
      const index = fishStore.findIndex((fish) => fish.id === id);
      if (index >= 0) fishStore.splice(index, 1);
    }),
    clearAllData: vi.fn(async () => {
      tripsStore.length = 0;
      weatherStore.length = 0;
      fishStore.length = 0;
    }),
    updateTrip: vi.fn(async (trip: Trip) => {
      const idx = tripsStore.findIndex((t) => t.id === trip.id);
      if (idx >= 0) tripsStore[idx] = { ...trip };
    }),
    updateWeatherLog: vi.fn(async (weather: WeatherLog) => {
      const idx = weatherStore.findIndex((w) => w.id === weather.id);
      if (idx >= 0) weatherStore[idx] = { ...weather };
    }),
    updateFishCaught: vi.fn(async (fish: FishCaught) => {
      const idx = fishStore.findIndex((f) => f.id === fish.id);
      if (idx >= 0) fishStore[idx] = { ...fish };
    }),
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn((_, id?: string) => ({ id: id ?? `doc-${Date.now()}`, path: `path/${id ?? Date.now()}` })),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ empty: true, docs: [], forEach: () => {} })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
  writeBatch: vi.fn(() => ({
    set: (ref: any, data: any) => {
      batchSetCalls.push({ ref, data });
    },
    update: (ref: any, data: any) => {
      batchUpdateCalls.push({ ref, data });
    },
    delete: vi.fn(),
    commit: vi.fn(async () => undefined),
  })),
  getFirestore: vi.fn(() => ({})),
}));

describe('Guest data merge integration', () => {
  let service: FirebaseDataService;

  beforeEach(() => {
    tripsStore.length = 0;
    weatherStore.length = 0;
    fishStore.length = 0;
    batchSetCalls.length = 0;
    batchUpdateCalls.length = 0;
    vi.clearAllMocks();

    Object.defineProperty(window, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
    resetGuestSessionState();

    service = new FirebaseDataService();
  });

  it('merges guest session data on user login with session tracking', async () => {
    await service.initialize(); // guest mode
    const sessionId = getOrCreateGuestSessionId();

    const tripId = 1;
    tripsStore.push({
      id: tripId,
      date: '2024-05-01',
      water: 'Harbour',
      location: 'Pier',
      hours: 3,
      companions: 'Sam',
      notes: 'Great day',
      guestSessionId: sessionId,
    } as Trip);

    const weatherId = `${tripId}-weather-1`;
    weatherStore.push({
      id: weatherId,
      tripId,
      timeOfDay: 'AM',
      sky: 'Clear',
      windCondition: 'Calm',
      windDirection: 'NE',
      waterTemp: '18',
      airTemp: '20',
      guestSessionId: sessionId,
    } as WeatherLog);

    const fishId = `${tripId}-fish-1`;
    fishStore.push({
      id: fishId,
      tripId,
      species: 'Snapper',
      length: '35cm',
      weight: '1.2kg',
      time: '09:15',
      gear: ['rod'],
      details: 'Released',
      guestSessionId: sessionId,
    } as FishCaught);

    await service.initialize('merge-user-id');

    const summary = await service.mergeLocalDataForUser();

    expect(summary.mergedTrips).toBe(1);
    expect(summary.mergedWeatherLogs).toBe(1);
    expect(summary.mergedFishCaught).toBe(1);
    expect(summary.mergedSessions.length).toBe(1);

    const recordedSession = summary.mergedSessions[0];
    const record = getGuestSessionRecord(recordedSession);
    expect(record).not.toBeNull();
    expect(record?.mergedUsers['merge-user-id']).toBeDefined();

    expect(batchSetCalls.some(call => call.data.guestSessionId === recordedSession)).toBe(true);
  });
});
