import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LocationProvider } from '../contexts/LocationContext';
import { DatabaseProvider } from '../contexts/DatabaseContext';
import { PWAProvider } from '../contexts/PWAContext';

// Mock providers for testing
const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

const MockLocationProvider = ({ children }: { children: React.ReactNode }) => (
  <LocationProvider>{children}</LocationProvider>
);

const MockDatabaseProvider = ({ children }: { children: React.ReactNode }) => (
  <DatabaseProvider>{children}</DatabaseProvider>
);

const MockPWAProvider = ({ children }: { children: React.ReactNode }) => (
  <PWAProvider>{children}</PWAProvider>
);

// All providers wrapper
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <MockThemeProvider>
      <MockLocationProvider>
        <MockDatabaseProvider>
          <MockPWAProvider>
            {children}
          </MockPWAProvider>
        </MockDatabaseProvider>
      </MockLocationProvider>
    </MockThemeProvider>
  );
};

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Test data factories
export const createMockTrip = (overrides = {}) => ({
  id: 1,
  date: '2024-01-15',
  water: 'Lake Taupo',
  location: 'Western Bay',
  hours: 4,
  companions: 'John Doe',
  notes: 'Great fishing day',
  ...overrides,
});

export const createMockWeatherLog = (overrides = {}) => ({
  id: 1,
  tripId: 1,
  timeOfDay: 'Morning',
  sky: 'Clear',
  windCondition: 'Light',
  windDirection: 'NE',
  waterTemp: '18°C',
  airTemp: '22°C',
  ...overrides,
});

export const createMockFishCaught = (overrides = {}) => ({
  id: 1,
  tripId: 1,
  species: 'Rainbow Trout',
  length: '45cm',
  weight: '2.5kg',
  time: '10:30',
  gear: ['Spinner', 'Light Rod'],
  details: 'Caught near the rocks',
  ...overrides,
});

export const createMockTackleItem = (overrides = {}) => ({
  id: 1,
  name: 'Test Lure',
  brand: 'Test Brand',
  type: 'Lure',
  colour: 'Red',
  ...overrides,
});

export const createMockGearType = (overrides = {}) => ({
  id: 1,
  name: 'Lures',
  ...overrides,
});

export const createMockUserLocation = (overrides = {}) => ({
  lat: -38.7372,
  lon: 176.0851,
  name: 'Taupo, New Zealand',
  ...overrides,
});

// Mock API responses
export const createMockWeatherResponse = (overrides = {}) => ({
  daily: {
    temperature_2m_max: [22, 24, 21],
    temperature_2m_min: [12, 14, 11],
    windspeed_10m_max: [15, 20, 12],
    winddirection_10m_dominant: [180, 200, 160],
    ...overrides,
  },
});

// Helper functions for testing
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
  };
};

export const mockIndexedDB = () => {
  const mockDatabase = {
    transaction: vi.fn(),
    close: vi.fn(),
    objectStoreNames: {
      contains: vi.fn(() => false),
    },
    createObjectStore: vi.fn(),
    deleteObjectStore: vi.fn(),
  };

  const mockTransaction = {
    objectStore: vi.fn(),
    oncomplete: null as any,
    onerror: null as any,
    error: null,
  };

  const mockObjectStore = {
    add: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    index: vi.fn(),
    createIndex: vi.fn(),
    openCursor: vi.fn(),
  };

  const mockIndex = {
    getAll: vi.fn(),
    openCursor: vi.fn(),
  };

  const mockRequest = {
    onsuccess: null as any,
    onerror: null as any,
    result: null as any,
    error: null,
  };

  const mockOpenRequest = {
    ...mockRequest,
    onupgradeneeded: null as any,
  };

  mockDatabase.transaction.mockReturnValue(mockTransaction);
  mockTransaction.objectStore.mockReturnValue(mockObjectStore);
  mockObjectStore.index.mockReturnValue(mockIndex);
  mockObjectStore.add.mockReturnValue(mockRequest);
  mockObjectStore.get.mockReturnValue(mockRequest);
  mockObjectStore.getAll.mockReturnValue(mockRequest);
  mockObjectStore.put.mockReturnValue(mockRequest);
  mockObjectStore.delete.mockReturnValue(mockRequest);
  mockIndex.getAll.mockReturnValue(mockRequest);

  return {
    mockDatabase,
    mockTransaction,
    mockObjectStore,
    mockIndex,
    mockRequest,
    mockOpenRequest,
  };
};

export const mockGeolocation = () => ({
  getCurrentPosition: vi.fn((success, error) => {
    success({
      coords: {
        latitude: -38.7372,
        longitude: 176.0851,
        accuracy: 10,
      },
    });
  }),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
});

export const mockFetch = (response: any, ok = true) => {
  return vi.fn(() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  );
};

// Wait for async operations in tests
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock file for file upload tests
export const createMockFile = (name: string, content: string, type = 'text/plain') => {
  const file = new File([content], name, { type });
  return file;
};

// Mock image for photo upload tests
export const createMockImage = (name: string = 'test.jpg') => {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  
  return new Promise<File>((resolve) => {
    canvas.toBlob((blob) => {
      const file = new File([blob!], name, { type: 'image/jpeg' });
      resolve(file);
    }, 'image/jpeg');
  });
};

// Helper to trigger file input change
export const triggerFileInput = (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, 'files', {
    value: files,
    writable: false,
  });
  
  const event = new Event('change', { bubbles: true });
  input.dispatchEvent(event);
};

// Mock date for consistent testing
export const mockDate = (date: string | Date) => {
  const mockDate = new Date(date);
  vi.setSystemTime(mockDate);
  return mockDate;
};

// Cleanup helper
export const cleanup = () => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
};