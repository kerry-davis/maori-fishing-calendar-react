import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  useLocalStorage, 
  useTheme, 
  useLocationStorage, 
  useTackleBoxStorage, 
  useGearTypesStorage 
} from '../useLocalStorage';
import type { UserLocation, TackleItem } from '../../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get store() {
      return store;
    },
    set store(newStore: Record<string, string>) {
      store = newStore;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    localStorageMock.store = {};
    // Reset localStorage mock implementation
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      localStorageMock.store[key] = value;
    });
    localStorageMock.getItem.mockImplementation((key: string) => {
      return localStorageMock.store[key] || null;
    });
    localStorageMock.removeItem.mockImplementation((key: string) => {
      delete localStorageMock.store[key];
    });
  });

  describe('useLocalStorage generic hook', () => {
    it('should return default value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      
      expect(result.current[0]).toBe('default');
      expect(result.current[3]).toBeNull(); // no error
    });

    it('should return stored value when localStorage has data', () => {
      localStorageMock.store['test-key'] = JSON.stringify('stored-value');
      
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      
      expect(result.current[0]).toBe('stored-value');
    });

    it('should update localStorage when setValue is called', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      
      act(() => {
        result.current[1]('new-value');
      });
      
      expect(result.current[0]).toBe('new-value');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('new-value'));
    });

    it('should handle function updates', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 10));
      
      act(() => {
        result.current[1](prev => prev + 5);
      });
      
      expect(result.current[0]).toBe(15);
    });

    it('should remove value when removeValue is called', () => {
      localStorageMock.store['test-key'] = JSON.stringify('stored-value');
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      
      act(() => {
        result.current[2](); // removeValue
      });
      
      expect(result.current[0]).toBe('default');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle JSON parsing errors gracefully', () => {
      localStorageMock.store['test-key'] = 'invalid-json';
      
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      
      expect(result.current[0]).toBe('default');
    });

    it('should handle localStorage setItem errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      
      // Mock setItem to throw error after hook is initialized
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });
      
      act(() => {
        result.current[1]('new-value');
      });
      
      expect(result.current[3]).toContain('Error setting localStorage key');
      consoleSpy.mockRestore();
    });
  });

  describe('useTheme', () => {
    it('should return false for isDark when no theme is stored', () => {
      const { result } = renderHook(() => useTheme());
      
      expect(result.current[0]).toBe(false); // isDark
      expect(result.current[2]).toBeNull(); // no error
    });

    it('should return true for isDark when dark theme is stored', () => {
      localStorageMock.store['theme'] = JSON.stringify('dark');
      
      const { result } = renderHook(() => useTheme());
      
      expect(result.current[0]).toBe(true);
    });

    it('should toggle theme correctly', () => {
      const { result } = renderHook(() => useTheme());
      
      act(() => {
        result.current[1](); // toggleTheme
      });
      
      expect(result.current[0]).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', JSON.stringify('dark'));
    });

    it('should apply dark class to document element', () => {
      localStorageMock.store['theme'] = JSON.stringify('dark');
      
      const { result } = renderHook(() => useTheme());
      
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(result.current[0]).toBe(true); // Verify the hook also returns true
    });

    it('should initialize theme based on system preference when no saved theme', () => {
      // Mock matchMedia to return true for dark preference
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme());
      
      // Should initialize to dark based on system preference
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', JSON.stringify('dark'));
    });
  });

  describe('useLocationStorage', () => {
    it('should return null when no location is stored', () => {
      const { result } = renderHook(() => useLocationStorage());
      
      expect(result.current[0]).toBeNull();
    });

    it('should return stored location', () => {
      const location: UserLocation = { lat: -36.8485, lon: 174.7633, name: 'Auckland' };
      localStorageMock.store['userLocation'] = JSON.stringify(location);
      
      const { result } = renderHook(() => useLocationStorage());
      
      expect(result.current[0]).toEqual(location);
    });

    it('should update location', () => {
      const { result } = renderHook(() => useLocationStorage());
      const newLocation: UserLocation = { lat: -41.2865, lon: 174.7762, name: 'Wellington' };
      
      act(() => {
        result.current[1](newLocation);
      });
      
      expect(result.current[0]).toEqual(newLocation);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('userLocation', JSON.stringify(newLocation));
    });
  });

  describe('useTackleBoxStorage', () => {
    it('should return empty array when no tackle box data is stored', () => {
      const { result } = renderHook(() => useTackleBoxStorage());
      
      expect(result.current[0]).toEqual([]);
    });

    it('should return stored tackle box data', () => {
      const tackleItems: TackleItem[] = [
        { id: 1, name: 'Test Lure', brand: 'Test Brand', type: 'Lure', colour: 'Red' }
      ];
      localStorageMock.store['tacklebox'] = JSON.stringify(tackleItems);
      
      const { result } = renderHook(() => useTackleBoxStorage());
      
      expect(result.current[0]).toEqual(tackleItems);
    });

    it('should update tackle box data', () => {
      const { result } = renderHook(() => useTackleBoxStorage());
      const newItems: TackleItem[] = [
        { id: 1, name: 'New Lure', brand: 'New Brand', type: 'Lure', colour: 'Blue' }
      ];
      
      act(() => {
        result.current[1](newItems);
      });
      
      expect(result.current[0]).toEqual(newItems);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('tacklebox', JSON.stringify(newItems));
    });

    it('should handle function updates for tackle box', () => {
      const initialItems: TackleItem[] = [
        { id: 1, name: 'Test Lure', brand: 'Test Brand', type: 'Lure', colour: 'Red' }
      ];
      localStorageMock.store['tacklebox'] = JSON.stringify(initialItems);
      
      const { result } = renderHook(() => useTackleBoxStorage());
      
      act(() => {
        result.current[1](prev => [
          ...prev,
          { id: 2, name: 'New Lure', brand: 'New Brand', type: 'Lure', colour: 'Blue' }
        ]);
      });
      
      expect(result.current[0]).toHaveLength(2);
      expect(result.current[0][1].name).toBe('New Lure');
    });
  });

  describe('useGearTypesStorage', () => {
    it('should return default gear types when no data is stored', () => {
      const { result } = renderHook(() => useGearTypesStorage());
      
      expect(result.current[0]).toEqual(['Lure', 'Rod', 'Reel']);
    });

    it('should return stored gear types', () => {
      const gearTypes = ['Lure', 'Rod', 'Reel', 'Net'];
      localStorageMock.store['gearTypes'] = JSON.stringify(gearTypes);
      
      const { result } = renderHook(() => useGearTypesStorage());
      
      expect(result.current[0]).toEqual(gearTypes);
    });

    it('should update gear types', () => {
      const { result } = renderHook(() => useGearTypesStorage());
      const newGearTypes = ['Lure', 'Rod', 'Reel', 'Bait', 'Net'];
      
      act(() => {
        result.current[1](newGearTypes);
      });
      
      expect(result.current[0]).toEqual(newGearTypes);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('gearTypes', JSON.stringify(newGearTypes));
    });

    it('should handle function updates for gear types', () => {
      const { result } = renderHook(() => useGearTypesStorage());
      
      act(() => {
        result.current[1](prev => [...prev, 'Sinker']);
      });
      
      expect(result.current[0]).toContain('Sinker');
      expect(result.current[0]).toHaveLength(4);
    });
  });

  describe('storage event handling', () => {
    it('should update value when storage event is fired', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      
      // Create a custom event since StorageEvent constructor is problematic in test environment
      const storageEvent = new Event('storage') as StorageEvent;
      Object.defineProperty(storageEvent, 'key', { value: 'test-key' });
      Object.defineProperty(storageEvent, 'newValue', { value: JSON.stringify('updated-from-another-tab') });
      Object.defineProperty(storageEvent, 'oldValue', { value: JSON.stringify('default') });
      
      act(() => {
        window.dispatchEvent(storageEvent);
      });
      
      expect(result.current[0]).toBe('updated-from-another-tab');
    });

    it('should handle invalid JSON in storage events', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
      
      const storageEvent = new Event('storage') as StorageEvent;
      Object.defineProperty(storageEvent, 'key', { value: 'test-key' });
      Object.defineProperty(storageEvent, 'newValue', { value: 'invalid-json' });
      Object.defineProperty(storageEvent, 'oldValue', { value: JSON.stringify('default') });
      
      act(() => {
        window.dispatchEvent(storageEvent);
      });
      
      expect(result.current[3]).toContain('Error parsing localStorage change');
      consoleSpy.mockRestore();
    });
  });
});