import { vi } from 'vitest';
import { Trip, WeatherLog, FishCaught } from '../../types';

// Mock data stores
export const mockTripsStore: Trip[] = [
  {
    id: 1,
    date: '2024-01-15',
    water: 'Lake Taupo',
    location: 'Western Bay',
    hours: 4,
    companions: 'John Doe',
    notes: 'Great fishing day',
  },
  {
    id: 2,
    date: '2024-01-16',
    water: 'Lake Rotorua',
    location: 'Eastern Shore',
    hours: 3,
    companions: 'Jane Smith',
    notes: 'Windy conditions',
  },
];

export const mockWeatherStore: WeatherLog[] = [
  {
    id: 1,
    tripId: 1,
    timeOfDay: 'Morning',
    sky: 'Clear',
    windCondition: 'Light',
    windDirection: 'NE',
    waterTemp: '18°C',
    airTemp: '22°C',
  },
  {
    id: 2,
    tripId: 2,
    timeOfDay: 'Afternoon',
    sky: 'Cloudy',
    windCondition: 'Strong',
    windDirection: 'SW',
    waterTemp: '16°C',
    airTemp: '19°C',
  },
];

export const mockFishStore: FishCaught[] = [
  {
    id: 1,
    tripId: 1,
    species: 'Rainbow Trout',
    length: '45cm',
    weight: '2.5kg',
    time: '10:30',
    gear: ['Spinner', 'Light Rod'],
    details: 'Caught near the rocks',
  },
  {
    id: 2,
    tripId: 1,
    species: 'Brown Trout',
    length: '38cm',
    weight: '1.8kg',
    time: '14:15',
    gear: ['Fly', 'Fly Rod'],
    details: 'Beautiful fish',
  },
];

// Create a comprehensive IndexedDB mock
export const createIndexedDBMock = () => {
  const stores = {
    trips: [...mockTripsStore],
    weather_logs: [...mockWeatherStore],
    fish_caught: [...mockFishStore],
  };

  let nextId = {
    trips: 3,
    weather_logs: 3,
    fish_caught: 3,
  };

  const mockRequest = (result?: any, error?: any) => ({
    onsuccess: null as any,
    onerror: null as any,
    result,
    error,
  });

  const mockObjectStore = (storeName: keyof typeof stores) => ({
    add: vi.fn((data: any) => {
      const request = mockRequest();
      setTimeout(() => {
        const id = nextId[storeName]++;
        const item = { ...data, id };
        stores[storeName].push(item as any);
        request.result = id;
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),

    get: vi.fn((id: number) => {
      const request = mockRequest();
      setTimeout(() => {
        const item = stores[storeName].find((item: any) => item.id === id);
        request.result = item || undefined;
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),

    getAll: vi.fn(() => {
      const request = mockRequest();
      setTimeout(() => {
        request.result = [...stores[storeName]];
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),

    put: vi.fn((data: any) => {
      const request = mockRequest();
      setTimeout(() => {
        const index = stores[storeName].findIndex((item: any) => item.id === data.id);
        if (index !== -1) {
          stores[storeName][index] = data;
        }
        request.result = data.id;
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),

    delete: vi.fn((id: number) => {
      const request = mockRequest();
      setTimeout(() => {
        const index = stores[storeName].findIndex((item: any) => item.id === id);
        if (index !== -1) {
          stores[storeName].splice(index, 1);
        }
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),

    clear: vi.fn(() => {
      const request = mockRequest();
      setTimeout(() => {
        stores[storeName].length = 0;
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }),

    index: vi.fn((indexName: string) => ({
      getAll: vi.fn((value?: any) => {
        const request = mockRequest();
        setTimeout(() => {
          let results = [...stores[storeName]];
          
          if (value !== undefined) {
            if (indexName === 'date') {
              results = results.filter((item: any) => item.date === value);
            } else if (indexName === 'tripId') {
              results = results.filter((item: any) => item.tripId === value);
            }
          }
          
          request.result = results;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      }),
    })),

    createIndex: vi.fn(),
  });

  const mockTransaction = {
    objectStore: vi.fn((storeName: string) => mockObjectStore(storeName as keyof typeof stores)),
    oncomplete: null as any,
    onerror: null as any,
    error: null,
  };

  const mockDatabase = {
    transaction: vi.fn((storeNames: string | string[], mode?: string) => mockTransaction),
    close: vi.fn(),
    objectStoreNames: {
      contains: vi.fn((name: string) => ['trips', 'weather_logs', 'fish_caught'].includes(name)),
    },
    createObjectStore: vi.fn((name: string, options?: any) => mockObjectStore(name as keyof typeof stores)),
    deleteObjectStore: vi.fn(),
  };

  const mockOpenRequest = {
    onsuccess: null as any,
    onerror: null as any,
    onupgradeneeded: null as any,
    result: mockDatabase,
    error: null,
  };

  const mockIndexedDB = {
    open: vi.fn(() => mockOpenRequest),
    deleteDatabase: vi.fn(() => mockRequest()),
  };

  return {
    mockIndexedDB,
    mockDatabase,
    mockTransaction,
    mockObjectStore,
    mockOpenRequest,
    stores,
    nextId,
  };
};

// Helper to reset mock data
export const resetMockData = () => {
  mockTripsStore.length = 0;
  mockTripsStore.push(
    {
      id: 1,
      date: '2024-01-15',
      water: 'Lake Taupo',
      location: 'Western Bay',
      hours: 4,
      companions: 'John Doe',
      notes: 'Great fishing day',
    },
    {
      id: 2,
      date: '2024-01-16',
      water: 'Lake Rotorua',
      location: 'Eastern Shore',
      hours: 3,
      companions: 'Jane Smith',
      notes: 'Windy conditions',
    }
  );

  mockWeatherStore.length = 0;
  mockWeatherStore.push(
    {
      id: 1,
      tripId: 1,
      timeOfDay: 'Morning',
      sky: 'Clear',
      windCondition: 'Light',
      windDirection: 'NE',
      waterTemp: '18°C',
      airTemp: '22°C',
    },
    {
      id: 2,
      tripId: 2,
      timeOfDay: 'Afternoon',
      sky: 'Cloudy',
      windCondition: 'Strong',
      windDirection: 'SW',
      waterTemp: '16°C',
      airTemp: '19°C',
    }
  );

  mockFishStore.length = 0;
  mockFishStore.push(
    {
      id: 1,
      tripId: 1,
      species: 'Rainbow Trout',
      length: '45cm',
      weight: '2.5kg',
      time: '10:30',
      gear: ['Spinner', 'Light Rod'],
      details: 'Caught near the rocks',
    },
    {
      id: 2,
      tripId: 1,
      species: 'Brown Trout',
      length: '38cm',
      weight: '1.8kg',
      time: '14:15',
      gear: ['Fly', 'Fly Rod'],
      details: 'Beautiful fish',
    }
  );
};