import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Enhanced localStorage mock with state persistence
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createLocalStorageMock(),
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
  configurable: true,
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock URL.createObjectURL and URL.revokeObjectURL for file handling
global.URL.createObjectURL = vi.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = vi.fn();

// Mock File and FileReader for file upload tests
global.File = class MockFile {
  constructor(
    public chunks: any[],
    public name: string,
    public options: any = {}
  ) {}
  
  get size() {
    return this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  }
  
  get type() {
    return this.options.type || '';
  }
};

global.FileReader = class MockFileReader {
  result: any = null;
  error: any = null;
  readyState: number = 0;
  onload: any = null;
  onerror: any = null;
  onloadend: any = null;
  
  readAsText(file: any) {
    this.readyState = 2;
    this.result = 'mock file content';
    if (this.onload) this.onload({ target: this });
    if (this.onloadend) this.onloadend({ target: this });
  }
  
  readAsDataURL(file: any) {
    this.readyState = 2;
    this.result = 'data:text/plain;base64,bW9jayBmaWxlIGNvbnRlbnQ=';
    if (this.onload) this.onload({ target: this });
    if (this.onloadend) this.onloadend({ target: this });
  }
};

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  BarElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  ArcElement: vi.fn(),
  LineElement: vi.fn(),
  PointElement: vi.fn(),
}));

// Import component mocks
import './mocks/components';

// Mock SunCalc
vi.mock('suncalc', () => {
  const mockSunCalc = {
    getMoonIllumination: vi.fn(() => ({
      fraction: 0.5,
      phase: 0.25,
      angle: 1.5,
    })),
    getMoonPosition: vi.fn(() => ({
      azimuth: 1.2,
      altitude: 0.3,
    })),
    getMoonTimes: vi.fn(() => ({
      rise: new Date('2024-01-15T18:30:00Z'),
      set: new Date('2024-01-16T06:30:00Z'),
    })),
    getTimes: vi.fn(() => ({
      sunrise: new Date('2024-01-15T06:30:00Z'),
      sunset: new Date('2024-01-15T18:30:00Z'),
    })),
  };
  
  return {
    default: mockSunCalc,
    ...mockSunCalc,
  };
});

// Mock PapaParse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn((data, options) => ({
      data: [['header1', 'header2'], ['value1', 'value2']],
      errors: [],
      meta: { fields: ['header1', 'header2'] },
    })),
    unparse: vi.fn((data) => 'header1,header2\nvalue1,value2'),
  },
}));

// Mock JSZip
vi.mock('jszip', () => ({
  default: class MockJSZip {
    files: Record<string, any> = {};
    
    file(name: string, data?: any) {
      if (data !== undefined) {
        this.files[name] = data;
        return this;
      }
      return this.files[name];
    }
    
    generateAsync() {
      return Promise.resolve(new Blob(['mock zip content']));
    }
  },
}));