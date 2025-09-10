import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AppProviders, useThemeContext, useLocationContext, useDatabaseContext } from '../index';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

Object.defineProperty(window, 'indexedDB', {
  value: mockIndexedDB
});

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation
});

// Test component that demonstrates all context functionality
function ContextIntegrationTest() {
  const { isDark, toggleTheme } = useThemeContext();
  const { userLocation, setLocation, requestLocation } = useLocationContext();
  const { isReady, error } = useDatabaseContext();

  const handleSetTestLocation = () => {
    setLocation({
      lat: -36.8485,
      lon: 174.7633,
      name: 'Auckland, New Zealand'
    });
  };

  const handleRequestLocation = async () => {
    try {
      await requestLocation();
    } catch (err) {
      console.error('Location request failed:', err);
    }
  };

  return (
    <div>
      <div data-testid="theme-status">{isDark ? 'dark' : 'light'}</div>
      <button data-testid="toggle-theme" onClick={toggleTheme}>
        Toggle Theme
      </button>
      
      <div data-testid="location-status">
        {userLocation ? userLocation.name : 'no-location'}
      </div>
      <button data-testid="set-location" onClick={handleSetTestLocation}>
        Set Test Location
      </button>
      <button data-testid="request-location" onClick={handleRequestLocation}>
        Request Location
      </button>
      
      <div data-testid="database-status">
        {isReady ? 'ready' : 'not-ready'}
      </div>
      <div data-testid="database-error">
        {error || 'no-error'}
      </div>
    </div>
  );
}

describe('Context Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
    
    // Mock localStorage responses
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'theme') return '"light"';
      if (key === 'userLocation') return null;
      return null;
    });
    
    // Mock successful IndexedDB initialization
    const mockDB = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      close: vi.fn(),
    };
    
    const mockRequest = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: mockDB,
    };
    
    mockIndexedDB.open.mockReturnValue(mockRequest);
    
    // Simulate successful database opening
    setTimeout(() => {
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess({ target: mockRequest });
      }
    }, 0);
  });

  it('should integrate all contexts successfully', async () => {
    render(
      <AppProviders>
        <ContextIntegrationTest />
      </AppProviders>
    );

    // Initial state
    expect(screen.getByTestId('theme-status')).toHaveTextContent('light');
    expect(screen.getByTestId('location-status')).toHaveTextContent('no-location');
    expect(screen.getByTestId('database-error')).toHaveTextContent('no-error');

    // Test theme toggle
    await act(async () => {
      screen.getByTestId('toggle-theme').click();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', '"dark"');

    // Test location setting
    await act(async () => {
      screen.getByTestId('set-location').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('location-status')).toHaveTextContent('Auckland, New Zealand');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'userLocation',
      JSON.stringify({
        lat: -36.8485,
        lon: 174.7633,
        name: 'Auckland, New Zealand'
      })
    );
  });

  it('should handle geolocation requests', async () => {
    // Mock successful geolocation
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: -41.2865,
          longitude: 174.7762,
          accuracy: 10
        }
      });
    });

    // Mock fetch for weather API validation
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });

    render(
      <AppProviders>
        <ContextIntegrationTest />
      </AppProviders>
    );

    await act(async () => {
      screen.getByTestId('request-location').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('location-status')).toHaveTextContent('-41.2865, 174.7762');
    });

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
  });

  it('should handle geolocation errors gracefully', async () => {
    // Mock geolocation error
    mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
      error({
        code: 1, // PERMISSION_DENIED
        message: 'User denied geolocation'
      });
    });

    render(
      <AppProviders>
        <ContextIntegrationTest />
      </AppProviders>
    );

    await act(async () => {
      screen.getByTestId('request-location').click();
    });

    // Location should remain unchanged
    expect(screen.getByTestId('location-status')).toHaveTextContent('no-location');
  });

  it('should maintain context state across re-renders', async () => {
    const { rerender } = render(
      <AppProviders>
        <ContextIntegrationTest />
      </AppProviders>
    );

    // Set initial state
    await act(async () => {
      screen.getByTestId('toggle-theme').click();
      screen.getByTestId('set-location').click();
    });

    // Rerender component
    rerender(
      <AppProviders>
        <ContextIntegrationTest />
      </AppProviders>
    );

    // State should be maintained
    await waitFor(() => {
      expect(screen.getByTestId('location-status')).toHaveTextContent('Auckland, New Zealand');
    });
  });
});