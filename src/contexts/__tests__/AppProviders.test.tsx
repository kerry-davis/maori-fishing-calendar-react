import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Test component that uses all contexts
function TestComponent() {
  const { isDark } = useThemeContext();
  const { userLocation } = useLocationContext();
  const { isReady, error } = useDatabaseContext();
  
  return (
    <div>
      <span data-testid="theme">{isDark ? 'dark' : 'light'}</span>
      <span data-testid="location">{userLocation ? 'has-location' : 'no-location'}</span>
      <span data-testid="database">{isReady ? 'ready' : 'not-ready'}</span>
      <span data-testid="database-error">{error || 'no-error'}</span>
    </div>
  );
}

describe('AppProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.className = '';
    
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

  it('should provide all contexts to children', async () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'theme') return '"light"';
      if (key === 'userLocation') return null;
      return null;
    });
    
    render(
      <AppProviders>
        <TestComponent />
      </AppProviders>
    );

    // Theme context should work
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    
    // Location context should work (initially no location)
    expect(screen.getByTestId('location')).toHaveTextContent('no-location');
    
    // Database context should work (initially not ready, but no error)
    expect(screen.getByTestId('database-error')).toHaveTextContent('no-error');
  });

  it('should handle context nesting correctly', () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'theme') return '"dark"';
      if (key === 'userLocation') return null;
      return null;
    });
    
    render(
      <AppProviders>
        <TestComponent />
      </AppProviders>
    );

    // All contexts should be available
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('location')).toHaveTextContent('no-location');
    expect(screen.getByTestId('database-error')).toHaveTextContent('no-error');
    
    // Dark theme should be applied to document
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});