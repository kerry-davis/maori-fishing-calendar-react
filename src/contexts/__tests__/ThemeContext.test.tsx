import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useThemeContext } from '../ThemeContext';

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

// Test component that uses the theme context
function TestComponent() {
  const { isDark, toggleTheme } = useThemeContext();
  
  return (
    <div>
      <span data-testid="theme-status">{isDark ? 'dark' : 'light'}</span>
      <button data-testid="toggle-theme" onClick={toggleTheme}>
        Toggle Theme
      </button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document classes
    document.documentElement.className = '';
  });

  it('should provide theme context to children', () => {
    localStorageMock.getItem.mockReturnValue('"light"');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-status')).toHaveTextContent('light');
  });

  it('should toggle theme when toggleTheme is called', async () => {
    localStorageMock.getItem.mockReturnValue('"light"');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const toggleButton = screen.getByTestId('toggle-theme');
    const themeStatus = screen.getByTestId('theme-status');

    expect(themeStatus).toHaveTextContent('light');

    await act(async () => {
      toggleButton.click();
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', '"dark"');
  });

  it('should apply dark class to document when theme is dark', () => {
    localStorageMock.getItem.mockReturnValue('"dark"');
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useThemeContext must be used within a ThemeProvider');
    
    consoleSpy.mockRestore();
  });
});